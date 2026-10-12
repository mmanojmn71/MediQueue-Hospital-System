
const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true
    },

    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true
    },

    appointmentDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },

    appointmentTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },

    status: {
      type: String,
      enum: ["booked", "completed", "cancelled"],
      default: "booked"
    }
  },
  {
    timestamps: true
  }
);

// Prevent double booking for the same doctor, date and time
appointmentSchema.index(
  {
    doctor: 1,
    appointmentDate: 1,
    appointmentTime: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      status: "booked"
    }
  }
);

module.exports = mongoose.model(
  "Appointment",
  appointmentSchema
);
