import React, { Component } from "react";
import axios from "axios";
import { Router, Switch, Route } from "react-router-dom";
import history from "./history";
import Home from "./pages/Home";
import Results from "./pages/Results";
import { Modal, message } from "antd";
import HelpModal from "./components/HelpModal";
import StopWatchingModal from "./components/StopWatchingModal";
import { getSeason } from "./utils";
import "./App.css";

class App extends Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      terms: [],
      currTerm: "",
      stopWatchingVisible: false,
      stopWatchingHash: "",
    };
  }

  componentDidMount() {
    axios.get("/terms/").then(res => {
      this.setState({ terms: res.data, currTerm: res.data[2] });
    });
  }

  changeTerm = (term: String) => {
    this.setState({ currTerm: term });
  };

  search = (searchString: string) => {
    history.push(`/results/${this.state.currTerm}/${searchString}`);
  };

  toggleHelp = () => {
    Modal.info({
      icon: "question-circle",
      title: "Help!",
      content: <HelpModal />,
      width: "40vw",
      maskClosable: true
    });
  };

  toggleStopWatching = () => {
    this.setState({ stopWatchingVisible: !this.state.stopWatchingVisible, stopWatchingHash: "" })
  }

  submitStopWatching = () => {
    axios
      .delete(`/remove/${this.state.stopWatchingHash}`)
      .then(res => {
        this.toggleStopWatching();
        if (res.status === 200) {
          message.success('Course unwatched');
        } else {
          message.error('An error occurred');
        }
      })
  }

 public render() {
    return (
      <div className={`App ${getSeason(this.state.currTerm)}`}>
        <StopWatchingModal
          maskClosable={true}
          visible={this.state.stopWatchingVisible}
          title="How should we notify you?"
          onOk={()=>{this.submitStopWatching()}}
          onCancel={this.toggleStopWatching}
          onChange={(e: any) => {
            this.setState({ stopWatchingHash: e });
          }}
          value={this.state.value}
        />
        <Router history={history}>
          <Switch>
            <Route
              path="/results/:term/:courseCode"
              render={props => (
                <Results
                  {...props}
                  terms={this.state.terms}
                  changeTerm={this.changeTerm}
                  search={this.search}
                  help={this.toggleHelp}
                  stopWatching={this.toggleStopWatching}
                />
              )}
            />
            <Route
              render={() => (
                <Home
                  terms={this.state.terms}
                  changeTerm={this.changeTerm}
                  search={this.search}
                  help={this.toggleHelp}
                  stopWatching={this.toggleStopWatching}
                />
              )}
            />
          </Switch>
        </Router>
      </div>
    );
  }
}

export default App;
