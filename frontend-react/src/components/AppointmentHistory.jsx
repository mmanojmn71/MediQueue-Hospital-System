
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
  const [processingId, setProcessingId] = useState(null);
  const [manualRefreshKey, setManualRefreshKey] = useState(0);

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

  async function updateAppointment(appointment, action) {
    if (processingId) return;

    const actionText =
      action === "complete"
        ? "mark as completed"
        : "cancel";

    const confirmed = window.confirm(
      `Do you want to ${actionText} the appointment ` +
      `for ${appointment.patientName}?`
    );

    if (!confirmed) return;

    setProcessingId(appointment._id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/appointments/${appointment._id}/${action}`,
        { method: "PATCH" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to update appointment"
        );
      }

      const newStatus =
        action === "complete" ? "completed" : "cancelled";

      setAppointments(previous =>
        previous.map(item =>
          item._id === appointment._id
            ? { ...item, status: newStatus }
            : item
        )
      );

      setSuccess(result.message);

      // Existing callback refreshes history and slots.
      if (onAppointmentCancelled) {
        onAppointmentCancelled();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  }

  const filteredAppointments = appointments.filter(
    appointment =>
      filter === "all" || appointment.status === filter
  );

  const bookedCount = appointments.filter(
    a => a.status === "booked"
  ).length;

  const completedCount = appointments.filter(
    a => a.status === "completed"
  ).length;

  const cancelledCount = appointments.filter(
    a => a.status === "cancelled"
  ).length;

  return (
    <section className="history-section">
      <div className="history-header">
        <div>
          <h2>Appointment History</h2>
          <p>Manage demo appointments stored in MongoDB.</p>
        </div>

        <button
          className="history-refresh"
          type="button"
          onClick={handleRefresh}
          disabled={
            loading ||
            refreshing ||
            Boolean(processingId)
          }
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
                <div className="history-actions">
                  <button
                    type="button"
                    className="complete-appointment-button"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      updateAppointment(appointment, "complete")
                    }
                  >
                    {processingId === appointment._id
                      ? "Processing..."
                      : "Mark as Completed"}
                  </button>

                  <button
                    type="button"
                    className="cancel-appointment-button"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      updateAppointment(appointment, "cancel")
                    }
                  >
                    {processingId === appointment._id
                      ? "Processing..."
                      : "Cancel Appointment"}
                  </button>
                </div>
              )}

              {appointment.status === "completed" && (
                <p className="completed-label">
                  Consultation completed.
                </p>
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
