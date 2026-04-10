import React, { useCallback, useEffect, useState } from "react";

import { createJob, listJobs, updateJob } from "../services/jobs";

export default function JobsManagementPanel() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingJobId, setEditingJobId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    gustoJobUuid: "",
  });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const nextJobs = await listJobs({ includeInactive: true });
      setJobs(nextJobs);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const resetForm = useCallback(() => {
    setEditingJobId(null);
    setForm({ name: "", description: "", gustoJobUuid: "" });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSaving(true);
      setError("");
      try {
        if (editingJobId) {
          await updateJob(editingJobId, form);
        } else {
          await createJob(form);
        }
        resetForm();
        await fetchJobs();
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to save job.");
      } finally {
        setSaving(false);
      }
    },
    [editingJobId, fetchJobs, form, resetForm]
  );

  const startEdit = useCallback((job) => {
    setEditingJobId(job._id);
    setForm({
      name: job.name || "",
      description: job.description || "",
      gustoJobUuid: job.gustoJobUuid || "",
    });
  }, []);

  const toggleJobState = useCallback(
    async (job) => {
      setSaving(true);
      setError("");
      try {
        await updateJob(job._id, { isActive: !job.isActive });
        await fetchJobs();
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to update job state.");
      } finally {
        setSaving(false);
      }
    },
    [fetchJobs]
  );

  return (
    <div
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>🧩 Jobs</h2>
        <button
          onClick={fetchJobs}
          disabled={loading || saving}
          style={{
            padding: "8px 12px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
          }}
        >
          Refresh Jobs
        </button>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#f8d7da",
            color: "#721c24",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        style={{ display: "grid", gap: 12, gridTemplateColumns: "2fr 2fr 2fr auto", marginTop: 16 }}
      >
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Job name"
          required
          style={{ padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <input
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="Description"
          style={{ padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <input
          value={form.gustoJobUuid}
          onChange={(event) =>
            setForm((current) => ({ ...current, gustoJobUuid: event.target.value }))
          }
          placeholder="Gusto job_uuid"
          style={{ padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "10px 14px",
              backgroundColor: "#111827",
              color: "#fff",
              border: "none",
              borderRadius: 6,
            }}
          >
            {saving ? "Saving..." : editingJobId ? "Update" : "Create"}
          </button>
          {editingJobId ? (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              style={{
                padding: "10px 14px",
                backgroundColor: "#fff",
                color: "#111827",
                border: "1px solid #d1d5db",
                borderRadius: 6,
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <p style={{ marginTop: 16 }}>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p style={{ marginTop: 16, color: "#6b7280" }}>No jobs configured yet.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ marginTop: 16, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Description</th>
              <th align="left">Gusto job_uuid</th>
              <th align="left">Status</th>
              <th align="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job._id} style={{ borderTop: "1px solid #eee" }}>
                <td>{job.name}</td>
                <td>{job.description || "-"}</td>
                <td>{job.gustoJobUuid || "-"}</td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      backgroundColor: job.isActive ? "#d1e7dd" : "#f8d7da",
                      color: job.isActive ? "#0f5132" : "#842029",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {job.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td align="right">
                  <button
                    onClick={() => startEdit(job)}
                    disabled={saving}
                    style={{
                      padding: "6px 10px",
                      marginRight: 8,
                      backgroundColor: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleJobState(job)}
                    disabled={saving}
                    style={{
                      padding: "6px 10px",
                      backgroundColor: job.isActive ? "#dc3545" : "#16a34a",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                    }}
                  >
                    {job.isActive ? "Archive" : "Reactivate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}