import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

function Toast({ toast, onClose }) {
  if (!toast) return null;

  const colors = {
    success: { bg: "#d1e7dd", fg: "#0f5132", border: "#badbcc" },
    error: { bg: "#f8d7da", fg: "#842029", border: "#f5c2c7" },
    info: { bg: "#cff4fc", fg: "#055160", border: "#b6effb" },
  };

  const c = colors[toast.type] || colors.info;

  return (
    <div
      role="status"
      style={{
        padding: "12px",
        backgroundColor: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        borderRadius: "6px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        marginBottom: "12px",
      }}
    >
      <div style={{ flex: 1 }}>{toast.message}</div>
      <button
        onClick={onClose}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontWeight: 700,
          color: c.fg,
        }}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export default function UserManagementTable() {
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | admin | caregiver
  const [statusFilter, setStatusFilter] = useState("active"); // active | inactive | all

  const [currentCaregiverId, setCurrentCaregiverId] = useState(null);
  const [pendingById, setPendingById] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      const id = res?.data?.user?.caregiverId || res?.data?.user?.id || null;
      setCurrentCaregiverId(id);
    } catch {
      // Non-fatal: UI will still work, but self-protect buttons may not disable.
    }
  }, []);

  const fetchCaregivers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/caregivers");
      const list = Array.isArray(res.data) ? res.data : [];
      setCaregivers(list);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
    fetchCaregivers();
  }, [fetchCaregivers, fetchCurrentUser]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return caregivers
      .filter((c) => {
        if (roleFilter !== "all" && c.role !== roleFilter) return false;

        const active = c.isActive !== false;
        if (statusFilter === "active" && !active) return false;
        if (statusFilter === "inactive" && active) return false;

        if (!q) return true;

        const name = `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase();
        const email = String(c.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => {
        const aActive = a.isActive !== false;
        const bActive = b.isActive !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
        return String(a.email || "").localeCompare(String(b.email || ""));
      });
  }, [caregivers, roleFilter, searchText, statusFilter]);

  const setPending = useCallback((id, patch) => {
    setPendingById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }, []);

  const clearPending = useCallback((id) => {
    setPendingById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updateCaregiverLocal = useCallback((id, patch) => {
    setCaregivers((prev) => prev.map((c) => (c._id === id ? { ...c, ...patch } : c)));
  }, []);

  const handlePromote = useCallback(
    async (c) => {
      if (!c?._id) return;

      if (c.isActive === false) {
        showToast("error", "Cannot promote an inactive user.");
        return;
      }

      if (c.role === "admin") {
        showToast("info", "User is already an admin.");
        return;
      }

      const ok = window.confirm(`Promote ${c.email} to admin?`);
      if (!ok) return;

      setPending(c._id, { action: "promote" });

      try {
        await api.post("/admin/promote", { caregiverId: c._id, email: c.email });
        updateCaregiverLocal(c._id, { role: "admin" });
        showToast("success", `Promoted ${c.email} to admin.`);
      } catch (e) {
        showToast(
          "error",
          e?.response?.data?.message || `Failed to promote ${c.email}`
        );
      } finally {
        clearPending(c._id);
      }
    },
    [clearPending, setPending, showToast, updateCaregiverLocal]
  );

  const handleDemote = useCallback(
    async (c) => {
      if (!c?._id) return;

      if (c.isActive === false) {
        showToast("error", "Cannot demote an inactive user.");
        return;
      }

      if (c.role !== "admin") {
        showToast("info", "User is already a caregiver.");
        return;
      }

      if (currentCaregiverId && String(currentCaregiverId) === String(c._id)) {
        showToast("error", "You can’t demote your own account.");
        return;
      }

      const ok = window.confirm(`Demote ${c.email} from admin to caregiver?`);
      if (!ok) return;

      setPending(c._id, { action: "demote" });

      try {
        await api.post("/admin/demote", { caregiverId: c._id, email: c.email });
        updateCaregiverLocal(c._id, { role: "caregiver" });
        showToast("success", `Demoted ${c.email} to caregiver.`);
      } catch (e) {
        showToast(
          "error",
          e?.response?.data?.message || `Failed to demote ${c.email}`
        );
      } finally {
        clearPending(c._id);
      }
    },
    [clearPending, currentCaregiverId, setPending, showToast, updateCaregiverLocal]
  );

  const handleDelete = useCallback(
    async (c) => {
      if (!c?._id) return;

      if (currentCaregiverId && String(currentCaregiverId) === String(c._id)) {
        showToast("error", "You can’t delete your own account.");
        return;
      }

      const ok = window.confirm(
        `Delete ${c.email}?\n\nThis will remove their Clerk account and deactivate them in the database.`
      );
      if (!ok) return;

      setPending(c._id, { action: "delete" });

      try {
        await api.delete(`/admin/users/${c._id}`);
        updateCaregiverLocal(c._id, { isActive: false, role: "caregiver" });
        showToast("success", `Deleted ${c.email}.`);
      } catch (e) {
        showToast(
          "error",
          e?.response?.data?.message || `Failed to delete ${c.email}`
        );
      } finally {
        clearPending(c._id);
      }
    },
    [clearPending, currentCaregiverId, setPending, showToast, updateCaregiverLocal]
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>👥 User Management</h2>

        <button
          onClick={fetchCaregivers}
          disabled={loading}
          style={{
            padding: "8px 12px",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          Refresh Users
        </button>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {error && (
        <div
          style={{
            padding: "12px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "6px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search name or email..."
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #ddd",
            minWidth: "260px",
          }}
        />

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #ddd",
          }}
        >
          <option value="all">All roles</option>
          <option value="admin">Admins</option>
          <option value="caregiver">Caregivers</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #ddd",
          }}
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
          <option value="all">All statuses</option>
        </select>

        <div style={{ color: "#666" }}>
          Showing <strong>{filtered.length}</strong> of <strong>{caregivers.length}</strong>
        </div>
      </div>

      {loading ? (
        <p>Loading users...</p>
      ) : filtered.length === 0 ? (
        <p>No users match your filters.</p>
      ) : (
        <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Role</th>
              <th align="left">Status</th>
              <th align="left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isSelf = currentCaregiverId && String(currentCaregiverId) === String(c._id);
              const active = c.isActive !== false;
              const pending = pendingById[c._id]?.action;

              const badgeStyle = (bg, fg) => ({
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "999px",
                backgroundColor: bg,
                color: fg,
                fontSize: "12px",
                fontWeight: 700,
              });

              return (
                <tr key={c._id} style={{ borderTop: "1px solid #eee" }}>
                  <td>
                    {c.firstName} {c.lastName}
                    {isSelf ? <span style={{ marginLeft: 8, color: "#666" }}>(you)</span> : null}
                  </td>
                  <td>{c.email}</td>
                  <td>
                    {c.role === "admin" ? (
                      <span style={badgeStyle("#e7f1ff", "#0b5ed7")}>admin</span>
                    ) : (
                      <span style={badgeStyle("#f1f3f5", "#343a40")}>caregiver</span>
                    )}
                  </td>
                  <td>
                    {active ? (
                      <span style={badgeStyle("#d1e7dd", "#0f5132")}>active</span>
                    ) : (
                      <span style={badgeStyle("#f8d7da", "#842029")}>inactive</span>
                    )}
                  </td>
                  <td style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => handlePromote(c)}
                      disabled={!active || isSelf || pending}
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#198754",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: !active || isSelf || pending ? "not-allowed" : "pointer",
                        opacity: c.role === "admin" ? 0.55 : 1,
                      }}
                      title={c.role === "admin" ? "Already an admin" : "Promote to admin"}
                    >
                      {pending === "promote" ? "Promoting..." : "Promote"}
                    </button>

                    <button
                      onClick={() => handleDemote(c)}
                      disabled={!active || isSelf || pending}
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#ffc107",
                        color: "#1f1f1f",
                        border: "none",
                        borderRadius: "4px",
                        cursor: !active || isSelf || pending ? "not-allowed" : "pointer",
                        opacity: c.role !== "admin" ? 0.55 : 1,
                      }}
                      title={c.role !== "admin" ? "Not an admin" : "Demote to caregiver"}
                    >
                      {pending === "demote" ? "Demoting..." : "Demote"}
                    </button>

                    <button
                      onClick={() => handleDelete(c)}
                      disabled={isSelf || pending}
                      style={{
                        padding: "6px 10px",
                        backgroundColor: "#dc3545",
                        color: "#fff",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isSelf || pending ? "not-allowed" : "pointer",
                        opacity: active ? 1 : 0.7,
                      }}
                      title={
                        isSelf
                          ? "You cannot delete yourself"
                          : "Delete in Clerk + deactivate in DB"
                      }
                    >
                      {pending === "delete" ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: "10px", color: "#666", fontSize: 12 }}>
        Delete removes the Clerk account and marks the user inactive locally (time logs stay intact).
      </div>
    </div>
  );
}
