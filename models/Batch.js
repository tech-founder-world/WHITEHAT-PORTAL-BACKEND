const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    timing: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    topics: [topicSchema],
    maxStudents: { type: Number, default: 30 },
    fee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },
    // THESE FIELDS ARE CRUCIAL
    category: {
      type: String,
      enum: ["silver", "platinum", "premium", "custom"],
      default: "custom",
    },
    duration: { 
      type: Number, 
      default: 0 
    },
    durationType: {
      type: String,
      enum: ["days", "months"],
      default: "days",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Batch", batchSchema);