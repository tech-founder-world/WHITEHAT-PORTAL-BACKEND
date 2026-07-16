const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  rollNumber: { type: String, required: true, unique: true, trim: true },
  email: { type: String, trim: true },
  // subjects this student is enrolled in (replaces the old free-text "course" field)
  subjects: [{ type: String, trim: true }],
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
