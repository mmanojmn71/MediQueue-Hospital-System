
function QueueList({ patients }) {
  return (
    <div>
      <h2>Patient Queue</h2>

      {patients.length === 0 ? (
        <p>No patients waiting</p>
      ) : (
        <ul>
          {patients.map((patient) => (
            <li key={patient.token}>
              Token A-{patient.token}: {patient.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default QueueList;
