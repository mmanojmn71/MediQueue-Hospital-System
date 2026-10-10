
function Stats({ waiting, completed }) {
  return (
    <div className="stats-container">
      <div className="stat-card">
        <h3>Patients Waiting</h3>
        <p>{waiting}</p>
      </div>

      <div className="stat-card">
        <h3>Consultations Completed</h3>
        <p>{completed}</p>
      </div>
    </div>
  );
}

export default Stats;
