import React, { Component } from "react";
import { Link } from "react-router-dom";
import { HelpCircle } from "react-feather";
import Search from "../components/Search";
import ResultsTable from "../components/ResultsTable";
import "./Results.css";
import axios from "axios";
import _ from "lodash";

interface IProps {
  changeTerm: (term: string) => void;
  help: () => void;
  history?: any;
  location?: any;
  match?: any;
  search: (searchString: string) => void;
}

class Results extends Component<any, any> {
  constructor(props: IProps) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    this.fetchResults();
  }

  componentWillReceiveProps(nextProps: IProps) {
    if (!_.isEqual(this.props, nextProps)) {
      this.fetchResults();
    }
  }

  fetchResults = () => {
    const {
      term,
      courseCode
    }: { term: number; courseCode: string } = this.props.match.params;
    const { subject, courseNumber } = this.getCourse(courseCode);

    axios
      .get(`http://localhost:3001/search/${term}/${subject}/${courseNumber}`)
      .then(res => {
        this.setState({
          results: res.data,
          course: `${subject.toUpperCase()}${courseNumber}`
        });
      });
  };

  getCourse = (
    courseCode: string
  ): { subject: string; courseNumber: string } => {
    const subjectMatch: RegExpMatchArray | null = courseCode.match(/[A-z]+/);
    const courseNumberMatch: RegExpMatchArray | null = courseCode.match(/\d+./);
    return {
      subject: subjectMatch ? subjectMatch[0].trim() : "",
      courseNumber: courseNumberMatch ? courseNumberMatch[0].trim() : ""
    };
  };

  parse_results = (results: [any]): any[] => {
    let newResults: any[] = [];
    if (!results) {
      return newResults;
    }
    for (let i = 0; i < results.length; i++) {
      if (!results[i].reserve && results[i + 1] && results[i + 1].reserve) {
        var reserve_enrol_total = 0;
        var reserve_enrol_cap = 0;
        let temp_index = i + 1;
        while (results[temp_index] && results[temp_index].reserve) {
          reserve_enrol_cap += results[temp_index].reserve_enrol_cap;
          reserve_enrol_total += results[temp_index].reserve_enrol_total;
          temp_index++;
        }
        newResults.push(results[i]);
        if (results[i].enrol_cap - reserve_enrol_cap > 0) {
          newResults.push({
            section: `${results[i].section} RES0`,
            reserve: "Not reserved",
            reserve_enrol_cap: results[i].enrol_cap - reserve_enrol_cap,
            reserve_enrol_total: results[i].enrol_total - reserve_enrol_total,
            instructor: results[i].instructor,
            time: results[i].time,
            days: results[i].days,
            date: results[i].date
          });
        }
      } else {
        newResults.push(results[i]);
      }
    }
    return newResults;
  };

  render() {
    this.parse_results(this.state.results);
    return (
      <div className="results-page">
        <div className="top-bar">
          <Link className="title" to="/">
            ClassWatch.
          </Link>
          <Search
            className="search"
            terms={this.props.terms}
            changeTerm={this.props.changeTerm}
            search={this.props.search}
          />
          <HelpCircle id="help-icon" onClick={this.props.help} />
        </div>
        <ResultsTable results={this.parse_results(this.state.results)} />
      </div>
    );
  }
}

export default Results;
