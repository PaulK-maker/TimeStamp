// // src/pages/CaregiverDashboard.jsx
// import React from "react";

// const CaregiverDashboard = () => {
//   return (
//     <div>
//       <h1>Caregiver Dashboard</h1>
//       <p>Here caregivers will punch in/out and see their time logs.</p>
//     </div>
//   );
// };

// export default CaregiverDashboard;


import React, { useEffect, useState } from "react";
import api from "../services/api";

const CaregiverDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const fetchMyLogs = async () => {
    try {
      setError("");
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await api.get("/timeclock/my-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error("FETCH LOGS ERROR:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to load logs"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = async () => {
    try {
      setError("");
      setLoading(true);
      const token = localStorage.getItem("token");
      await api.post(
        "/timeclock/punch-in",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH IN ERROR:", err);
      setError(
        err.response?.data?.message || err.message || "Punch in failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setError("");
      setLoading(true);
      const token = localStorage.getItem("token");
      await api.post(
        "/timeclock/punch-out",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH OUT ERROR:", err);
      setError(
        err.response?.data?.message || err.message || "Punch out failed"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLogs();
  }, []);

  return (
    <div style={{ padding: "30px" }}>
      <h1>Caregiver Dashboard</h1>
      <p>Here caregivers will punch in/out and see their time logs.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ margin: "20px 0", display: "flex", gap: "10px" }}>
        <button
          onClick={handlePunchIn}
          disabled={loading}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Punch In
        </button>
        <button
          onClick={handlePunchOut}
          disabled={loading}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Punch Out
        </button>
      </div>

      {loading && <p>Loading...</p>}

      <h2>My Time Logs</h2>
      {logs.length === 0 ? (
        <p>No time logs yet.</p>
      ) : (
        <ul>
          {logs.map((log) => (
            <li key={log.id || log._id}>
              In: {new Date(log.punchIn).toLocaleString()}
              {log.punchOut && (
                <>
                  {"  "}Out: {new Date(log.punchOut).toLocaleString()} —{" "}
                  {log.totalHours} hrs
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CaregiverDashboard;