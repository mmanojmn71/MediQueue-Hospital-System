
const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  token: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["waiting", "completed"],
    default: "waiting"
  }
}, {
  timestamps: true
});

const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
