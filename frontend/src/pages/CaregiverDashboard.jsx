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

//   const logout = useCallback(() => {
//     localStorage.removeItem("token");
//     localStorage.removeItem("user");
//     navigate("/login", { replace: true });
//   }, [navigate]);

//   const calculateTotals = useCallback((logsData) => {
//     const total = logsData.reduce((sum, log) => {
//       if (log.punchIn && log.punchOut) {
//         const hours = (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60);
//         return sum + hours;
//       }
//       return sum;
//     }, 0);
//     setTotalHours(total);
//   }, []);

//   const fetchMyLogs = async () => {
//     try {
//       setError("");
//       setLoading(true);
      
//       const res = await api.get("/timeclock/mylogs");
//       const logsData = res.data.logs || [];
      
//       setLogs(logsData);
//       calculateTotals(logsData);
      
//       const activeShift = logsData.find(log => log.punchIn && !log.punchOut);
//       setCurrentlyClockedIn(!!activeShift);
      
//       try {
//         const userData = JSON.parse(localStorage.getItem("user") || "{}");
//         setUserInfo(userData.caregiver);
//       } catch (e) {
//         console.warn("Could not parse user info");
//       }
      
//     } catch (err) {
//       console.error("FETCH LOGS ERROR:", err);
      
//       if (err.response?.status === 401) {
//         localStorage.removeItem("token");
//         localStorage.removeItem("user");
//         window.location.href = "/login";
//         return;
//       }
      
//       setError(err.response?.data?.message || err.message || "Failed to load logs");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handlePunchIn = async () => {
//     try {
//       setError("");
//       setLoading(true);
//       await api.post("/timeclock/punch-in", {});
//       await fetchMyLogs();
//     } catch (err) {
//       console.error("PUNCH IN ERROR:", err);
      
//       if (err.response?.status === 401) {
//         localStorage.removeItem("token");
//         localStorage.removeItem("user");
//         window.location.href = "/login";
//         return;
//       }
      
//       setError(err.response?.data?.message || "Punch in failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handlePunchOut = async () => {
//     try {
//       setError("");
//       setLoading(true);
//       await api.post("/timeclock/punch-out", {});
//       await fetchMyLogs();
//     } catch (err) {
//       console.error("PUNCH OUT ERROR:", err);
      
//       if (err.response?.status === 401) {
//         localStorage.removeItem("token");
//         localStorage.removeItem("user");
//         window.location.href = "/login";
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

//   const formatHours = (hours) => hours ? hours.toFixed(2) : "-";
//   const formatDateTime = (dateString) => 
//     dateString ? new Date(dateString).toLocaleString() : "-";

//   return (
//     <div style={{ minHeight: "100vh", backgroundColor: "#f5f5f5" }}>
//       <Header />
//       <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
//           <div>
//             <h1 style={{ margin: 0, color: "#333" }}>Caregiver Dashboard</h1>
//             {userInfo && (
//               <p style={{ color: "#666", margin: "5px 0 0 0" }}>
//                 Welcome, <strong>{userInfo.email}</strong>
//               </p>
//             )}
//           </div>
//           <button 
//             onClick={logout}
//             style={{
//               padding: "8px 16px",
//               backgroundColor: "#dc3545",
//               color: "white",
//               border: "none",
//               borderRadius: "4px",
//               cursor: "pointer"
//             }}
//           >
//             Logout
//           </button>
//         </div>

//         {error && (
//           <div style={{
//             padding: "12px",
//             backgroundColor: "#f8d7da",
//             color: "#721c24",
//             borderRadius: "4px",
//             marginBottom: "20px",
//             border: "1px solid #f5c6cb"
//           }}>
//             {error}
//             <button 
//               onClick={() => setError("")}
//               style={{ float: "right", background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
//             >
//               ×
//             </button>
//           </div>
//         )}

//         {/* Status & Total Hours Card */}
//         <div style={{ 
//           display: "flex", 
//           gap: "20px", 
//           marginBottom: "20px",
//           flexWrap: "wrap"
//         }}>
//           <div style={{ 
//             background: currentlyClockedIn 
//               ? "linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)" 
//               : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
//             color: "white", 
//             padding: "20px", 
//             borderRadius: "12px", 
//             flex: 1,
//             minWidth: "250px",
//             textAlign: "center"
//           }}>
//             <h2 style={{ margin: "0 0 10px 0", fontSize: "2em" }}>
//               {totalHours.toFixed(2)} hrs
//             </h2>
//             <p style={{ margin: 0, fontSize: "1.1em", opacity: 0.9 }}>
//               Total hours worked
//             </p>
//             <p style={{ margin: "10px 0 0 0", fontSize: "0.9em", opacity: 0.8 }}>
//               {logs.length} shift{logs.length !== 1 ? 's' : ''}
//             </p>
//           </div>

