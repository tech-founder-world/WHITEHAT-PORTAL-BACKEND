const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/students - Get all students with filters
router.get("/", async (req, res) => {
  try {
    const { subject, search, addedBy } = req.query;
    let filter = {};

    if (subject) {
      filter.subjects = subject;
    }

    // Search by name or roll number
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by who added the student
    if (addedBy) {
      filter.addedBy = addedBy;
    }

    // If counsellor, only show their students
    if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter._id = { $in: assignedIds };
    }

    const students = await Student.find(filter)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .sort({ createdAt: -1 });

    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/students - Create a new student
router.post("/", async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      email,
      subjects,
      phone,
      class: className,
      section,
    } = req.body;

    if (!name || !rollNumber) {
      return res.status(400).json({ message: "Name and roll number required" });
    }

    // Check if roll number already exists
    const existing = await Student.findOne({ rollNumber });
    if (existing) {
      return res.status(400).json({ message: "Roll number already exists" });
    }

    const student = await Student.create({
      name,
      rollNumber,
      email: email || "",
      subjects: subjects || [],
      phone: phone || "",
      class: className || "",
      section: section || "",
      addedBy: req.user._id,
      addedByRole: req.user.role,
      // If counsellor is adding, assign them as counsellor
      counsellor: req.user.role === "counsellor" ? req.user._id : null,
    });

    // If counsellor added student, add to counsellor's students list
    if (req.user.role === "counsellor") {
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { students: student._id },
      });
    }

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");

    res.status(201).json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Roll number already exists" });
    }
    console.error("Error creating student:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/students/:id - Update student
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      rollNumber,
      email,
      subjects,
      phone,
      class: className,
      section,
      counsellor,
    } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if user has permission to edit
    if (
      req.user.role === "counsellor" &&
      student.addedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only edit students you added" });
    }

    // Check if roll number already exists (if changed)
    if (rollNumber && rollNumber !== student.rollNumber) {
      const existing = await Student.findOne({ rollNumber });
      if (existing) {
        return res.status(400).json({ message: "Roll number already exists" });
      }
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      {
        name: name || student.name,
        rollNumber: rollNumber || student.rollNumber,
        email: email !== undefined ? email : student.email,
        subjects: subjects !== undefined ? subjects : student.subjects,
        phone: phone !== undefined ? phone : student.phone,
        class: className !== undefined ? className : student.class,
        section: section !== undefined ? section : student.section,
        counsellor: counsellor !== undefined ? counsellor : student.counsellor,
      },
      { new: true, runValidators: true },
    )
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email");

    res.json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Roll number already exists" });
    }
    console.error("Error updating student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/students/:id - Delete student
router.delete("/:id", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if user has permission to delete
    if (
      req.user.role === "counsellor" &&
      student.addedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only delete students you added" });
    }

    // Delete student and their attendance records
    await Student.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ student: req.params.id });

    // Remove student from counsellor's list
    await User.updateMany(
      { students: req.params.id },
      { $pull: { students: req.params.id } },
    );

    res.json({ message: "Student deleted successfully" });
  } catch (err) {
    console.error("Error deleting student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/students/subjects - Get all unique subjects
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
