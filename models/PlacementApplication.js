const mongoose = require('mongoose');

const placementApplicationSchema = new mongoose.Schema({
  placementForm: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
  
  // --- Student Personal Info ---
  studentName: { type: String, required: true, trim: true },
  studentEmail: { type: String, required: true, lowercase: true, trim: true },
  studentPhone: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, trim: true },
  branch: { type: String, required: true, trim: true },
  year: { type: String, required: true, trim: true },
  semester: { type: String, required: true, trim: true },
  cgpa: { type: Number, required: true, min: 0, max: 10 },

  // --- Training & Admission Details ---
  batchName: { type: String, trim: true },
  courseType: { type: String, enum: ['Silver', 'Platinum', 'Premium'], default: 'Silver' },
  totalFees: { type: Number, default: 0 },
  feesPaid: { type: Number, default: 0 },
  feesPending: { type: Number, default: 0 },
  dueClear: { type: Boolean, default: false },
  
  // --- Course Timeline ---
  joinedDate: { type: Date },
  endedDate: { type: Date },
  
  // --- 🆕 Interview Tracking (Array of Logs) ---
  interviews: [{
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['shortlisted', 'selected', 'rejected', 'interview_scheduled'] }
  }],

  // --- 🆕 NEW STATS FIELDS (To store the manual numbers from the Counsellor) ---
  totalInterviewsGiven: { type: Number, default: 0 },
  totalInterviewsRejected: { type: Number, default: 0 },
  totalInterviewsSelected: { type: Number, default: 0 },   // Auto-calculated
  totalInterviewsShortlisted: { type: Number, default: 0 }, // Auto-calculated

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