//           <div style={{ 
//             background: currentlyClockedIn ? "#fff3cd" : "white", 
//             padding: "20px", 
//             borderRadius: "12px", 
//             flex: 1,
//             minWidth: "250px",
//             border: currentlyClockedIn ? "2px solid #ffc107" : "1px solid #dee2e6"
//           }}>
//             <h3 style={{ margin: "0 0 10px 0", color: currentlyClockedIn ? "#856404" : "#333" }}>
//               {currentlyClockedIn ? "🟢 CLOCKED IN" : "⏳ Clocked Out"}
//             </h3>
//             <p style={{ margin: 0, fontSize: "0.9em", opacity: 0.8 }}>
//               {currentlyClockedIn ? "Punch out to end your shift" : "Ready to start working"}
//             </p>
//           </div>
//         </div>

//         {/* Punch In/Out Buttons */}
//         <div style={{ 
//           background: "white", 
//           padding: "20px", 
//           borderRadius: "8px", 
//           boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
//           marginBottom: "20px",
//           textAlign: "center"
//         }}>
//           <h2 style={{ color: "#333", marginTop: 0 }}>Clock In/Out</h2>
//           <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
//             <button
//               onClick={handlePunchIn}
//               disabled={loading || currentlyClockedIn}
//               style={{ 
//                 padding: "15px 30px", 
//                 fontSize: "18px",
//                 backgroundColor: loading || currentlyClockedIn ? "#ccc" : "#4CAF50",
//                 color: "white",
//                 border: "none",
//                 borderRadius: "8px",
//                 cursor: (loading || currentlyClockedIn) ? "not-allowed" : "pointer",
//                 minWidth: "150px",
//                 fontWeight: "bold"
//               }}
//             >
//               {loading ? "Processing..." : "🟢 Punch In"}
//             </button>
//             <button
//               onClick={handlePunchOut}
//               disabled={loading || !currentlyClockedIn}
//               style={{ 
//                 padding: "15px 30px", 
//                 fontSize: "18px",
//                 backgroundColor: loading || !currentlyClockedIn ? "#ccc" : "#f44336",
//                 color: "white",
//                 border: "none",
//                 borderRadius: "8px",
//                 cursor: (loading || !currentlyClockedIn) ? "not-allowed" : "pointer",
//                 minWidth: "150px",
//                 fontWeight: "bold"
//               }}
//             >
//               {loading ? "Processing..." : "🔴 Punch Out"}
//             </button>
//           </div>
//         </div>

