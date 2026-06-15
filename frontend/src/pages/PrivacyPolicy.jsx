import React from "react";
import { Link } from "react-router-dom";

// LEGAL NOTICE: Review with a qualified attorney before accepting real customers.

const EFFECTIVE_DATE = "June 14, 2026";
const COMPANY_NAME = "TimeCaptcha";
const CONTACT_EMAIL = "support@timecaptcha.com"; // update before go-live

export default function PrivacyPolicy() {
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <h1 className="pageTitle">Privacy Policy</h1>
      <p className="pageSubtitle">Effective date: {EFFECTIVE_DATE}</p>

      <div className="card" style={{ lineHeight: 1.7 }}>

        <h2 style={{ marginTop: 0 }}>1. Who We Are</h2>
        <p>
          {COMPANY_NAME} operates a cloud-based workforce time-recording platform ("Service").
          This Privacy Policy explains how we collect, use, and protect information when you
          use the Service. By using the Service you agree to the practices described here.
        </p>

        <h2>2. Information We Collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> Name, email address, and authentication
            credentials managed through Clerk (our identity provider).
          </li>
          <li>
            <strong>Organisation data:</strong> Facility name, tenant code, subscription plan,
            and billing contact information.
          </li>
          <li>
            <strong>Time and workforce data:</strong> Punch-in and punch-out timestamps, job
            assignments, shift notes, missed-punch requests, and administrator-approved
            corrections.
          </li>
          <li>
            <strong>Payroll profile metadata:</strong> Compensation type, pay rate, and
            provider reference identifiers entered by administrators. We do not store SSNs,
            bank account numbers, routing numbers, or tax-withholding details — those remain
            exclusively with your payroll provider.
          </li>
          <li>
            <strong>Usage and technical data:</strong> IP addresses, browser type, device
            identifiers, and server logs collected automatically for security and reliability
            purposes.
          </li>
          <li>
            <strong>Local calendar notes:</strong> Planner notes entered in the Calendar tool
            are stored only in your browser's local storage and are never transmitted to our
            servers.
          </li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To provide and operate the Service (authentication, time tracking, reporting).</li>
          <li>To process subscription billing through Stripe.</li>
          <li>To communicate service updates, billing notices, and support responses.</li>
          <li>To detect, investigate, and prevent fraudulent or abusive use.</li>
          <li>To comply with applicable legal obligations.</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>

        <h2>4. How We Share Your Information</h2>
        <p>We share information only in the following circumstances:</p>
        <ul>
          <li>
            <strong>Service providers:</strong> Trusted third-party vendors (Clerk for
            authentication, Stripe for billing, MongoDB Atlas for database hosting, Render for
            cloud infrastructure) who process data on our behalf under confidentiality
            obligations.
          </li>
          <li>
            <strong>Payroll providers:</strong> If your organisation uses a connected payroll
            integration (such as Gusto), approved time data and payroll profile references may
            be transmitted to that provider at the explicit direction of the administrator.
          </li>
          <li>
            <strong>Legal requirements:</strong> Where disclosure is required by law, court
            order, or to protect the rights and safety of {COMPANY_NAME} or others.
          </li>
          <li>
            <strong>Business transfers:</strong> In connection with a merger, acquisition, or
            sale of assets, with notice to affected users.
          </li>
        </ul>

        <h2>5. Employee Data</h2>
        <p>
          Time and workforce records belong to the employing organisation (the "tenant") and
          are accessible to that organisation's administrators. Employees (staff users) can
          view their own time entries and submit correction requests. Administrators are
          responsible for ensuring that collection and use of employee data complies with
          applicable employment, privacy, and labour laws in their jurisdiction.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain account and time-record data for as long as your organisation's
          subscription is active and for a reasonable period thereafter (up to 12 months) to
          allow for disputes or legal holds. You may request deletion of your organisation's
          data by contacting us. Some data may be retained longer where required by law.
        </p>

        <h2>7. Security</h2>
        <p>
          We implement industry-standard security measures including TLS encryption in
          transit, hashed credentials, access-controlled databases, and environment-level
          secret management. However, no system is completely secure. You are responsible for
          maintaining the confidentiality of your account credentials and for promptly
          reporting any suspected unauthorised access.
        </p>

        <h2>8. Your Rights</h2>
        <p>
          Depending on your jurisdiction you may have rights to access, correct, delete, or
          port your personal data. To exercise these rights, contact us at the address below.
          We will respond within the timeframe required by applicable law.
        </p>

        <h2>9. Cookies</h2>
        <p>
          The Service uses session cookies and local storage for authentication and
          functionality. We do not use third-party advertising cookies. You can configure your
          browser to refuse cookies, but some features of the Service may not function
          correctly as a result.
        </p>

        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Changes will be posted on this
          page with a revised effective date. Continued use of the Service after changes take
          effect constitutes your acceptance of the updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          If you have questions or requests regarding this Privacy Policy, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          See also our <Link to="/terms">Terms of Service</Link>.
        </p>

      </div>
    </div>
  );
}
