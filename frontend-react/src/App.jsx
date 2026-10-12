
import { useEffect, useState } from "react";

import Stats from "./components/Stats";
import PatientForm from "./components/PatientForm";
import QueueList from "./components/QueueList";
import DoctorList from "./components/DoctorList";
import AppointmentForm from "./components/AppointmentForm";
import AppointmentHistory from "./components/AppointmentHistory";

import "./App.css";

function App() {
  const [patientName, setPatientName] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [historyRefreshKey, setHistoryRefreshKey] =
    useState(0);

  const [availabilityRefreshKey, setAvailabilityRefreshKey] =
    useState(0);

  async function loadPatients() {
    try {
      const response = await fetch("/api/patients");

      if (!response.ok) {
        throw new Error("Unable to load patients");
      }

      const data = await response.json();

      setPatients(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  async function addPatient() {
    const name = patientName.trim();

    if (!name || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to add patient"
        );
      }

      setPatientName("");
      await loadPatients();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function completePatient() {
    const nextPatient = patients.find(
      patient => patient.status === "waiting"
    );

    if (!nextPatient || saving) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/patients/${nextPatient._id}/complete`,
        { method: "PATCH" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to complete consultation"
        );
      }

      await loadPatients();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Called when a new booking succeeds
  function handleAppointmentBooked() {
    setHistoryRefreshKey(value => value + 1);
  }

  // Called when a booking is cancelled
  function handleAppointmentCancelled() {
    setHistoryRefreshKey(value => value + 1);

    // Remount the form so it reloads slot availability.
    // This also clears an unfinished form selection.
    setAvailabilityRefreshKey(value => value + 1);
  }

  const waitingPatients = patients.filter(
    patient => patient.status === "waiting"
  );

  const completedPatients = patients.filter(
    patient => patient.status === "completed"
  );

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>MediQueue Hospital Dashboard</h1>
        <p>Smart Hospital Queue Management System</p>
      </header>

      <Stats
        waiting={waitingPatients.length}
        completed={completedPatients.length}
      />

      <PatientForm
        patientName={patientName}
        setPatientName={setPatientName}
        addPatient={addPatient}
        saving={saving}
      />

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading patients...</p>
      ) : (
        <QueueList patients={waitingPatients} />
      )}

      <button
        className="complete-button"
        onClick={completePatient}
        disabled={saving || waitingPatients.length === 0}
      >
        {saving ? "Processing..." : "Complete Next Patient"}
      </button>

      <DoctorList />

      <AppointmentForm
        key={availabilityRefreshKey}
        onAppointmentBooked={handleAppointmentBooked}
      />

      <AppointmentHistory
        refreshKey={historyRefreshKey}
        onAppointmentCancelled={handleAppointmentCancelled}
      />
    </main>
  );
}

export default App;
