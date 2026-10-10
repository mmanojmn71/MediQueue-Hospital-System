
const express = require("express");

const app = express();
const PORT = 5000;

app.use(express.json());

// Fictional hospital data
const hospitals = [
  {
    id: 1,
    name: "City Care Hospital",
    location: "Bengaluru",
    availableBeds: 10,
    doctorsAvailable: 5
  },
  {
    id: 2,
    name: "Greenview Medical Centre",
    location: "Koramangala",
    availableBeds: 8,
    doctorsAvailable: 3
  },
  {
    id: 3,
    name: "Northside Care Clinic",
    location: "Hebbal",
    availableBeds: 4,
    doctorsAvailable: 2
  }
];

// Temporary data, lost when server restarts
const patients = [];
let nextPatientId = 1;
let nextToken = 1;

// Home
app.get("/", (req, res) => {
  res.send("Welcome to MediQueue Backend!");
});

// Get hospitals
app.get("/api/hospitals", (req, res) => {
  res.json(hospitals);
});

// Get all patients
app.get("/api/patients", (req, res) => {
  res.json(patients);
});

// Add patient
app.post("/api/patients", (req, res) => {
  const { name } = req.body || {};

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      message: "Patient name is required"
    });
  }

  const newPatient = {
    id: nextPatientId++,
    name: name.trim(),
    token: nextToken++,
    status: "waiting"
  };

  patients.push(newPatient);

  res.status(201).json({
    message: "Patient added successfully",
    patient: newPatient
  });
});

// Complete consultation
app.patch("/api/patients/:id/complete", (req, res) => {
  const id = Number(req.params.id);

  const patient = patients.find(p => p.id === id);

  if (!patient) {
    return res.status(404).json({
      message: "Patient not found"
    });
  }

  if (patient.status === "completed") {
    return res.status(409).json({
      message: "Consultation already completed"
    });
  }

  patient.status = "completed";

  res.json({
    message: "Consultation completed successfully",
    patient
  });
});

app.listen(PORT, () => {
  console.log(`MediQueue Backend running on port ${PORT}`);
});
