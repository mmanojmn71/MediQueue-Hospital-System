const setupStaffSecurity = require("./staffSecurity");
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

app.use(express.json({ limit: "20kb" }));
setupStaffSecurity(app);

// =======================================
// HELPERS
// =======================================

function validDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) return false;

  const parsed = new Date(`${date}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function validTime(time) {
  return (
    typeof time === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  );
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(mins).padStart(2, "0")}`
  );
}

function getIndiaNow() {
  const india = new Date(Date.now() + 330 * 60000);

  return {
    date: india.toISOString().slice(0, 10),
    time: india.toISOString().slice(11, 16)
  };
}

function isFutureSlot(date, time) {
  const now = getIndiaNow();

  return (
    date > now.date ||
    (date === now.date && time > now.time)
  );
}

function dayOfWeek(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function generateDoctorSlots(doctor, date) {
  if (!doctor || !validDate(date)) return [];

  const workingDay = doctor.workingSchedule?.find(
    item => item.dayOfWeek === dayOfWeek(date)
  );

  if (!workingDay) return [];

  const duration = doctor.slotDurationMinutes;

  if (![15, 30, 60].includes(duration)) {
    return [];
  }

  if (
    !validTime(workingDay.startTime) ||
    !validTime(workingDay.endTime)
  ) return [];

  const start = toMinutes(workingDay.startTime);
  const end = toMinutes(workingDay.endTime);

  if (start >= end) return [];

  const times = [];

  for (
    let minute = start;
    minute + duration <= end;
    minute += duration
  ) {
    times.push(toTime(minute));
  }

  return times;
}

const OCCUPIED_STATUSES = ["booked", "completed"];

// Validate a full doctor schedule.
function validateSchedule(schedule, duration) {
  if (!Array.isArray(schedule) || schedule.length > 7) {
    return "Invalid working schedule";
  }

  if (![15, 30, 60].includes(duration)) {
    return "Slot duration must be 15, 30 or 60 minutes";
  }

  const seenDays = new Set();

  for (const item of schedule) {
    if (
      !item ||
      !Number.isInteger(item.dayOfWeek) ||
      item.dayOfWeek < 0 ||
      item.dayOfWeek > 6 ||
      !validTime(item.startTime) ||
      !validTime(item.endTime)
    ) {
      return "Invalid working day or time";
    }

    if (seenDays.has(item.dayOfWeek)) {
      return "A working day cannot appear twice";
    }

    seenDays.add(item.dayOfWeek);

    const start = toMinutes(item.startTime);
    const end = toMinutes(item.endTime);

    if (start >= end) {
      return "End time must be after start time";
    }

    if ((end - start) < duration) {
      return "Working hours must fit at least one slot";
    }
  }

  return null;
}

// =======================================
// HEALTH CHECK
// =======================================

app.get("/", (req, res) => {
  res.json({
    message: "MediQueue Backend is running"
  });
});

// =======================================
// HOSPITALS
// =======================================

app.get("/api/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.find()
      .sort({ name: 1 });

    res.json(hospitals);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to fetch hospitals"
    });
  }
});

// =======================================
// DOCTORS
// =======================================

app.get("/api/doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find()
      .populate("hospital", "name location")
      .sort({ name: 1 });

    res.json(doctors);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to fetch doctors"
    });
  }
});

// =======================================
// DAY 37 - UPDATE DOCTOR AVAILABILITY
// =======================================

app.patch(
  "/api/doctors/:id/availability",
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body || {};

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid doctor ID"
        });
      }

      if (typeof isAvailable !== "boolean") {
        return res.status(400).json({
          message: "isAvailable must be true or false"
        });
      }

      const doctor = await Doctor.findById(id);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      // Protect existing future appointments.
      if (!isAvailable) {
        const now = getIndiaNow();

        const upcoming = await Appointment.exists({
          doctor: id,
          status: "booked",
          $or: [
            {
              appointmentDate: { $gt: now.date }
            },
            {
              appointmentDate: now.date,
              appointmentTime: { $gt: now.time }
            }
          ]
        });

        if (upcoming) {
          return res.status(409).json({
            message:
              "Doctor has upcoming bookings. Cancel or reschedule those appointments before marking unavailable."
          });
        }
      }

      doctor.isAvailable = isAvailable;
      await doctor.save();

      await doctor.populate(
        "hospital",
        "name location"
      );

      res.json({
        message: "Doctor availability updated",
        doctor
      });
    } catch (error) {
      console.error("Availability update:", error);

      res.status(500).json({
        message: "Unable to update doctor availability"
      });
    }
  }
);

// =======================================
// DAY 37 - UPDATE WORKING SCHEDULE
// =======================================

