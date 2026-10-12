
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const connectDB = require("./config/db");

const Patient = require("./models/Patient");
const Hospital = require("./models/Hospital");
const Doctor = require("./models/Doctor");
const Appointment = require("./models/Appointment");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ====================================
// HELPER FUNCTIONS
// ====================================

function validDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function getIndiaNow() {
  const india = new Date(
    Date.now() + 330 * 60 * 1000
  );

  return {
    date: india.toISOString().slice(0, 10),
    time: india.toISOString().slice(11, 16)
  };
}

function isWeekend(date) {
  const day = new Date(
    `${date}T00:00:00Z`
  ).getUTCDay();

  return day === 0 || day === 6;
}

function generateSlots() {
  const slots = [];

  for (let hour = 9; hour <= 16; hour++) {
    for (const minute of ["00", "30"]) {
      slots.push(
        `${String(hour).padStart(2, "0")}:${minute}`
      );
    }
  }

  return slots;
}

const TIME_SLOTS = generateSlots();

// ====================================
// HOME ROUTE
// ====================================

app.get("/", (req, res) => {
  res.json({
    message: "MediQueue Backend is running"
  });
});

// ====================================
// HOSPITAL ROUTES
// ====================================

app.get("/api/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .sort({ name: 1 });

    res.json(hospitals);
  } catch (error) {
    console.error("Hospitals error:", error.message);

    res.status(500).json({
      message: "Unable to fetch hospitals"
    });
  }
});

// ====================================
// DOCTOR ROUTES
// ====================================

app.get("/api/doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate("hospital", "name location")
      .sort({ name: 1 });

    res.json(doctors);
  } catch (error) {
    console.error("Doctors error:", error.message);

    res.status(500).json({
      message: "Unable to fetch doctors"
    });
  }
});

// ====================================
// GET PATIENT QUEUE
// ====================================

app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find()
      .sort({ token: 1 });

    res.json(patients);
  } catch (error) {
    console.error("Patients error:", error.message);

    res.status(500).json({
      message: "Unable to fetch patients"
    });
  }
});

// ====================================
// ADD PATIENT
// ====================================

app.post("/api/patients", async (req, res) => {
  try {
    const { name } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Enter a valid patient name"
      });
    }

    const lastPatient = await Patient.findOne()
      .sort({ token: -1 });

    const nextToken = lastPatient
      ? lastPatient.token + 1
      : 1;

    const patient = await Patient.create({
      name: name.trim(),
      token: nextToken,
      status: "waiting"
    });

    res.status(201).json({
      message: "Patient added successfully",
      patient
    });
  } catch (error) {
    console.error("Add patient error:", error.message);

    res.status(500).json({
      message: "Unable to add patient"
    });
  }
});

// ====================================
// COMPLETE PATIENT CONSULTATION
// ====================================

app.patch(
  "/api/patients/:id/complete",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid patient ID"
        });
      }

      const patient = await Patient.findOneAndUpdate(
        {
          _id: id,
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
        message: "Consultation completed successfully",
        patient
      });
    } catch (error) {
      console.error(
        "Complete patient error:",
        error.message
      );

      res.status(500).json({
        message: "Unable to complete consultation"
      });
    }
  }
);

// ====================================
// GET AVAILABLE APPOINTMENT SLOTS
// ====================================

