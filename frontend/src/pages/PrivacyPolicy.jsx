import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="container">
      <h1 className="pageTitle">Privacy Policy</h1>
      <p className="pageSubtitle">
        This is a general placeholder privacy policy. Update it before production
        use.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Information we collect</h3>
        <p>
          We may collect basic account information (such as email) and time tracking
          data (such as punch-in and punch-out timestamps).
        </p>

        <h3>How we use information</h3>
        <p>
          Information is used to provide the service (authentication, time tracking,
          reporting) and to improve product reliability.
        </p>

        <h3>Local planner notes</h3>
        <p>
          Planner notes created in the Calendar are stored locally in your browser
          (localStorage). They are not synced to the server.
        </p>

        <h3>Contact</h3>
        <p>
          If you have questions about this policy, contact the app administrator.
        </p>
      </div>
    </div>
  );
}
