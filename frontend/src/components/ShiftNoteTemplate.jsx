import React, { useEffect, useState } from "react";
import { getMe } from "../services/me";

const LINES = 10;

function printShiftNote({ staffName, facilityName, date }) {
  const ruled = Array.from({ length: LINES }, () =>
    `<div style="border-bottom:1px solid #ccc;min-height:28px;margin-bottom:4px"></div>`
  ).join("");

  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <html>
    <head>
      <title>Shift Note</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; font-size: 14px; color: #000; }
        h2   { text-align: center; margin-bottom: 4px; font-size: 18px; }
        .sub { text-align: center; color: #555; margin-bottom: 24px; font-size: 13px; }
        .row { display: flex; gap: 24px; margin-bottom: 16px; }
        .field { flex: 1; }
        .label { font-size: 11px; text-transform: uppercase; color: #555; margin-bottom: 4px; }
        .line  { border-bottom: 1px solid #000; min-height: 26px; }
        .restricted { font-size: 11px; color: #888; font-style: italic; }
        .sig   { margin-top: 32px; display: flex; gap: 32px; }
        .sig .field { flex: 2; }
        .sig .date  { flex: 1; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <h2>${facilityName || "Daily Shift Note"}</h2>
      <div class="sub">Confidential — For internal use only</div>

      <div class="row">
        <div class="field">
          <div class="label">Staff Name</div>
          <div class="line">${staffName || ""}</div>
        </div>
        <div class="field">
          <div class="label">Date</div>
          <div class="line">${date}</div>
        </div>
      </div>

      <div class="row">
        <div class="field">
          <div class="label">Shift From</div>
          <div class="line"></div>
        </div>
        <div class="field">
          <div class="label">Shift To</div>
          <div class="line"></div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        <div class="label">Client Name <span class="restricted">(write after printing — do not pre-fill)</span></div>
        <div class="line"></div>
      </div>

      <div style="margin-bottom:8px">
        <div class="label">Notes / Observations</div>
        ${ruled}
      </div>

      <div class="sig">
        <div class="field">
          <div class="label">Staff Signature</div>
          <div class="line"></div>
        </div>
        <div class="date">
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

export default function ShiftNoteTemplate() {
  const [staffName, setStaffName]       = useState("");
  const [facilityName, setFacilityName] = useState("");

  useEffect(() => {
    getMe().then((me) => {
      if (me?.firstName || me?.lastName) {
        setStaffName(`${me.firstName || ""} ${me.lastName || ""}`.trim());
      }
      if (me?.tenantName) setFacilityName(me.tenantName);
    }).catch(() => {});
  }, []);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
      <h2 style={{ margin: "0 0 4px" }}>🗒️ Shift Note Template</h2>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
        Prints a blank form. Client name is left intentionally blank — write it by hand after printing.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Facility / Organization Name</label>
          <input
            value={facilityName}
            onChange={(e) => setFacilityName(e.target.value)}
            placeholder="e.g. Sunrise Care Home"
            style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Staff Name (pre-filled on form)</label>
          <input
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Staff name"
            style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }}
          />
        </div>
        <button
          onClick={() => printShiftNote({ staffName, facilityName, date: today })}
          style={{ padding: "10px 18px", background: "#111827", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Print Blank Form
        </button>
      </div>
    </div>
  );
}
