import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { getMe } from "../services/me";

export default function TopNav() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [role, setRole] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (!isLoaded || !isSignedIn || !userId) {
        setRole(null);
        return;
      }

      try {
        const me = await getMe({ cacheKey: userId });
        if (cancelled) return;
        setRole(me?.role ?? null);
      } catch {
        if (cancelled) return;
        setRole(null);
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
            to="/caregiver"
            className={({ isActive }) =>
              `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
            }
          >
            Dashboard
          </NavLink>

          {(role === "admin" || role === "superadmin") && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `btn topNavBtn${isActive ? " topNavBtnActive" : ""}`
              }
            >
              Admin
            </NavLink>
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
