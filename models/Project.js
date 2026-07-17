const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: [] },
    ],
    subject: { type: String, required: true },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    maxScore: { type: Number, default: 100 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Project", projectSchema);
