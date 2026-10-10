
function PatientForm({
  patientName,
  setPatientName,
  addPatient,
  saving
}) {
  function handleSubmit(event) {
    event.preventDefault();
    addPatient();
  }

  return (
    <form className="patient-form" onSubmit={handleSubmit}>
      <h2>Add New Patient</h2>

      <label htmlFor="patientName">
        Patient Name
      </label>

      <input
        id="patientName"
        type="text"
        placeholder="Enter patient name"
        value={patientName}
        onChange={event => setPatientName(event.target.value)}
        maxLength={100}
        required
      />

      <button
        type="submit"
        disabled={saving || !patientName.trim()}
      >
        {saving ? "Saving..." : "Add Patient"}
      </button>
    </form>
  );
}

export default PatientForm;
