import React, { useMemo, useState } from "react";

const STORAGE_KEY = "timestampPlannerNotes";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function formatHuman(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export default function Calendar() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(() => toDateKey(today));
  const [notes, setNotes] = useState(() => loadNotes());
  const [draft, setDraft] = useState(() => notes[toDateKey(today)] || "");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const monthLabel = useMemo(() => {
    return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [cursor]);

  const { cells, noteKeysThisMonth } = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const out = [];
    for (let i = 0; i < firstDow; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      out.push(new Date(year, month, day));
    }

    const noteKeys = new Set();
    Object.keys(notes || {}).forEach((k) => {
      if (k.startsWith(`${year}-${pad2(month + 1)}-`) && String(notes[k] || "").trim()) {
        noteKeys.add(k);
      }
    });

    return { cells: out, noteKeysThisMonth: noteKeys };
  }, [month, notes, year]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedKey.split("-").map((n) => Number(n));
    return new Date(y, (m || 1) - 1, d || 1);
  }, [selectedKey]);

  const onPrev = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };

  const onNext = () => {
    setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  const onPick = (date) => {
    const key = toDateKey(date);
    setSelectedKey(key);
    setDraft(notes[key] || "");
  };

  const onSave = () => {
    const next = { ...(notes || {}) };
    const trimmed = String(draft || "").trim();
    if (!trimmed) {
      delete next[selectedKey];
    } else {
      next[selectedKey] = draft;
    }

    setNotes(next);
    saveNotes(next);
  };

  const onClear = () => {
    setDraft("");
    const next = { ...(notes || {}) };
    delete next[selectedKey];
    setNotes(next);
    saveNotes(next);
  };

  const selectedHasNote = Boolean(String(notes[selectedKey] || "").trim());

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="calendarWrap">
      <div className="calendarHeader">
        <button type="button" className="btn" onClick={onPrev}>
          ←
        </button>
        <h2>{monthLabel}</h2>
        <button type="button" className="btn" onClick={onNext}>
          →
        </button>
      </div>

      <div className="card">
        <div className="calendarGrid" style={{ marginBottom: 10 }}>
          {dows.map((d) => (
            <div key={d} className="calendarDow">
              {d}
            </div>
          ))}
        </div>

        <div className="calendarGrid">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="dayCell dayCellMuted" />;
            }

            const key = toDateKey(date);
            const hasNote = noteKeysThisMonth.has(key);
            const isToday = isSameDay(date, today);
            const isSelected = key === selectedKey;

            const className = [
              "dayCell",
              isToday ? "today" : "",
              isSelected ? "selected" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={key}
                className={className}
                onClick={() => onPick(date)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onPick(date);
                }}
              >
                <div className="dayNumber">{date.getDate()}</div>
                {hasNote && <div className="noteDot" title="Has a note" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card noteEditor">
        <div className="noteMeta">
          <span>Selected: {formatHuman(selectedDate)}</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btnPrimary" onClick={onSave}>
              Save
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClear}
              disabled={!selectedHasNote && !String(draft || "").trim()}
              title="Clear note for this day"
            >
              Clear
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a simple note for this day (stored locally in this browser)…"
        />
      </div>
    </div>
  );
}
