import React, { useEffect, useRef, useState } from "react";
import { getMe } from "../services/me";
import api from "../services/api";

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

const isDictationSupported = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext) && window.WebSocket;

export default function ShiftNoteTemplate() {
  const [staffName, setStaffName]     = useState("");
  const [formType, setFormType]       = useState(FORM_TYPES[0]);
  const [layout, setLayout]           = useState("template");
  const [notes, setNotes]             = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening]   = useState(false);
  const [dictationError, setDictationError] = useState("");

  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    getMe().then((me) => {
      if (me?.firstName || me?.lastName) {
        setStaffName(`${me.firstName || ""} ${me.lastName || ""}`.trim());
      }
    }).catch(() => {});
  }, []);

  const stopListening = () => {
    setIsListening(false);
    setInterimText("");

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (_) {}
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      streamRef.current = null;
    }
  };

  useEffect(() => () => {
    stopListening();
  }, []);

  const startListening = async () => {
    try {
      setDictationError("");

      // 1) Get short-lived auth token from backend with a cache-buster
      const res = await api.get(`/dictate-token?_cb=${Date.now()}`);
      const token = res.data?.token;
      if (!token) throw new Error("Could not retrieve dictation token");

      // 2) Access mic
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const sampleRate = audioContext.sampleRate;

      // 3) Connect WebSocket to ws/dictate via proxy
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.REACT_APP_API_BASE_URL
        ? process.env.REACT_APP_API_BASE_URL.replace(/^https?:\/\//, "")
        : (window.location.hostname === "localhost" ? "localhost:5001" : "api.timecapcha.app");

      const wsUrl = `${protocol}//${host}/ws/dictate?token=${encodeURIComponent(token)}&sr=${sampleRate}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "error") {
            setDictationError(data.message);
            stopListening();
          } else if (data.type === "final") {
            const text = data.transcript?.trim();
            if (text) {
              setNotes((prev) => {
                const endedWithSpace = prev.endsWith(" ") || prev === "";
                return prev + (endedWithSpace ? "" : " ") + text + " ";
              });
            }
            setInterimText("");
          } else if (data.type === "interim") {
            setInterimText(data.transcript || "");
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onerror = () => {
        setDictationError("WebSocket connection error");
        stopListening();
      };

      ws.onclose = () => {
        setIsListening(false);
        setInterimText("");
      };

      // 4) ScriptProcessor to convert Float32 to Int16 PCM and stream
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const len = inputData.length;
        const buffer = new Int16Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        ws.send(buffer.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (err) {
      console.error("startListening failed:", err);
      setDictationError(err.message || "Failed to start microphone. Please check permission.");
      setIsListening(false);
      stopListening();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
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
                title={isListening ? "Stop dictation" : "Start dictation"}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  background: isListening ? "#fee2e2" : "#d1fae5",
                  color: isListening ? "#991b1b" : "#065f46",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>🎤</span>
                {isListening ? "Stop" : "Dictate"}
                {isListening && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                )}
              </button>
            )}
            <button
              onClick={() => { setNotes(""); setInterimText(""); }}
              style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #ddd", background: "#f9fafb", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={notes + interimText}
          onChange={(e) => { setInterimText(""); setNotes(e.target.value); }}
          placeholder={isDictationSupported ? 'Type here or click "Dictate" to speak your notes…' : "Type your notes here…"}
          rows={6}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14, lineHeight: 1.6 }}
        />
        {isListening && (
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            🎤 Listening… speak clearly. Text finalizes when you pause.
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
