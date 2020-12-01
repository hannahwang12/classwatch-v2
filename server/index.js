const express = require('express');
const cors = require('cors');
const path = require('path');
const _ = require('lodash')
const bodyParser = require('body-parser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const mailgunTransport = require('nodemailer-mailgun-transport');
const mailgun = require('./mailgun_auth.js');

const { scraper } = require('./scraper.js');
const { WatchedCourses, UnverifiedCourses } = require('./db/db.js');

const mailgunOptions = {
  auth: {
    api_key: mailgun.api_key,
    domain: 'uwclasswatch.com',
  },
};

const mgtransport = mailgunTransport(mailgunOptions);
const transporter = nodemailer.createTransport(mgtransport);

const URL = 'http://www.uwclasswatch.com';

// Text to cipher
function btoa(text) {
  return Buffer.from(text).toString('base64');
}

// Cipher to text
function atob(cipher) {
  return Buffer.from(cipher, 'base64').toString();
}

// Takes a removal code and decrypts
function decode(removalCode) {
  const decoded = atob(removalCode);
  const array = decoded.split('|');
  return {
    courseCode: array[0],
    sectionNumber: array[1],
    email: array[2],
  };
}

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const getTerms = (date) => {
  let terms = [];
  const currYear = date.getFullYear() % 100;
  const currMonth = date.getMonth() + 1;
  let prev_fall = `1${(currYear - 1).toString()}9`;
  let winter = `1${currYear.toString()}1`;
  let spring = `1${currYear.toString()}5`;
  let fall = `1${currYear.toString()}9`;
  let next_winter = `1${(currYear + 1).toString()}1`;
  let next_spring = `1${(currYear + 1).toString()}5`;
  if (currMonth >= 3 && currMonth < 7) {
    terms = [prev_fall, winter, spring, fall];
  } else if (currMonth >= 7 && currMonth < 11) {
    terms = [winter, spring, fall, next_winter];
  } else {
    terms = [spring, fall, next_winter, next_spring];
  }
  return terms;
};

console.assert(_.isEqual(getTerms(new Date('2020-02')), ['1195', '1199', '1201', '1205']));
console.assert(_.isEqual(getTerms(new Date('2020-06')), ['1199', '1201', '1205', '1209']));
console.assert(_.isEqual(getTerms(new Date('2020-10')), ['1201', '1205', '1209', '1211']));
console.assert(_.isEqual(getTerms(new Date('2020-12')), ['1205', '1209', '1211', '1215']));

app.get('/terms', (req, res) => {
  res.send(getTerms(new Date()));
});

app.get('/search/:term/:subject/:courseNumber', (req, res) => {
  const { term, subject, courseNumber } = req.params;
  scraper(term, subject.toUpperCase(), courseNumber)
    .then((results) => {
      res.send(results);
    })
    .catch(() => {
      res.sendStatus(500);
    });
});

function sendVerification(email, name, sections, hash) {
  const link = `${URL}/verify/${hash}`;
  const mailOptions = {
    from: 'postmaster@uwclasswatch.com',
    to: email,
    subject: 'Verify your choice!',
    html: `<p style="font-size: 16px">You (or someone with your email) has requested to watch ${name}: ${sections}</p>
           <p style="font-size: 15px">Please <a href='${link}'>click on the link</a> to verify your email.</p>
           <p><a href='http://uwclasswatch.com/'>ClassWatch</a> works by scraping UWaterloo's publicly available enrolment numbers, 
              which are updated every half hour between 8:00am and 8:00pm. This application is entirely student-run.</p>`,
  };
  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.log(error);
    }
  });
}

app.post('/watch', (req, res) => {
  const { course, sections, email } = req.body;
  const unverified = sections.map(section => new UnverifiedCourses({
    course_code: course,
    section_number: section,
    email,
    hash: btoa(`${course}|${section}|${email}`),
  }));
  Promise.all(sections.map(section => sendVerification(email, course, section, btoa(`${course}|${section}|${email}`))));
  UnverifiedCourses.insertMany(unverified, (err) => {
    if (err) console.log(err);
  });
  res.sendStatus(200);
});

app.delete('/remove/:removalCode', (req, res) => {
  const { removalCode } = req.params;
  const {
    courseCode, sectionNumber, email,
  } = decode(removalCode);
  WatchedCourses.updateOne(
    { course_code: courseCode },
    { $pull: { 'sections.$[section].emails': { email, removalCode } } },
    { arrayFilters: [{ 'section.section_number': sectionNumber }] },
    (err) => {
      if (err) console.log(err);
    },
  );
  res.sendStatus(200);
});

app.get('/verify/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/src/static/style.css'));
});

