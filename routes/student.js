const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/students?subject=Mathematics — optionally filter by enrolled subject
router.get("/", async (req, res) => {
  try {
    const { subject } = req.query;
    let filter = {};

    if (subject) {
      filter.subjects = subject;
    }

    // If counsellor, only show their assigned students
    if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter._id = { $in: assignedIds };
    }

    const students = await Student.find(filter).sort({ name: 1 });
    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/students
router.post("/", async (req, res) => {
  try {
    const { name, rollNumber, email, subjects } = req.body;
    if (!name || !rollNumber) {
      return res.status(400).json({ message: "Name and roll number required" });
    }

    const student = await Student.create({
      name,
      rollNumber,
      email,
      subjects: subjects || [],
    });
    res.status(201).json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Roll number already exists" });
    }
    console.error("Error creating student:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/students/:id
router.put("/:id", async (req, res) => {
  try {
    const { name, rollNumber, email, subjects } = req.body;
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { name, rollNumber, email, subjects: subjects || [] },
      { new: true, runValidators: true },
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Roll number already exists" });
    }
    console.error("Error updating student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/students/:id
router.delete("/:id", async (req, res) => {
  try {
    // Delete student and their attendance records
    await Student.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ student: req.params.id });
    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error("Error deleting student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/students/subjects — get all unique subjects across all students
router.get("/all-subjects", async (req, res) => {
  try {
    const result = await Student.distinct("subjects");
    res.json(result.filter(Boolean).sort());
  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
