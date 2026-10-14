
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

// =====================================
// HELPER FUNCTIONS
// =====================================

// Validate actual calendar dates.
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

// Demo hospitals use Indian Standard Time.
function getIndiaNow() {
  const now = new Date(Date.now() + 330 * 60000);

  return {
    date: now.toISOString().slice(0, 10),
    time: now.toISOString().slice(11, 16)
  };
}

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
function getDayOfWeek(date) {
  return new Date(
    `${date}T00:00:00Z`
  ).getUTCDay();
}

// Convert HH:MM to minutes since midnight.
function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);

  return hour * 60 + minute;
}

// Convert minutes since midnight to HH:MM.
function toTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return (
    `${String(hour).padStart(2, "0")}:` +
    `${String(minute).padStart(2, "0")}`
  );
}

// =====================================
// DAY 36: DOCTOR-SPECIFIC SLOTS
// =====================================

// Generate slots using the doctor's schedule.
// The endTime is exclusive.
//
// Example:
// startTime = 09:00
// endTime = 13:00
// duration = 30
//
// Slots: 09:00, 09:30, ..., 12:30
function generateDoctorSlots(doctor, date) {
  if (!doctor || !validDate(date)) {
    return [];
  }

  const weekday = getDayOfWeek(date);

  const workingDay = doctor.workingSchedule?.find(
    schedule => schedule.dayOfWeek === weekday
  );

  if (!workingDay) {
    return [];
  }

  const duration = doctor.slotDurationMinutes;

  if (![15, 30, 60].includes(duration)) {
    return [];
  }

  const startMinutes = toMinutes(
    workingDay.startTime
  );

  const endMinutes = toMinutes(
    workingDay.endTime
  );

  if (
    !Number.isFinite(startMinutes) ||
    !Number.isFinite(endMinutes) ||
    startMinutes >= endMinutes
  ) {
    return [];
  }

  const slots = [];

  for (
    let minute = startMinutes;
    minute + duration <= endMinutes;
    minute += duration
  ) {
    slots.push(toTime(minute));
  }

  return slots;
}

// Check if a booking is within the doctor's hours.
function isValidDoctorSlot(doctor, date, time) {
  return generateDoctorSlots(doctor, date)
    .includes(time);
}

// Completed consultations remain occupied.
// Cancelled appointments release their slots.
const OCCUPIED_STATUSES = [
  "booked",
  "completed"
];

// =====================================
// HOME
// =====================================

app.get("/", (req, res) => {
  res.json({
    message: "MediQueue Backend is running"
  });
});

// =====================================
// GET HOSPITALS
// =====================================

app.get("/api/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find().sort({
      name: 1
    });

    res.json(hospitals);
  } catch (error) {
    console.error("Hospitals error:", error.message);

    res.status(500).json({
      message: "Unable to fetch hospitals"
    });
  }
});

// =====================================
// GET DOCTORS
// =====================================

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

// =====================================
// PATIENT QUEUE - GET
// =====================================

app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find().sort({
      token: 1
    });

    res.json(patients);
  } catch (error) {
    console.error("Patients error:", error.message);

    res.status(500).json({
      message: "Unable to fetch patients"
    });
  }
});

// =====================================
// PATIENT QUEUE - POST
// =====================================

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

// =====================================
// COMPLETE PATIENT CONSULTATION
// =====================================

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

// =====================================
// DAY 36: APPOINTMENT AVAILABILITY
// =====================================

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

      const selectedDoctor = await Doctor.findById(
        doctor
      );

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

      // Generate times from this doctor's schedule.
      const scheduledTimes = generateDoctorSlots(
        selectedDoctor,
        date
      );

      // Only look for occupied appointments.
      const appointments = await Appointment.find({
        doctor,
        appointmentDate: date,
        status: {
          $in: OCCUPIED_STATUSES
        }
      }).select("appointmentTime");

      const occupiedTimes = new Set(
        appointments.map(
          item => item.appointmentTime
        )
      );

      const now = getIndiaNow();

      const slots = scheduledTimes.map(time => {
        const past =
          date < now.date ||
          (
            date === now.date &&
            time <= now.time
          );

        let reason = null;

        if (past) {
          reason = "Past";
        } else if (occupiedTimes.has(time)) {
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
        doctorName: selectedDoctor.name,
        date,
        slotDurationMinutes:
          selectedDoctor.slotDurationMinutes,
        workingToday: scheduledTimes.length > 0,
        slots
      });
    } catch (error) {
      console.error(
        "Availability error:",
        error.message
      );

      res.status(500).json({
        message: "Unable to retrieve available slots"
      });
    }
  }
);

