const mongoose = require('mongoose');

const interviewLogSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['shortlisted', 'selected', 'rejected', 'interview_scheduled', 'pending'] },
  notes: { type: String, trim: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const placementApplicationSchema = new mongoose.Schema({
  placementForm: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
  
  // --- Student Basic Info (filled by student) ---
  studentName: { type: String, required: true, trim: true },
  studentEmail: { type: String, required: true, lowercase: true, trim: true },
  studentPhone: { type: String, required: true, trim: true },
  fatherName: { type: String, trim: true },
  courseType: { type: String, enum: ['Silver', 'Platinum', 'Premium'], default: 'Silver' },
  courseTiming: { type: String, trim: true },
  resumeLink: { type: String, trim: true },
  
  // --- Student Details (Updated by Counselor) ---
  branch: { type: String, trim: true },
  totalFees: { type: Number, default: 0 },
  feesPaid: { type: Number, default: 0 },
  feesPending: { type: Number, default: 0 },
  dueClear: { type: Boolean, default: false },
  joinedDate: { type: Date },
  endedDate: { type: Date },
  
  // --- Interview Stats (Updated by Counselor) ---
  totalInterviewsGiven: { type: Number, default: 0 },
  totalInterviewsRejected: { type: Number, default: 0 },
  totalInterviewsSelected: { type: Number, default: 0 },
  totalInterviewsShortlisted: { type: Number, default: 0 },
  
  // --- Interview Logs (Clickable History) ---
  interviewLogs: [interviewLogSchema],
  
  // --- Application Status ---
  status: { 
    type: String, 
    enum: ['pending', 'shortlisted', 'rejected', 'selected', 'interview_scheduled'],
    default: 'pending'
  },
  comments: { type: String, trim: true },
  appliedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('PlacementApplication', placementApplicationSchema);