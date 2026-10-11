
const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  location: {
    type: String,
    required: true,
    trim: true
  },

  availableBeds: {
    type: Number,
    default: 0,
    min: 0
  },

  doctorsAvailable: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

const Hospital = mongoose.model("Hospital", hospitalSchema);

module.exports = Hospital;
