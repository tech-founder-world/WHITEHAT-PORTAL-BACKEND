const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    subjects: [{ type: String, trim: true }],
    projects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    batches: [{ type: mongoose.Schema.Types.ObjectId, ref: "Batch" }],
    // Simplified payment fields - only amounts
    totalFee: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
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

// Add index on email for faster lookups
studentSchema.index({ email: 1 });

module.exports = mongoose.model("Student", studentSchema);
