
require("dotenv").config();

const mongoose = require("mongoose");
const Hospital = require("./models/Hospital");

const hospitals = [
  {
    name: "City Care Hospital",
    location: "Bengaluru",
    availableBeds: 10,
    doctorsAvailable: 5
  },
  {
    name: "Greenview Medical Centre",
    location: "Koramangala",
    availableBeds: 8,
    doctorsAvailable: 3
  },
  {
    name: "Northside Care Clinic",
    location: "Hebbal",
    availableBeds: 4,
    doctorsAvailable: 2
  }
];

async function seedHospitals() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    for (const hospital of hospitals) {
      await Hospital.updateOne(
        { name: hospital.name },
        { $set: hospital },
        { upsert: true, runValidators: true }
      );
    }

    console.log("Sample hospitals saved successfully!");

    const savedHospitals = await Hospital.find();

    savedHospitals.forEach(hospital => {
      console.log(
        `${hospital.name} - ${hospital.location}`
      );
    });

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedHospitals();
