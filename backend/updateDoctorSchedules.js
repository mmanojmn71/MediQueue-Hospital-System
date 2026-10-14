
require("dotenv").config();

const mongoose = require("mongoose");
const Doctor = require("./models/Doctor");

function makeSchedule(days, startTime, endTime) {
  return days.map(dayOfWeek => ({
    dayOfWeek,
    startTime,
    endTime
  }));
}

const schedules = [
  {
    name: "Dr. Ananya Rao",
    workingSchedule: makeSchedule(
      [1, 2, 3, 4, 5],
      "09:00",
      "13:00"
    ),
    slotDurationMinutes: 30
  },
  {
    name: "Dr. Ramesh Kumar",
    workingSchedule: makeSchedule(
      [1, 2, 3, 4, 5, 6],
      "10:00",
      "16:00"
    ),
    slotDurationMinutes: 30
  },
  {
    name: "Dr. Priya Sharma",
    workingSchedule: makeSchedule(
      [1, 2, 3, 4, 5],
      "11:00",
      "17:00"
    ),
    slotDurationMinutes: 30
  }
];

async function updateSchedules() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    for (const item of schedules) {
      const doctor = await Doctor.findOne({
        name: item.name
      });

      if (!doctor) {
        console.log("Doctor not found:", item.name);
        continue;
      }

      doctor.workingSchedule = item.workingSchedule;
      doctor.slotDurationMinutes =
        item.slotDurationMinutes;

      await doctor.save();

      console.log(
        `Updated ${doctor.name}: ` +
        `${doctor.workingSchedule.length} working days`
      );
    }

    console.log("Doctor schedules updated");
  } catch (error) {
    console.error(
      "Schedule update failed:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

updateSchedules();
