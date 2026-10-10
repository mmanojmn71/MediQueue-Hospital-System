
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Patient = require("./models/Patient");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

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

// Home API
app.get("/", (req, res) => {
  res.send("Welcome to MediQueue Backend!");
});

// GET hospitals
app.get("/api/hospitals", (req, res) => {
  res.json(hospitals);
});

// GET patients from MongoDB
app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ token: 1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load patients"
    });
  }
});

// POST a patient to MongoDB
app.post("/api/patients", async (req, res) => {
  try {
    const { name } = req.body || {};

    if (typeof name !== "string" || !name.trim() ||
        name.trim().length > 100) {
      return res.status(400).json({
        message: "Enter a valid patient name"
      });
    }

    // Temporary token logic for learning
    const lastPatient = await Patient.findOne()
      .sort({ token: -1 });

    const nextToken = lastPatient ? lastPatient.token + 1 : 1;

    const patient = await Patient.create({
      name: name.trim(),
      token: nextToken,
      status: "waiting"
    });

    res.status(201).json({
      message: "Patient saved successfully",
      patient
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to save patient"
    });
  }
});

// PATCH consultation status
app.patch("/api/patients/:id/complete", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid patient ID"
      });
    }

    const patient = await Patient.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "waiting"
      },
      {
        $set: { status: "completed" }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    );

    if (!patient) {
      return res.status(404).json({
        message: "Waiting patient not found"
      });
    }

    res.json({
      message: "Consultation completed",
      patient
    });
  } catch (error) {
    res.status(500).json({
      message: "Unable to complete consultation"
    });
  }
});

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`MediQueue Backend running on port ${PORT}`);
  });
}

startServer();