// =====================================
// GET APPOINTMENT HISTORY
// =====================================

app.get("/api/appointments", async (req, res) => {
  try {
    // Preserve old-format documents in MongoDB.
    // Return current-schema appointments only.
    const appointments = await Appointment.find({
      hospital: { $type: "objectId" },
      doctor: { $type: "objectId" }
    })
      .populate(
        "hospital",
        "name location"
      )
      .populate(
        "doctor",
        "name specialization"
      )
      .sort({
        appointmentDate: 1,
        appointmentTime: 1
      });

    res.json(appointments);
  } catch (error) {
    console.error("History error:", error.message);

    res.status(500).json({
      message: "Unable to fetch appointments"
    });
  }
});

// =====================================
// DAY 36: BOOK WITH DOCTOR SCHEDULE
// =====================================

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
      typeof appointmentTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(appointmentTime)
    ) {
      return res.status(400).json({
        message: "Invalid appointment date or time"
      });
    }

    const selectedHospital = await Hospital.findById(
      hospital
    );

    if (!selectedHospital) {
      return res.status(404).json({
        message: "Hospital not found"
      });
    }

    const selectedDoctor = await Doctor.findOne({
      _id: doctor,
      hospital,
      isAvailable: true
    });

    if (!selectedDoctor) {
      return res.status(400).json({
        message:
          "Doctor is unavailable or not assigned to this hospital"
      });
    }

    // IMPORTANT: Validate against the doctor's own hours.
    if (
      !isValidDoctorSlot(
        selectedDoctor,
        appointmentDate,
        appointmentTime
      )
    ) {
      return res.status(400).json({
        message:
          "Doctor does not work at the selected date or time"
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

    // A completed historical appointment cannot
    // be booked again.
    const completedSlot = await Appointment.exists({
      doctor,
      appointmentDate,
      appointmentTime,
      status: "completed"
    });

    if (completedSlot) {
      return res.status(409).json({
        message:
          "This appointment slot is already occupied"
      });
    }

    // Existing unique MongoDB index prevents two
    // active booked appointments for the same slot.
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

    console.error("Booking error:", error.message);

    res.status(500).json({
      message: "Unable to book appointment"
    });
  }
});

// =====================================
// CANCEL APPOINTMENT - DAY 34
// =====================================

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
        .populate(
          "hospital",
          "name location"
        )
        .populate(
          "doctor",
          "name specialization"
        );

      if (!appointment) {
        return res.status(404).json({
          message:
            "Booked appointment not found or already cancelled"
        });
      }

      res.json({
        message: "Appointment cancelled successfully",
        appointment
      });
    } catch (error) {
      console.error(
        "Cancellation error:",
        error.message
      );

      res.status(500).json({
        message: "Unable to cancel appointment"
      });
    }
  }
);

// =====================================
// COMPLETE APPOINTMENT - DAY 35
// =====================================

app.patch(
  "/api/appointments/:id/complete",
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid appointment ID"
        });
      }

      const appointment = await Appointment.findOneAndUpdate(
        {
          _id: id,
          status: "booked"
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
      )
        .populate(
          "hospital",
          "name location"
        )
        .populate(
          "doctor",
          "name specialization"
        );

      if (!appointment) {
        return res.status(404).json({
          message:
            "Booked appointment not found or already processed"
        });
      }

      res.json({
        message: "Appointment completed successfully",
        appointment
      });
    } catch (error) {
      console.error(
        "Completion error:",
        error.message
      );

      res.status(500).json({
        message: "Unable to complete appointment"
      });
    }
  }
);

// =====================================
// START SERVER
// =====================================

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