app.get(
  "/api/appointments/slots",
  async (req, res) => {
    try {
      const { doctor, date } = req.query;

      if (
        typeof doctor !== "string" ||
        !mongoose.isValidObjectId(doctor) ||
        !validDate(date)
      ) {
        return res.status(400).json({
          message: "Valid doctor ID and date are required"
        });
      }

      const selectedDoctor = await Doctor.findById(doctor);

      if (!selectedDoctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      if (!selectedDoctor.isAvailable) {
        return res.status(400).json({
          message: "Doctor is currently unavailable"
        });
      }

      const appointments = await Appointment.find({
        doctor,
        appointmentDate: date,
        status: "booked"
      }).select("appointmentTime");

      const bookedTimes = new Set(
        appointments.map(
          appointment => appointment.appointmentTime
        )
      );

      const now = getIndiaNow();
      const weekend = isWeekend(date);

      const slots = TIME_SLOTS.map(time => {
        const past =
          date < now.date ||
          (date === now.date && time <= now.time);

        let reason = null;

        if (weekend) {
          reason = "Closed";
        } else if (past) {
          reason = "Past";
        } else if (bookedTimes.has(time)) {
          reason = "Booked";
        }

        return {
          time,
          available: reason === null,
          reason
        };
      });

      res.json({
        doctor: selectedDoctor._id,
        date,
        slots
      });
    } catch (error) {
      console.error(
        "Slot availability error:",
        error.message
      );

      res.status(500).json({
        message: "Unable to load appointment slots"
      });
    }
  }
);

// ====================================
// GET APPOINTMENTS
// ====================================

app.get("/api/appointments", async (req, res) => {
  try {
    // Keep legacy documents in MongoDB, but only
    // display records using the current schema.
    const appointments = await Appointment.find({
      hospital: { $type: "objectId" },
      doctor: { $type: "objectId" }
    })
      .populate("hospital", "name location")
      .populate("doctor", "name specialization")
      .sort({
        appointmentDate: 1,
        appointmentTime: 1
      });

    res.json(appointments);
  } catch (error) {
    console.error(
      "Appointments error:",
      error.message
    );

    res.status(500).json({
      message: "Unable to fetch appointments"
    });
  }
});

// ====================================
// BOOK APPOINTMENT
// ====================================

app.post("/api/appointments", async (req, res) => {
  try {
    const {
      patientName,
      hospital,
      doctor,
      appointmentDate,
      appointmentTime
    } = req.body || {};

    if (
      typeof patientName !== "string" ||
      !patientName.trim() ||
      patientName.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Enter a valid patient name"
      });
    }

    if (
      typeof hospital !== "string" ||
      typeof doctor !== "string" ||
      !mongoose.isValidObjectId(hospital) ||
      !mongoose.isValidObjectId(doctor)
    ) {
      return res.status(400).json({
        message: "Invalid hospital or doctor ID"
      });
    }

    if (
      !validDate(appointmentDate) ||
      !TIME_SLOTS.includes(appointmentTime)
    ) {
      return res.status(400).json({
        message: "Invalid appointment date or time slot"
      });
    }

    const hospitalRecord = await Hospital.findById(
      hospital
    );

    if (!hospitalRecord) {
      return res.status(404).json({
        message: "Hospital not found"
      });
    }

    const doctorRecord = await Doctor.findOne({
      _id: doctor,
      hospital,
      isAvailable: true
    });

    if (!doctorRecord) {
      return res.status(400).json({
        message:
          "Doctor is unavailable or belongs to another hospital"
      });
    }

    if (isWeekend(appointmentDate)) {
      return res.status(400).json({
        message: "Appointments are available Monday to Friday"
      });
    }

    const now = getIndiaNow();

    if (
      appointmentDate < now.date ||
      (
        appointmentDate === now.date &&
        appointmentTime <= now.time
      )
    ) {
      return res.status(400).json({
        message: "Cannot book an appointment in the past"
      });
    }

    // MongoDB unique partial index protects
    // active bookings for each doctor/date/time.
    const appointment = await Appointment.create({
      patientName: patientName.trim(),
      hospital,
      doctor,
      appointmentDate,
      appointmentTime,
      status: "booked"
    });

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This appointment slot is already booked"
      });
    }

    console.error(
      "Appointment booking error:",
      error.message
    );

    res.status(500).json({
      message: "Unable to book appointment"
    });
  }
});

// ====================================
// DAY 34 - CANCEL AN APPOINTMENT
// ====================================

app.patch(
  "/api/appointments/:id/cancel",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid appointment ID"
        });
      }

      // Only an actively booked appointment
      // can be changed to cancelled.
      const appointment = await Appointment.findOneAndUpdate(
        {
          _id: id,
          status: "booked"
        },
        {
          $set: {
            status: "cancelled"
          }
        },
        {
          returnDocument: "after",
          runValidators: true
        }
      )
        .populate("hospital", "name location")
        .populate("doctor", "name specialization");

      if (!appointment) {
        return res.status(404).json({
          message:
            "Booked appointment not found or already cancelled"
        });
      }

      return res.json({
        message: "Appointment cancelled successfully",
        appointment
      });
    } catch (error) {
      console.error(
        "Appointment cancellation error:",
        error.message
      );

      return res.status(500).json({
        message: "Unable to cancel appointment"
      });
    }
  }
);

// ====================================
// START EXPRESS SERVER
// ====================================

async function startServer() {
  try {
    await connectDB();

    await Appointment.init();

    app.listen(PORT, () => {
      console.log(
        `MediQueue Backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Server startup error:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
