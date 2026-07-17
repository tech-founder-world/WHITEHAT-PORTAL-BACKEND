// models/Placement.js
const mongoose = require('mongoose');

const placementSchema = new mongoose.Schema({
  formTitle: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  companyName: { type: String, required: true, trim: true },
  jobRole: { type: String, required: true, trim: true },
  jobLocation: { type: String, trim: true },
  salaryPackage: { type: String, trim: true },
  eligibilityCriteria: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  formLink: { type: String, unique: true, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  applications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlacementApplication' }]
}, { timestamps: true });

module.exports = mongoose.model('Placement', placementSchema);