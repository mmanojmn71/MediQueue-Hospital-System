
import { useState } from "react";

import Stats from "./components/Stats";
import PatientForm from "./components/PatientForm";
import QueueList from "./components/QueueList";

function App() {
  const [patientName, setPatientName] = useState("");
  const [patients, setPatients] = useState([]);
  const [completed, setCompleted] = useState(0);
  const [nextToken, setNextToken] = useState(1);

  function addPatient() {
    const name = patientName.trim();

    if (name === "") {
      alert("Please enter a patient name");
      return;
    }

    const newPatient = {
      token: nextToken,
      name: name
    };

    setPatients(prev => [...prev, newPatient]);
    setNextToken(prev => prev + 1);
    setPatientName("");
  }

  function completePatient() {
    if (patients.length === 0) return;

    setPatients(prev => prev.slice(1));
    setCompleted(prev => prev + 1);
  }

  return (
    <div style={{ padding: "30px", maxWidth: "650px", margin: "auto" }}>
      <h1>MediQueue Hospital Dashboard</h1>

      <Stats
        waiting={patients.length}
        completed={completed}
      />

      <PatientForm
        patientName={patientName}
        setPatientName={setPatientName}
        addPatient={addPatient}
      />

      <QueueList patients={patients} />

      <button
        onClick={completePatient}
        disabled={patients.length === 0}
      >
        Complete Next Patient
      </button>
    </div>
  );
}

export default App;
