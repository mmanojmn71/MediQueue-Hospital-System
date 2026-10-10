
function PatientForm({ patientName, setPatientName, addPatient }) {
  return (
    <div>
      <input
        type="text"
        placeholder="Enter patient name"
        value={patientName}
        onChange={(event) => setPatientName(event.target.value)}
      />

      <button onClick={addPatient}>
        Add Patient
      </button>
    </div>
  );
}

export default PatientForm;
