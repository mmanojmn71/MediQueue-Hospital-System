
function QueueList({ patients }) {
  return (
    <section className="queue-section">
      <h2>Patient Queue</h2>

      {patients.length === 0 ? (
        <p>No patients waiting</p>
      ) : (
        <div className="patient-list">
          {patients.map((patient, index) => (
            <div className="patient-row" key={patient.id}>
              <span className="token">
                A-{patient.token}
              </span>

              <span className="patient-name">
                {patient.name}
              </span>

              <span className="patient-status">
                {index === 0 ? "Next" : "Waiting"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default QueueList;
