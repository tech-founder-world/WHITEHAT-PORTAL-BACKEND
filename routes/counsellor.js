const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Student = require("../models/Student");
const { protect } = require("../middleware/auth");

// Apply protect middleware to all routes in this file
router.use(protect);

// GET /api/counsellor/students — get counsellor's assigned students
router.get("/students", async (req, res) => {
  try {
    // First, get the counsellor with populated students
    const counsellor = await User.findById(req.user._id).populate({
      path: "students",
      populate: [
        { path: "addedBy", select: "name email role" },
        { path: "counsellor", select: "name email" },
        { path: "teacher", select: "name email subjects" }
      ]
    });
    
    if (!counsellor) {
      return res.status(404).json({ message: "Counsellor not found" });
    }
    
    // Also fetch any students that have this counsellor assigned but might not be in the array
    const studentsWithCounsellor = await Student.find({ 
      counsellor: req.user._id 
    }).populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email subjects");
    
    // Combine and deduplicate
    const counsellorStudents = counsellor.students || [];
    const allStudents = [...counsellorStudents];
    
    // Add any students that have this counsellor assigned but aren't in the array
    studentsWithCounsellor.forEach(student => {
      if (!allStudents.some(s => s._id.toString() === student._id.toString())) {
        allStudents.push(student);
      }
    });
    
    res.json(allStudents);
  } catch (err) {
    console.error("Error fetching counsellor students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/counsellor/me — get own profile
router.get("/me", (req, res) => {
  res.json(req.user);
});

module.exports = router;