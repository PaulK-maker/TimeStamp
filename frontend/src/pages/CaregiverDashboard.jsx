import React, { useEffect, useState } from "react";
import api from "../services/api";  // ✅ Correct import

const CaregiverDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const fetchMyLogs = async () => {
    try {
      setError("");
      setLoading(true);
      // ✅ api interceptor auto-adds token - no manual headers needed
      const res = await api.get("/timeclock/my-logs");
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error("FETCH LOGS ERROR:", err);
      setError(err.response?.data?.message || err.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = async () => {
    try {
      setError("");
      setLoading(true);
      // ✅ Simplified - interceptor handles Authorization header
      await api.post("/timeclock/punch-in", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH IN ERROR:", err);
      setError(err.response?.data?.message || err.message || "Punch in failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    try {
      setError("");
      setLoading(true);
      // ✅ Simplified - no manual headers
      await api.post("/timeclock/punch-out", {});
      await fetchMyLogs();
    } catch (err) {
      console.error("PUNCH OUT ERROR:", err);
      setError(err.response?.data?.message || err.message || "Punch out failed");
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
      
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ margin: "20px 0", display: "flex", gap: "10px" }}>
        <button
          onClick={handlePunchIn}
          disabled={loading}
          style={{ 
            padding: "10px 20px", 
            fontSize: "16px",
            backgroundColor: loading ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "Punch In"}
        </button>
        <button
          onClick={handlePunchOut}
          disabled={loading}
          style={{ 
            padding: "10px 20px", 
            fontSize: "16px",
            backgroundColor: loading ? "#ccc" : "#f44336",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: loading ? "not-allowed" : "pointer"
          }}
        >
          {loading ? "Processing..." : "Punch Out"}
        </button>
      </div>

      {loading && <p>Loading logs...</p>}

      <h2>My Time Logs</h2>
      {logs.length === 0 ? (
        <p>No time logs yet. Punch in to start tracking!</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {logs.map((log) => (
            <li key={log.id || log._id} style={{ 
              padding: "10px", 
              borderBottom: "1px solid #eee",
              marginBottom: "10px"
            }}>
              <strong>In:</strong> {new Date(log.punchIn).toLocaleString()}
              {log.punchOut && (
                <>
                  <br />
                  <strong>Out:</strong> {new Date(log.punchOut).toLocaleString()} 
                  <br />
                  <strong>Total:</strong> {log.totalHours} hrs
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