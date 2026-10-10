
import { useEffect, useState } from "react";

function HospitalList() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHospitals() {
      try {
        const response = await fetch("/api/hospitals");

        if (!response.ok) {
          throw new Error("Failed to load hospitals");
        }

        const data = await response.json();

        if (active) {
          setHospitals(data);
        }
      } catch (err) {
        if (active) {
          setError("Cannot connect to hospital server");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHospitals();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p>Loading hospitals...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
    <section>
      <h2>Available Hospitals</h2>

      {hospitals.map((hospital) => (
        <div
          key={hospital.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "10px",
            padding: "15px",
            marginBottom: "12px"
          }}
        >
          <h3>{hospital.name}</h3>
          <p>Location: {hospital.location}</p>
          <p>Available Beds: {hospital.availableBeds}</p>
          <p>Doctors Available: {hospital.doctorsAvailable}</p>
        </div>
      ))}
    </section>
  );
}

export default HospitalList;
