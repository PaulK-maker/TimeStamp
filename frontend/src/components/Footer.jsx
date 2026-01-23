import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footerInner">
        <div className="footerLinks">
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/calendar">Calendar</Link>
        </div>
        <div className="footerCopy">© {year} TimeCaptcha. All rights reserved.</div>
      </div>
    </footer>
  );
}
