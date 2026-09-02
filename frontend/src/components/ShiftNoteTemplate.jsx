import React, { useEffect, useRef, useState } from "react";
import { getMe } from "../services/me";
import api from "../services/api";
import axios from "axios";

const FORM_TYPES = ["Progress Narrative", "Activity", "Report"];

function ruled(count) {
  return Array.from({ length: count }, () =>
    `<div style="border-bottom:1px solid #ccc;min-height:26px;margin-bottom:5px"></div>`
  ).join("");
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printForm({ staffName, formType, layout, notes }) {
  const isPlain = layout === "plain";
  const hasNotes = notes?.trim().length > 0;

  const notesBlock = (label, blankCount) => `
    <div class="label" style="margin-bottom:6px">${label}</div>
    ${hasNotes
      ? `<div style="white-space:pre-wrap;font-size:13px;line-height:1.9;padding:2px 0;margin-bottom:6px">${escapeHtml(notes)}</div>${ruled(3)}`
      : ruled(blankCount)
    }
  `;

  const content = isPlain ? `
    <div class="field" style="margin-bottom:12px">
      <div class="label">Staff Name</div>
      <div class="line">${escapeHtml(staffName)}</div>
    </div>
    ${notesBlock("Notes", 22)}
  ` : `
    <div class="row">
      <div class="field">
        <div class="label">Staff Name</div>
        <div class="line">${escapeHtml(staffName)}</div>
      </div>
      <div class="field">
        <div class="label">Shift From</div>
        <div class="line"></div>
      </div>
      <div class="field">
        <div class="label">Shift To</div>
        <div class="line"></div>
      </div>
    </div>
    <div class="field" style="margin-bottom:14px">
      <div class="label">Client Name</div>
      <div class="line"></div>
    </div>
    ${notesBlock("Notes / Observations", 13)}
  `;

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <html>
    <head>
      <title> </title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          font-family: Arial, sans-serif;
          font-size: 13px;
          color: #000;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          padding: 24px 40px 20px;
        }
        h2    { text-align: center; font-size: 16px; margin-bottom: 14px; }
        .row  { display: flex; gap: 20px; margin-bottom: 14px; }
        .field { flex: 1; }
        .label { font-size: 10px; text-transform: uppercase; color: #555; margin-bottom: 3px; letter-spacing: 0.4px; }
        .line  { border-bottom: 1px solid #000; min-height: 24px; }
        .body  { flex: 1; }
        .sig   { display: flex; gap: 32px; padding-top: 12px; margin-top: auto; }
        .sig .sfield { flex: 2; }
        .sig .dfield { flex: 1; }
        @page  { margin: 0; }
        @media print { body { padding: 0.45in; } }
      </style>
    </head>
    <body>
      <h2>${escapeHtml(formType)}</h2>
      <div class="body">${content}</div>
      <div class="sig">
        <div class="sfield">
          <div class="label">Staff Signature</div>
          <div class="line"></div>
        </div>
        <div class="dfield">
          <div class="label">Date Signed</div>
          <div class="line"></div>
        </div>
      </div>
    </body>
    </html>
  `);

  win.document.close();
  win.print();
}

const isDictationSupported = typeof window !== "undefined" && window.MediaRecorder;

export default function ShiftNoteTemplate() {
  const [staffName, setStaffName]     = useState("");
  const [formType, setFormType]       = useState(FORM_TYPES[0]);
  const [layout, setLayout]           = useState("template");
  const [notes, setNotes]             = useState("");
  const [isListening, setIsListening]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [dictationError, setDictationError] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const durationTimerRef = useRef(null);

  useEffect(() => {
    getMe().then((me) => {
      if (me?.firstName || me?.lastName) {
        setStaffName(`${me.firstName || ""} ${me.lastName || ""}`.trim());
      }
    }).catch(() => {});
  }, []);

  const stopListening = (shouldTranscribe = true) => {
    setIsListening(false);
    clearInterval(durationTimerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      if (!shouldTranscribe) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
      }
      mediaRecorderRef.current.stop();
    }

    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  useEffect(() => () => {
    stopListening(false);
  }, []);

  const startListening = async () => {
    try {
      setDictationError("");
      setRecordDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) return;
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("audio", audioBlob, "dictation.webm");

          const API_BASE_URL =
            process.env.REACT_APP_API_BASE_URL ||
            (typeof window !== "undefined" && window.location.hostname === "localhost"
              ? "http://localhost:5001"
              : "https://api.timecapcha.app");

          const res = await axios.post(`${API_BASE_URL}/api/dictate-file`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 35000,
          });

          const text = res.data?.transcript;
          if (text) {
            setNotes((prev) => {
              const endedWithSpace = prev.endsWith(" ") || prev === "";
              return prev + (endedWithSpace ? "" : " ") + text + " ";
            });
          }
        } catch (err) {
          console.error("Transcription upload failed:", err);
          setDictationError(err?.response?.data?.message || err.message || "Failed to transcribe audio.");
        } finally {
          setIsProcessing(false);
        }
      };

      recorder.start();
      setIsListening(true);

      durationTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("startListening failed:", err);
      setDictationError(err.message || "Failed to start microphone. Please check permission.");
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening(true);
    } else {
      startListening();
    }
  };

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const inputStyle = { padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" };

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ margin: "0 0 4px" }}>🗒️ Print Form</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
        Client name is left blank — write by hand after printing. Notes typed or dictated here print on the form; nothing is saved.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Form Type</label>
          <select value={formType} onChange={(e) => setFormType(e.target.value)} style={inputStyle}>
            {FORM_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Layout</label>
          <select value={layout} onChange={(e) => setLayout(e.target.value)} style={inputStyle}>
            <option value="template">Template (structured)</option>
            <option value="plain">Plain (blank lines)</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Staff Name (pre-filled)</label>
          <input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="Staff name" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Notes / Observations</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isDictationSupported && (
              <span style={{ fontSize: 11, color: "#9ca3af" }}>Dictation not supported in this browser</span>
            )}
            {isDictationSupported && (
              <button
                onClick={toggleListening}
                disabled={isProcessing}
                title={isListening ? "Stop recording & transcribe" : "Start recording"}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: isListening ? "#fee2e2" : (isProcessing ? "#f3f4f6" : "#d1fae5"),
                  color: isListening ? "#991b1b" : (isProcessing ? "#9ca3af" : "#065f46"),
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: isProcessing ? 0.7 : 1,
                }}
              >
                <span style={{ fontSize: 16 }}>🎤</span>
                {isListening ? `Stop (${formatDuration(recordDuration)})` : (isProcessing ? "Transcribing…" : "Dictate")}
                {isListening && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                )}
              </button>
            )}
            <button
              onClick={() => { setNotes(""); }}
              style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #ddd", background: "#f9fafb", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); }}
          placeholder={isDictationSupported ? 'Type here or click "Dictate" to record your voice…' : "Type your notes here…"}
          rows={6}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14, lineHeight: 1.6 }}
        />
        {isListening && (
          <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
            🎤 Recording… speak clearly. Click Stop when finished to transcribe.
          </p>
        )}
        {isProcessing && (
          <p style={{ fontSize: 11, color: "#059669", marginTop: 4, fontWeight: 600 }}>
            🔄 Processing transcription via Deepgram Nova-2... please hold on.
          </p>
        )}
        {dictationError && (
          <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{dictationError}</p>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => printForm({ staffName, formType, layout, notes })}
          style={{ padding: "10px 24px", background: "#111827", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
        >
          Print Form
        </button>
      </div>
    </div>
  );
}
