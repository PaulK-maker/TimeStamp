import React from "react";
import { Link } from "react-router-dom";
import { SignedIn } from "@clerk/clerk-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footerInner">
        <div className="footerLinks">
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <SignedIn>
            <Link to="/calendar">Calendar</Link>
          </SignedIn>
        </div>
        <div className="footerCopy">© {year} TimeCaptcha. All rights reserved.</div>
      </div>
    </footer>
  );
}
