import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import Header from "../components/Header";
import api from "../services/api";
import { getMe } from "../services/me";

const CaregiverDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [totalHours, setTotalHours] = useState(0);
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState(false);

  const [missedPunchRequests, setMissedPunchRequests] = useState([]);
  const [requestingEntryId, setRequestingEntryId] = useState(null);
  const [requestedTimeLocal, setRequestedTimeLocal] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestStatusMsg, setRequestStatusMsg] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  const navigate = useNavigate();
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }

    getMe({ forceRefresh: true })
      .then((me) => setIsAdmin(me?.role === "admin"))
      .catch(() => {
        // If /auth/me briefly fails during sign-in, we don't want to break the page.
        // Admin button will simply not render.
        setIsAdmin(false);
      });
  }, [isLoaded, isSignedIn]);

  const logout = useCallback(() => {
    navigate("/sign-out", { replace: true });
  }, [navigate]);

  const calculateTotals = useCallback((logsData) => {
    const total = logsData.reduce((sum, log) => {
      const out = log.effectivePunchOut ?? log.punchOut;
      const inn = log.effectivePunchIn ?? log.punchIn;

      if (inn && out) {
        return (
          sum +
          (new Date(out) - new Date(inn)) /
            (1000 * 60 * 60)
        );
      }
      return sum;
    }, 0);

    setTotalHours(total);

    const activeShift = logsData.find((log) => log.punchIn && !log.punchOut);
    setCurrentlyClockedIn(!!activeShift);
  }, []);

  const toLocalDateTimeValue = (d) => {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
    const local = new Date(date.getTime() - tzOffsetMs);
    return local.toISOString().slice(0, 16);
  };

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await api.get("/missed-punch/requests/mine");
      setMissedPunchRequests(Array.isArray(res.data.requests) ? res.data.requests : []);
    } catch (err) {
      // Non-fatal; requests are an optional helper feature.
    }
  }, []);

  const fetchMyLogs = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const res = await api.get("/timeclock/my-logs");
      const logsData = res.data.logs || [];
      setLogs(logsData);
      calculateTotals(logsData);
      fetchMyRequests();
    } catch (err) {
      console.error("FETCH LOGS ERROR:", err);
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setError(err.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [calculateTotals, fetchMyRequests, logout]);

  const handlePunchIn = async () => {
    try {
      setError("");
      setLoading(true);
      await api.post("/timeclock/punch-in", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH IN ERROR:", err);
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setError(err.response?.data?.message || "Punch in failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setError("");
      setLoading(true);
      await api.post("/timeclock/punch-out", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH OUT ERROR:", err);
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setError(err.response?.data?.message || "Punch out failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchMyLogs();
  }, [fetchMyLogs, isLoaded, isSignedIn]);

  const formatDateTime = (date) => (date ? new Date(date).toLocaleString() : "-");

  const latestRequestByEntryId = missedPunchRequests.reduce((acc, r) => {
    const entryId = r?.timeEntry?._id || r?.timeEntry;
    if (!entryId) return acc;
    const key = String(entryId);
    const existing = acc[key];
    if (!existing) {
      acc[key] = r;
      return acc;
    }
    const existingCreated = new Date(existing.createdAt || 0).getTime();
    const currentCreated = new Date(r.createdAt || 0).getTime();
    if (currentCreated > existingCreated) acc[key] = r;
    return acc;
  }, {});

  const openMissedPunchRequest = (entry) => {
    setRequestStatusMsg("");
    setRequestingEntryId(entry?._id || null);
    setRequestedTimeLocal(toLocalDateTimeValue(new Date()));
    setRequestReason("");
  };

  const submitMissedPunchRequest = async () => {
    if (!requestingEntryId) return;
    setRequestBusy(true);
    setRequestStatusMsg("");
    try {
      await api.post("/missed-punch/requests", {
        timeEntryId: requestingEntryId,
        missingField: "punchOut",
        requestedTime: new Date(requestedTimeLocal).toISOString(),
        reason: requestReason,
      });
      setRequestStatusMsg("Request submitted.");
      setRequestingEntryId(null);
      await fetchMyRequests();
      await fetchMyLogs();
    } catch (err) {
      setRequestStatusMsg(err.response?.data?.message || "Failed to submit request");
    } finally {
      setRequestBusy(false);
    }
  };

  const cancelMissedPunchRequest = async (requestId) => {
    if (!requestId) return;
    setRequestBusy(true);
    setRequestStatusMsg("");
    try {
      await api.post(`/missed-punch/requests/${requestId}/cancel`, {});
      setRequestStatusMsg("Request cancelled.");
      await fetchMyRequests();
    } catch (err) {
      setRequestStatusMsg(err.response?.data?.message || "Failed to cancel request");
    } finally {
      setRequestBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        padding: "20px",
      }}
    >
      <Header title="Caregiver Dashboard" />
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1>Caregiver Dashboard</h1>
            {user?.primaryEmailAddress?.emailAddress && (
              <p>
                Welcome, <strong>{user.primaryEmailAddress.emailAddress}</strong>
              </p>
            )}
          </div>
          <div>
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                style={{
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "5px",
                  marginRight: "10px",
                }}
              >
                Switch to Admin View
              </button>
            )}
            <button
              onClick={logout}
              style={{
                background: "#dc3545",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "5px",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: "#f8d7da",
              color: "#721c24",
              padding: "10px",
              borderRadius: "5px",
              marginBottom: "20px",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div
            style={{
              background: currentlyClockedIn ? "#ff6b6b" : "#4CAF50",
              color: "white",
              padding: "20px",
              borderRadius: "10px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 10px 0" }}>{totalHours.toFixed(2)} hrs</h2>
            <p>Total hours worked</p>
          </div>
          <div
            style={{
              background: currentlyClockedIn ? "#fff3cd" : "#d4edda",
              padding: "20px",
              borderRadius: "10px",
              flex: 1,
              textAlign: "center",
            }}
          >
            <h3>{currentlyClockedIn ? "🟢 CLOCKED IN" : "⏳ Clocked Out"}</h3>
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "10px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
            <button
              onClick={handlePunchIn}
              disabled={loading || currentlyClockedIn}
              style={{
                padding: "15px 30px",
                backgroundColor: loading || currentlyClockedIn ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: loading || currentlyClockedIn ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Processing..." : "🟢 Punch In"}
            </button>
            <button
              onClick={handlePunchOut}
              disabled={loading || !currentlyClockedIn}
              style={{
                padding: "15px 30px",
                backgroundColor: loading || !currentlyClockedIn ? "#ccc" : "#f44336",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: loading || !currentlyClockedIn ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Processing..." : "🔴 Punch Out"}
            </button>
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "10px" }}>
          <h3>My Recent Shifts ({logs.length})</h3>
          {loading ? (
            <p>Loading shifts...</p>
          ) : logs.length === 0 ? (
            <p>No shifts yet. Punch in to start tracking!</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Punch In</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Punch Out</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const inn = log.effectivePunchIn ?? log.punchIn;
                  const out = log.effectivePunchOut ?? log.punchOut;

                  const hours =
                    inn && out
                      ? (
                          (new Date(out) - new Date(inn)) /
                          (1000 * 60 * 60)
                        ).toFixed(2)
                      : "-";

                  const isCorrected = Boolean(log.effectivePunchOut && !log.punchOut);
                  const isMissingPunchOut = !log.punchOut && !log.effectivePunchOut;
                  const latestRequest = latestRequestByEntryId[String(log._id)];
                  const hasPending = latestRequest?.status === "pending";

                  return (
                    <tr key={log._id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px" }}>
                        {log.punchIn
                          ? new Date(log.punchIn).toLocaleDateString()
                          : "-"}
                      </td>
                      <td style={{ padding: "12px" }}>{formatDateTime(log.punchIn)}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ color: log.punchOut ? "#28a745" : "#ffc107" }}>
                          {formatDateTime(out)}
                        </span>
                        {isCorrected && (
                          <span style={{ marginLeft: 8, color: "#6b7280", fontSize: 12 }}>
                            (corrected)
                          </span>
                        )}

                        {isMissingPunchOut && (
                          <div style={{ marginTop: 8 }}>
                            {hasPending ? (
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ color: "#6b7280", fontSize: 12 }}>
                                  Missed punch request pending
                                </span>
                                <button
                                  onClick={() => cancelMissedPunchRequest(latestRequest?._id)}
                                  disabled={requestBusy}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 6,
                                    border: "1px solid #e5e7eb",
                                    background: "white",
                                    cursor: requestBusy ? "not-allowed" : "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openMissedPunchRequest(log)}
                                disabled={requestBusy}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #e5e7eb",
                                  background: "white",
                                  cursor: requestBusy ? "not-allowed" : "pointer",
                                }}
                              >
                                Request missed punch-out
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>
                        {hours}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {requestingEntryId && (
          <div
            style={{
              marginTop: 16,
              background: "white",
              padding: 16,
              borderRadius: 10,
              border: "1px solid #eee",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Request missed punch-out</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Requested punch-out time</div>
                <input
                  type="datetime-local"
                  value={requestedTimeLocal}
                  onChange={(e) => setRequestedTimeLocal(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
              </label>
              <label style={{ flex: "1 1 320px" }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Reason (optional)</div>
                <input
                  type="text"
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Forgot to punch out, device issue, etc."
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                  }}
                />
              </label>
            </div>

            {requestStatusMsg && (
              <div style={{ marginTop: 10, color: "#6b7280" }}>{requestStatusMsg}</div>
            )}

            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <button
                onClick={submitMissedPunchRequest}
                disabled={requestBusy || !requestedTimeLocal}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: requestBusy ? "#cbd5e1" : "#2563eb",
                  color: "white",
                  cursor: requestBusy ? "not-allowed" : "pointer",
                }}
              >
                Submit request
              </button>
              <button
                onClick={() => setRequestingEntryId(null)}
                disabled={requestBusy}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: requestBusy ? "not-allowed" : "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CaregiverDashboard;
 
//         setUserInfo(parsed.caregiver || null);
//       }
//      catch (err) {
//       console.error("FETCH LOGS ERROR:", err);

//       // ✅ 401 MUST EXIT IMMEDIATELY
//       if (err.response?.status === 401) {
//         logout();
//         return;
//       }

//       setError(
//         err.response?.data?.message ||
//           err.message ||
//           "Failed to load logs"
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 🟢 Punch In
//   const handlePunchIn = async () => {
//     try {
//       setLoading(true);
//       setError("");

//       await api.post("/api/timeclock/punch-in");
//       await fetchMyLogs();
//     } catch (err) {
//       console.error("PUNCH IN ERROR:", err);

//       if (err.response?.status === 401) {
//         logout();
//         return;
//       }

//       setError(err.response?.data?.message || "Punch in failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 🔴 Punch Out
//   const handlePunchOut = async () => {
//     try {
//       setLoading(true);
//       setError("");

//       await api.post("/api/timeclock/punch-out");
//       await fetchMyLogs();
//     } catch (err) {
//       console.error("PUNCH OUT ERROR:", err);

//       if (err.response?.status === 401) {
//         logout();
//         return;
//       }

//       setError(err.response?.data?.message || "Punch out failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchMyLogs();
//   }, []);

//   const formatDateTime = (date) =>
//     date ? new Date(date).toLocaleString() : "-";

//   return (
//     <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
//       <Header />

//       <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
//         {/* Header */}
//         <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             marginBottom: "20px",
//           }}
//         >
//           <div>
//             <h1>Caregiver Dashboard</h1>
//             {userInfo && (
//               <p style={{ color: "#666" }}>
//                 Welcome, <strong>{userInfo.email}</strong>
//               </p>
//             )}
//           </div>

//           <button
//             onClick={logout}
//             style={{
//               background: "#dc3545",
//               color: "#fff",
//               border: "none",
//               padding: "8px 16px",
//               borderRadius: "4px",
//               cursor: "pointer",
//             }}
//           >
//             Logout
//           </button>
//         </div>

//         {/* Error */}
//         {error && (
//           <div
//             style={{
//               background: "#f8d7da",
//               color: "#721c24",
//               padding: "12px",
//               borderRadius: "4px",
//               marginBottom: "20px",
//             }}
//           >
//             {error}
//           </div>
//         )}

//         {/* Summary */}
//         <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
//           <div
//             style={{
//               flex: 1,
//               background: "#667eea",
//               color: "#fff",
//               padding: "20px",
//               borderRadius: "10px",
//               textAlign: "center",
//             }}
//           >
//             <h2>{totalHours.toFixed(2)} hrs</h2>
//             <p>Total hours worked</p>
//           </div>

//           <div
//             style={{
//               flex: 1,
//               background: "#fff",
//               padding: "20px",
//               borderRadius: "10px",
//               border: currentlyClockedIn
//                 ? "2px solid #28a745"
//                 : "1px solid #ddd",
//             }}
//           >
//             <h3>
//               {currentlyClockedIn ? "🟢 CLOCKED IN" : "⏳ CLOCKED OUT"}
//             </h3>
//           </div>
//         </div>

//         {/* Punch Buttons */}
//         <div
//           style={{
//             background: "#fff",
//             padding: "20px",
//             borderRadius: "8px",
//             marginBottom: "20px",
//             textAlign: "center",
//           }}
//         >
//           <button
//             onClick={handlePunchIn}
//             disabled={loading || currentlyClockedIn}
//             style={{
//               marginRight: "10px",
//               padding: "12px 24px",
//               background: "#28a745",
//               color: "#fff",
//               border: "none",
//               borderRadius: "6px",
//             }}
//           >
//             Punch In
//           </button>

//           <button
//             onClick={handlePunchOut}
//             disabled={loading || !currentlyClockedIn}
//             style={{
//               padding: "12px 24px",
//               background: "#dc3545",
//               color: "#fff",
//               border: "none",
//               borderRadius: "6px",
//             }}
//           >
//             Punch Out
//           </button>
//         </div>

//         {/* Logs */}
//         <div
//           style={{
//             background: "#fff",
//             padding: "20px",
//             borderRadius: "8px",
//           }}
//         >
//           <h2>My Shifts</h2>

//           {logs.length === 0 ? (
//             <p>No shifts yet.</p>
//           ) : (
//             <table style={{ width: "100%", borderCollapse: "collapse" }}>
//               <thead>
//                 <tr>
//                   <th>Date</th>
//                   <th>Punch In</th>
//                   <th>Punch Out</th>
//                   <th>Hours</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {logs.map((log) => {
//                   const hours =
//                     log.punchIn && log.punchOut
//                       ? (
//                           (new Date(log.punchOut) -
//                             new Date(log.punchIn)) /
//                           (1000 * 60 * 60)
//                         ).toFixed(2)
//                       : "-";

//                   return (
//                     <tr key={log._id}>
//                       <td>
//                         {log.punchIn
//                           ? new Date(log.punchIn).toLocaleDateString()
//                           : "-"}
//                       </td>
//                       <td>{formatDateTime(log.punchIn)}</td>
//                       <td>{formatDateTime(log.punchOut)}</td>
//                       <td>{hours}</td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default CaregiverDashboard;





// import React, { useEffect, useState, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// import Header from "../components/Header";
// import api from "../services/api";

// const CaregiverDashboard = () => {
//   const [loading, setLoading] = useState(false);
//   const [logs, setLogs] = useState([]);
//   const [error, setError] = useState("");
//   const [totalHours, setTotalHours] = useState(0);
//   const [currentlyClockedIn, setCurrentlyClockedIn] = useState(false);
//   const [userInfo, setUserInfo] = useState(null);

//   const navigate = useNavigate();

//   // 🔐 Logout
//   const logout = useCallback(() => {
//     localStorage.removeItem("token");
//     localStorage.removeItem("user");
//     navigate("/login", { replace: true });
//   }, [navigate]);

//   // ⏱ Calculate hours
//   const calculateTotals = useCallback((logsData) => {
//     const total = logsData.reduce((sum, log) => {
//       if (log.punchIn && log.punchOut) {
//         return (
//           sum +
//           (new Date(log.punchOut) - new Date(log.punchIn)) /
//             (1000 * 60 * 60)
//         );
//       }
//       return sum;
//     }, 0);

//     setTotalHours(total);
//   }, []);

//   // 📡 Fetch caregiver logs
//   // const fetchMyLogs = async () => {
//   //   try {
//   //     setLoading(true);
//   //     setError("");

//   //     // ✅ caregiver-specific route
//   //     const res = await api.get("/caregiver/timelogs");
//   //     const logsData = res.data.logs || [];

//   //     setLogs(logsData);
//   //     calculateTotals(logsData);

//   //     const activeShift = logsData.find(
//   //       (log) => log.punchIn && !log.punchOut
//   //     );
//   //     setCurrentlyClockedIn(Boolean(activeShift));

//   //     const storedUser = localStorage.getItem("user");
//   //     if (storedUser) {
//   //       const parsed = JSON.parse(storedUser);
//   //       setUserInfo(parsed.caregiver || null);
//   //     }
//   //   } catch (err) {
//   //     console.error("FETCH LOGS ERROR:", err);

//   //     if (err.response?.status === 401) {
//   //       logout();
//   //       return;
//   //     }

//   //     setError("Failed to load logs");
//   //   } finally {
//   //     setLoading(false);
//   //   }
//   // };
//   const fetchMyLogs = async () => {
//   try {
//     setError("");
//     setLoading(true);
//     const res = await api.get("/timeclock/my-logs");  // ✅ Fixed
//     setLogs(res.data.logs || []);
//   } catch (err) {
//     console.error("FETCH LOGS ERROR:", err);
//     setError(err.response?.data?.message || "Failed to load logs");
//   } finally {
//     setLoading(false);
//   }
// };

  // 🟢 Punch In
  // const handlePunchIn = async () => {
  //   try {
  //     setLoading(true);
  //     setError("");

  //     await api.post("/timeclock/punch-in");
  //     await fetchMyLogs();
  //   } catch (err) {
  //     console.error("PUNCH IN ERROR:", err);

  //     if (err.response?.status === 401) {
  //       logout();
  //       return;
  //     }

  //     setError("Punch in failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // // 🔴 Punch Out
  // const handlePunchOut = async () => {
  //   try {
  //     setLoading(true);
  //     setError("");

  //     await api.post("/timeclock/punch-out");
  //     await fetchMyLogs();
  //   } catch (err) {
  //     console.error("PUNCH OUT ERROR:", err);

  //     if (err.response?.status === 401) {
  //       logout();
  //       return;
  //     }

  //     setError("Punch out failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

/*
  Duplicate implementation below caused build failure due to a mid-file `import React...`.
  Kept temporarily for reference during the Clerk migration.

  import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import api from "../services/api";

const CaregiverDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [totalHours, setTotalHours] = useState(0);
  const [currentlyClockedIn, setCurrentlyClockedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    navigate("/sign-out", { replace: true });
  }, [navigate]);

  const calculateTotals = useCallback((logsData) => {
    const total = logsData.reduce((sum, log) => {
      if (log.punchIn && log.punchOut) {
        return sum + (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60);
      }
      return sum;
    }, 0);
    setTotalHours(total);

    const activeShift = logsData.find(log => log.punchIn && !log.punchOut);
    setCurrentlyClockedIn(!!activeShift);
  }, []);

  // ✅ FIXED: backend route is /my-logs
  const fetchMyLogs = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await api.get("/timeclock/my-logs");
      const logsData = res.data.logs || [];
      
      setLogs(logsData);
      calculateTotals(logsData);  // ✅ Restores totals/clocked-in

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUserInfo(parsed.caregiver || null);
        } catch (e) {
          console.warn("Could not parse user info");
        }
      }
    } catch (err) {
      console.error("FETCH LOGS ERROR:", err);
      if (err.response?.status === 401) {
        logout();  // ✅ Auto-logout on 401
        return;
      }
      setError(err.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = async () => {
    try {
      setError("");
      setLoading(true);
      await api.post("/timeclock/punch-in", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH IN ERROR:", err);
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setError(err.response?.data?.message || "Punch in failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setError("");
      setLoading(true);
      await api.post("/timeclock/punch-out", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH OUT ERROR:", err);
      if (err.response?.status === 401) {
        logout();
        return;
      }
      setError(err.response?.data?.message || "Punch out failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLogs();
  }, []);

  const formatDateTime = (date) => date ? new Date(date).toLocaleString() : "-";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5", padding: "20px" }}>
      <Header title="Caregiver Dashboard" />
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <h1>Caregiver Dashboard</h1>
            {userInfo && <p>Welcome, <strong>{userInfo.email}</strong></p>}
          </div>
          <button onClick={logout} style={{ background: "#dc3545", color: "white", border: "none", padding: "10px 20px", borderRadius: "5px" }}>
            Logout
          </button>
        </div>

        {error && (
          <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px", borderRadius: "5px", marginBottom: "20px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ 
            background: currentlyClockedIn ? "#ff6b6b" : "#4CAF50", 
            color: "white", padding: "20px", borderRadius: "10px", flex: 1, textAlign: "center" 
          }}>
            <h2 style={{ margin: "0 0 10px 0" }}>{totalHours.toFixed(2)} hrs</h2>
            <p>Total hours worked</p>
          </div>
          <div style={{ 
            background: currentlyClockedIn ? "#fff3cd" : "#d4edda", 
            padding: "20px", borderRadius: "10px", flex: 1, textAlign: "center" 
          }}>
            <h3>{currentlyClockedIn ? "🟢 CLOCKED IN" : "⏳ Clocked Out"}</h3>
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "10px", marginBottom: "20px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
            <button
              onClick={handlePunchIn}
              disabled={loading || currentlyClockedIn}
              style={{
                padding: "15px 30px",
                backgroundColor: loading || currentlyClockedIn ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: loading || currentlyClockedIn ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Processing..." : "🟢 Punch In"}
            </button>
            <button
              onClick={handlePunchOut}
              disabled={loading || !currentlyClockedIn}
              style={{
                padding: "15px 30px",
                backgroundColor: loading || !currentlyClockedIn ? "#ccc" : "#f44336",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: loading || !currentlyClockedIn ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Processing..." : "🔴 Punch Out"}
            </button>
          </div>
        </div>

        <div style={{ background: "white", padding: "20px", borderRadius: "10px" }}>
          <h3>My Recent Shifts ({logs.length})</h3>
          {loading ? (
            <p>Loading shifts...</p>
          ) : logs.length === 0 ? (
            <p>No shifts yet. Punch in to start tracking!</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Punch In</th>
                  <th style={{ padding: "12px", textAlign: "left" }}>Punch Out</th>
                  <th style={{ padding: "12px", textAlign: "right" }}>Hours</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hours = log.punchIn && log.punchOut
                    ? ((new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60)).toFixed(2)
                    : "-";
                  return (
                    <tr key={log._id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px" }}>
                        {log.punchIn ? new Date(log.punchIn).toLocaleDateString() : "-"}
                      </td>
                      <td style={{ padding: "12px" }}>{formatDateTime(log.punchIn)}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ color: log.punchOut ? "#28a745" : "#ffc107" }}>
                          {formatDateTime(log.punchOut)}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold" }}>{hours}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaregiverDashboard;
*/