app.get('/verify/goose2.jpg', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/src/static/goose2.jpg'));
});

app.get('/verify/:hash', (req, res) => {
  UnverifiedCourses.findOne({ hash: req.params.hash }, (unverifiedFindErr, doc) => {
    // check if the course exists
    if (!doc || unverifiedFindErr) {
      res.sendFile(path.join(__dirname, '../client/src/static/unverified.html'));
      return;
    }
    WatchedCourses.findOne({ course_code: doc.course_code },
      async (watchedCoursesFindErr, foundCourse) => {
      // if it doesn't exist, create new doc for that course
        await UnverifiedCourses.deleteOne(
          { hash: doc.hash },
          (err) => {
            if (err) {
              res.sendFile(path.join(__dirname, '../client/src/static/unverified.html'));
              throw err;
            }
          },
        );
        if (!foundCourse) {
          const createCoursePromise = new Promise((resolve, reject) => {
            WatchedCourses.create({
              course_code: doc.course_code,
            }, (err) => {
              if (err) {
                res.sendFile(path.join(__dirname, '../client/src/static/unverified.html'));
                reject(err);
              }
              resolve();
            });
          });
          await createCoursePromise;
        }
        // check if the section number exists
        WatchedCourses.aggregate([
          { $match: { course_code: doc.course_code } },
          { $unwind: '$sections' },
          { $match: { 'sections.section_number': doc.section_number } },
        ], async (watchedCoursesAggregateErr, foundSection) => {
          // if it doesn't exist, push the section number into the array
          if (!foundSection || !foundSection.length) {
            await WatchedCourses.updateOne(
              { course_code: doc.course_code },
              { $addToSet: { sections: { section_number: doc.section_number, emails: [] } } },
              (err) => {
                if (err) {
                  res.sendFile(path.join(__dirname, '../client/src/static/unverified.html'));
                  throw err;
                }
              },
            );
          }
          // add the email to the array
          WatchedCourses.updateOne(
            { course_code: doc.course_code },
            { $addToSet: { 'sections.$[section].emails': { email: doc.email, hash: doc.hash } } },
            { arrayFilters: [{ 'section.section_number': doc.section_number }] },
            (err) => {
              if (err) {
                res.sendFile(path.join(__dirname, '../client/src/static/unverified.html'));
                throw err;
              }
            },
          );
          res.sendFile(path.join(__dirname, '../client/src/static/verified.html'));
        });
      });
  });
});

const sendNotificationEmail = (email, course, section, hash, enrolTotal, enrolCap) => {
  const mailOptions = {
    from: 'postmaster@uwclasswatch.com',
    to: email,
    subject: `Space available in ${course} ${section}!`,
    html: `<p style="font-size: 16px">The enrolment capacity for this class is currently ${enrolTotal} / ${enrolCap}.\n
           To stop receiving notifications about this class, enter your removal code at <a href='http://www.uwclasswatch.com'>UWClasswatch</a>.</p>
           <p style="font-size: 15px">Your removal code for this class is: ${hash}</p>
           <p><a href='http://uwclasswatch.com/'>UWClassWatch</a> works by scraping UWaterloo's publicly available enrolment numbers, 
              which are updated every half hour between 8:00am and 8:00pm. This application is entirely student-run.</p>`,
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.log(error);
    }
  });
};

const checkCourses = async () => {
  const watchedCourses = await WatchedCourses.find();
  const courses = watchedCourses.map(course => ({
    subject: course.course_code.match(/[A-z]+/)[0].trim(),
    number: course.course_code.match(/\d+./)[0].trim(),
    sections: course.sections,
  }));
  return Promise.all(
    courses.map(async (course) => {
      const results = await scraper(getTerms()[2], course.subject, course.number);
      course.sections.forEach((section) => {
        const sectionInfo = results.filter(elem => elem.section === section.section_number)[0];
        if ((sectionInfo.reserve && sectionInfo.reserveEnrolTotal < sectionInfo.reserveEnrolCap)
        || (!sectionInfo.reserve && sectionInfo.enrolTotal < sectionInfo.enrolCap)) {
          section.emails.map(email => sendNotificationEmail(
            email.email, `${course.subject}${course.number}`, section.section_number, email.hash,
            sectionInfo.reserve ? sectionInfo.reserveEnrolTotal : sectionInfo.enrolTotal,
            sectionInfo.reseve ? sectionInfo.reserveEnrolCap : sectionInfo.enrolCap,
          ));
        }
      });
    }),
  );
};

cron.schedule('1,31 8-20 * * *', () => {
  checkCourses();
}, {
  timezone: 'America/New_York',
});


app.listen(port);
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, '../client/build/') });
});