//         {/* My Time Logs */}
//         <div style={{ background: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
//           <h2 style={{ color: "#333", marginTop: 0 }}>📋 My Recent Shifts ({logs.length})</h2>
//           {loading && <p style={{ textAlign: "center", padding: "40px" }}>Loading shifts...</p>}
//           {logs.length === 0 && !loading ? (
//             <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
//               <p style={{ fontSize: "1.2em", marginBottom: "10px" }}>No shifts yet</p>
//               <p>Punch in to start tracking your time!</p>
//             </div>
//           ) : (
//             <div style={{ overflowX: "auto" }}>
//               <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
//                 <thead>
//                   <tr style={{ backgroundColor: "#f8f9fa" }}>
//                     <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>
//                       Date
//                     </th>
//                     <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>
//                       Punch In
//                     </th>
//                     <th style={{ padding: "12px 8px", textAlign: "left", borderBottom: "2px solid #dee2e6" }}>
//                       Punch Out
//                     </th>
//                     <th style={{ padding: "12px 8px", textAlign: "right", borderBottom: "2px solid #dee2e6" }}>
//                       Hours
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {logs.map((log) => {
//                     const hours = log.punchIn && log.punchOut
//                       ? ((new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60)).toFixed(2)
//                       : "-";
                    
//                     return (
//                       <tr key={log._id || log.id} style={{ borderBottom: "1px solid #dee2e6" }}>
//                         <td style={{ padding: "12px 8px", fontWeight: 500 }}>
//                           {log.punchIn ? new Date(log.punchIn).toLocaleDateString() : "-"}
//                         </td>
//                         <td style={{ padding: "12px 8px" }}>{formatDateTime(log.punchIn)}</td>
//                         <td style={{ padding: "12px 8px" }}>
//                           <span style={{ 
//                             color: log.punchOut ? "#28a745" : "#ffc107",
//                             fontWeight: log.punchOut ? "normal" : "bold"
//                           }}>
//                             {formatDateTime(log.punchOut)}
//                           </span>
//                         </td>
//                         <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: "bold" }}>
//                           {formatHours(hours)}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
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

//   // 🔐 Centralized logout
//   const logout = useCallback(() => {
//     localStorage.removeItem("token");
//     localStorage.removeItem("user");
//     navigate("/login", { replace: true });
//   }, [navigate]);

//   // ⏱ Calculate total hours
//   const calculateTotals = useCallback((logsData) => {
//     const total = logsData.reduce((sum, log) => {
//       if (log.punchIn && log.punchOut) {
//         const hours =
//           (new Date(log.punchOut) - new Date(log.punchIn)) /
//           (1000 * 60 * 60);
//         return sum + hours;
//       }
//       return sum;
//     }, 0);

//     setTotalHours(total);
//   }, []);

//   // 📡 Fetch caregiver logs
//   const fetchMyLogs = async () => {
//   try {
//     setLoading(true);
//     const res = await api.get("/caregiver/timelogs");
//     setLogs(res.data.logs || []);
//   } catch (err) {
//     setError("Failed to load logs");
//   } finally {
//     setLoading(false);
//   }
// }; 
//       const res = await api.get("/api/timeclock/mylogs");
//       const logsData = res.data.logs || [];

//       setLogs(logsData);
//       calculateTotals(logsData);

//       const activeShift = logsData.find(
//         (log) => log.punchIn && !log.punchOut
//       );
//       setCurrentlyClockedIn(Boolean(activeShift));

//       // Load user info
//       const storedUser = localStorage.getItem("user");
//       if (storedUser) {
//         const parsed = JSON.parse(storedUser);
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

  // 🔐 Logout
  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  // ⏱ Calculate hours
  const calculateTotals = useCallback((logsData) => {
    const total = logsData.reduce((sum, log) => {
      if (log.punchIn && log.punchOut) {
        return (
          sum +
          (new Date(log.punchOut) - new Date(log.punchIn)) /
            (1000 * 60 * 60)
        );
      }
      return sum;
    }, 0);

    setTotalHours(total);
  }, []);

  // 📡 Fetch caregiver logs
  const fetchMyLogs = async () => {
    try {
      setLoading(true);
      setError("");

      // ✅ caregiver-specific route
      const res = await api.get("/caregiver/timelogs");
      const logsData = res.data.logs || [];

      setLogs(logsData);
      calculateTotals(logsData);

      const activeShift = logsData.find(
        (log) => log.punchIn && !log.punchOut
      );
      setCurrentlyClockedIn(Boolean(activeShift));

      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUserInfo(parsed.caregiver || null);
      }
    } catch (err) {
      console.error("FETCH LOGS ERROR:", err);

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  // 🟢 Punch In
  const handlePunchIn = async () => {
    try {
      setLoading(true);
      setError("");

      await api.post("/timeclock/punch-in");
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH IN ERROR:", err);

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError("Punch in failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔴 Punch Out
  const handlePunchOut = async () => {
    try {
      setLoading(true);
      setError("");

      await api.post("/timeclock/punch-out");
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH OUT ERROR:", err);

      if (err.response?.status === 401) {
        logout();
        return;
      }

      setError("Punch out failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLogs();
  }, []);

  const formatDateTime = (date) =>
    date ? new Date(date).toLocaleString() : "-";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Header />

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
        <h1>Caregiver Dashboard</h1>

        {userInfo && (
          <p>
            Welcome, <strong>{userInfo.email}</strong>
          </p>
        )}

        {error && <p style={{ color: "red" }}>{error}</p>}

        <h2>{totalHours.toFixed(2)} hrs</h2>

        <button
          onClick={handlePunchIn}
          disabled={loading || currentlyClockedIn}
        >
          Punch In
        </button>

        <button
          onClick={handlePunchOut}
          disabled={loading || !currentlyClockedIn}
        >
          Punch Out
        </button>

        <h3>My Shifts</h3>

        {logs.length === 0 ? (
          <p>No shifts yet.</p>
        ) : (
          <table width="100%">
            <thead>
              <tr>
                <th>Date</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Hours</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const hours =
                  log.punchIn && log.punchOut
                    ? (
                        (new Date(log.punchOut) -
                          new Date(log.punchIn)) /
                        (1000 * 60 * 60)
                      ).toFixed(2)
                    : "-";

                return (
                  <tr key={log._id}>
                    <td>
                      {log.punchIn
                        ? new Date(log.punchIn).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{formatDateTime(log.punchIn)}</td>
                    <td>{formatDateTime(log.punchOut)}</td>
                    <td>{hours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CaregiverDashboard;




