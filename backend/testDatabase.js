
require("dotenv").config();

const mongoose = require("mongoose");
const Patient = require("./models/Patient");

async function testDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Database connected!");

    // Find the next token for this simple test
    const lastPatient = await Patient.findOne()
      .sort({ token: -1 });

    const nextToken = lastPatient
      ? lastPatient.token + 1
      : 1;

    // Save a fictional patient
    const patient = await Patient.create({
      name: "Ravi",
      token: nextToken,
      status: "waiting"
    });

    console.log("Patient saved:", patient.name);

    // Read saved patients
    const patients = await Patient.find();

    console.log("Patients in MongoDB:");

    patients.forEach(p => {
      console.log(
        `Token A-${p.token}: ${p.name} (${p.status})`
      );
    });

  } catch (error) {
    console.error("Database error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testDatabase();
