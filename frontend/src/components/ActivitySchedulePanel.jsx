import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSchedule,
  createTemplate,
  deleteSchedule,
  deleteTemplate,
  exportSchedule,
  listSchedules,
  listTemplates,
  updateSchedule,
} from "../services/activities";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CATEGORIES = ["Physical", "Social", "Educational", "Recreational", "Other"];

const BLANK_TEMPLATE = { name: "", category: "Other", defaultDurationMinutes: 60 };
const BLANK_SLOT = { day: 0, time: "09:00", activityName: "", durationMinutes: 60, notes: "" };

// returns the ISO date string for the Monday of the week containing `dateStr`
function toMondayISO(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const utcDay = d.getUTCDay(); // 0=Sun
  const diff = utcDay === 0 ? -6 : 1 - utcDay;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

const btn = (extra = {}) => ({
  border: "none", borderRadius: 6, cursor: "pointer", padding: "8px 14px", ...extra,
});

export default function ActivitySchedulePanel() {
  const [templates, setTemplates]           = useState([]);
  const [schedules, setSchedules]           = useState([]);
  const [weekStart, setWeekStart]           = useState(() => toMondayISO());
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");
  const [view, setView]                     = useState("schedule"); // "schedule" | "templates"
  const [templateForm, setTemplateForm]     = useState(BLANK_TEMPLATE);
  const [slotForm, setSlotForm]             = useState(BLANK_SLOT);
  const [showSlotForm, setShowSlotForm]     = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tmpls, scheds] = await Promise.all([listTemplates(), listSchedules()]);
      setTemplates(tmpls);
      setSchedules(scheds);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load activities.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeSchedule = useMemo(
    () => schedules.find((s) => new Date(s.weekStartDate).toISOString().slice(0, 10) === weekStart) || null,
    [schedules, weekStart]
  );

  const refreshSchedules = useCallback(async () => {
    const scheds = await listSchedules();
    setSchedules(scheds);
  }, []);

  const handleCreateSchedule = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      await createSchedule({ weekStartDate: weekStart });
      await refreshSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  }, [weekStart, refreshSchedules]);

  const handleTogglePublish = useCallback(async () => {
    if (!activeSchedule) return;
    setSaving(true);
    setError("");
    try {
      const nextStatus = activeSchedule.status === "published" ? "draft" : "published";
      await updateSchedule(activeSchedule._id, { status: nextStatus });
      await refreshSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  }, [activeSchedule, refreshSchedules]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!activeSchedule || !window.confirm("Delete this week's schedule?")) return;
    setSaving(true);
    setError("");
    try {
      await deleteSchedule(activeSchedule._id);
      await refreshSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete schedule.");
    } finally {
      setSaving(false);
    }
  }, [activeSchedule, refreshSchedules]);

  const handleAddSlot = useCallback(async (e) => {
    e.preventDefault();
    if (!activeSchedule) return;
    setSaving(true);
    setError("");
    try {
      const updatedActivities = [
        ...(activeSchedule.activities || []),
        {
          day:              Number(slotForm.day),
          time:             slotForm.time,
          activityName:     slotForm.activityName.trim(),
          durationMinutes:  Number(slotForm.durationMinutes),
          notes:            slotForm.notes || null,
        },
      ];
      await updateSchedule(activeSchedule._id, { activities: updatedActivities });
      setSlotForm(BLANK_SLOT);
      setShowSlotForm(false);
      await refreshSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to add activity.");
    } finally {
      setSaving(false);
    }
  }, [activeSchedule, slotForm, refreshSchedules]);

  const handleRemoveSlot = useCallback(async (index) => {
    if (!activeSchedule) return;
    setSaving(true);
    setError("");
    try {
      const updatedActivities = activeSchedule.activities.filter((_, i) => i !== index);
      await updateSchedule(activeSchedule._id, { activities: updatedActivities });
      await refreshSchedules();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to remove activity.");
    } finally {
      setSaving(false);
    }
  }, [activeSchedule, refreshSchedules]);

  const handleExport = useCallback(async () => {
    if (!activeSchedule) return;
    try {
      const data = await exportSchedule(activeSchedule._id);
      const win = window.open("", "_blank");
      if (!win) return;
      const startLabel = new Date(data.weekStartDate).toDateString();
      const rows = data.byDay.map((d) => {
        const cells = d.activities
          .map((a) => `${a.time} — ${a.activityName} (${a.durationMinutes} min)${a.facilitator ? ` · ${a.facilitator}` : ""}${a.notes ? `<br/><em>${a.notes}</em>` : ""}`)
          .join("<br/><br/>") || "—";
        return `<tr><td style="padding:8px 12px;border:1px solid #ccc;font-weight:600;vertical-align:top;width:14%">${d.dayName}</td><td style="padding:8px 12px;border:1px solid #ccc;vertical-align:top">${cells}</td></tr>`;
      }).join("");
      win.document.write(`<html><head><title>Weekly Activity Schedule</title></head><body style="font-family:sans-serif;padding:24px"><h2 style="margin-bottom:4px">Weekly Activity Schedule</h2><p style="color:#555;margin-top:0">Week of ${startLabel}</p><table style="border-collapse:collapse;width:100%">${rows}</table></body></html>`);
      win.document.close();
      win.print();
    } catch {
      setError("Failed to export schedule.");
    }
  }, [activeSchedule]);

  const handleAddTemplate = useCallback(async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createTemplate({ ...templateForm, defaultDurationMinutes: Number(templateForm.defaultDurationMinutes) });
      setTemplateForm(BLANK_TEMPLATE);
      const tmpls = await listTemplates();
      setTemplates(tmpls);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }, [templateForm]);

  const handleDeleteTemplate = useCallback(async (id) => {
    if (!window.confirm("Delete this template?")) return;
    setSaving(true);
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to delete template.");
    } finally {
      setSaving(false);
    }
  }, []);

  const applyTemplate = useCallback((t) => {
    setSlotForm((p) => ({ ...p, activityName: t.name, durationMinutes: t.defaultDurationMinutes }));
    setShowSlotForm(true);
  }, []);

  const activitiesByDay = useMemo(
    () =>
      DAY_NAMES.map((name, i) => ({
        name,
        slots: (activeSchedule?.activities || [])
          .map((a, idx) => ({ ...a, idx }))
          .filter((a) => a.day === i)
          .sort((a, b) => a.time.localeCompare(b.time)),
      })),
    [activeSchedule]
  );

  return (
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>📅 Activity Schedules</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setView("schedule")} style={btn({ background: view === "schedule" ? "#111827" : "#f3f4f6", color: view === "schedule" ? "#fff" : "#111" })}>Schedule</button>
          <button onClick={() => setView("templates")} style={btn({ background: view === "templates" ? "#111827" : "#f3f4f6", color: view === "templates" ? "#fff" : "#111" })}>Templates</button>
          <button onClick={fetchAll} disabled={loading} style={btn({ background: "#007bff", color: "#fff" })}>Refresh</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: 12, background: "#f8d7da", color: "#721c24", borderRadius: 6 }}>{error}</div>
      )}

      {/* ── Templates view ──────────────────────────────────────────────── */}
      {view === "templates" && (
        <div>
          <form onSubmit={handleAddTemplate} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, marginBottom: 16 }}>
            <input
              value={templateForm.name}
              onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Activity name"
              required
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <select
              value={templateForm.category}
              onChange={(e) => setTemplateForm((p) => ({ ...p, category: e.target.value }))}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              type="number" min="1"
              value={templateForm.defaultDurationMinutes}
              onChange={(e) => setTemplateForm((p) => ({ ...p, defaultDurationMinutes: e.target.value }))}
              placeholder="Duration (min)"
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <button type="submit" disabled={saving} style={btn({ background: "#111827", color: "#fff" })}>+ Add</button>
          </form>

          {templates.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No templates yet. Add one above.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                  {["Name", "Category", "Duration", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px" }}>{t.name}</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>{t.category}</td>
                    <td style={{ padding: "10px 12px" }}>{t.defaultDurationMinutes} min</td>
                    <td style={{ padding: "10px 12px" }}>
                      <button onClick={() => handleDeleteTemplate(t._id)} disabled={saving} style={btn({ padding: "4px 10px", fontSize: 12, background: "#fee2e2", color: "#991b1b" })}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Schedule view ────────────────────────────────────────────────── */}
      {view === "schedule" && (
        <div>
          {/* Week picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <label style={{ fontWeight: 600 }}>Week of (Monday):</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(toMondayISO(e.target.value))}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
            />
            {activeSchedule && (
              <span style={{
                padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                background: activeSchedule.status === "published" ? "#d1fae5" : "#fef3c7",
                color:      activeSchedule.status === "published" ? "#065f46" : "#92400e",
              }}>
                {activeSchedule.status === "published" ? "Published" : "Draft"}
              </span>
            )}
          </div>

          {!activeSchedule ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
              <p>No schedule for this week yet.</p>
              <button onClick={handleCreateSchedule} disabled={saving} style={btn({ background: "#111827", color: "#fff" })}>
                {saving ? "Creating…" : "Create Schedule"}
              </button>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <button onClick={() => { setShowSlotForm((s) => !s); setSlotForm(BLANK_SLOT); }} style={btn({ background: "#111827", color: "#fff" })}>
                  {showSlotForm ? "Cancel" : "+ Add Activity"}
                </button>
                <button onClick={handleTogglePublish} disabled={saving} style={btn({ background: activeSchedule.status === "published" ? "#fef3c7" : "#d1fae5", color: "#111" })}>
                  {activeSchedule.status === "published" ? "Revert to Draft" : "Publish"}
                </button>
                <button onClick={handleExport} style={btn({ background: "#e0e7ff", color: "#3730a3" })}>
                  Print / Export
                </button>
                <button onClick={handleDeleteSchedule} disabled={saving} style={btn({ background: "#fee2e2", color: "#991b1b" })}>
                  Delete Schedule
                </button>
              </div>

              {/* Add slot form */}
              {showSlotForm && (
                <>
                  <form onSubmit={handleAddSlot} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr 2fr auto", gap: 10, marginBottom: 8, alignItems: "end" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Day</label>
                      <select
                        value={slotForm.day}
                        onChange={(e) => setSlotForm((p) => ({ ...p, day: e.target.value }))}
                        style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }}
                      >
                        {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Time</label>
                      <input type="time" value={slotForm.time} onChange={(e) => setSlotForm((p) => ({ ...p, time: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Activity Name *</label>
                      <input value={slotForm.activityName} onChange={(e) => setSlotForm((p) => ({ ...p, activityName: e.target.value }))} placeholder="Activity name" required style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Duration (min)</label>
                      <input type="number" min="1" value={slotForm.durationMinutes} onChange={(e) => setSlotForm((p) => ({ ...p, durationMinutes: e.target.value }))} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>Notes</label>
                      <input value={slotForm.notes} onChange={(e) => setSlotForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", width: "100%" }} />
                    </div>
                    <button type="submit" disabled={saving} style={btn({ background: "#111827", color: "#fff", alignSelf: "end" })}>Add</button>
                  </form>

                  {/* Template quick-fill chips */}
                  {templates.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 6px" }}>Quick-fill from template:</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {templates.map((t) => (
                          <button key={t._id} type="button" onClick={() => applyTemplate(t)}
                            style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 16, background: "#f9fafb", cursor: "pointer" }}>
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 7-day grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                {activitiesByDay.map(({ name, slots }) => (
                  <div key={name} style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ background: "#111827", color: "#fff", padding: "6px 10px", fontSize: 13, fontWeight: 600 }}>
                      {name.slice(0, 3)}
                    </div>
                    <div style={{ padding: 8, minHeight: 80 }}>
                      {slots.length === 0 ? (
                        <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>—</p>
                      ) : (
                        slots.map((slot) => (
                          <div key={slot.idx} style={{ marginBottom: 8, padding: 6, background: "#f9fafb", borderRadius: 4, fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{slot.time} · {slot.activityName}</div>
                            <div style={{ color: "#6b7280" }}>{slot.durationMinutes} min{slot.notes ? ` — ${slot.notes}` : ""}</div>
                            <button onClick={() => handleRemoveSlot(slot.idx)} disabled={saving}
                              style={{ marginTop: 4, padding: "2px 6px", fontSize: 11, border: "none", borderRadius: 3, background: "#fee2e2", color: "#991b1b", cursor: "pointer" }}>
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
