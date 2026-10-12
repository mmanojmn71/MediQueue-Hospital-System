
import { useEffect, useState } from "react";

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return date || "Not specified";
  }

  const [year, month, day] = date.split("-").map(Number);

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time || "")) {
    return time || "Not specified";
  }

  const [hour, minute] = time.split(":").map(Number);
  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function AppointmentHistory({
  refreshKey = 0,
  onAppointmentCancelled
}) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);

  // Retrieve appointments after booking,
  // cancellation, or clicking Refresh.
  useEffect(() => {
    const controller = new AbortController();

    async function loadAppointments() {
      setError("");

      try {
        const response = await fetch("/api/appointments", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Unable to fetch appointments");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid appointment response");
        }

        if (!controller.signal.aborted) {
          setAppointments(data);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    loadAppointments();

    return () => controller.abort();
  }, [refreshKey, manualRefreshKey]);

  function handleRefresh() {
    setRefreshing(true);
    setSuccess("");
    setManualRefreshKey(value => value + 1);
  }

  // DAY 34: Cancel an appointment
  async function handleCancel(appointment) {
    if (cancellingId) return;

    const confirmed = window.confirm(
      `Cancel the appointment for ${appointment.patientName} ` +
      `on ${formatDate(appointment.appointmentDate)} ` +
      `at ${formatTime(appointment.appointmentTime)}?`
    );

    if (!confirmed) return;

    setCancellingId(appointment._id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/appointments/${appointment._id}/cancel`,
        { method: "PATCH" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to cancel appointment"
        );
      }

      // Update the card immediately.
      setAppointments(previous =>
        previous.map(item =>
          item._id === appointment._id
            ? {
                ...item,
                status: "cancelled"
              }
            : item
        )
      );

      setSuccess("Appointment cancelled successfully");

      // Refresh appointment history and free slots.
      if (onAppointmentCancelled) {
        onAppointmentCancelled();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

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
          <p>
            View and manage demo appointments in MongoDB.
          </p>
        </div>

        <button
          type="button"
          className="history-refresh"
          onClick={handleRefresh}
          disabled={loading || refreshing || Boolean(cancellingId)}
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

      {success && (
        <p className="cancel-success" role="status">
          {success}
        </p>
      )}

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

              {appointment.status === "booked" && (
                <button
                  type="button"
                  className="cancel-appointment-button"
                  disabled={Boolean(cancellingId)}
                  onClick={() => handleCancel(appointment)}
                >
                  {cancellingId === appointment._id
                    ? "Cancelling..."
                    : "Cancel Appointment"}
                </button>
              )}

              {appointment.status === "cancelled" && (
                <p className="cancelled-label">
                  This appointment has been cancelled.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AppointmentHistory;
