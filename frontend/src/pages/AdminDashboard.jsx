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
  const [signedInEmail, setSignedInEmail] = useState("");

  const [tenantCode, setTenantCode] = useState(null);
  const [tenantName, setTenantName] = useState(null);
  const [shiftLengthHours, setShiftLengthHours] = useState(8);
  const [shiftLengthSaving, setShiftLengthSaving] = useState(false);

  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceLatitude, setGeofenceLatitude] = useState(null);
  const [geofenceLongitude, setGeofenceLongitude] = useState(null);
  const [geofenceRadiusMeters, setGeofenceRadiusMeters] = useState(200);
  const [geofenceLocating, setGeofenceLocating] = useState(false);
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const [geofenceStatus, setGeofenceStatus] = useState("");

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
     Shift length (8h / 12h) setting
  ======================= */
  const handleShiftLengthChange = useCallback(async (nextValue) => {
    if (nextValue === shiftLengthHours || shiftLengthSaving) return;

    const previousValue = shiftLengthHours;
    setShiftLengthHours(nextValue);
    setShiftLengthSaving(true);
    setErrorMsg("");
    try {
      await api.patch("/admin/shift-length", { shiftLengthHours: nextValue });
    } catch (err) {
      setShiftLengthHours(previousValue);

      if (err.response?.status === 403) {
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
        setErrorMsg(err.response?.data?.message || "Failed to update shift length.");
      }
    } finally {
      setShiftLengthSaving(false);
    }
  }, [shiftLengthHours, shiftLengthSaving]);

  /* =======================
     Geofenced clock-in/out setting
  ======================= */
  const handleUseCurrentLocation = useCallback(() => {
    setGeofenceStatus("");
    setErrorMsg("");

    if (!navigator.geolocation) {
      setErrorMsg("Location services are not available in this browser.");
      return;
    }

    setGeofenceLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeofenceLatitude(position.coords.latitude);
        setGeofenceLongitude(position.coords.longitude);
        setGeofenceStatus("Location captured. Click Save to apply it.");
        setGeofenceLocating(false);
      },
      (geoError) => {
        setErrorMsg(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Location permission was denied. Enable location access for this site and try again."
            : "Could not determine your current location. Please try again."
        );
        setGeofenceLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  const handleSaveGeofenceLocation = useCallback(async () => {
    if (geofenceLatitude == null || geofenceLongitude == null) {
      setErrorMsg("Use the button to capture the facility's location before saving.");
      return;
    }

    setGeofenceSaving(true);
    setErrorMsg("");
    setGeofenceStatus("");
    try {
      await api.patch("/admin/geofence", {
        facilityLatitude: geofenceLatitude,
        facilityLongitude: geofenceLongitude,
        geofenceRadiusMeters,
      });
      setGeofenceStatus("Facility location and radius saved.");
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to save facility location.");
    } finally {
      setGeofenceSaving(false);
    }
  }, [geofenceLatitude, geofenceLongitude, geofenceRadiusMeters]);

  const handleToggleGeofenceEnabled = useCallback(async () => {
    const nextValue = !geofenceEnabled;
    setGeofenceSaving(true);
    setErrorMsg("");
    setGeofenceStatus("");
    try {
      await api.patch("/admin/geofence", { geofenceEnabled: nextValue });
      setGeofenceEnabled(nextValue);
      setGeofenceStatus(nextValue ? "Geofencing enabled." : "Geofencing disabled.");
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === "GEOFENCE_LOCATION_REQUIRED") {
        setErrorMsg("Set and save a facility location before enabling geofencing.");
      } else {
        setErrorMsg(err.response?.data?.message || "Failed to update geofencing.");
      }
    } finally {
      setGeofenceSaving(false);
    }
  }, [geofenceEnabled]);

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
        setShiftLengthHours(me?.shiftLengthHours === 12 ? 12 : 8);
        setGeofenceEnabled(Boolean(me?.geofence?.enabled));
        setGeofenceLatitude(
          typeof me?.geofence?.latitude === "number" ? me.geofence.latitude : null
        );
        setGeofenceLongitude(
          typeof me?.geofence?.longitude === "number" ? me.geofence.longitude : null
        );
        setGeofenceRadiusMeters(me?.geofence?.radiusMeters || 200);
        setSignedInEmail(
          me?.email ||
            me?.emailAddress ||
            me?.primaryEmailAddress?.emailAddress ||
            ""
        );
      } catch {
        if (cancelled) return;
        setTenantCode(null);
        setTenantName(null);
        setSignedInEmail("");
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

  const renderLocationBadge = (location, label) => {
    if (!location || typeof location.withinFence !== "boolean") return null;

    const isWithin = location.withinFence;
    const distance = typeof location.distanceMeters === "number" ? `${location.distanceMeters}m` : "";

    return (
      <span
        key={label}
        title={`${label}: ${isWithin ? "on-site" : "off-site"}${distance ? ` (${distance} from facility)` : ""}`}
        style={{
          display: "inline-block",
          padding: "2px 6px",
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 700,
          marginRight: 4,
          color: isWithin ? "#146c43" : "#b00020",
          background: isWithin ? "#e6f4ea" : "#ffe1e1",
        }}
      >
        {label} {isWithin ? "✓" : "⚠"} {distance}
      </span>
    );
  };

  const renderLocationCell = (punchInLocation, punchOutLocation) => {
    const badges = [
      renderLocationBadge(punchInLocation, "In"),
      renderLocationBadge(punchOutLocation, "Out"),
    ].filter(Boolean);

    if (badges.length === 0) {
      return <span style={{ color: "#999" }}>—</span>;
    }

    return <>{badges}</>;
  };

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
    const next = totals.map((item) => ({
      ...item,
      shiftCount: item.totalHours / shiftLengthHours,
    }));
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
  }, [totals, totalsSort, shiftLengthHours]);

  /* =======================
     Overtime alerts (current work week, Mon-Sun)
     Two-tier: "approaching" starts 2 hrs before the 40-hr threshold,
     "overtime" once actually at/over 40 hrs.
  ======================= */
  const OVERTIME_THRESHOLD_HOURS = 40;
  const OVERTIME_WARNING_BUFFER_HOURS = 2;

  const overtimeAlerts = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const weekStart = new Date(now);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(now.getDate() + diffToMonday);

    const weekTotals = {};

    logs.forEach((log) => {
      if (!log.punchIn || !log.punchOut || !log.staff?._id) return;
      const punchInDate = new Date(log.punchIn);
      if (punchInDate < weekStart) return;

      const hours = (new Date(log.punchOut) - punchInDate) / (1000 * 60 * 60);
      const staffId = log.staff._id;

      if (!weekTotals[staffId]) {
        weekTotals[staffId] = { staff: log.staff, hours: 0 };
      }
      weekTotals[staffId].hours += hours;
    });

    return Object.values(weekTotals)
      .filter((entry) => entry.hours >= OVERTIME_THRESHOLD_HOURS - OVERTIME_WARNING_BUFFER_HOURS)
      .map((entry) => ({
        ...entry,
        isOvertime: entry.hours >= OVERTIME_THRESHOLD_HOURS,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [logs]);

  /* =======================
     Missed punch-out alerts
     Flags shifts still open well past a normal shift length - likely
     someone forgot to punch out, rather than a genuinely long shift.
  ======================= */
  const MISSED_PUNCH_OUT_BUFFER_HOURS = 4;

  const missedPunchOutAlerts = useMemo(() => {
    const now = new Date();
    const thresholdMs = (shiftLengthHours + MISSED_PUNCH_OUT_BUFFER_HOURS) * 60 * 60 * 1000;

    return logs
      .filter((log) => !log.punchOut && log.punchIn && log.staff?._id)
      .map((log) => {
        const punchInDate = new Date(log.punchIn);
        const hoursOpen = (now - punchInDate) / (1000 * 60 * 60);
        return { log, hoursOpen };
      })
      .filter((entry) => now - new Date(entry.log.punchIn) > thresholdMs)
      .sort((a, b) => b.hoursOpen - a.hoursOpen);
  }, [logs, shiftLengthHours]);

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
            {signedInEmail ? (
              <div style={{ marginTop: 4, color: "#555" }}>
                Signed in as: <strong>{signedInEmail}</strong>
              </div>
            ) : null}
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
                  <th align="left">Location</th>
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
                      <td>{renderLocationCell(log.punchInLocation, log.punchOutLocation)}</td>
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

        {/* Missed Punch-Out Alerts */}
        {missedPunchOutAlerts.length > 0 ? (
          <div
            style={{
              background: "#fff3f3",
              border: "1px solid #ffd7d7",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 6px 0", color: "#b00020" }}>⏰ Missed Punch-Out?</h2>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 10 }}>
              These shifts are still open well past a normal {shiftLengthHours}-hour shift —
              likely someone forgot to punch out.
            </div>
            <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Staff</th>
                  <th align="left">Job</th>
                  <th align="left">Punched In</th>
                  <th align="right">Hours Open</th>
                </tr>
              </thead>
              <tbody>
                {missedPunchOutAlerts.map(({ log, hoursOpen }) => (
                  <tr key={log._id} style={{ borderTop: "1px solid #ffd7d7" }}>
                    <td>{log.staff?.firstName} {log.staff?.lastName}</td>
                    <td>{log.jobSnapshot?.name || log.job?.name || "-"}</td>
                    <td>{formatDateTime(log.punchIn)}</td>
                    <td align="right">
                      <strong style={{ color: "#b00020" }}>{hoursOpen.toFixed(1)} hrs</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Overtime Alerts */}
        {overtimeAlerts.length > 0 ? (
          <div
            style={{
              background: "#fff3f3",
              border: "1px solid #ffd7d7",
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ margin: "0 0 6px 0", color: "#b00020" }}>⚠️ Overtime This Week</h2>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 10 }}>
              Staff approaching or over {OVERTIME_THRESHOLD_HOURS} hours for the current work week (Mon–Sun).
            </div>
            <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Staff</th>
                  <th align="right">Hours This Week</th>
                  <th align="right">Status</th>
                </tr>
              </thead>
              <tbody>
                {overtimeAlerts.map((item) => (
                  <tr key={item.staff._id} style={{ borderTop: "1px solid #ffd7d7" }}>
                    <td>{item.staff.firstName} {item.staff.lastName}</td>
                    <td align="right">
                      <strong style={{ color: item.isOvertime ? "#b00020" : "#8a6d00" }}>
                        {item.hours.toFixed(2)} hrs
                      </strong>
                    </td>
                    <td align="right">
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          color: item.isOvertime ? "#b00020" : "#8a6d00",
                          background: item.isOvertime ? "#ffe1e1" : "#fff3cd",
                        }}
                      >
                        {item.isOvertime ? "Overtime" : "Approaching"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Geofenced clock-in/out */}
        <div
          style={{
            background: "#fff",
            padding: "20px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ marginTop: 0 }}>📍 Geofenced Clock-In</h2>
          <div style={{ color: "#555", fontSize: 13, marginBottom: 14 }}>
            Require staff to be physically at the facility to punch in or out. Stand at the
            facility and capture its location, set a radius, then enable enforcement.
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={geofenceLocating || geofenceSaving}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid #111",
                background: "#fff",
                color: "#111",
                cursor: geofenceLocating || geofenceSaving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {geofenceLocating ? "Getting location…" : "📍 Use my current location"}
            </button>

            <span style={{ color: "#555", fontSize: 13 }}>
              {geofenceLatitude != null && geofenceLongitude != null
                ? `Captured: ${geofenceLatitude.toFixed(5)}, ${geofenceLongitude.toFixed(5)}`
                : "No facility location set yet"}
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 13, color: "#444" }}>
              Radius:
              <select
                value={geofenceRadiusMeters}
                onChange={(e) => setGeofenceRadiusMeters(Number(e.target.value))}
                disabled={geofenceSaving}
                style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd" }}
              >
                <option value={100}>100 meters</option>
                <option value={200}>200 meters</option>
                <option value={500}>500 meters</option>
                <option value={1000}>1000 meters</option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleSaveGeofenceLocation}
              disabled={geofenceSaving || geofenceLatitude == null || geofenceLongitude == null}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                background: "#111",
                color: "#fff",
                cursor: geofenceSaving ? "not-allowed" : "pointer",
                fontWeight: 600,
              }}
            >
              {geofenceSaving ? "Saving…" : "Save Location & Radius"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: "#444" }}>Enforcement:</span>
            <button
              type="button"
              onClick={handleToggleGeofenceEnabled}
              disabled={geofenceSaving}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "none",
                background: geofenceEnabled ? "#146c43" : "#999",
                color: "#fff",
                cursor: geofenceSaving ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {geofenceEnabled ? "ON — required to clock in/out" : "OFF"}
            </button>
          </div>

          {geofenceStatus ? (
            <div style={{ marginTop: 10, color: "#146c43", fontSize: 13 }}>{geofenceStatus}</div>
          ) : null}
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ color: "#555", fontSize: 13 }}>Facility shift length:</span>
            <div style={{ display: "inline-flex", border: "1px solid #ddd", borderRadius: 6, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => handleShiftLengthChange(8)}
                disabled={shiftLengthSaving}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  background: shiftLengthHours === 8 ? "#111" : "#fff",
                  color: shiftLengthHours === 8 ? "#fff" : "#111",
                  cursor: shiftLengthSaving ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                8-hour shifts
              </button>
              <button
                type="button"
                onClick={() => handleShiftLengthChange(12)}
                disabled={shiftLengthSaving}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderLeft: "1px solid #ddd",
                  background: shiftLengthHours === 12 ? "#111" : "#fff",
                  color: shiftLengthHours === 12 ? "#fff" : "#111",
                  cursor: shiftLengthSaving ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                12-hour shifts
              </button>
            </div>
            <span style={{ color: "#999", fontSize: 12 }}>
              Shifts worked = total hours ÷ {shiftLengthHours}. An estimate for reference — hours worked stays authoritative.
            </span>
          </div>

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
                    <th align="right">Shifts (~{shiftLengthHours}h)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTotals.map((item, idx) => (
                    <tr key={item.staff._id} style={{ borderTop: "1px solid #eee" }}>
                      <td>#{idx + 1}</td>
                      <td>{item.staff.firstName} {item.staff.lastName}</td>
                      <td>{item.staff.email || "-"}</td>
                      <td align="right"><strong>{item.totalHours.toFixed(2)} hrs</strong></td>
                      <td align="right">{item.shiftCount.toFixed(1)}</td>
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