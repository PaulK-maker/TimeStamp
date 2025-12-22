import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

const AdminDashboard = () => {
  const [logs, setLogs] = useState([]);
  const [totalHours, setTotalHours] = useState([]);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  useEffect(() => {
    const fetchTimeLogs = async () => {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      try {
        const res = await axios.get(
          "http://localhost:5000/api/admin/timelogs",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setLogs(res.data.logs);

        const totalMap = {};
        res.data.logs.forEach((log) => {
          const hours =
            log.clockOut && log.clockIn
              ? (new Date(log.clockOut) - new Date(log.clockIn)) /
                (1000 * 60 * 60)
              : 0;

          const id = log.caregiver._id;
          if (!totalMap[id]) {
            totalMap[id] = {
              ...log.caregiver,
              totalHours: 0,
            };
          }
          totalMap[id].totalHours += hours;
        });

        setTotalHours(Object.values(totalMap));
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
        logout();
      }
    };

    fetchTimeLogs();
  }, [navigate]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <Header />

      <div style={{ padding: "20px" }}>
        <h1>Admin Dashboard</h1>
        <button onClick={logout}>Logout</button>

        <h2>All Time Logs</h2>
        <table border="1" cellPadding="5" width="100%">
          <thead>
            <tr>
              <th>Caregiver</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id}>
                <td>
                  {log.caregiver.firstName} {log.caregiver.lastName}
                </td>
                <td>{new Date(log.clockIn).toLocaleString()}</td>
                <td>
                  {log.clockOut
                    ? new Date(log.clockOut).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {log.clockOut
                    ? (
                        (new Date(log.clockOut) -
                          new Date(log.clockIn)) /
                        (1000 * 60 * 60)
                      ).toFixed(2)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Total Hours per Caregiver</h2>
        <ul>
          {totalHours.map((item) => (
            <li key={item._id}>
              {item.firstName} {item.lastName}:{" "}
              {item.totalHours.toFixed(2)} hrs
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminDashboard;