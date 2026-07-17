const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    rollNumber: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true },
    subjects: [{ type: String, trim: true }],
    // Projects this student is enrolled in
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    // Additional student info
    phone: { type: String, trim: true },
    class: { type: String, trim: true },
    section: { type: String, trim: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Student", studentSchema);
