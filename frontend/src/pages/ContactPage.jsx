import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const SUPPORT_EMAIL = "support@timestamp.com";

function buildMailto({ to, subject, body }) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  return `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
}

export default function ContactPage() {
  const navigate = useNavigate();

  const captcha = useMemo(() => {
    const a = Math.floor(Math.random() * 8) + 1; // 1..9
    const b = Math.floor(Math.random() * 8) + 1; // 1..9
    return { a, b, answer: String(a + b) };
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const inputStyle = {
    width: "100%",
    padding: "10px",
    marginTop: "8px",
    marginBottom: "16px",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    fontFamily: "inherit",
    fontSize: "16px",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (captchaAnswer.trim() !== captcha.answer) {
      setError("Spam check failed. Please answer the question correctly.");
      return;
    }

    const subject = "TimeStamp Inquiry";
    const body = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;
    const mailto = buildMailto({ to: SUPPORT_EMAIL, subject, body });

    setSubmitted(true);

    // Open user's email client
    window.location.href = mailto;

    // Redirect back home shortly after (best-effort)
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 500);
  };

  return (
    <div className="container">
      <h1 className="pageTitle">Contact Us</h1>
      <p className="pageSubtitle">
        Have questions or need support? Send us a message and we’ll get back to you soon.
      </p>

      <div className="card" style={{ maxWidth: 560 }}>
        {error && (
          <p style={{ color: "#b00020", marginTop: 0, marginBottom: 16 }}>
            {error}
          </p>
        )}

        {submitted && !error && (
          <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 16 }}>
            Opening your email client…
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 8 }}>
            <label htmlFor="contact-name" style={{ fontWeight: 600, fontSize: 14 }}>
              Name
            </label>
            <input
              type="text"
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label htmlFor="contact-email" style={{ fontWeight: 600, fontSize: 14 }}>
              Email
            </label>
            <input
              type="email"
              id="contact-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label htmlFor="contact-message" style={{ fontWeight: 600, fontSize: 14 }}>
              Message
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
              placeholder="How can we help?"
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label htmlFor="contact-captcha" style={{ fontWeight: 600, fontSize: 14 }}>
              Spam check: What is {captcha.a} + {captcha.b}?
            </label>
            <input
              type="text"
              id="contact-captcha"
              inputMode="numeric"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              required
              style={inputStyle}
              placeholder="Answer"
            />
          </div>

          <button
            type="submit"
            className="btn btnPrimary"
            style={{ width: "100%", padding: 12, fontSize: 16, fontWeight: 600 }}
          >
            Send Email
          </button>

          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12, marginBottom: 0 }}>
            This will open your default email app.
          </p>
        </form>
      </div>
    </div>
  );
}
