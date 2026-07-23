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
    const { subject, search, addedBy, all } = req.query;
    let filter = {};

    if (all === 'true' && req.user.role === 'admin') {
      const students = await Student.find({})
        .populate("addedBy", "name email role")
        .populate("counsellor", "name email")
        .populate("teacher", "name email subjects")
        .sort({ createdAt: -1 });
      return res.json(students);
    }

    if (subject) {
      filter.subjects = subject;
    }

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

    if (req.user.role === "teacher") {
      const teacherSubjects = (req.user.subjects || []).map(s => s.trim().toUpperCase());
      
      if (teacherSubjects.length === 0) {
        return res.json([]);
      }
      
      filter.teacher = req.user._id;
      filter.subjects = { $in: teacherSubjects };
    }

    if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter._id = { $in: assignedIds };
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

// POST /api/students - Create a new student
router.post("/", async (req, res) => {
  try {
    const {
      name,
      fatherName,
      email,
      phone,
      subjects,
      totalFee,
      paidAmount,
      batchType,
      mode,
    } = req.body;

    if (!name || !fatherName || !email || !phone) {
      return res.status(400).json({ 
        message: "Name, father's name, email, and phone are required" 
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await Student.findOne({ 
      email: cleanEmail 
    });
    
    if (existing) {
      return res.status(400).json({ 
        message: `Email "${cleanEmail}" is already registered by student "${existing.name}". Please use a different email.` 
      });
    }

    const capitalizedSubjects = (subjects || []).map(sub => 
      sub.trim().toUpperCase()
    );

    const total = totalFee || 0;
    const paid = paidAmount || 0;
    const due = total - paid;

    const student = await Student.create({
      name: name.trim(),
      fatherName: fatherName.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      subjects: capitalizedSubjects,
      batchType: batchType || "Premium",
      mode: mode || "Online",
      totalFee: total,
      paidAmount: paid,
      dueAmount: due,
      addedBy: req.user._id,
      addedByRole: req.user.role,
      counsellor: req.user.role === "counsellor" ? req.user._id : null,
    });

    if (req.user.role === "counsellor") {
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { students: student._id },
      });
    }

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");

    res.status(201).json({
      success: true,
      message: "Student added successfully",
      student
    });
  } catch (err) {
    console.error("Error creating student:", err);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: `Email "${req.body.email}" is already registered. Please use a different email.` 
      });
    }
    
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
});

// PUT /api/students/:id - Update student
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      fatherName,
      email,
      phone,
      subjects,
      totalFee,
      paidAmount,
      batchType,
      mode,
      counsellor,
    } = req.body;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (
      req.user.role === "counsellor" &&
      student.addedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only edit students you added" });
    }

    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== student.email.toLowerCase()) {
        const existing = await Student.findOne({ email: cleanEmail });
        if (existing) {
          return res.status(400).json({ 
            message: `Email "${cleanEmail}" is already registered by student "${existing.name}". Please use a different email.` 
          });
        }
      }
    }

    const capitalizedSubjects = (subjects || []).map(sub => 
      sub.trim().toUpperCase()
    );

    const total = totalFee !== undefined ? totalFee : student.totalFee || 0;
    const paid = paidAmount !== undefined ? paidAmount : student.paidAmount || 0;
    const due = total - paid;

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      {
        name: name ? name.trim() : student.name,
        fatherName: fatherName ? fatherName.trim() : student.fatherName,
        email: email ? email.trim().toLowerCase() : student.email,
        phone: phone ? phone.trim() : student.phone,
        subjects: subjects !== undefined ? capitalizedSubjects : student.subjects,
        batchType: batchType || student.batchType || "Premium",
        mode: mode || student.mode || "Online",
        totalFee: total,
        paidAmount: paid,
        dueAmount: due,
        counsellor: counsellor !== undefined ? counsellor : student.counsellor,
      },
      { new: true, runValidators: true },
    )
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email subjects");

    res.json({
      success: true,
      message: "Student updated successfully",
      student: updated
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: "Email already exists. Please use a different email address." 
      });
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

    if (
      req.user.role === "counsellor" &&
      student.addedBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only delete students you added" });
    }

    await Student.findByIdAndDelete(req.params.id);
    await Attendance.deleteMany({ student: req.params.id });

    await User.updateMany(
      { students: req.params.id },
      { $pull: { students: req.params.id } },
    );

    res.json({ 
      success: true,
      message: "Student deleted successfully" 
    });
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