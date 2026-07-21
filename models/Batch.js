// backend/models/Batch.js
const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  courseType: { 
    type: String, 
    enum: ['Silver', 'Platinum', 'Premium'],
    default: 'Silver'
  },
  startDate: { type: Date },
  endDate: { type: Date },
  // The Counsellor who created this batch
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // The students enrolled in this batch
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  status: { 
    type: String, 
    enum: ['active', 'completed', 'archived'],
    default: 'active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);