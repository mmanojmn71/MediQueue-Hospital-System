
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const connectDB = require("./config/db");
const Patient = require("./models/Patient");
const Hospital = require("./models/Hospital");
const Doctor = require("./models/Doctor");

const app = express();

const PORT = process.env.PORT || 5000;

// Middleware to read JSON data
app.use(express.json());

// ==============================
// HOME API
// ==============================

app.get("/", (req, res) => {
  res.send("Welcome to MediQueue Backend!");
});

// ==============================
// GET ALL HOSPITALS
// ==============================

app.get("/api/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .sort({ name: 1 });

    res.status(200).json(hospitals);

  } catch (error) {
    console.error("Hospital API error:", error.message);

    res.status(500).json({
      message: "Unable to fetch hospitals"
    });
  }
});

// ==============================
// GET ALL PATIENTS
// ==============================

app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find()
      .sort({ token: 1 });

    res.status(200).json(patients);

  } catch (error) {
    console.error("Patient API error:", error.message);

    res.status(500).json({
      message: "Unable to fetch patients"
    });
  }
});

// ==============================
// ADD NEW PATIENT
// ==============================

app.post("/api/patients", async (req, res) => {
  try {
    const { name } = req.body || {};

    // Validate patient name
    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Enter a valid patient name"
      });
    }

    // Generate the next token
    const lastPatient = await Patient.findOne()
      .sort({ token: -1 });

    const nextToken = lastPatient
      ? lastPatient.token + 1
      : 1;

    // Save patient to MongoDB
    const newPatient = await Patient.create({
      name: name.trim(),
      token: nextToken,
      status: "waiting"
    });

    res.status(201).json({
      message: "Patient added successfully",
      patient: newPatient
    });

  } catch (error) {
    console.error("Add patient error:", error.message);

    res.status(500).json({
      message: "Unable to add patient"
    });
  }
});

// ==============================
// COMPLETE PATIENT CONSULTATION
// ==============================

app.patch("/api/patients/:id/complete", async (req, res) => {
  try {
    const patientId = req.params.id;

    // Validate MongoDB ObjectId
    if (!mongoose.isValidObjectId(patientId)) {
      return res.status(400).json({
        message: "Invalid patient ID"
      });
    }

    // Update only waiting patients
    const updatedPatient = await Patient.findOneAndUpdate(
      {
        _id: patientId,
        status: "waiting"
      },
      {
        $set: {
          status: "completed"
        }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!updatedPatient) {
      return res.status(404).json({
        message: "Waiting patient not found"
      });
    }

    res.status(200).json({
      message: "Consultation completed successfully",
      patient: updatedPatient
    });

  } catch (error) {
    console.error("Complete consultation error:", error.message);

    res.status(500).json({
      message: "Unable to complete consultation"
    });
  }
});

// ==============================
// START BACKEND SERVER
// ==============================

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `MediQueue Backend running on port ${PORT}`
      );
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

app.get("/api/doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate("hospital", "name location")
      .sort({ name: 1 });

    res.status(200).json(doctors);

  } catch (error) {
    console.error("Doctor API error:", error.message);

    res.status(500).json({
      message: "Unable to fetch doctors"
    });
  }
});

startServer();
