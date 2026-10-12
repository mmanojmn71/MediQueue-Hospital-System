
import { useEffect, useState } from "react";

function formatDate(date) {
  if (!date) return "Not specified";

  const parts = date.split("-");

  if (parts.length !== 3) return date;

  const [year, month, day] = parts.map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(time) {
  if (!time) return "Not specified";

  const [hour, minute] = time.split(":").map(Number);

  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function AppointmentHistory({ refreshKey = 0 }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  async function loadAppointments(manual = false) {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await fetch("/api/appointments");

      if (!response.ok) {
        throw new Error("Unable to fetch appointments");
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid appointment response");
      }

      setAppointments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function refreshHistory() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/appointments");

        if (!response.ok) {
          throw new Error("Unable to fetch appointments");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid appointment response");
        }

        if (active) {
          setAppointments(data);
        }
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    refreshHistory();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const filteredAppointments = appointments.filter(
    appointment =>
      filter === "all" || appointment.status === filter
  );

  const bookedCount = appointments.filter(
    appointment => appointment.status === "booked"
  ).length;

  const completedCount = appointments.filter(
    appointment => appointment.status === "completed"
  ).length;

  const cancelledCount = appointments.filter(
    appointment => appointment.status === "cancelled"
  ).length;

  return (
    <section className="history-section">
      <div className="history-header">
        <div>
          <h2>Appointment History</h2>
          <p>View saved appointments from MongoDB.</p>
        </div>

        <button
          type="button"
          className="history-refresh"
          onClick={() => loadAppointments(true)}
          disabled={loading || refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="history-stats">
        <div className="history-stat">
          <strong>{appointments.length}</strong>
          <span>Total</span>
        </div>

        <div className="history-stat">
          <strong>{bookedCount}</strong>
          <span>Booked</span>
        </div>

        <div className="history-stat">
          <strong>{completedCount}</strong>
          <span>Completed</span>
        </div>

        <div className="history-stat">
          <strong>{cancelledCount}</strong>
          <span>Cancelled</span>
        </div>
      </div>

      <div className="history-filters">
        <label htmlFor="history-filter">
          Filter by Status
        </label>

        <select
          id="history-filter"
          value={filter}
          onChange={event => setFilter(event.target.value)}
        >
          <option value="all">All Appointments</option>
          <option value="booked">Booked</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading appointments...</p>
      ) : filteredAppointments.length === 0 ? (
        <p className="history-empty">
          No appointments found.
        </p>
      ) : (
        <div className="history-grid">
          {filteredAppointments.map(appointment => (
            <article
              key={appointment._id}
              className="history-card"
            >
              <div className="history-card-top">
                <h3>{appointment.patientName}</h3>

                <span
                  className={
                    `history-status status-${appointment.status}`
                  }
                >
                  {appointment.status}
                </span>
              </div>

              <p>
                <strong>Doctor:</strong>{" "}
                {appointment.doctor?.name ?? "Unknown"}
              </p>

              <p>
                <strong>Specialization:</strong>{" "}
                {appointment.doctor?.specialization ??
                  "Not specified"}
              </p>

              <p>
                <strong>Hospital:</strong>{" "}
                {appointment.hospital?.name ?? "Unknown"}
              </p>

              <p>
                <strong>Date:</strong>{" "}
                {formatDate(appointment.appointmentDate)}
              </p>

              <p>
                <strong>Time:</strong>{" "}
                {formatTime(appointment.appointmentTime)}
              </p>

              <p className="history-booking-id">
                Booking ID: {appointment._id}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AppointmentHistory;
