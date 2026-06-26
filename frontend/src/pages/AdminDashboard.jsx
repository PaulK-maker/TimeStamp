// // src/pages/AdminDashboard.jsx
// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import Header from "../components/Header";
// import api from "../services/api";

// const AdminDashboard = () => {
//   const [logs, setLogs] = useState([]);
//   const [totals, setTotals] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMsg, setErrorMsg] = useState("");

//   const navigate = useNavigate();

//   const logout = () => {
//     localStorage.removeItem("token");
//     navigate("/login");
//   };

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (!token) {
//       navigate("/login");
//       return;
//     }

//     const fetchTimeLogs = async () => {
//       try {
//         const res = await api.get("/admin/timelogs");

//         const logsData = res.data.logs || [];
//         setLogs(logsData);

//         // ✅ Calculate total hours per caregiver (frontend-safe)
//         const totalsMap = {};

//         logsData.forEach((log) => {
//           if (!log.clockIn || !log.clockOut || !log.caregiver) return;

//           const hours =
//             (new Date(log.clockOut) - new Date(log.clockIn)) /
//             (1000 * 60 * 60);

//           const caregiverId = log.caregiver._id;

//           if (!totalsMap[caregiverId]) {
//             totalsMap[caregiverId] = {
//               caregiver: log.caregiver,
//               totalHours: 0,
//             };
//           }

//           totalsMap[caregiverId].totalHours += hours;
//         });

//         setTotals(Object.values(totalsMap));
//         setLoading(false);
//       } catch (err) {
//         console.error("FETCH ERROR:", err);
//         setLoading(false);

//         if (err.response?.status === 401) {
//           setErrorMsg("Unauthorized. Please log in again.");
//           logout();
//         } else {
//           setErrorMsg("Failed to load time logs.");
//         }
//       }
//     };

//     fetchTimeLogs();
//   }, [navigate]);

//   if (loading) return <p>Loading...</p>;

//   return (
//     <div>
//       <Header />

//       <div style={{ padding: "20px" }}>
//         <h1>Admin Dashboard</h1>
//         <button onClick={logout}>Logout</button>

//         {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

//         <h2>All Time Logs</h2>
//         {logs.length === 0 ? (
//           <p>No time logs found</p>
//         ) : (
//           <table border="1" cellPadding="5" width="100%">
//             <thead>
//               <tr>
//                 <th>Caregiver</th>
//                 <th>Clock In</th>
//                 <th>Clock Out</th>
//                 <th>Hours</th>
//               </tr>
//             </thead>
//             <tbody>
//               {logs.map((log) => {
//                 const hours =
//                   log.clockIn && log.clockOut
//                     ? (
//                         (new Date(log.clockOut) -
//                           new Date(log.clockIn)) /
//                         (1000 * 60 * 60)
//                       ).toFixed(2)
//                     : "-";

//                 return (
//                   <tr key={log._id}>
//                     <td>
//                       {log.caregiver?.firstName}{" "}
//                       {log.caregiver?.lastName}
//                     </td>
//                     <td>
//                       {log.clockIn
//                         ? new Date(log.clockIn).toLocaleString()
//                         : "-"}
//                     </td>
//                     <td>
//                       {log.clockOut
//                         ? new Date(log.clockOut).toLocaleString()
//                         : "-"}
//                     </td>
//                     <td>{hours}</td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>
//         )}

//         <h2>Total Hours per Caregiver</h2>
//         {totals.length === 0 ? (
//           <p>No totals available</p>
//         ) : (
//           <ul>
//             {totals.map((item) => (
//               <li key={item.caregiver._id}>
//                 {item.caregiver.firstName}{" "}
//                 {item.caregiver.lastName}:{" "}
//                 {item.totalHours.toFixed(2)} hrs
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// };

// export default AdminDashboard;


// import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import Header from "../components/Header";
// import api from "../services/api";

// const AdminDashboard = () => {
//   const [logs, setLogs] = useState([]);
//   const [totals, setTotals] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [errorMsg, setErrorMsg] = useState("");
//   const navigate = useNavigate();

//   const logout = () => {
//     localStorage.removeItem("token");
//     navigate("/login");
//   };

//   const fetchTimeLogs = async () => {
//     setLoading(true);
//     setErrorMsg("");

//     try {
//       const res = await api.get("/admin/timelogs");
//       setLogs(res.data.logs || []);
//       setTotals(res.data.totalHoursPerCaregiver || []);
//     } catch (err) {
//       console.error("Error fetching time logs:", err);
//       if (err.response && err.response.status === 401) {
//         setErrorMsg("Unauthorized. Please log in again.");
//         logout();
//       } else {
//         setErrorMsg("Failed to load time logs.");
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (!token) return navigate("/login");
//     fetchTimeLogs();
//   }, [navigate]);

//   if (loading) return <p>Loading...</p>;

//   return (
//     <div>
//       <Header />
//       <div style={{ padding: "20px" }}>
//         <button onClick={logout}>Logout</button>
//         {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

//         <h2>All Time Logs</h2>
//         {logs.length === 0 ? (
//           <p>No time logs</p>
//         ) : (
//           <table border="1" cellPadding="5" width="100%">
//             <thead>
//               <tr>
//                 <th>Caregiver</th>
//                 <th>Clock In</th>
//                 <th>Clock Out</th>
//                 <th>Hours</th>
//               </tr>
//             </thead>
//             <tbody>
//               {logs.map((log) => (
//                 <tr key={log._id || log.id}>
//                   <td>{log.caregiver?.firstName} {log.caregiver?.lastName}</td>
//                   <td>{log.clockIn ? new Date(log.clockIn).toLocaleString() : "-"}</td>
//                   <td>{log.clockOut ? new Date(log.clockOut).toLocaleString() : "-"}</td>
//                   <td>{log.totalHours !== undefined ? log.totalHours.toFixed(2) : "-"}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}

//         <h2>Total Hours per Caregiver</h2>
//         {totals.length === 0 ? (
//           <p>No totals available</p>
//         ) : (
//           <ul>
//             {totals.map((item) => (
//               <li key={item.caregiver._id}>
//                 {item.caregiver.firstName} {item.caregiver.lastName}: {item.totalHours.toFixed(2)} hrs
//               </li>
//             ))}
//           </ul>
//         )}
//       </div>
//     </div>
//   );
// };

// export default AdminDashboard;

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import JobsManagementPanel from "../components/JobsManagementPanel";
import UserManagementTable from "../components/UserManagementTable";
import api from "../services/api";
import { getMe } from "../services/me";

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [tenantCode, setTenantCode] = useState(null);
  const [tenantName, setTenantName] = useState(null);

  const [missedPunchRequests, setMissedPunchRequests] = useState([]);
  const [mpLoading, setMpLoading] = useState(false);
  const [mpError, setMpError] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteCopyCode, setInviteCopyCode] = useState("");

  const [logSearchText, setLogSearchText] = useState("");
  const [logDateStart, setLogDateStart] = useState("");
  const [logDateEnd, setLogDateEnd] = useState("");
  const [logSort, setLogSort] = useState("punchIn_desc");
  const [logPage, setLogPage] = useState(1);
  const [totalsSort, setTotalsSort] = useState("hours_desc");

  const navigate = useNavigate();

  const formatTenantCode = useCallback((code) => {
    const normalized = (code || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "");
    if (!normalized) return "";
    if (normalized.length <= 4) return normalized;
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }, []);

  /* =======================
     Logout (Clerk-aware)
  ======================= */
  const logout = useCallback(() => {
    navigate("/sign-out", { replace: true });
  }, [navigate]);

  /* =======================
     Calculate totals
  ======================= */
  const calculateTotals = useCallback((logsData) => {
    const totalsMap = {};

    logsData.forEach((log) => {
      if (!log.punchIn || !log.punchOut || !log.staff?._id) return;

      const hours =
        (new Date(log.punchOut) - new Date(log.punchIn)) /
        (1000 * 60 * 60);

      const staffId = log.staff._id;

      if (!totalsMap[staffId]) {
        totalsMap[staffId] = {
          staff: log.staff,
          totalHours: 0,
        };
      }

      totalsMap[staffId].totalHours += hours;
    });

    return Object.values(totalsMap);
  }, []);

  /* =======================
     Fetch admin time logs
  ======================= */
  const fetchTimeLogs = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await api.get("/admin/timelogs");

      const logsData = Array.isArray(res.data.logs)
        ? res.data.logs
        : [];

      setLogs(logsData);
      setTotals(calculateTotals(logsData));
    } catch (err) {
      console.error("FETCH TIME LOGS ERROR:", err);

      if (err.response?.status === 401) {
        setErrorMsg("Session expired. Please log in again.");
        logout();
      } else if (err.response?.status === 403) {
        const code = err.response?.data?.code;
        const feature = err.response?.data?.feature;
        if (code === "PLAN_REQUIRED") {
          setErrorMsg("Select a plan on Billing to use this feature.");
        } else if (code === "FEATURE_NOT_AVAILABLE") {
          setErrorMsg(
            `Your plan doesn’t include this feature${feature ? ` (${feature})` : ""}. Upgrade on Billing to unlock it.`
          );
        } else {
          setErrorMsg(err.response?.data?.message || "Access denied.");
        }
      } else {
        setErrorMsg(
          err.response?.data?.message ||
            "Failed to load time logs."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [calculateTotals, logout]);

  const fetchMissedPunchRequests = useCallback(async () => {
    setMpLoading(true);
    setMpError("");
    try {
      const res = await api.get("/admin/missed-punch-requests", {
        params: { status: "pending" },
      });
      setMissedPunchRequests(Array.isArray(res.data.requests) ? res.data.requests : []);
    } catch (err) {
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setMpError(err.response?.data?.message || "Failed to load missed punch requests.");
    } finally {
      setMpLoading(false);
    }
  }, [logout]);

  const approveMissedPunchRequest = useCallback(
    async (requestId) => {
      if (!requestId) return;
      setMpLoading(true);
      setMpError("");
      try {
        await api.post(`/admin/missed-punch-requests/${requestId}/approve`, {
          adminNote: "",
        });
        await fetchMissedPunchRequests();
      } catch (err) {
        setMpError(err.response?.data?.message || "Failed to approve request.");
      } finally {
        setMpLoading(false);
      }
    },
    [fetchMissedPunchRequests]
  );

  const rejectMissedPunchRequest = useCallback(
    async (requestId) => {
      if (!requestId) return;
      setMpLoading(true);
      setMpError("");
      try {
        await api.post(`/admin/missed-punch-requests/${requestId}/reject`, {
          adminNote: "",
        });
        await fetchMissedPunchRequests();
      } catch (err) {
        setMpError(err.response?.data?.message || "Failed to reject request.");
      } finally {
        setMpLoading(false);
      }
    },
    [fetchMissedPunchRequests]
  );

  /* =======================
     Init on page load
  ======================= */
  useEffect(() => {
    fetchTimeLogs();
    fetchMissedPunchRequests();
  }, [fetchTimeLogs, fetchMissedPunchRequests]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const me = await getMe({ forceRefresh: true });
        if (cancelled) return;
        setTenantCode(me?.tenantCode || null);
        setTenantName(me?.tenantName || null);
      } catch {
        if (cancelled) return;
        setTenantCode(null);
        setTenantName(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =======================
     Helpers
  ======================= */
  /* =======================
     Invite staff
  ======================= */
  const handleSendInviteOtp = useCallback(async () => {
    setInviteStatus("");
    setInviteCopyCode("");
    setInviteBusy(true);
    try {
      const res = await api.post("/tenant/otp/send-join", { toEmail: inviteEmail.trim() });
      if (res.data?.code === "MAIL_NOT_CONFIGURED" && res.data?.inviteCode) {
        setInviteCopyCode(res.data.inviteCode);
        setInviteStatus("Email isn't configured — copy the code below and send it manually.");
      } else {
        setInviteStatus(res.data?.message || "Invite code sent!");
      }
    } catch (err) {
      setInviteStatus(err?.response?.data?.message || "Failed to send invite code.");
    } finally {
      setInviteBusy(false);
    }
  }, [inviteEmail]);

  const closeInviteModal = useCallback(() => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteStatus("");
    setInviteCopyCode("");
  }, []);

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "-";

  const formatHours = (hours) =>
    typeof hours === "number" ? hours.toFixed(2) : "-";

  const LOGS_PAGE_SIZE = 15;

  const filteredLogs = useMemo(() => {
    const search = logSearchText.trim().toLowerCase();

    const next = logs
      .filter((log) => {
        if (logDateStart) {
          const start = new Date(`${logDateStart}T00:00:00`);
          if (new Date(log.punchIn) < start) return false;
        }

        if (logDateEnd) {
          const end = new Date(`${logDateEnd}T23:59:59.999`);
          if (new Date(log.punchIn) > end) return false;
        }

        if (!search) return true;

        const staffName = `${log.staff?.firstName || ""} ${log.staff?.lastName || ""}`.trim().toLowerCase();
        const email = String(log.staff?.email || "").toLowerCase();
        const job = String(log.jobSnapshot?.name || log.job?.name || "").toLowerCase();
        return staffName.includes(search) || email.includes(search) || job.includes(search);
      })
      .sort((a, b) => {
        if (logSort === "hours_desc" || logSort === "hours_asc") {
          const aHours = a.punchIn && a.punchOut ? (new Date(a.punchOut) - new Date(a.punchIn)) / (1000 * 60 * 60) : 0;
          const bHours = b.punchIn && b.punchOut ? (new Date(b.punchOut) - new Date(b.punchIn)) / (1000 * 60 * 60) : 0;
          return logSort === "hours_desc" ? bHours - aHours : aHours - bHours;
        }

        const aPunchIn = new Date(a.punchIn).getTime();
        const bPunchIn = new Date(b.punchIn).getTime();
        return logSort === "punchIn_asc" ? aPunchIn - bPunchIn : bPunchIn - aPunchIn;
      });

    return next;
  }, [logs, logDateEnd, logDateStart, logSearchText, logSort]);

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PAGE_SIZE));

  const pagedLogs = useMemo(() => {
    const start = (logPage - 1) * LOGS_PAGE_SIZE;
    return filteredLogs.slice(start, start + LOGS_PAGE_SIZE);
  }, [filteredLogs, logPage]);

  const sortedTotals = useMemo(() => {
    const next = [...totals];
    next.sort((a, b) => {
      if (totalsSort === "name_asc" || totalsSort === "name_desc") {
        const aName = `${a.staff?.firstName || ""} ${a.staff?.lastName || ""}`.trim().toLowerCase();
        const bName = `${b.staff?.firstName || ""} ${b.staff?.lastName || ""}`.trim().toLowerCase();
        const cmp = aName.localeCompare(bName);
        return totalsSort === "name_asc" ? cmp : -cmp;
      }

      const aHours = Number(a.totalHours || 0);
      const bHours = Number(b.totalHours || 0);
      return totalsSort === "hours_asc" ? aHours - bHours : bHours - aHours;
    });

    return next;
  }, [totals, totalsSort]);

  useEffect(() => {
    setLogPage(1);
  }, [logSearchText, logDateStart, logDateEnd, logSort]);

  useEffect(() => {
    if (logPage > totalLogPages) {
      setLogPage(totalLogPages);
    }
  }, [logPage, totalLogPages]);

  if (loading && !logs.length) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  /* =======================
     Render
  ======================= */
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Header title="Admin Dashboard" />

      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
            {tenantCode ? (
              <div style={{ marginTop: 6, color: "#555" }}>
                Facility code (support/reference): {" "}
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {formatTenantCode(tenantCode)}
                </span>
                {tenantName ? <span> • {tenantName}</span> : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              onClick={fetchTimeLogs}
              disabled={refreshing}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              🔄 Refresh
            </button>

            <button
              onClick={() => navigate("/admin/reports/print")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              🖨️ Print Report
            </button>


            <button
              onClick={() => navigate("/admin/payroll")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#111827",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Payroll
            </button>
            <button
              onClick={() => navigate("/staff")}
              style={{
                padding: "8px 16px",
                backgroundColor: "#17a2b8",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Switch to Staff View
            </button>

            <button
              onClick={() => setInviteOpen(true)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#059669",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              ✉️ Invite Staff
            </button>

            <button
              onClick={logout}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "12px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              borderRadius: "4px",
              marginBottom: "20px",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Time Logs */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <h2>📋 All Time Logs ({filteredLogs.length})</h2>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <input
              value={logSearchText}
              onChange={(e) => setLogSearchText(e.target.value)}
              placeholder="Search staff, email, or job..."
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ddd",
                minWidth: 240,
                flex: "1 1 260px",
              }}
            />
            <input
              type="date"
              value={logDateStart}
              onChange={(e) => setLogDateStart(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
            />
            <input
              type="date"
              value={logDateEnd}
              onChange={(e) => setLogDateEnd(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
            />
            <select
              value={logSort}
              onChange={(e) => setLogSort(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
            >
              <option value="punchIn_desc">Newest first</option>
              <option value="punchIn_asc">Oldest first</option>
              <option value="hours_desc">Longest shifts</option>
              <option value="hours_asc">Shortest shifts</option>
            </select>
          </div>

          {filteredLogs.length === 0 ? (
            <p>No time logs found.</p>
          ) : (
            <>
            <table width="100%" cellPadding="8">
              <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 1 }}>
                <tr>
                  <th align="left">Staff</th>
                  <th align="left">Email</th>
                  <th align="left">Job</th>
                  <th align="left">Punch In</th>
                  <th align="left">Punch Out</th>
                  <th align="right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((log) => {
                  const hours =
                    log.punchIn && log.punchOut
                      ? (new Date(log.punchOut) -
                          new Date(log.punchIn)) /
                        (1000 * 60 * 60)
                      : null;

                  return (
                    <tr key={log._id}>
                      <td>
                        {log.staff?.firstName}{" "}
                        {log.staff?.lastName}
                      </td>
                      <td>{log.staff?.email}</td>
                      <td>{log.jobSnapshot?.name || log.job?.name || "-"}</td>
                      <td>{formatDateTime(log.punchIn)}</td>
                      <td>{formatDateTime(log.punchOut)}</td>
                      <td align="right">
                        {formatHours(hours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
              <div style={{ color: "#555", fontSize: 13 }}>
                Showing {pagedLogs.length} of {filteredLogs.length} entries
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
                  disabled={logPage <= 1}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: logPage <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Prev
                </button>
                <span style={{ color: "#444", fontSize: 13 }}>
                  Page {logPage} / {totalLogPages}
                </span>
                <button
                  onClick={() => setLogPage((prev) => Math.min(totalLogPages, prev + 1))}
                  disabled={logPage >= totalLogPages}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                    cursor: logPage >= totalLogPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        <JobsManagementPanel />

        {/* User Management */}
        <UserManagementTable />

        {/* Missed Punch Requests */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>🕒 Missed Punch Requests</h2>
            <button
              onClick={fetchMissedPunchRequests}
              disabled={mpLoading}
              style={{
                padding: "8px 12px",
                backgroundColor: "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
              }}
            >
              Refresh
            </button>
          </div>

          {mpError && (
            <div
              style={{
                marginTop: 12,
                padding: "12px",
                backgroundColor: "#f8d7da",
                color: "#721c24",
                borderRadius: "4px",
              }}
            >
              {mpError}
            </div>
          )}

          {mpLoading ? (
            <p>Loading requests...</p>
          ) : missedPunchRequests.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No pending requests.</p>
          ) : (
            <table width="100%" cellPadding="8" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th align="left">Staff</th>
                  <th align="left">Email</th>
                  <th align="left">Shift Punch In</th>
                  <th align="left">Requested Punch Out</th>
                  <th align="left">Reason</th>
                  <th align="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {missedPunchRequests.map((r) => (
                  <tr key={r._id}>
                    <td>
                      {r.staff?.firstName} {r.staff?.lastName}
                    </td>
                    <td>{r.staff?.email}</td>
                    <td>
                      {r.timeEntry?.punchIn
                        ? new Date(r.timeEntry.punchIn).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {r.requestedTime
                        ? new Date(r.requestedTime).toLocaleString()
                        : "-"}
                    </td>
                    <td style={{ color: "#6b7280" }}>{r.reason || "-"}</td>
                    <td align="right">
                      <button
                        onClick={() => approveMissedPunchRequest(r._id)}
                        disabled={mpLoading}
                        style={{
                          padding: "6px 10px",
                          marginRight: 8,
                          backgroundColor: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: mpLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectMissedPunchRequest(r._id)}
                        disabled={mpLoading}
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: mpLoading ? "not-allowed" : "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <h2>📊 Total Hours per Staff Member</h2>

          {sortedTotals.length === 0 ? (
            <p>No completed shifts.</p>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                <div style={{ color: "#555", fontSize: 13 }}>
                  Ranked by selected sort
                </div>
                <select
                  value={totalsSort}
                  onChange={(e) => setTotalsSort(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ddd" }}
                >
                  <option value="hours_desc">Most hours first</option>
                  <option value="hours_asc">Least hours first</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
              </div>

              <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Rank</th>
                    <th align="left">Staff</th>
                    <th align="left">Email</th>
                    <th align="right">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTotals.map((item, idx) => (
                    <tr key={item.staff._id} style={{ borderTop: "1px solid #eee" }}>
                      <td>#{idx + 1}</td>
                      <td>{item.staff.firstName} {item.staff.lastName}</td>
                      <td>{item.staff.email || "-"}</td>
                      <td align="right"><strong>{item.totalHours.toFixed(2)} hrs</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* Invite Staff Modal */}
      {inviteOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget && !inviteBusy) closeInviteModal(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          <div style={{
            background: "white", borderRadius: 14, padding: 28,
            width: "100%", maxWidth: 480,
            boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
          }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: 20, color: "#111827" }}>Invite Staff Member</h3>
            <p style={{ margin: "0 0 20px 0", color: "#6b7280", fontSize: 14 }}>
              A 6-digit join code will be emailed to the staff member. They sign up with that
              same email address, then enter the code to join this facility.
            </p>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Staff email address
            </label>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setInviteStatus(""); setInviteCopyCode(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && inviteEmail.trim() && !inviteBusy) handleSendInviteOtp(); }}
                placeholder="staff@facility.com"
                style={{
                  flex: 1, padding: "10px 12px",
                  borderRadius: 8, border: "1px solid #d1d5db",
                  fontSize: 14,
                }}
              />
              <button
                onClick={handleSendInviteOtp}
                disabled={inviteBusy || !inviteEmail.trim()}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: inviteBusy || !inviteEmail.trim() ? "#94a3b8" : "#059669",
                  color: "white", fontWeight: 600, fontSize: 14,
                  cursor: inviteBusy || !inviteEmail.trim() ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {inviteBusy ? "Sending…" : "Send Code"}
              </button>
            </div>

            {inviteStatus && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 14,
                background: inviteCopyCode ? "#fefce8" : "#f0fdf4",
                color: inviteCopyCode ? "#713f12" : "#166534",
                border: inviteCopyCode ? "1px solid #fde68a" : "1px solid #bbf7d0",
              }}>
                {inviteStatus}
              </div>
            )}

            {inviteCopyCode && (
              <div style={{
                background: "#fff8e6", border: "1px solid #ffe7b8",
                borderRadius: 10, padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>Share this code with the staff member:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 28, fontWeight: 800,
                    letterSpacing: 6, color: "#111827",
                  }}>
                    {inviteCopyCode}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(inviteCopyCode).catch(() => {})}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
                      background: "white", fontSize: 13, cursor: "pointer", color: "#374151",
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#475569" }}>
              <strong style={{ color: "#1e293b" }}>Staff onboarding steps:</strong>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                <li>Staff signs up at the app using this exact email address</li>
                <li>After sign-in they land on the Join screen</li>
                <li>They enter the 6-digit code → joined and ready to clock in</li>
              </ol>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              {!inviteCopyCode && !inviteStatus && (
                <button
                  onClick={closeInviteModal}
                  disabled={inviteBusy}
                  style={{
                    padding: "10px 20px", borderRadius: 8,
                    border: "1px solid #d1d5db", background: "white",
                    fontSize: 14, color: "#374151", cursor: inviteBusy ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                onClick={closeInviteModal}
                style={{
                  padding: "10px 20px", borderRadius: 8, border: "none",
                  background: inviteStatus ? "#059669" : "#6b7280",
                  color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                {inviteStatus ? "Done" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;