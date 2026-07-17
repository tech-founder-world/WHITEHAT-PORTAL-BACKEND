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

    const teacher = await User.create({
      name,
      email,
      password,
      role: "teacher",
      subjects: subjects || [],
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
    const update = { name, email, subjects };
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
    const { name, email, password, specialization, students } = req.body;
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
      students: students || [],
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
    const { name, email, specialization, students, password } = req.body;
    const update = { name, email, specialization, students };
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

module.exports = router;
