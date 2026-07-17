// models/PlacementApplication.js
const mongoose = require('mongoose');

const placementApplicationSchema = new mongoose.Schema({
  placementForm: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
  studentName: { type: String, required: true, trim: true },
  studentEmail: { type: String, required: true, lowercase: true, trim: true },
  studentPhone: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  semester: { type: String, required: true, trim: true },
  cgpa: { type: Number, required: true, min: 0, max: 10 },
  resumeLink: { type: String, trim: true },
  skills: [{ type: String }],
  experience: { type: String, trim: true },
  additionalInfo: { type: String, trim: true },
  appliedAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'shortlisted', 'rejected', 'selected', 'interview_scheduled'],
    default: 'pending'
  },
  comments: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('PlacementApplication', placementApplicationSchema);