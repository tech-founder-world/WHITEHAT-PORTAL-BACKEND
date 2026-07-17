const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    subject: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 1, default: 100 },
    remarks: { type: String, trim: true, default: "" },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    evaluationType: {
      type: String,
      enum: ["project", "quiz", "assignment", "exam", "other"],
      default: "project",
    },
  },
  { timestamps: true },
);

// Prevent duplicate evaluation for same student+project+date
evaluationSchema.index({ student: 1, project: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Evaluation", evaluationSchema);
