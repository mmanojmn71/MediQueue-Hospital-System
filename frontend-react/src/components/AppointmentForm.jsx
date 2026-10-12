
import { useEffect, useState } from "react";

function getTodayIndia() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = type =>
    parts.find(part => part.type === type).value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(time) {
  const [hour, minute] = time.split(":").map(Number);

  const hour12 = hour % 12 || 12;
  const period = hour >= 12 ? "PM" : "AM";

  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function AppointmentForm({ onAppointmentBooked }) {
  const [hospitals, setHospitals] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [patientName, setPatientName] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // Load hospitals and doctors
  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const [hospitalResponse, doctorResponse] =
          await Promise.all([
            fetch("/api/hospitals", {
              signal: controller.signal
            }),
            fetch("/api/doctors", {
              signal: controller.signal
            })
          ]);

        if (!hospitalResponse.ok || !doctorResponse.ok) {
          throw new Error("Unable to load hospitals or doctors");
        }

        const hospitalData = await hospitalResponse.json();
        const doctorData = await doctorResponse.json();

        if (!controller.signal.aborted) {
          setHospitals(hospitalData);
          setDoctors(doctorData);
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

    loadData();

    return () => controller.abort();
  }, []);

  const filteredDoctors = doctors.filter(
    doctor =>
      doctor.hospital?._id === hospitalId &&
      doctor.isAvailable === true
  );

  // Fetch dynamic slots whenever the selection changes
  useEffect(() => {
    if (!doctorId || !date) {
      setSlots([]);
      setSlotsLoading(false);
      setSlotsError("");
      return;
    }

    const controller = new AbortController();

    setTime("");
    setSlots([]);
    setSlotsLoading(true);
    setSlotsError("");

    async function loadSlots() {
      try {
        const query = new URLSearchParams({
          doctor: doctorId,
          date
        });

        const response = await fetch(
          `/api/appointments/slots?${query.toString()}`,
          { signal: controller.signal }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Unable to load time slots"
          );
        }

        if (!controller.signal.aborted) {
          setSlots(result.slots);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setSlotsError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSlotsLoading(false);
        }
      }
    }

    loadSlots();

    return () => controller.abort();
  }, [doctorId, date, refreshCount]);

  function changeHospital(event) {
    setHospitalId(event.target.value);
    setDoctorId("");
    setDate("");
    setTime("");
    setSlots([]);
    setError("");
    setConfirmation(null);
  }

  function changeDoctor(event) {
    setDoctorId(event.target.value);
    setTime("");
    setSlots([]);
    setError("");
    setConfirmation(null);
  }

  function changeDate(event) {
    setDate(event.target.value);
    setTime("");
    setSlots([]);
    setError("");
    setConfirmation(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting || slotsLoading || slotsError) {
      return;
    }

    const selectedSlot = slots.find(
      slot => slot.time === time
    );

    if (!selectedSlot?.available) {
      setError("Please select an available slot");
      return;
    }

    setSubmitting(true);
    setError("");
    setConfirmation(null);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patientName: patientName.trim(),
          hospital: hospitalId,
          doctor: doctorId,
          appointmentDate: date,
          appointmentTime: time
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Appointment booking failed"
        );
      }

      setConfirmation({
        ...result.appointment,
        hospitalName: hospitals.find(
          hospital => hospital._id === hospitalId
        )?.name,
        doctorName: doctors.find(
          doctor => doctor._id === doctorId
        )?.name
      });

      // Tell App.jsx to refresh appointment history
      if (onAppointmentBooked) {
        onAppointmentBooked();
      }

      setPatientName("");
      setTime("");

      // Refresh available slots
      setRefreshCount(count => count + 1);

    } catch (err) {
      setError(err.message);
      setRefreshCount(count => count + 1);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="appointment-section">
        <h2>Book an Appointment</h2>
        <p>Loading booking form...</p>
      </section>
    );
  }

  const availableCount = slots.filter(
    slot => slot.available
  ).length;

  return (
    <section className="appointment-section">
      <div className="section-title">
        <h2>Book an Appointment</h2>
        <p>
          Select your hospital, doctor, date and time.
        </p>
      </div>

      <form
        className="appointment-form"
        onSubmit={handleSubmit}
      >
        <label htmlFor="booking-name">
          Patient Name
        </label>

        <input
          id="booking-name"
          type="text"
          placeholder="Enter patient name"
          value={patientName}
          onChange={event =>
            setPatientName(event.target.value)
          }
          maxLength={100}
          required
        />

        <label htmlFor="booking-hospital">
          Select Hospital
        </label>

        <select
          id="booking-hospital"
          value={hospitalId}
          onChange={changeHospital}
          required
        >
          <option value="">Choose Hospital</option>

          {hospitals.map(hospital => (
            <option
              key={hospital._id}
              value={hospital._id}
            >
              {hospital.name}
            </option>
          ))}
        </select>

        <label htmlFor="booking-doctor">
          Select Doctor
        </label>

        <select
          id="booking-doctor"
          value={doctorId}
          onChange={changeDoctor}
          disabled={!hospitalId}
          required
        >
          <option value="">Choose Doctor</option>

          {filteredDoctors.map(doctor => (
            <option
              key={doctor._id}
              value={doctor._id}
            >
              {doctor.name} — {doctor.specialization}
            </option>
          ))}
        </select>

        <label htmlFor="booking-date">
          Appointment Date
        </label>

        <input
          id="booking-date"
          type="date"
          min={getTodayIndia()}
          value={date}
          onChange={changeDate}
          required
        />

        <div className="slot-heading">
          <h3>Available Time Slots</h3>

          {doctorId && date && !slotsLoading && !slotsError && (
            <span>{availableCount} available</span>
          )}
        </div>

        {slotsLoading && (
          <p>Checking appointment availability...</p>
        )}

        {slotsError && (
          <p className="booking-error" role="alert">
            {slotsError}
          </p>
        )}

        {(!doctorId || !date) && (
          <p className="booking-note">
            Select a doctor and date to view available slots.
          </p>
        )}

        {!slotsLoading &&
          !slotsError &&
          slots.length > 0 && (
            <div className="slot-grid">
              {slots.map(slot => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available || submitting}
                  className={
                    !slot.available
                      ? "slot-button booked"
                      : time === slot.time
                        ? "slot-button selected"
                        : "slot-button available"
                  }
                  aria-pressed={
                    slot.available && time === slot.time
                  }
                  onClick={() => setTime(slot.time)}
                >
                  <strong>{formatTime(slot.time)}</strong>
                  <small>
                    {slot.available
                      ? "Available"
                      : slot.reason || "Unavailable"}
                  </small>
                </button>
              ))}
            </div>
          )}

        <p className="booking-note">
          Demo schedule: Monday–Friday, 9:00 AM–4:30 PM.
          The backend confirms whether a slot is still available.
        </p>

        <button
          className="confirm-booking"
          type="submit"
          disabled={
            submitting ||
            slotsLoading ||
            Boolean(slotsError) ||
            !patientName.trim() ||
            !hospitalId ||
            !doctorId ||
            !date ||
            !time
          }
        >
          {submitting
            ? "Booking Appointment..."
            : "Confirm Appointment"}
        </button>
      </form>

      {error && (
        <p className="booking-error" role="alert">
          {error}
        </p>
      )}

      {confirmation && (
        <div className="booking-success" role="status">
          <h3>Appointment Confirmed!</h3>

          <p>
            <strong>Patient:</strong>{" "}
            {confirmation.patientName}
          </p>

          <p>
            <strong>Hospital:</strong>{" "}
            {confirmation.hospitalName}
          </p>

          <p>
            <strong>Doctor:</strong>{" "}
            {confirmation.doctorName}
          </p>

          <p>
            <strong>Date:</strong>{" "}
            {confirmation.appointmentDate}
          </p>

          <p>
            <strong>Time:</strong>{" "}
            {formatTime(confirmation.appointmentTime)}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {confirmation.status}
          </p>

          <p className="booking-id">
            Booking ID: {confirmation._id}
          </p>
        </div>
      )}
    </section>
  );
}

export default AppointmentForm;
