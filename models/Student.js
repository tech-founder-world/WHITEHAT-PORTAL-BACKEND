const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Batch" }],
    phone: { type: String, trim: true },
    class: { type: String, trim: true },
    section: { type: String, trim: true },
    // Track who added the student
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedByRole: {
      type: String,
      enum: ["admin", "counsellor", "teacher"],
      required: true,
    },
    counsellor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
