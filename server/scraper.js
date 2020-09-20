const request = require('request-promise');
const cheerio = require('cheerio');

const parseData = async ($, term, subject, courseNumber) => {
  const courseTitle = $(
    'body > main > p:nth-child(3) > table > tbody > tr:nth-child(2) > td:nth-child(4)',
  ).text();
  let firstResult = true;
  const classes = $('table table:first-of-type > tbody > tr')
    .slice(1)
    .filter((index, row) => {
      const section = $(row)
        .find(':nth-child(2)')
        .text()
        .trim();
      if (section === 'Comp Sec') {
        firstResult = false;
      }
      const type = section.substring(0, 3);
      return /* (type != 'TST') && */ firstResult;
    })
    .map((index, row) => {
      if (
        $(row)
          .find('i')
          .text()
          .indexOf('Reserve') >= 0
      ) {
        const reserve = $(row)
          .find('i')
          .text();
        const reserveEnrolCap = $(row)
          .find(':nth-child(2)')
          .text()
          .trim();
        const reserveEnrolTotal = $(row)
          .find(':nth-child(3)')
          .text()
          .trim();
        let section;
        let i = 0;
        while (!/[A-Z]{3} \d{3}/.test(section)) {
          section = $(`table table > tbody > tr:nth-child(${index + 1 - i})`)
            .find(':nth-child(2)')
            .text()
            .trim();
          i += 1;
        }
        const instructorLastName = $(row)
          .find(':nth-child(8)')
          .text()
          .split(',')[0]
          .trim();
        let instructorFirstName = '';
        if (instructorLastName !== '') {
          instructorFirstName = $(row)
            .find(':nth-child(8)')
            .text()
            .split(',')[1]
            .trim();
        }
        const timeAndDays = $(row)
          .find(':nth-child(6)')
          .text()
          .trim();
        const time = timeAndDays.substring(0, 11);
        const days = timeAndDays.substring(11).match(/([A-Z][a-z]*)/g);
        const date = timeAndDays.match(/\d\d\/\d\d/);
        return {
          section: `${section} RES${i}`,
          reserve,
          reserveEnrolCap,
          reserveEnrolTotal,
          instructor: `${instructorFirstName} ${instructorLastName}`,
          time,
          days,
          date,
        };
      }
      const section = $(row)
        .find(':nth-child(2)')
        .text()
        .trim();
      const type = section.substring(0, 3);
      const instructorLastName = $(row)
        .find(':nth-child(13)')
        .text()
        .split(',')[0]
        .trim();
      let instructorFirstName = '';
      if (instructorLastName !== '') {
        instructorFirstName = $(row)
          .find(':nth-child(13)')
          .text()
          .split(',')[1]
          .trim();
      }
      const enrolCap = $(row)
        .find(':nth-child(7)')
        .text()
        .trim();
      const enrolTotal = $(row)
        .find(':nth-child(8)')
        .text()
        .trim();
      const waitCap = $(row)
        .find(':nth-child(9)')
        .text()
        .trim();
      const waitTotal = $(row)
        .find(':nth-child(10)')
        .text()
        .trim();
      const campus = $(row)
        .find(':nth-child(3)')
        .text()
        .trim();
      const location = $(row)
        .find(':nth-child(12)')
        .text()
        .trim();
      const timeAndDays = $(row)
        .find(':nth-child(11)')
        .text()
        .trim();
      const time = timeAndDays.substring(0, 11);
      const days = timeAndDays.substring(11).match(/([A-Z][a-z]*)/g);
      const date = timeAndDays.match(/\d\d\/\d\d/);
      return {
        courseCode: `${subject} ${courseNumber}`,
        courseTitle,
        section,
        type,
        instructor: `${instructorFirstName} ${instructorLastName}`,
        enrolCap,
        enrolTotal,
        location,
        time,
        days,
        date,
        term,
      };
    })
    .toArray();
  return classes;
};

const scrapeData = async (term, subject, courseNumber) => {
  const headers = {
    Origin: 'https://classes.uwaterloo.ca/',
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  };
  const form = {
    level: 'under',
    sess: term,
    subject,
    cournum: courseNumber,
  };
  const body = await request.post({
    url: 'https://classes.uwaterloo.ca/cgi-bin/cgiwrap/infocour/salook.pl?',
    form,
    headers,
  });
  if (/sorry, but your query had no matches/i.test(body)) {
    return [
      {
        courseCode: `${subject} ${courseNumber}`,
        term,
      },
    ];
  }
  const $ = cheerio.load(body, { lowerCaseTags: true });
  return parseData($, term, subject, courseNumber);
};

exports.scraper = scrapeData;
