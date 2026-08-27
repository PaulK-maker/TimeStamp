import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getMe } from "../services/me";

export default function TopNav() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [role, setRole] = useState(null);
  const [tenantName, setTenantName] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (!isLoaded || !isSignedIn || !userId) {
        setRole(null);
        setTenantName(null);
        return;
      }

      try {
        const me = await getMe({ cacheKey: userId });
        if (cancelled) return;
        setRole(me?.role ?? null);
        setTenantName(me?.tenantName ?? null);
      } catch {
        if (cancelled) return;
        setRole(null);
        setTenantName(null);
      }
    }

    loadRole();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div className="topNav">
      <div className="topNavInner">
        {tenantName ? (
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              padding: "6px 0",
              color: "#111",
            }}
            title="Current facility"
          >
            🏠 {tenantName}
          </div>
        ) : null}
        <div className="topNavLinks">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/staff"
            className={({ isActive }) =>
              `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
            }
          >
            Dashboard
          </NavLink>

          {(role === "admin" || role === "superadmin") && (
            <>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
                }
              >
                Admin
              </NavLink>
              <NavLink
                to="/admin/operations"
                className={({ isActive }) =>
                  `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
                }
              >
                Operations
              </NavLink>
              <NavLink
                to="/admin/payroll"
                className={({ isActive }) =>
                  `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
                }
              >
                Payroll
              </NavLink>
            </>
          )}

          {role === "superadmin" && (
            <NavLink
              to="/superadmin"
              className={({ isActive }) =>
                `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
              }
            >
              Superadmin
            </NavLink>
          )}
        </div>
      </div>
    </div>
  );
}