app.patch(
  "/api/doctors/:id/schedule",
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        workingSchedule,
        slotDurationMinutes
      } = req.body || {};

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid doctor ID"
        });
      }

      const errorMessage = validateSchedule(
        workingSchedule,
        slotDurationMinutes
      );

      if (errorMessage) {
        return res.status(400).json({
          message: errorMessage
        });
      }

      const doctor = await Doctor.findById(id);

      if (!doctor) {
        return res.status(404).json({
          message: "Doctor not found"
        });
      }

      // Build a proposed schedule in memory first.
      const proposedDoctor = {
        workingSchedule,
        slotDurationMinutes
      };

      const now = getIndiaNow();

      // Future booked appointments must still
      // fit the doctor's proposed schedule.
      const futureBookings = await Appointment.find({
        doctor: id,
        status: "booked",
        $or: [
          { appointmentDate: { $gt: now.date } },
          {
            appointmentDate: now.date,
            appointmentTime: { $gt: now.time }
          }
        ]
      }).select("appointmentDate appointmentTime");

      const conflictingBookings = futureBookings.filter(
        appointment =>
          !generateDoctorSlots(
            proposedDoctor,
            appointment.appointmentDate
          ).includes(appointment.appointmentTime)
      );

      if (conflictingBookings.length > 0) {
        return res.status(409).json({
          message:
            "This schedule conflicts with existing future bookings. Keep those slots or reschedule the appointments first.",
          conflicts: conflictingBookings.map(item => ({
            date: item.appointmentDate,
            time: item.appointmentTime
          }))
        });
      }

      doctor.workingSchedule = workingSchedule;
      doctor.slotDurationMinutes = slotDurationMinutes;

      await doctor.save();

      await doctor.populate(
        "hospital",
        "name location"
      );

      res.json({
        message: "Doctor schedule updated successfully",
        doctor
      });
    } catch (error) {
      console.error("Schedule update:", error);

      res.status(500).json({
        message: "Unable to update doctor schedule"
      });
    }
  }
);

// =======================================
// PATIENT QUEUE
// =======================================

app.get("/api/patients", async (req, res) => {
  try {
    const patients = await Patient.find()
      .sort({ token: 1 });

    res.json(patients);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to fetch patients"
    });
  }
});

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
    console.error(error);
    res.status(500).json({
      message: "Unable to add patient"
    });
  }
});

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
        { _id: id, status: "waiting" },
        { $set: { status: "completed" } },
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
      console.error(error);
      res.status(500).json({
        message: "Unable to complete consultation"
      });
    }
  }
);

// =======================================
// APPOINTMENT SLOT AVAILABILITY
// =======================================

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
          message: "Valid doctor ID and date required"
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
          message: "Doctor is unavailable"
        });
      }

      const scheduledTimes = generateDoctorSlots(
        selectedDoctor,
        date
      );

      const appointments = await Appointment.find({
        doctor,
        appointmentDate: date,
        status: { $in: OCCUPIED_STATUSES }
      }).select("appointmentTime");

      const occupiedTimes = new Set(
        appointments.map(a => a.appointmentTime)
      );

      const slots = scheduledTimes.map(time => {
        const past = !isFutureSlot(date, time);
        const occupied = occupiedTimes.has(time);

        return {
          time,
          available: !past && !occupied,
          reason: past
            ? "Past"
            : occupied
              ? "Booked"
              : null
        };
      });

      res.json({
        doctor: selectedDoctor._id,
        doctorName: selectedDoctor.name,
        date,
        workingToday: scheduledTimes.length > 0,
        slotDurationMinutes:
          selectedDoctor.slotDurationMinutes,
        slots
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to retrieve appointment slots"
      });
    }
  }
);

// =======================================
// APPOINTMENT HISTORY
// =======================================

app.get("/api/appointments", async (req, res) => {
  try {
    // Legacy documents remain stored but are
    // excluded from the new appointment interface.
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
    console.error(error);

    res.status(500).json({
      message: "Unable to fetch appointments"
    });
  }
});

// =======================================
// BOOK APPOINTMENT
// =======================================

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
      !validTime(appointmentTime)
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
          "Doctor is unavailable or belongs to another hospital"
      });
    }

    if (
      !generateDoctorSlots(
        selectedDoctor,
        appointmentDate
      ).includes(appointmentTime)
    ) {
      return res.status(400).json({
        message:
          "Doctor does not work at the selected date or time"
      });
    }

    if (!isFutureSlot(
      appointmentDate,
      appointmentTime
    )) {
      return res.status(400).json({
        message: "Cannot book an appointment in the past"
      });
    }

    const completedSlot = await Appointment.exists({
      doctor,
      appointmentDate,
      appointmentTime,
      status: "completed"
    });

    if (completedSlot) {
      return res.status(409).json({
        message: "This slot is already occupied"
      });
    }

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

    console.error(error);

    res.status(500).json({
      message: "Unable to book appointment"
    });
  }
});

// =======================================
// CANCEL APPOINTMENT
// =======================================

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
        { _id: id, status: "booked" },
        { $set: { status: "cancelled" } },
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

      res.json({
        message: "Appointment cancelled successfully",
        appointment
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to cancel appointment"
      });
    }
  }
);

// =======================================
// COMPLETE APPOINTMENT
// =======================================

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
        { _id: id, status: "booked" },
        { $set: { status: "completed" } },
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
            "Booked appointment not found or already processed"
        });
      }

      res.json({
        message: "Appointment completed successfully",
        appointment
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Unable to complete appointment"
      });
    }
  }
);

// =======================================
// START SERVER
// =======================================

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
    console.error("Server startup error:", error.message);
    process.exit(1);
  }
}

startServer();
