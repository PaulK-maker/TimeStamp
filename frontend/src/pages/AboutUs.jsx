import React from "react";

export default function AboutUs() {
  return (
    <div className="container">
      <h1 className="pageTitle">About Us</h1>
      <p className="pageSubtitle">
        TimeStamp is a simple time tracking app designed to help caregivers clock in/out,
        review their shifts, and help admins review logs.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>What we do</h3>
        <p>
          We provide an easy way to track work time and keep a clear record of shift
          history. Our goal is to make time tracking reliable, fast, and easy to
          use.
        </p>

        <h3>What’s next</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Location-aware clock in/out (geofencing)</li>
          <li>Admin reporting and exports</li>
          <li>More scheduling and planning tools</li>
        </ul>
      </div>
    </div>
  );
}
