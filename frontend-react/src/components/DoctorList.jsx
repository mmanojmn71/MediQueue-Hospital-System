
import { useEffect, useState } from "react";

function DoctorList() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDoctors() {
      try {
        const response = await fetch("/api/doctors");

        if (!response.ok) {
          throw new Error("Unable to fetch doctors");
        }

        const data = await response.json();

        if (active) {
          setDoctors(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDoctors();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="doctor-section">
        <h2>Our Doctors</h2>
        <p>Loading doctors...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="doctor-section">
        <h2>Our Doctors</h2>
        <p className="error-message" role="alert">{error}</p>
      </section>
    );
  }

  return (
    <section className="doctor-section">
      <div className="doctor-heading">
        <h2>Our Doctors</h2>
        <p>
          View doctors, specializations and hospital details.
        </p>
      </div>

      {doctors.length === 0 ? (
        <p>No doctors found.</p>
      ) : (
        <div className="doctor-grid">
          {doctors.map((doctor) => (
            <div className="doctor-card" key={doctor._id}>
              <div className="doctor-avatar">👨‍⚕️</div>

              <h3>{doctor.name}</h3>

              <p className="doctor-specialization">
                {doctor.specialization}
              </p>

              <p className="doctor-hospital">
                🏥 {doctor.hospital?.name ?? "Not assigned"}
              </p>

              <p className="doctor-location">
                📍 {doctor.hospital?.location ?? "Unknown"}
              </p>

              <span
                className={
                  doctor.isAvailable
                    ? "doctor-status available"
                    : "doctor-status unavailable"
                }
              >
                {doctor.isAvailable
                  ? "Available"
                  : "Unavailable"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default DoctorList;
