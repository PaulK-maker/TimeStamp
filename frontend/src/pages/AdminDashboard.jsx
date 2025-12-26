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


import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import api from "../services/api";

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const fetchTimeLogs = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/admin/timelogs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const logsData = res.data.logs || [];
      setLogs(logsData);

      // ⭐ Compute total hours per caregiver in frontend
      const totalsMap = {};

      logsData.forEach((log) => {
        if (!log.punchIn || !log.punchOut || !log.caregiver) return;
        const caregiverId = log.caregiver._id;

        const hours =
          (new Date(log.punchOut) - new Date(log.punchIn)) / (1000 * 60 * 60);

        if (!totalsMap[caregiverId]) {
          totalsMap[caregiverId] = {
            caregiver: log.caregiver,
            totalHours: 0,
          };
        }

        totalsMap[caregiverId].totalHours += hours;
      });

      setTotals(Object.values(totalsMap));
    } catch (err) {
      console.error("Error fetching time logs:", err);
      if (err.response?.status === 401) {
        setErrorMsg("Unauthorized. Please log in again.");
        logout();
      } else {
        setErrorMsg("Failed to load time logs.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");
    fetchTimeLogs();
  }, [navigate]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <Header />
      <div style={{ padding: "20px" }}>
        <h1>Admin Dashboard</h1>
        <button onClick={logout}>Logout</button>
        {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

        <h2>All Time Logs</h2>
        {logs.length === 0 ? (
          <p>No time logs found</p>
        ) : (
          <table border="1" cellPadding="5" width="100%">
            <thead>
              <tr>
                <th>Caregiver</th>
                <th>Email</th>
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
                        (new Date(log.punchOut) - new Date(log.punchIn)) /
                        (1000 * 60 * 60)
                      ).toFixed(2)
                    : "-";

                return (
                  <tr key={log._id}>
                    <td>
                      {log.caregiver?.firstName} {log.caregiver?.lastName}
                    </td>
                    <td>{log.caregiver?.email}</td>
                    <td>
                      {log.punchIn
                        ? new Date(log.punchIn).toLocaleString()
                        : "-"}
                    </td>
                    <td>
                      {log.punchOut
                        ? new Date(log.punchOut).toLocaleString()
                        : "-"}
                    </td>
                    <td>{hours}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <h2>Total Hours per Caregiver</h2>
        {totals.length === 0 ? (
          <p>No totals available</p>
        ) : (
          <ul>
            {totals.map((item) => (
              <li key={item.caregiver._id}>
                {item.caregiver.firstName} {item.caregiver.lastName}:{" "}
                {item.totalHours.toFixed(2)} hrs
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;