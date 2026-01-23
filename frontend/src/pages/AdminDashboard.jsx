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
import UserManagementTable from "../components/UserManagementTable";
import api from "../services/api";

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const navigate = useNavigate();

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
      if (!log.punchIn || !log.punchOut || !log.caregiver?._id) return;

      const hours =
        (new Date(log.punchOut) - new Date(log.punchIn)) /
        (1000 * 60 * 60);

      const caregiverId = log.caregiver._id;

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

  /* =======================
     Fetch admin time logs
  ======================= */
  const fetchTimeLogs = useCallback(async () => {
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
        setErrorMsg("Access denied. Admin privileges required.");
      } else {
        setErrorMsg(
          err.response?.data?.message ||
            "Failed to load time logs."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [calculateTotals, logout]);

  /* =======================
     Init on page load
  ======================= */
  useEffect(() => {
    fetchTimeLogs();
  }, [fetchTimeLogs]);

  /* =======================
     Helpers
  ======================= */
  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "-";

  const formatHours = (hours) =>
    typeof hours === "number" ? hours.toFixed(2) : "-";

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
          <h1>Admin Dashboard</h1>

          <div>
            <button
              onClick={fetchTimeLogs}
              disabled={refreshing}
              style={{
                padding: "8px 16px",
                marginRight: "10px",
                backgroundColor: "#007bff",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              🔄 Refresh
            </button>

            <button
              onClick={() => navigate("/caregiver")}
              style={{
                padding: "8px 16px",
                marginRight: "10px",
                backgroundColor: "#17a2b8",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
              }}
            >
              Switch to Caregiver View
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
          <h2>📋 All Time Logs ({logs.length})</h2>

          {logs.length === 0 ? (
            <p>No time logs found.</p>
          ) : (
            <table width="100%" cellPadding="8">
              <thead>
                <tr>
                  <th align="left">Caregiver</th>
                  <th align="left">Email</th>
                  <th align="left">Punch In</th>
                  <th align="left">Punch Out</th>
                  <th align="right">Hours</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hours =
                    log.punchIn && log.punchOut
                      ? (new Date(log.punchOut) -
                          new Date(log.punchIn)) /
                        (1000 * 60 * 60)
                      : null;

                  return (
                    <tr key={log._id}>
                      <td>
                        {log.caregiver?.firstName}{" "}
                        {log.caregiver?.lastName}
                      </td>
                      <td>{log.caregiver?.email}</td>
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
          )}
        </div>

        {/* User Management */}
        <UserManagementTable />

        {/* Totals */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
          }}
        >
          <h2>📊 Total Hours per Caregiver</h2>

          {totals.length === 0 ? (
            <p>No completed shifts.</p>
          ) : (
            <ul>
              {totals.map((item) => (
                <li key={item.caregiver._id}>
                  {item.caregiver.firstName}{" "}
                  {item.caregiver.lastName}:{" "}
                  <strong>
                    {item.totalHours.toFixed(2)} hrs
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