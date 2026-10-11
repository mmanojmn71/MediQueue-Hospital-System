
require("dotenv").config();

const mongoose = require("mongoose");
const Hospital = require("./models/Hospital");
const Doctor = require("./models/Doctor");

async function seedDoctors() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const sampleDoctors = [
      {
        name: "Dr. Ananya Rao",
        specialization: "Cardiology",
        hospitalName: "City Care Hospital"
      },
      {
        name: "Dr. Ramesh Kumar",
        specialization: "Neurology",
        hospitalName: "Greenview Medical Centre"
      },
      {
        name: "Dr. Priya Sharma",
        specialization: "General Medicine",
        hospitalName: "Northside Care Clinic"
      }
    ];

    for (const data of sampleDoctors) {
      const hospital = await Hospital.findOne({
        name: data.hospitalName
      });

      if (!hospital) {
        throw new Error(
          `Hospital not found: ${data.hospitalName}`
        );
      }

      await Doctor.updateOne(
        {
          name: data.name,
          hospital: hospital._id
        },
        {
          $set: {
            specialization: data.specialization,
            isAvailable: true
          },
          $setOnInsert: {
            name: data.name,
            hospital: hospital._id
          }
        },
        {
          upsert: true,
          runValidators: true
        }
      );
    }

    const doctors = await Doctor.find()
      .populate("hospital", "name location");

    doctors.forEach(doctor => {
      console.log(
        `${doctor.name} - ${doctor.specialization} - ${doctor.hospital.name}`
      );
    });

    console.log("Doctor data saved successfully!");

  } catch (error) {
    console.error("Error:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedDoctors();
