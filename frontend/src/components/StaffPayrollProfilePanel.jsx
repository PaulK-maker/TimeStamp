import React, { useCallback, useEffect, useState } from "react";
import { listStaff, updatePayrollProfile } from "../services/staff";

const EMPTY_FORM = {
  compensationType: "",
  payRate: "",
  salaryAmount: "",
  payrollEligible: false,
  employmentStatus: "active",
  workerClassification: "",
  payrollProvider: "gusto",
  payrollProviderEmployeeId: "",
  payrollStartDate: "",
  payrollEndDate: "",
};

function toFormValues(staffMember) {
  const p = staffMember.payrollProfile || {};
  return {
    compensationType: p.compensationType || "",
    payRate: p.payRate != null ? String(p.payRate) : "",
    salaryAmount: p.salaryAmount != null ? String(p.salaryAmount) : "",
    payrollEligible: !!p.payrollEligible,
    employmentStatus: p.employmentStatus || "active",
    workerClassification: p.workerClassification || "",
    payrollProvider: p.payrollProvider || "gusto",
    payrollProviderEmployeeId: p.payrollProviderEmployeeId || "",
    payrollStartDate: p.payrollStartDate ? p.payrollStartDate.slice(0, 10) : "",
    payrollEndDate: p.payrollEndDate ? p.payrollEndDate.slice(0, 10) : "",
  };
}

function getStatus(staffMember) {
  const p = staffMember.payrollProfile || {};
  if (!p.payrollEligible) return "ineligible";
  if (p.payrollEligible && p.compensationType && p.payrollProviderEmployeeId) return "ready";
  return "incomplete";
}

const STATUS_STYLE = {
  ready: { background: "#edf7ed", color: "#1b5e20", label: "Ready" },
  incomplete: { background: "#fff8e1", color: "#f57f17", label: "Incomplete" },
  ineligible: { background: "#f5f5f5", color: "#757575", label: "Ineligible" },
};

function StatusBadge({ staffMember }) {
  const key = getStatus(staffMember);
  const style = STATUS_STYLE[key];
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 700,
        background: style.background,
        color: style.color,
      }}
    >
      {style.label}
    </span>
  );
}

const fieldStyle = { padding: 8, borderRadius: 6, border: "1px solid #ccc", width: "100%", boxSizing: "border-box" };
const labelStyle = { display: "block", marginBottom: 4, fontWeight: 600, fontSize: 13 };

