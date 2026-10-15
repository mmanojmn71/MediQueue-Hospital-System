
import { useEffect, useState } from "react";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function DoctorManagement({ refreshKey = 0, onUpdated }) {
  const [doctors, setDoctors] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDoctors() {
      setLoading(true);

      try {
        const response = await fetch("/api/doctors", {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error("Unable to load doctors");
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          setDoctors(data);
          setSelectedId(previous =>
            data.some(d => d._id === previous)
              ? previous
              : data[0]?._id || ""
          );
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDoctors();

    return () => controller.abort();
  }, [refreshKey]);

  const selectedDoctor = doctors.find(
    doctor => doctor._id === selectedId
  );

  // Reset editable fields when selecting a doctor.
  useEffect(() => {
    if (!selectedDoctor) {
      setSchedule([]);
      return;
    }

    setSchedule(
      (selectedDoctor.workingSchedule || []).map(item => ({
        dayOfWeek: item.dayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime
      }))
    );

    setDuration(
      selectedDoctor.slotDurationMinutes || 30
    );
  }, [selectedDoctor]);

  function changeDay(dayOfWeek, enabled) {
    setSuccess("");
    setError("");

    if (enabled) {
      setSchedule(previous => [
        ...previous,
        {
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00"
        }
      ].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
    } else {
      setSchedule(previous =>
        previous.filter(
          item => item.dayOfWeek !== dayOfWeek
        )
      );
    }
  }

  function changeTime(dayOfWeek, field, value) {
    setSchedule(previous =>
      previous.map(item =>
        item.dayOfWeek === dayOfWeek
          ? { ...item, [field]: value }
          : item
      )
    );

    setSuccess("");
  }

  async function saveSchedule() {
    if (!selectedDoctor || saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/doctors/${selectedId}/schedule`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            workingSchedule: schedule,
            slotDurationMinutes: Number(duration)
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const conflictText = result.conflicts?.length
          ? " Conflicting slots: " +
            result.conflicts.map(
              item => `${item.date} ${item.time}`
            ).join(", ")
          : "";

        throw new Error(
          (result.message || "Schedule update failed") +
          conflictText
        );
      }

      setDoctors(previous =>
        previous.map(doctor =>
          doctor._id === selectedId
            ? result.doctor
            : doctor
        )
      );

      setSuccess(result.message);
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability() {
    if (!selectedDoctor || saving) return;

    const newValue = !selectedDoctor.isAvailable;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/doctors/${selectedId}/availability`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            isAvailable: newValue
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          "Availability update failed"
        );
      }

      setDoctors(previous =>
        previous.map(doctor =>
          doctor._id === selectedId
            ? result.doctor
            : doctor
        )
      );

      setSuccess(result.message);
      onUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="management-section">
        <h2>Doctor Management</h2>
        <p>Loading doctors...</p>
      </section>
    );
  }

  return (
    <section className="management-section">
      <h2>Doctor Management</h2>
      <p>
        Update fictional doctor schedules and availability.
      </p>

      <div className="management-field">
        <label htmlFor="management-doctor">
          Select Doctor
        </label>

        <select
          id="management-doctor"
          value={selectedId}
          onChange={event => {
            setSelectedId(event.target.value);
            setError("");
            setSuccess("");
          }}
        >
          {doctors.map(doctor => (
            <option
              value={doctor._id}
              key={doctor._id}
            >
              {doctor.name}
            </option>
          ))}
        </select>
      </div>

      {selectedDoctor && (
        <>
          <div className="management-doctor-card">
            <div>
              <h3>{selectedDoctor.name}</h3>
              <p>{selectedDoctor.specialization}</p>
              <p>
                {selectedDoctor.hospital?.name ||
                  "No hospital"}
              </p>
            </div>

            <span
              className={
                selectedDoctor.isAvailable
                  ? "management-status is-available"
                  : "management-status is-unavailable"
              }
            >
              {selectedDoctor.isAvailable
                ? "Available"
                : "Unavailable"}
            </span>
          </div>

          <button
            type="button"
            className="availability-toggle"
            onClick={toggleAvailability}
            disabled={saving}
          >
            {selectedDoctor.isAvailable
              ? "Mark Doctor Unavailable"
              : "Mark Doctor Available"}
          </button>

          <h3 className="management-subtitle">
            Weekly Working Schedule
          </h3>

          <div className="management-days">
            {DAYS.map((day, dayOfWeek) => {
              const item = schedule.find(
                value => value.dayOfWeek === dayOfWeek
              );

              return (
                <div
                  key={dayOfWeek}
                  className="management-day"
                >
                  <label className="management-day-label">
                    <input
                      type="checkbox"
                      checked={Boolean(item)}
                      onChange={event =>
                        changeDay(
                          dayOfWeek,
                          event.target.checked
                        )
                      }
                      disabled={saving}
                    />
                    <span>{day}</span>
                  </label>

                  {item && (
                    <div className="management-time-row">
                      <label>
                        Start
                        <input
                          type="time"
                          value={item.startTime}
                          onChange={event =>
                            changeTime(
                              dayOfWeek,
                              "startTime",
                              event.target.value
                            )
                          }
                          disabled={saving}
                        />
                      </label>

                      <label>
                        End
                        <input
                          type="time"
                          value={item.endTime}
                          onChange={event =>
                            changeTime(
                              dayOfWeek,
                              "endTime",
                              event.target.value
                            )
                          }
                          disabled={saving}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="management-field">
            <label htmlFor="slot-duration">
              Consultation Duration
            </label>

            <select
              id="slot-duration"
              value={duration}
              onChange={event =>
                setDuration(Number(event.target.value))
              }
              disabled={saving}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>

          <button
            type="button"
            className="management-save"
            onClick={saveSchedule}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Doctor Schedule"}
          </button>
        </>
      )}

      {!selectedDoctor && (
        <p>No doctors found.</p>
      )}

      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}

      {success && (
        <p className="cancel-success" role="status">
          {success}
        </p>
      )}
    </section>
  );
}

export default DoctorManagement;
