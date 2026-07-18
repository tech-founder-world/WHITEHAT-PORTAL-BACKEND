const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ["silver", "platinum", "premium", "custom"],
      default: "custom",
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      description: "Duration in days",
    },
    durationType: {
      type: String,
      enum: ["days", "months"],
      default: "days",
    },
    description: { type: String, trim: true },
    counsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    startDate: { type: String }, // YYYY-MM-DD
    endDate: { type: String }, // YYYY-MM-DD
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    maxStudents: { type: Number, default: 30 },
    fee: { type: Number, default: 0 },
    // For project-based batches
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  },
  { timestamps: true },
);

// Default batches to create
const defaultBatches = [
  {
    name: "Silver Batch",
    category: "silver",
    duration: 45,
    durationType: "days",
    description: "45 days foundational program",
  },
  {
    name: "Platinum Batch",
    category: "platinum",
    duration: 3,
    durationType: "months",
    description: "3 months comprehensive program",
  },
  {
    name: "Premium Batch",
    category: "premium",
    duration: 6,
    durationType: "months",
    description: "6 months advanced program",
  },
];

module.exports = {
  Batch: mongoose.model("Batch", batchSchema),
  defaultBatches,
};