export default function StaffPayrollProfilePanel() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [successId, setSuccessId] = useState(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const list = await listStaff();
      setStaffList(list);
    } catch (err) {
      setFetchError(err?.response?.data?.message || "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const startEdit = useCallback((staffMember) => {
    setEditingId(staffMember._id);
    setForm(toFormValues(staffMember));
    setSaveError("");
    setSuccessId(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError("");
  }, []);

  const setField = useCallback((key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSave = useCallback(
    async (event) => {
      event.preventDefault();
      setSaving(true);
      setSaveError("");
      try {
        const payload = {
          compensationType: form.compensationType || undefined,
          payrollEligible: form.payrollEligible,
          employmentStatus: form.employmentStatus || undefined,
          workerClassification: form.workerClassification || undefined,
          payrollProvider: form.payrollProvider || undefined,
          payrollProviderEmployeeId: form.payrollProviderEmployeeId || undefined,
          payrollStartDate: form.payrollStartDate || undefined,
          payrollEndDate: form.payrollEndDate || undefined,
        };
        if (form.compensationType === "hourly" || form.compensationType === "contractor") {
          payload.payRate = form.payRate !== "" ? parseFloat(form.payRate) : undefined;
        }
        if (form.compensationType === "salary") {
          payload.salaryAmount = form.salaryAmount !== "" ? parseFloat(form.salaryAmount) : undefined;
        }

        const updated = await updatePayrollProfile(editingId, payload);
        setStaffList((current) =>
          current.map((staffMember) =>
            staffMember._id === editingId
              ? { ...staffMember, payrollProfile: updated?.payrollProfile || staffMember.payrollProfile }
              : staffMember
          )
        );
        setSuccessId(editingId);
        setEditingId(null);
        setForm(EMPTY_FORM);
      } catch (err) {
        setSaveError(err?.response?.data?.message || "Failed to save payroll profile.");
      } finally {
        setSaving(false);
      }
    },
    [editingId, form]
  );

  return (
    <section style={{ background: "#fff", border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Staff Payroll Profiles</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Set compensation type, pay rate, and Gusto employee ID per staff member.
            SSN, banking, and tax data must be managed directly in Gusto.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchStaff}
          disabled={loading}
          style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          Refresh
        </button>
      </div>

      {fetchError ? (
        <div style={{ padding: 12, background: "#fdecea", color: "#b71c1c", borderRadius: 6, marginBottom: 12 }}>
          {fetchError}
        </div>
      ) : null}

      {loading ? <p>Loading staff...</p> : null}

      {!loading && !staffList.length ? (
        <p style={{ color: "#6b7280" }}>No staff found.</p>
      ) : null}

      {!loading && staffList.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Name</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Email</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Comp. Type</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Rate / Salary</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Employee ID</th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Status</th>
                <th style={{ textAlign: "right", padding: "10px 8px", borderBottom: "2px solid #ddd" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((staffMember) => {
                const p = staffMember.payrollProfile || {};
                const isEditing = editingId === staffMember._id;
                const rateDisplay =
                  p.compensationType === "salary"
                    ? p.salaryAmount != null
                      ? `$${p.salaryAmount.toLocaleString()}/yr`
                      : "-"
                    : p.payRate != null
                    ? `$${p.payRate}/hr`
                    : "-";

                return (
                  <React.Fragment key={staffMember._id}>
                    <tr style={{ background: isEditing ? "#f9fafb" : "transparent" }}>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee" }}>
                        {staffMember.firstName} {staffMember.lastName}
                        {successId === staffMember._id ? (
                          <span style={{ marginLeft: 8, color: "#1b5e20", fontSize: 12, fontWeight: 600 }}>Saved</span>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee", color: "#555" }}>
                        {staffMember.email}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee" }}>
                        {p.compensationType || <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee" }}>
                        {rateDisplay}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee", fontFamily: "monospace", fontSize: 13 }}>
                        {p.payrollProviderEmployeeId || <span style={{ color: "#9ca3af", fontFamily: "inherit" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee" }}>
                        <StatusBadge staffMember={staffMember} />
                      </td>
                      <td style={{ padding: "10px 8px", borderBottom: isEditing ? "none" : "1px solid #eee", textAlign: "right" }}>
                        {isEditing ? null : (
                          <button
                            type="button"
                            onClick={() => startEdit(staffMember)}
                            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>

                    {isEditing ? (
                      <tr style={{ background: "#f9fafb" }}>
                        <td colSpan={7} style={{ padding: "0 8px 16px", borderBottom: "2px solid #e5e5e5" }}>
                          <form onSubmit={handleSave} style={{ marginTop: 12 }}>
                            {saveError ? (
                              <div style={{ padding: 10, background: "#fdecea", color: "#b71c1c", borderRadius: 6, marginBottom: 12 }}>
                                {saveError}
                              </div>
                            ) : null}

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                              <div>
                                <label style={labelStyle}>Compensation Type</label>
                                <select
                                  value={form.compensationType}
                                  onChange={(e) => setField("compensationType", e.target.value)}
                                  style={fieldStyle}
                                >
                                  <option value="">— select —</option>
                                  <option value="hourly">Hourly</option>
                                  <option value="salary">Salary</option>
                                  <option value="contractor">Contractor</option>
                                </select>
                              </div>

                              {(form.compensationType === "hourly" || form.compensationType === "contractor") ? (
                                <div>
                                  <label style={labelStyle}>Pay Rate ($/hr)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.payRate}
                                    onChange={(e) => setField("payRate", e.target.value)}
                                    placeholder="e.g. 18.50"
                                    style={fieldStyle}
                                  />
                                </div>
                              ) : null}

                              {form.compensationType === "salary" ? (
                                <div>
                                  <label style={labelStyle}>Annual Salary ($)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={form.salaryAmount}
                                    onChange={(e) => setField("salaryAmount", e.target.value)}
                                    placeholder="e.g. 60000"
                                    style={fieldStyle}
                                  />
                                </div>
                              ) : null}

                              <div>
                                <label style={labelStyle}>Employment Status</label>
                                <select
                                  value={form.employmentStatus}
                                  onChange={(e) => setField("employmentStatus", e.target.value)}
                                  style={fieldStyle}
                                >
                                  <option value="active">Active</option>
                                  <option value="inactive">Inactive</option>
                                  <option value="terminated">Terminated</option>
                                </select>
                              </div>

                              <div>
                                <label style={labelStyle}>Worker Classification</label>
                                <input
                                  type="text"
                                  value={form.workerClassification}
                                  onChange={(e) => setField("workerClassification", e.target.value)}
                                  placeholder="e.g. W2, 1099"
                                  style={fieldStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>Payroll Provider</label>
                                <select
                                  value={form.payrollProvider}
                                  onChange={(e) => setField("payrollProvider", e.target.value)}
                                  style={fieldStyle}
                                >
                                  <option value="gusto">Gusto</option>
                                </select>
                              </div>

                              <div>
                                <label style={labelStyle}>Provider Employee ID</label>
                                <input
                                  type="text"
                                  value={form.payrollProviderEmployeeId}
                                  onChange={(e) => setField("payrollProviderEmployeeId", e.target.value)}
                                  placeholder="Gusto employee UUID"
                                  style={fieldStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>Payroll Start Date</label>
                                <input
                                  type="date"
                                  value={form.payrollStartDate}
                                  onChange={(e) => setField("payrollStartDate", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>

                              <div>
                                <label style={labelStyle}>Payroll End Date</label>
                                <input
                                  type="date"
                                  value={form.payrollEndDate}
                                  onChange={(e) => setField("payrollEndDate", e.target.value)}
                                  style={fieldStyle}
                                />
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22 }}>
                                <input
                                  id={`eligible-${staffMember._id}`}
                                  type="checkbox"
                                  checked={form.payrollEligible}
                                  onChange={(e) => setField("payrollEligible", e.target.checked)}
                                  style={{ width: 16, height: 16, cursor: "pointer" }}
                                />
                                <label htmlFor={`eligible-${staffMember._id}`} style={{ fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                                  Payroll eligible
                                </label>
                              </div>
                            </div>

                            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                              <button
                                type="submit"
                                disabled={saving}
                                style={{ padding: "10px 18px", borderRadius: 6, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 600 }}
                              >
                                {saving ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={saving}
                                style={{ padding: "10px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
