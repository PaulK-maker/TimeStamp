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

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import api from "../services/api";

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    navigate("/sign-out", { replace: true });
  }, [navigate]);

  const calculateTotals = useCallback((logsData) => {
    const totalsMap = {};
    
    logsData.forEach((log) => {
      if (!log.punchIn || !log.punchOut || !log.caregiver?._id) return;
      
      const caregiverId = log.caregiver._id;
      const hours = (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60);
      
      if (!totalsMap[caregiverId]) {
        totalsMap[caregiverId] = {
          caregiver: log.caregiver,
          totalHours: 0,
        };
      }
      
      totalsMap[caregiverId].totalHours += hours;
    });
    
    return Object.values(totalsMap);
  }, []);

  const fetchTimeLogs = useCallback(async () => {
    setLoading(refreshing ? true : false);
    setErrorMsg("");
    setRefreshing(false);

    try {
      // NOTE: axios interceptor attaches Clerk token automatically when signed in.
      const res = await api.get("/admin/timelogs");

      const logsData = Array.isArray(res.data.logs) ? res.data.logs : [];
      setLogs(logsData);
      setTotals(calculateTotals(logsData));

    } catch (err) {
      console.error("Error fetching time logs:", err);
      
      if (err.response?.status === 401 || err.code === "ERR_NETWORK") {
        setErrorMsg("Session expired. Please log in again.");
        logout();
      } else if (err.response?.status === 403) {
        setErrorMsg("Access denied. Admin privileges required.");
      } else {
        setErrorMsg(
          err.response?.data?.message || 
          "Failed to load time logs. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [refreshing, calculateTotals, logout]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTimeLogs();
  };

  useEffect(() => {
    fetchTimeLogs();
  }, [fetchTimeLogs]);

  const formatHours = (hours) => {
    if (hours === null || hours === undefined) return "-";
    const numericHours = typeof hours === "string" ? Number(hours) : hours;
    if (typeof numericHours !== "number" || Number.isNaN(numericHours)) return "-";
    return numericHours.toFixed(2);
  };
  const formatDateTime = (dateString) => 
    dateString ? new Date(dateString).toLocaleString() : "-";

  if (loading && !logs.length) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
      <Header title="Admin Dashboard" />
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ margin: 0, color: "#333" }}>Admin Dashboard</h1>
          <div>
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: "8px 16px",
                marginRight: "10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: refreshing ? "not-allowed" : "pointer"
              }}
            >
              {refreshing ? "Refreshing..." : "🔄 Refresh"}
            </button>
            <button 
              onClick={logout}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            padding: "12px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            borderRadius: "4px",
            marginBottom: "20px",
            border: "1px solid #f5c6cb"
          }}>
            {errorMsg}
            <button 
              onClick={() => setErrorMsg("")}
              style={{ float: "right", background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        )}

        {/* All Time Logs Table */}
        <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
          <h2 style={{ color: "#333", marginTop: 0 }}>📋 All Time Logs ({logs.length})</h2>
          {logs.length === 0 ? (
            <p style={{ color: "#666", textAlign: "center", padding: "40px" }}>
              No time logs found. Caregivers haven't clocked in yet.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table 
                style={{ 
                  width: "100%", 
                  borderCollapse: "collapse", 
                  fontSize: "14px" 
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f8f9fa" }}>
                    <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Caregiver</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Email</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Punch In</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>Punch Out</th>
                    <th style={{ padding: "12px 8px", textAlign: "right", borderBottom: "2px solid #dee2e6" }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const hours = log.punchIn && log.punchOut
                      ? (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60)
                      : null;
                    
                    return (
                      <tr key={log._id} style={{ borderBottom: "1px solid #dee2e6" }}>
                        <td style={{ padding: "12px 8px" }}>
                          <strong>{log.caregiver?.firstName || "N/A"} {log.caregiver?.lastName || ""}</strong>
                        </td>
                        <td style={{ padding: "12px 8px" }}>{log.caregiver?.email || "-"}</td>
                        <td style={{ padding: "12px 8px" }}>{formatDateTime(log.punchIn)}</td>
                        <td style={{ padding: "12px 8px" }}>{formatDateTime(log.punchOut)}</td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: "bold" }}>
                          {formatHours(hours)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totals Summary */}
        <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color: "#333", marginTop: 0 }}>📊 Total Hours per Caregiver ({totals.length})</h2>
          {totals.length === 0 ? (
            <p style={{ color: "#666" }}>No completed shifts to summarize</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {totals.map((item) => (
                <li key={item.caregiver._id} style={{
                  padding: "12px",
                  borderBottom: "1px solid #eee",
                  display: "flex",
                  justifyContent: "space-between"
                }}>
                  <span>
                    {item.caregiver.firstName} {item.caregiver.lastName}
                    <small style={{ color: "#666", marginLeft: "8px" }}>
                      ({item.caregiver.email})
                    </small>
                  </span>
                  <strong style={{ color: "#28a745" }}>
                    {item.totalHours.toFixed(2)} hours
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
