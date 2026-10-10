
function Stats({ waiting, completed }) {
  return (
    <div>
      <h2>Patients Waiting: {waiting}</h2>
      <h2>Consultations Completed: {completed}</h2>
    </div>
  );
}

export default Stats;
