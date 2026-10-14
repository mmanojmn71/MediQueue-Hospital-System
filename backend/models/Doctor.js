
const mongoose = require("mongoose");

const workingDaySchema = new mongoose.Schema(
  {
    // Sunday = 0, Monday = 1, ..., Saturday = 6
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6
    },

    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    },

    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d$/
    }
  },
  {
    _id: false
  }
);

const doctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    specialization: {
      type: String,
      required: true,
      trim: true
    },

    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true
    },

    isAvailable: {
      type: Boolean,
      default: true
    },

    // Each doctor can have different working days.
    workingSchedule: {
      type: [workingDaySchema],
      default: []
    },

    // Duration of one consultation slot.
    slotDurationMinutes: {
      type: Number,
      default: 30,
      enum: [15, 30, 60]
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Doctor",
  doctorSchema
);
