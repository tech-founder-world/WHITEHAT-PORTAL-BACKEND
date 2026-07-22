const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" format
  },
  { timestamps: true },
);

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    timing: { type: String, trim: true }, // NEW: Batch timing
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    topics: [topicSchema], // NEW: Day-to-day topics
    maxStudents: { type: Number, default: 30 },
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Batch", batchSchema);
