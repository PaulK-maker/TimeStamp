import React from "react";

const TimeLogsTable = ({ logs }) => {
  return (
    <div>
      <h3>Time Logs</h3>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Caregiver</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Total Hours</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.caregiver.firstName} {log.caregiver.lastName}</td>
              <td>{new Date(log.punchIn).toLocaleString()}</td>
              <td>{log.punchOut ? new Date(log.punchOut).toLocaleString() : "-"}</td>
              <td>{log.totalHours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimeLogsTable;