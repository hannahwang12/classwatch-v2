import React, { Component } from "react";

class ResultsRow extends Component<any, any> {
  render() {
    const rowData = this.props.row;
    if (rowData.reserve && rowData.date) {
      console.log("date");
      return (
        <tr className="reserveRow">
          <td>
            <label className="container">
              <input
                className="checkbox"
                type="checkbox"
                name="sections[]"
                value={rowData.section}
              />
              <span className="checkmark" />
            </label>
          </td>
          <td className="reserveCell">{rowData.reserve}</td>
          <td>{rowData.instructor}</td>
          <td>
            {rowData.days ? rowData.days.toString().replace(/,/g, ", ") : null}{" "}
            {rowData.date ? rowData.date[0] : null}
          </td>
          <td>{rowData.time}</td>
          <td>{rowData.location}</td>
          <td>
            {rowData.reserve_enrol_total} / {rowData.reserve_enrol_cap}
          </td>
        </tr>
      );
    } else if (rowData.reserve) {
      //console.log('reserve');
      return (
        <tr className="reserveRow">
          <td>
            <label className="container">
              <input
                className="checkbox"
                type="checkbox"
                name="sections[]"
                value={rowData.section}
              />
              <span className="checkmark" />
            </label>
          </td>
          <td colSpan={5} className="reserveCell">
            {rowData.reserve}
          </td>
          <td>
            {rowData.reserve_enrol_total} / {rowData.reserve_enrol_cap}
          </td>
        </tr>
      );
    } else if (!rowData.enrol_cap) {
      return (
        <tr className="reserveRow">
          <td />
          <td />
          <td>{rowData.instructor}</td>
          <td>
            {rowData.days ? rowData.days.toString().replace(/,/g, ", ") : null}{" "}
            {rowData.date ? rowData.date[0] : null}
          </td>
          <td>{rowData.time}</td>
          <td>{rowData.location}</td>
          <td />
        </tr>
      );
    } else {
      return (
        <tr>
          <td>
            <label className="container">
              <input
                className="checkbox"
                type="checkbox"
                name="sections[]"
                value={rowData.section}
              />
              <span className="checkmark" />
            </label>
          </td>
          <td>{rowData.section}</td>
          <td>{rowData.instructor}</td>
          <td>
            {rowData.days ? rowData.days.toString().replace(/,/g, ", ") : null}{" "}
            {rowData.date ? rowData.date[0] : null}
          </td>
          <td>{rowData.time}</td>
          <td>{rowData.location}</td>
          <td>
            {rowData.enrol_total} / {rowData.enrol_cap}
          </td>
        </tr>
      );
    }
  }
}

export default ResultsRow;
