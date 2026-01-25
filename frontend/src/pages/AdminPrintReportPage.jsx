import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

const STORAGE_KEY = "timestampReportPresets:v1";

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function toLocalDateValue(d) {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  const local = new Date(date.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 10);
}

function dateStartUtc(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateEndUtc(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T23:59:59.999");
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTime(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function formatHours(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toFixed(2);
}

function getShiftLabelFromPunchIn(punchIn) {
  if (!punchIn) return "-";
  const d = new Date(punchIn);
  if (Number.isNaN(d.getTime())) return "-";
  const hour = d.getHours();
  return hour < 12 ? "AM" : "PM";
}

function calcHours(punchIn, punchOut) {
  if (!punchIn || !punchOut) return null;
  const a = new Date(punchIn);
  const b = new Date(punchOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return (b - a) / (1000 * 60 * 60);
}

function computeDailyOvertimeHours({ dailyHours, shiftHours, graceHours }) {
  if (typeof dailyHours !== "number" || Number.isNaN(dailyHours)) return 0;
  if (dailyHours <= shiftHours) return 0;

  const extra = dailyHours - shiftHours;
  const halfShift = shiftHours / 2;

  // Overtime is hours exceeding a full shift by MORE than grace, but LESS than a half-shift.
  if (extra <= graceHours) return 0;
  if (extra >= halfShift) return 0;

  return extra - graceHours;
}

export default function AdminPrintReportPage() {
  const navigate = useNavigate();

  const [facilityName, setFacilityName] = useState("");
  const [periodType, setPeriodType] = useState("weekly");
  const [startDate, setStartDate] = useState(toLocalDateValue(new Date()));
  const [endDate, setEndDate] = useState(toLocalDateValue(new Date()));

  const [shiftHours, setShiftHours] = useState(12);
  const [graceHours, setGraceHours] = useState(1);

  const [ptoEnabled, setPtoEnabled] = useState(true);
  const [ptoHours, setPtoHours] = useState(0);

  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [bonusAmount, setBonusAmount] = useState(0);

  const [manualOvertimeEnabled, setManualOvertimeEnabled] = useState(true);
  const [manualOvertimeHours, setManualOvertimeHours] = useState(0);

  const [employeeSignature, setEmployeeSignature] = useState("");
  const [adminSignature, setAdminSignature] = useState("");
  const [signatureDate, setSignatureDate] = useState(toLocalDateValue(new Date()));

  const [selectedCaregiverId, setSelectedCaregiverId] = useState("all");
  const [printPerCaregiver, setPrintPerCaregiver] = useState(false);

  const [perCaregiverOverrides, setPerCaregiverOverrides] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [rawLogs, setRawLogs] = useState([]);
  const [includeById, setIncludeById] = useState({});

  const [presetName, setPresetName] = useState("");
  const [savedPresets, setSavedPresets] = useState([]);

  const loadPresets = useCallback(() => {
    const existing = safeJsonParse(localStorage.getItem(STORAGE_KEY) || "[]", []);
    setSavedPresets(Array.isArray(existing) ? existing : []);
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const applyPeriod = useCallback(
    (type) => {
      setPeriodType(type);
      const start = dateStartUtc(startDate);
      if (!start) return;
      const d = new Date(start);

      if (type === "weekly") {
        d.setDate(d.getDate() + 6);
        setEndDate(toLocalDateValue(d));
      } else if (type === "biweekly") {
        d.setDate(d.getDate() + 13);
        setEndDate(toLocalDateValue(d));
      } else if (type === "monthly") {
        const year = start.getFullYear();
        const month = start.getMonth();
        const last = new Date(year, month + 1, 0, 23, 59, 59, 999);
        setEndDate(toLocalDateValue(last));
      }
    },
    [startDate]
  );

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const start = dateStartUtc(startDate);
      const end = dateEndUtc(endDate);

      const params = {};
      if (selectedCaregiverId && selectedCaregiverId !== "all") {
        params.caregiverId = selectedCaregiverId;
      }
      if (start) params.startDate = start.toISOString();
      if (end) params.endDate = end.toISOString();

      const res = await api.get("/admin/timelogs", { params });
      const logs = Array.isArray(res.data.logs) ? res.data.logs : [];
      setRawLogs(logs);

      const nextInclude = {};
      for (const log of logs) {
        const out = log.effectivePunchOut ?? log.punchOut;
        const inn = log.effectivePunchIn ?? log.punchIn;
        const hasHours = Boolean(inn && out);
        nextInclude[log._id] = hasHours;
      }
      setIncludeById(nextInclude);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load time logs");
    } finally {
      setLoading(false);
    }
  }, [endDate, selectedCaregiverId, startDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const caregivers = useMemo(() => {
    const map = new Map();
    for (const log of rawLogs) {
      const c = log.caregiver;
      if (!c?._id) continue;
      map.set(String(c._id), c);
    }
    return Array.from(map.values()).sort((a, b) => {
      const an = `${a.firstName || ""} ${a.lastName || ""}`.trim();
      const bn = `${b.firstName || ""} ${b.lastName || ""}`.trim();
      return an.localeCompare(bn);
    });
  }, [rawLogs]);

  const includedLogs = useMemo(() => {
    return rawLogs.filter((l) => includeById[l._id]);
  }, [includeById, rawLogs]);

  const derivedLogs = useMemo(() => {
    return includedLogs
      .map((log) => {
        const inn = log.effectivePunchIn ?? log.punchIn;
        const out = log.effectivePunchOut ?? log.punchOut;
        const hours = calcHours(inn, out);
        const shiftLabel = getShiftLabelFromPunchIn(inn);
        const dateKey = inn ? new Date(inn).toLocaleDateString() : "-";
        return {
          ...log,
          derived: {
            inn,
            out,
            hours,
            shiftLabel,
            dateKey,
          },
        };
      })
      .filter((l) => typeof l.derived.hours === "number" && !Number.isNaN(l.derived.hours));
  }, [includedLogs]);

  const buildDailyRows = useCallback((logs) => {
    const map = new Map();
    for (const log of logs) {
      const key = log.derived.dateKey;
      if (!map.has(key)) {
        map.set(key, { dateKey: key, totalHours: 0, logs: [] });
      }
      const row = map.get(key);
      row.totalHours += log.derived.hours;
      row.logs.push(log);
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      const ad = new Date(a.logs[0]?.derived?.inn || 0).getTime();
      const bd = new Date(b.logs[0]?.derived?.inn || 0).getTime();
      return ad - bd;
    });
    return rows;
  }, []);

  const buildTotals = useCallback(
    (dailyRows) => {
      const totalHours = dailyRows.reduce((sum, d) => sum + d.totalHours, 0);
      const shiftFraction = shiftHours > 0 ? totalHours / shiftHours : 0;

      const computedOvertime = dailyRows.reduce((sum, d) => {
        return (
          sum +
          computeDailyOvertimeHours({
            dailyHours: d.totalHours,
            shiftHours: Number(shiftHours) || 12,
            graceHours: Number(graceHours) || 0,
          })
        );
      }, 0);

      return { totalHours, shiftFraction, computedOvertime };
    },
    [graceHours, shiftHours]
  );

  const daily = useMemo(() => buildDailyRows(derivedLogs), [buildDailyRows, derivedLogs]);
  const totals = useMemo(() => buildTotals(daily), [buildTotals, daily]);

  const perCaregiver = useMemo(() => {
    const map = new Map();
    for (const log of derivedLogs) {
      const caregiverId = String(log.caregiver?._id || "");
      if (!caregiverId) continue;
      if (!map.has(caregiverId)) {
        map.set(caregiverId, {
          caregiverId,
          caregiver: log.caregiver,
          logs: [],
        });
      }
      map.get(caregiverId).logs.push(log);
    }

    const groups = Array.from(map.values());
    const sorted = groups.sort((a, b) => {
      const an = `${a.caregiver?.firstName || ""} ${a.caregiver?.lastName || ""}`.trim();
      const bn = `${b.caregiver?.firstName || ""} ${b.caregiver?.lastName || ""}`.trim();
      return an.localeCompare(bn);
    });

    return sorted.map((g) => {
      const dailyRows = buildDailyRows(g.logs);
      return {
        ...g,
        daily: dailyRows,
        totals: buildTotals(dailyRows),
      };
    });
  }, [buildDailyRows, buildTotals, derivedLogs]);

  const getCaregiverAdjustments = useCallback(
    (caregiverId) => {
      const id = String(caregiverId || "");
      const override = perCaregiverOverrides[id];
      if (!override) {
        return {
          ptoEnabled,
          ptoHours,
          bonusEnabled,
          bonusAmount,
          manualOvertimeEnabled,
          manualOvertimeHours,
        };
      }

      return {
        ptoEnabled: override.ptoEnabled ?? ptoEnabled,
        ptoHours: Number(override.ptoHours ?? ptoHours),
        bonusEnabled: override.bonusEnabled ?? bonusEnabled,
        bonusAmount: Number(override.bonusAmount ?? bonusAmount),
        manualOvertimeEnabled: override.manualOvertimeEnabled ?? manualOvertimeEnabled,
        manualOvertimeHours: Number(override.manualOvertimeHours ?? manualOvertimeHours),
      };
    },
    [
      bonusAmount,
      bonusEnabled,
      manualOvertimeEnabled,
      manualOvertimeHours,
      perCaregiverOverrides,
      ptoEnabled,
      ptoHours,
    ]
  );

  const setCaregiverAdjustmentField = useCallback((caregiverId, field, value) => {
    const id = String(caregiverId || "");
    if (!id) return;
    setPerCaregiverOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value,
      },
    }));
  }, []);

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;

    const preset = {
      id: `${Date.now()}`,
      name,
      savedAt: new Date().toISOString(),
      fields: {
        facilityName,
        periodType,
        shiftHours,
        graceHours,
        printPerCaregiver,
        perCaregiverOverrides,
        ptoEnabled,
        ptoHours,
        bonusEnabled,
        bonusAmount,
        manualOvertimeEnabled,
        manualOvertimeHours,
        employeeSignature,
        adminSignature,
      },
    };

    const existing = safeJsonParse(localStorage.getItem(STORAGE_KEY) || "[]", []);
    const list = Array.isArray(existing) ? existing : [];
    const next = [preset, ...list.filter((p) => p.name !== name)].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPresetName("");
    loadPresets();
  };

  const applyPreset = (preset) => {
    const f = preset?.fields;
    if (!f) return;
    setFacilityName(f.facilityName ?? "");
    setPeriodType(f.periodType ?? "weekly");
    setShiftHours(Number(f.shiftHours ?? 12));
    setGraceHours(Number(f.graceHours ?? 1));
    setPrintPerCaregiver(Boolean(f.printPerCaregiver ?? false));
    setPerCaregiverOverrides(
      f.perCaregiverOverrides && typeof f.perCaregiverOverrides === "object" ? f.perCaregiverOverrides : {}
    );
    setPtoEnabled(Boolean(f.ptoEnabled ?? true));
    setPtoHours(Number(f.ptoHours ?? 0));
    setBonusEnabled(Boolean(f.bonusEnabled ?? true));
    setBonusAmount(Number(f.bonusAmount ?? 0));
    setManualOvertimeEnabled(Boolean(f.manualOvertimeEnabled ?? true));
    setManualOvertimeHours(Number(f.manualOvertimeHours ?? 0));
    setEmployeeSignature(f.employeeSignature ?? "");
    setAdminSignature(f.adminSignature ?? "");
  };

  const deletePreset = (id) => {
    const existing = safeJsonParse(localStorage.getItem(STORAGE_KEY) || "[]", []);
    const list = Array.isArray(existing) ? existing : [];
    const next = list.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    loadPresets();
  };

  return (
    <div className="container">
      <div className="noPrint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="pageTitle">Printable Hours Report</h1>
          <p className="pageSubtitle">Build a report from captured punches (read-only) and print.</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => navigate("/admin")}>Back</button>
          <button className="btn btnPrimary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {error && (
        <div className="card noPrint" style={{ borderColor: "#fca5a5", color: "#991b1b" }}>
          {error}
        </div>
      )}

      <div className="card noPrint" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Report inputs</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Facility name</div>
            <input
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="Facility / Unit"
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Caregiver</div>
            <select
              value={selectedCaregiverId}
              onChange={(e) => setSelectedCaregiverId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            >
              <option value="all">All caregivers (filtered by date range)</option>
              {caregivers.map((c) => (
                <option key={c._id} value={c._id}>
                  {(c.firstName || "")} {(c.lastName || "")} ({c.email})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Period type</div>
            <select
              value={periodType}
              onChange={(e) => applyPeriod(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Start date</div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (periodType !== "custom") {
                  setTimeout(() => applyPeriod(periodType), 0);
                }
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>End date</div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodType("custom");
              }}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Hours per shift</div>
            <input
              type="number"
              min="1"
              step="0.5"
              value={shiftHours}
              onChange={(e) => setShiftHours(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </label>

          <label>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Overtime grace (hours)</div>
            <input
              type="number"
              min="0"
              step="0.5"
              value={graceHours}
              onChange={(e) => setGraceHours(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </label>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={fetchLogs} disabled={loading}>
            {loading ? "Loading..." : "Refresh logs"}
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={printPerCaregiver}
              disabled={selectedCaregiverId !== "all"}
              onChange={(e) => setPrintPerCaregiver(e.target.checked)}
            />
            Print one page per caregiver (only when "All caregivers" is selected)
          </label>
        </div>

        <h3 style={{ marginBottom: 8 }}>Optional fields (use N/A when not applicable)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={ptoEnabled} onChange={(e) => setPtoEnabled(e.target.checked)} />
              PTO
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              disabled={!ptoEnabled}
              value={ptoHours}
              onChange={(e) => setPtoHours(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={manualOvertimeEnabled} onChange={(e) => setManualOvertimeEnabled(e.target.checked)} />
              Manual overtime (hours)
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              disabled={!manualOvertimeEnabled}
              value={manualOvertimeHours}
              onChange={(e) => setManualOvertimeHours(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>

          <div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={bonusEnabled} onChange={(e) => setBonusEnabled(e.target.checked)} />
              Bonus (amount)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!bonusEnabled}
              value={bonusAmount}
              onChange={(e) => setBonusAmount(Number(e.target.value))}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
            />
          </div>
        </div>

        <h3 style={{ marginBottom: 8, marginTop: 16 }}>Presets (localStorage)</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name"
            style={{ padding: 10, borderRadius: 10, border: "1px solid var(--border)", minWidth: 220 }}
          />
          <button className="btn" onClick={savePreset} disabled={!presetName.trim()}>
            Save preset
          </button>
        </div>

        {savedPresets.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {savedPresets.map((p) => (
              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <strong>{p.name}</strong>
                  <span style={{ marginLeft: 10, color: "var(--muted)", fontSize: 12 }}>
                    saved {formatDateTime(p.savedAt)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => applyPreset(p)}>
                    Apply
                  </button>
                  <button className="btn" onClick={() => deletePreset(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card noPrint" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Include / exclude entries</h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          This only affects the report output. It does not modify captured times.
        </p>

        {rawLogs.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No logs found for this filter.</p>
        ) : (
          <table width="100%" cellPadding="8">
            <thead>
              <tr>
                <th align="left">Include</th>
                <th align="left">Caregiver</th>
                <th align="left">Shift</th>
                <th align="left">Punch In</th>
                <th align="left">Punch Out</th>
                <th align="right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rawLogs.map((log) => {
                const inn = log.effectivePunchIn ?? log.punchIn;
                const out = log.effectivePunchOut ?? log.punchOut;
                const hours = calcHours(inn, out);
                const hasHours = typeof hours === "number" && !Number.isNaN(hours);

                return (
                  <tr key={log._id} style={{ opacity: hasHours ? 1 : 0.6 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(includeById[log._id])}
                        disabled={!hasHours}
                        onChange={(e) =>
                          setIncludeById((prev) => ({ ...prev, [log._id]: e.target.checked }))
                        }
                      />
                    </td>
                    <td>
                      {log.caregiver?.firstName} {log.caregiver?.lastName}
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>{log.caregiver?.email}</div>
                    </td>
                    <td>{getShiftLabelFromPunchIn(inn)}</td>
                    <td>{formatDateTime(inn)}</td>
                    <td>{formatDateTime(out)}</td>
                    <td align="right">{hasHours ? formatHours(hours) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* PRINT AREA */}
      <div className="printArea card" style={{ marginTop: 16 }}>
        {(printPerCaregiver && selectedCaregiverId === "all") ? (
          perCaregiver.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>No included entries.</div>
          ) : (
            perCaregiver.map((g, idx) => {
              const caregiverName = `${g.caregiver?.firstName || ""} ${g.caregiver?.lastName || ""}`.trim();
              const adj = getCaregiverAdjustments(g.caregiverId);

              return (
                <div key={g.caregiverId} className={idx === 0 ? "" : "printPageBreak"}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <h2 style={{ margin: 0 }}>Hours Report</h2>
                      <div style={{ color: "var(--muted)" }}>{facilityName?.trim() || "Facility: __________"}</div>
                      <div style={{ color: "var(--muted)" }}>
                        Caregiver: {caregiverName || "__________"}
                        {g.caregiver?.email ? ` (${g.caregiver.email})` : ""}
                      </div>
                      <div style={{ color: "var(--muted)" }}>
                        Period: {periodType} ({startDate} → {endDate})
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div><strong>Total hours:</strong> {formatHours(g.totals.totalHours)}</div>
                      <div><strong>Shifts (fraction):</strong> {formatHours(g.totals.shiftFraction)}</div>
                      <div><strong>Computed OT hours:</strong> {formatHours(g.totals.computedOvertime)}</div>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

                  <table width="100%" cellPadding="8">
                    <thead>
                      <tr>
                        <th align="left">Date</th>
                        <th align="right">Total Hours</th>
                        <th align="right">Shift Fraction</th>
                        <th align="right">OT Hours (rule)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.daily.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ color: "var(--muted)" }}>
                            No included entries.
                          </td>
                        </tr>
                      ) : (
                        g.daily.map((d) => {
                          const sf = shiftHours > 0 ? d.totalHours / shiftHours : 0;
                          const overtime = computeDailyOvertimeHours({
                            dailyHours: d.totalHours,
                            shiftHours: Number(shiftHours) || 12,
                            graceHours: Number(graceHours) || 0,
                          });

                          return (
                            <tr key={d.dateKey}>
                              <td>{d.dateKey}</td>
                              <td align="right">{formatHours(d.totalHours)}</td>
                              <td align="right">{formatHours(sf)}</td>
                              <td align="right">{formatHours(overtime)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

                  <div className="noPrint" style={{ marginBottom: 12 }}>
                    <h3 style={{ margin: 0, marginBottom: 8 }}>Per-caregiver adjustments</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                      <div>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(adj.ptoEnabled)}
                            onChange={(e) => setCaregiverAdjustmentField(g.caregiverId, "ptoEnabled", e.target.checked)}
                          />
                          PTO
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          disabled={!adj.ptoEnabled}
                          value={Number(adj.ptoHours) || 0}
                          onChange={(e) => setCaregiverAdjustmentField(g.caregiverId, "ptoHours", Number(e.target.value))}
                          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(adj.manualOvertimeEnabled)}
                            onChange={(e) =>
                              setCaregiverAdjustmentField(g.caregiverId, "manualOvertimeEnabled", e.target.checked)
                            }
                          />
                          Manual overtime (hours)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          disabled={!adj.manualOvertimeEnabled}
                          value={Number(adj.manualOvertimeHours) || 0}
                          onChange={(e) =>
                            setCaregiverAdjustmentField(g.caregiverId, "manualOvertimeHours", Number(e.target.value))
                          }
                          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(adj.bonusEnabled)}
                            onChange={(e) => setCaregiverAdjustmentField(g.caregiverId, "bonusEnabled", e.target.checked)}
                          />
                          Bonus (amount)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={!adj.bonusEnabled}
                          value={Number(adj.bonusAmount) || 0}
                          onChange={(e) => setCaregiverAdjustmentField(g.caregiverId, "bonusAmount", Number(e.target.value))}
                          style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
                        />
                      </div>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                      Tip: these values print per caregiver; the global optional fields act as defaults.
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>PTO</div>
                      <div>{adj.ptoEnabled ? `${formatHours(Number(adj.ptoHours) || 0)} hrs` : "N/A"}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Overtime (manual)</div>
                      <div>
                        {adj.manualOvertimeEnabled
                          ? `${formatHours(Number(adj.manualOvertimeHours) || 0)} hrs`
                          : "N/A"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Bonus</div>
                      <div>{adj.bonusEnabled ? `$${(Number(adj.bonusAmount) || 0).toFixed(2)}` : "N/A"}</div>
                    </div>
                  </div>

                  <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Employee signature</div>
                      <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{employeeSignature}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin signature</div>
                      <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{adminSignature}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Date</div>
                      <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{signatureDate}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0 }}>Hours Report</h2>
                <div style={{ color: "var(--muted)" }}>{facilityName?.trim() || "Facility: __________"}</div>
                <div style={{ color: "var(--muted)" }}>
                  Period: {periodType} ({startDate} → {endDate})
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div><strong>Total hours:</strong> {formatHours(totals.totalHours)}</div>
                <div><strong>Shifts (fraction):</strong> {formatHours(totals.shiftFraction)}</div>
                <div><strong>Computed OT hours:</strong> {formatHours(totals.computedOvertime)}</div>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

            <table width="100%" cellPadding="8">
              <thead>
                <tr>
                  <th align="left">Date</th>
                  <th align="right">Total Hours</th>
                  <th align="right">Shift Fraction</th>
                  <th align="right">OT Hours (rule)</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "var(--muted)" }}>
                      No included entries.
                    </td>
                  </tr>
                ) : (
                  daily.map((d) => {
                    const shiftFraction = shiftHours > 0 ? d.totalHours / shiftHours : 0;
                    const overtime = computeDailyOvertimeHours({
                      dailyHours: d.totalHours,
                      shiftHours: Number(shiftHours) || 12,
                      graceHours: Number(graceHours) || 0,
                    });

                    return (
                      <tr key={d.dateKey}>
                        <td>{d.dateKey}</td>
                        <td align="right">{formatHours(d.totalHours)}</td>
                        <td align="right">{formatHours(shiftFraction)}</td>
                        <td align="right">{formatHours(overtime)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600 }}>PTO</div>
                <div>{ptoEnabled ? `${formatHours(Number(ptoHours) || 0)} hrs` : "N/A"}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Overtime (manual)</div>
                <div>{manualOvertimeEnabled ? `${formatHours(Number(manualOvertimeHours) || 0)} hrs` : "N/A"}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Bonus</div>
                <div>{bonusEnabled ? `$${(Number(bonusAmount) || 0).toFixed(2)}` : "N/A"}</div>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "12px 0" }} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Employee signature</div>
                <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{employeeSignature}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Admin signature</div>
                <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{adminSignature}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Date</div>
                <div style={{ borderBottom: "1px solid #111", minHeight: 22 }}>{signatureDate}</div>
              </div>
            </div>
          </>
        )}

        <div className="noPrint" style={{ marginTop: 14 }}>
          <h3>Signature inputs (optional)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Employee signature</div>
              <input
                value={employeeSignature}
                onChange={(e) => setEmployeeSignature(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Admin signature</div>
              <input
                value={adminSignature}
                onChange={(e) => setAdminSignature(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
              />
            </label>
            <label>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>Date</div>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="noPrint" style={{ marginTop: 16, color: "var(--muted)", fontSize: 12 }}>
        Notes:
        <ul>
          <li>Shift fraction uses hours ÷ hours-per-shift (e.g., 6 hours = 0.5 shift when shift is 12).</li>
          <li>Computed OT rule: extra hours beyond one shift by more than grace, but less than a half-shift.</li>
          <li>Underlying punches are never edited; missed punches are handled via approved overlays.</li>
        </ul>
      </div>
    </div>
  );
}
