import React from "react";
import { Link } from "react-router-dom";

// LEGAL NOTICE: This document is a starting-point template for a time recording SaaS.
// Have a qualified attorney review and customise these terms before accepting real customers.

const EFFECTIVE_DATE = "June 14, 2026";
const COMPANY_NAME = "TimeCaptcha";
const CONTACT_EMAIL = "support@timecaptcha.com"; // update before go-live

export default function TermsOfService() {
  return (
    <div className="container" style={{ maxWidth: 820 }}>
      <h1 className="pageTitle">Terms of Service &amp; Acceptable Use Policy</h1>
      <p className="pageSubtitle">Effective date: {EFFECTIVE_DATE}</p>

      <div className="card" style={{ lineHeight: 1.7 }}>

        {/* ── 1. Acceptance ── */}
        <h2 style={{ marginTop: 0 }}>1. Acceptance of Terms</h2>
        <p>
          By creating an account, joining a facility workspace, or using any feature of the{" "}
          <strong>{COMPANY_NAME}</strong> platform ("Service"), you ("User") agree to be bound
          by these Terms of Service (&quot;Terms&quot;). If you are agreeing on behalf of an
          employer, organisation, or other legal entity ("Organisation"), you represent that
          you have the authority to bind that Organisation to these Terms. If you do not agree,
          do not use the Service.
        </p>

        {/* ── 2. Description of Service ── */}
        <h2>2. Description of Service</h2>
        <p>
          {COMPANY_NAME} is a cloud-based workforce time-recording platform that allows
          organisations to track employee shift start and end times, manage job assignments,
          review time logs, and generate payroll-ready data exports. The Service is intended
          for lawful employment and workforce-management purposes only.
        </p>
        <p>
          <strong>Payroll disclaimer:</strong> {COMPANY_NAME} is a time-recording tool, not a
          payroll engine. Hours and gross-pay previews shown in the Service are for reference
          only. Final payroll calculations, tax withholdings, deductions, and payments must be
          performed and verified by a licensed payroll provider or qualified payroll
          professional. {COMPANY_NAME} accepts no liability for payroll errors arising from
          reliance on in-app estimates.
        </p>

        {/* ── 3. Acceptable Use ── */}
        <h2>3. Acceptable Use Policy</h2>
        <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must <strong>not</strong>:</p>
        <ul>
          <li>Record, alter, or delete time entries in a way that misrepresents actual hours worked (time-sheet fraud).</li>
          <li>Use the Service to track individuals without their knowledge where notice or consent is required by applicable law.</li>
          <li>Share account credentials or allow unauthorised persons to access your facility workspace.</li>
          <li>Attempt to reverse-engineer, scrape, or access the Service by automated means not expressly authorised.</li>
          <li>Upload or transmit malicious code, spam, or content that infringes third-party rights.</li>
          <li>Use the Service in any way that violates applicable federal, state, or local laws or regulations.</li>
        </ul>
        <p>
          Violation of this Acceptable Use Policy may result in immediate suspension or
          termination of your account without refund.
        </p>

        {/* ── 4. Employer Responsibilities ── */}
        <h2>4. Employer Responsibilities</h2>
        <p>
          If you are using the Service as an employer or on behalf of an employer, you are
          solely responsible for:
        </p>
        <ul>
          <li>
            <strong>Wage and hour law compliance.</strong> Ensuring that time records, overtime
            calculations, break tracking, and pay practices comply with all applicable federal,
            state, and local wage and hour laws (including the Fair Labor Standards Act and
            applicable state equivalents).
          </li>
          <li>
            <strong>Record-keeping obligations.</strong> Maintaining accurate employment and
            payroll records as required by law. Time data exported from {COMPANY_NAME} should
            be reviewed and approved by a responsible manager before payroll processing.
          </li>
          <li>
            <strong>Correction of errors.</strong> Promptly correcting any inaccurate time
            entries. {COMPANY_NAME} provides missed-punch request workflows to support this
            process, but final approval and correction remain the employer&apos;s responsibility.
          </li>
          <li>
            <strong>Plan and feature suitability.</strong> Selecting a subscription plan whose
            features meet your operational requirements. {COMPANY_NAME} does not warrant that
            any particular plan is suitable for your industry or regulatory environment.
          </li>
        </ul>

        {/* ── 5. Employee Notice & Consent ── */}
        <h2>5. Employee Notice and Monitoring Disclosure</h2>
        <p>
          Many jurisdictions require employers to inform employees that their work time and
          location (if geofencing is enabled) is being recorded electronically. As an employer
          using this Service, you are responsible for:
        </p>
        <ul>
          <li>
            Providing employees with any legally required notice that their shift times are
            being recorded by an electronic system.
          </li>
          <li>
            Obtaining any consent required by applicable law before enabling location-based
            features such as geofenced clock-in or clock-out.
          </li>
          <li>
            Ensuring employees understand how to submit missed-punch correction requests if
            their recorded time is inaccurate.
          </li>
        </ul>
        <p>
          {COMPANY_NAME} is not responsible for an employer&apos;s failure to provide required
          employee notices.
        </p>

        {/* ── 6. Data Accuracy ── */}
        <h2>6. Data Accuracy Disclaimer</h2>
        <p>
          {COMPANY_NAME} records punch times as submitted by users or device events. The
          accuracy of time records depends on factors outside our control, including device
          clock accuracy, network latency, user input, and employer approval workflows.{" "}
          <strong>
            {COMPANY_NAME} makes no warranty that recorded times are accurate, complete, or
            suitable for any particular legal or payroll purpose.
          </strong>{" "}
          Employers must review and approve time records before relying on them for payroll or
          legal compliance.
        </p>

        {/* ── 7. Account Security ── */}
        <h2>7. Account Security</h2>
        <p>
          You are responsible for maintaining the security of your account credentials.
          Administrators must promptly deactivate access for staff who leave the organisation.
          {COMPANY_NAME} will not be liable for any loss or damage arising from unauthorised
          access to your account caused by your failure to maintain adequate security.
        </p>

        {/* ── 8. Subscription and Billing ── */}
        <h2>8. Subscription and Billing</h2>
        <p>
          Certain features of the Service require a paid subscription. Subscription fees are
          billed in advance on a monthly basis through Stripe. By subscribing you authorise us
          to charge your selected payment method on a recurring basis. Subscriptions
          automatically renew unless cancelled before the renewal date through the Billing
          section of the Admin Dashboard.
        </p>
        <p>
          Fees are non-refundable except where required by applicable law. Downgrading or
          cancelling a plan takes effect at the end of the current billing period. Feature
          access (such as data management and payroll) is gated by plan tier as described on
          the pricing page.
        </p>

        {/* ── 9. Intellectual Property ── */}
        <h2>9. Intellectual Property</h2>
        <p>
          The Service, including its software, design, and content, is owned by{" "}
          {COMPANY_NAME} and protected by applicable intellectual property laws. These Terms do
          not grant you any right to use {COMPANY_NAME}&apos;s name, logo, or trademarks. Your
          time and workforce data remains yours; you grant {COMPANY_NAME} a limited licence to
          process it solely to provide the Service.
        </p>

        {/* ── 10. Limitation of Liability ── */}
        <h2>10. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {COMPANY_NAME} and its operators shall not
          be liable for any indirect, incidental, special, consequential, or punitive damages,
          including loss of profits, data, or business opportunities, arising out of or in
          connection with the Service or these Terms, even if advised of the possibility of
          such damages.
        </p>
        <p>
          Our total cumulative liability for any claim arising out of or relating to the
          Service shall not exceed the total fees paid by you to {COMPANY_NAME} in the three
          (3) months preceding the claim.
        </p>

        {/* ── 11. Termination ── */}
        <h2>11. Termination</h2>
        <p>
          Either party may terminate the agreement at any time. {COMPANY_NAME} may suspend or
          terminate your account for violation of these Terms, non-payment, or inactivity
          exceeding 12 months. Upon termination, your access to the Service will cease and
          your data may be deleted after a 30-day grace period, subject to legal retention
          requirements.
        </p>

        {/* ── 12. Changes to Terms ── */}
        <h2>12. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. We will notify you by posting the new
          Terms on this page with a revised effective date. Continued use of the Service after
          changes take effect constitutes your acceptance of the revised Terms. If you do not
          agree to the updated Terms, you must stop using the Service and cancel your
          subscription.
        </p>

        {/* ── 13. Governing Law ── */}
        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the laws of the United
          States and the state in which {COMPANY_NAME} is registered, without regard to
          conflict-of-law principles. Any disputes arising under these Terms shall be resolved
          in the courts of that jurisdiction.
        </p>

        {/* ── 14. Contact ── */}
        <h2>14. Contact</h2>
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
        <p>
          See also our <Link to="/privacy">Privacy Policy</Link>.
        </p>

      </div>
    </div>
  );
}
