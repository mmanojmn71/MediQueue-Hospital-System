
import { useEffect, useState } from "react";

function StaffGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/staff/session");

        if (!response.ok) {
          throw new Error("Unable to check staff session");
        }

        const data = await response.json();

        if (active) {
          setAuthenticated(data.authenticated === true);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Staff login failed"
        );
      }

      setPassword("");
      setAuthenticated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/staff/logout", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Unable to log out");
      }

      setAuthenticated(false);
      setPassword("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <section className="staff-gate">
        <h2>Staff Administration</h2>
        <p>Checking staff session...</p>
      </section>
    );
  }

  return (
    <section className="staff-gate">
      <div className="staff-gate-header">
        <div>
          <h2>Staff Administration</h2>
          <p>Sign in to manage doctor schedules.</p>
        </div>

        {authenticated && (
          <button
            type="button"
            className="staff-logout"
            onClick={handleLogout}
            disabled={busy}
          >
            Log Out
          </button>
        )}
      </div>

      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}

      {authenticated ? (
        children
      ) : (
        <form
          className="staff-login-form"
          onSubmit={handleLogin}
        >
          <label htmlFor="staff-password">
            Staff Password
          </label>

          <input
            id="staff-password"
            type="password"
            value={password}
            onChange={event =>
              setPassword(event.target.value)
            }
            placeholder="Enter staff password"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={busy || !password}
          >
            {busy ? "Signing in..." : "Staff Login"}
          </button>
        </form>
      )}
    </section>
  );
}

export default StaffGate;
