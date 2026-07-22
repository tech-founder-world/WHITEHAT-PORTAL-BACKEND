const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Student = require("../models/Student");
const { protect, adminOnly } = require("../middleware/auth");

// All routes require admin auth
router.use(protect, adminOnly);

// ===== TEACHER ROUTES =====

// GET /api/admin/teachers
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-password");
    res.json(teachers);
  } catch (err) {
    console.error("Error fetching teachers:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/teachers — create teacher account
router.post("/teachers", async (req, res) => {
  try {
    const { name, email, password, subjects } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email, and password required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already in use" });

    // Capitalize all subjects
    const capitalizedSubjects = (subjects || []).map((sub) =>
      sub.trim().toUpperCase(),
    );

    const teacher = await User.create({
      name,
      email,
      password,
      role: "teacher",
      subjects: capitalizedSubjects,
    });
    const { password: _, ...teacherData } = teacher.toObject();
    res.status(201).json(teacherData);
  } catch (err) {
    console.error("Error creating teacher:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/admin/teachers/:id — update teacher
router.put("/teachers/:id", async (req, res) => {
  try {
    const { name, email, subjects, password } = req.body;

    // Capitalize all subjects
    const capitalizedSubjects = (subjects || []).map((sub) =>
      sub.trim().toUpperCase(),
    );

    const update = { name, email, subjects: capitalizedSubjects };
    if (password) {
      const bcrypt = require("bcryptjs");
      update.password = await bcrypt.hash(password, 10);
    }
    const teacher = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).select("-password");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    console.error("Error updating teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/teachers/:id
router.delete("/teachers/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Teacher deleted" });
  } catch (err) {
    console.error("Error deleting teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== COUNSELLOR ROUTES =====

// GET /api/admin/counsellors
router.get("/counsellors", async (req, res) => {
  try {
    const counsellors = await User.find({ role: "counsellor" })
      .select("-password")
      .populate("students", "name rollNumber subjects");
    res.json(counsellors);
  } catch (err) {
    console.error("Error fetching counsellors:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/counsellors — create counsellor account
router.post("/counsellors", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "Name, email, and password required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already in use" });

    const counsellor = await User.create({
      name,
      email,
      password,
      role: "counsellor",
      specialization: specialization || "",
      students: [],
    });
    const { password: _, ...counsellorData } = counsellor.toObject();
    res.status(201).json(counsellorData);
  } catch (err) {
    console.error("Error creating counsellor:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/admin/counsellors/:id — update counsellor
router.put("/counsellors/:id", async (req, res) => {
  try {
    const { name, email, specialization, password } = req.body;
    const update = { name, email, specialization };
    if (password) {
      const bcrypt = require("bcryptjs");
      update.password = await bcrypt.hash(password, 10);
    }
    const counsellor = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    })
      .select("-password")
      .populate("students", "name rollNumber");
    if (!counsellor)
      return res.status(404).json({ message: "Counsellor not found" });
    res.json(counsellor);
  } catch (err) {
    console.error("Error updating counsellor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/counsellors/:id
router.delete("/counsellors/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Counsellor deleted" });
  } catch (err) {
    console.error("Error deleting counsellor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== ASSIGN STUDENT TO TEACHER (With Subject Validation) =====

// GET /api/admin/students - Get all students with filters
router.get("/students", async (req, res) => {
  try {
    const { search, addedBy } = req.query;
    let filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { fatherName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (addedBy) {
      filter.addedBy = addedBy;
    }

    const students = await Student.find(filter)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email subjects")
      .sort({ createdAt: -1 });

    res.json(students);
  } catch (err) {
    console.error("Error fetching students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/students/assign-teacher - Assign student to teacher with validation
router.post("/students/assign-teacher", async (req, res) => {
  try {
    const { studentId, teacherId } = req.body;

    if (!studentId || !teacherId) {
      return res
        .status(400)
        .json({ message: "Student ID and Teacher ID required" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // 🆕 VALIDATION: Check if student has at least one subject that matches teacher's subjects
    const studentSubjects = (student.subjects || []).map((s) =>
      s.trim().toUpperCase(),
    );
    const teacherSubjects = (teacher.subjects || []).map((s) =>
      s.trim().toUpperCase(),
    );

    if (teacherSubjects.length === 0) {
      return res.status(400).json({
        message:
          "This teacher has no subjects assigned. Please assign subjects to the teacher first.",
      });
    }

    // Check if student has any subject matching teacher's subjects
    const hasMatchingSubject = studentSubjects.some((sub) =>
      teacherSubjects.includes(sub),
    );

    if (!hasMatchingSubject) {
      return res.status(400).json({
        message: `Student (${student.name}) has subjects: ${studentSubjects.join(", ") || "None"}. 
                  Teacher (${teacher.name}) teaches: ${teacherSubjects.join(", ")}. 
                  Student must have at least one matching subject to be assigned to this teacher.`,
        studentSubjects: studentSubjects,
        teacherSubjects: teacherSubjects,
      });
    }

    // Update student with teacher
    student.teacher = teacherId;
    await student.save();

    // Add student to teacher's students list
    await User.findByIdAndUpdate(teacherId, {
      $addToSet: { students: studentId },
    });

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");
    await student.populate("teacher", "name email subjects");

    res.json({
      success: true,
      message: `Student assigned to teacher successfully. Matching subjects: ${studentSubjects.filter((s) => teacherSubjects.includes(s)).join(", ")}`,
      student,
    });
  } catch (err) {
    console.error("Error assigning teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/teachers/:id/students - Get students assigned to a teacher
router.get("/teachers/:id/students", async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id).populate(
      "students",
      "name email subjects phone fatherName totalFee paidAmount dueAmount",
    );

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher not found" });
    }

    res.json(teacher.students || []);
  } catch (err) {
    console.error("Error fetching teacher students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
