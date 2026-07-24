const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Student = require("../models/Student");
const { protect, adminOnly } = require("../middleware/auth");

// All routes require admin auth
router.use(protect, adminOnly);

// ===== TEST ROUTE =====
router.get("/test", (req, res) => {
  res.json({ 
    message: "Admin route is working!",
    user: req.user 
  });
});

// ===== COUNSELLOR UPDATE ROUTE =====
// MOVED TO TOP TO AVOID CONFLICT WITH OTHER ROUTES
router.put("/students/:id/counsellor", async (req, res) => {
  
  try {
    const { counsellorId } = req.body;
    const studentId = req.params.id;

    if (!studentId) {
      return res.status(400).json({ message: "Student ID is required" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const oldCounsellorId = student.counsellor?.toString();
    

    // If counsellor is being changed
    if (counsellorId !== oldCounsellorId) {
      // Remove from old counsellor's list
      if (oldCounsellorId) {
        await User.findByIdAndUpdate(
          oldCounsellorId,
          { $pull: { students: studentId } }
        );
      }
      
      // Add to new counsellor's list
      if (counsellorId) {
        const newCounsellor = await User.findById(counsellorId);
        if (!newCounsellor || newCounsellor.role !== "counsellor") {
          return res.status(400).json({ message: "Invalid counsellor" });
        }
        
        await User.findByIdAndUpdate(
          counsellorId,
          { $addToSet: { students: studentId } }
        );
      }
    }

    // Update student's counsellor
    student.counsellor = counsellorId || null;
    await student.save();

    // Populate the student with all relations
    const populatedStudent = await Student.findById(studentId)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email subjects");


    res.json({
      success: true,
      message: "Counsellor updated successfully",
      student: populatedStudent
    });
  } catch (err) {
    console.error("❌ Error updating counsellor:", err);
    res.status(500).json({ 
      message: "Server error updating counsellor",
      error: err.message 
    });
  }
});

// ===== TEACHER ROUTES =====

// GET /api/admin/teachers
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" })
      .select("-password")
      .populate("students", "name email subjects phone fatherName");
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

    const capitalizedSubjects = (subjects || []).map((sub) =>
      sub.trim().toUpperCase(),
    );

    const teacher = await User.create({
      name,
      email,
      password,
      role: "teacher",
      subjects: capitalizedSubjects,
      students: [],
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
    })
      .select("-password")
      .populate("students", "name email subjects phone fatherName");
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
    await Student.updateMany(
      { teacher: req.params.id },
      { $unset: { teacher: "" } },
    );

    const Batch = require("../models/Batch");
    await Batch.updateMany(
      { createdBy: req.params.id },
      { $unset: { createdBy: "" } },
    );

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Teacher deleted successfully" });
  } catch (err) {
    console.error("Error deleting teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== COUNSELLOR ROUTES =====

// GET /api/admin/counsellors - Get all counsellors
router.get("/counsellors", async (req, res) => {
  try {
    const counsellors = await User.find({ role: "counsellor" })
      .select("-password")
      .populate("students", "name email subjects phone fatherName totalFee paidAmount dueAmount");
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
      .populate("students", "name email subjects phone");
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
    await Student.updateMany(
      { counsellor: req.params.id },
      { $unset: { counsellor: "" } },
    );

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Counsellor deleted successfully" });
  } catch (err) {
    console.error("Error deleting counsellor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===== STUDENT ROUTES =====

// GET /api/admin/students - Get all students with filters
router.get("/students", async (req, res) => {
  try {
    const { search, addedBy, counsellor } = req.query;
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

    if (counsellor) {
      filter.counsellor = counsellor;
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

// ===== ASSIGN STUDENT TO TEACHER =====

// POST /api/admin/students/assign-teacher
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

    const studentSubjects = (student.subjects || []).map((s) =>
      s.trim().toUpperCase(),
    );
    const teacherSubjects = (teacher.subjects || []).map((s) =>
      s.trim().toUpperCase(),
    );

    if (teacherSubjects.length === 0) {
      return res.status(400).json({
        message: "This teacher has no subjects assigned.",
      });
    }

    const hasMatchingSubject = studentSubjects.some((sub) =>
      teacherSubjects.includes(sub),
    );

    if (!hasMatchingSubject) {
      return res.status(400).json({
        message: `Student has no matching subjects with this teacher.`,
      });
    }

    if (student.teacher) {
      await User.findByIdAndUpdate(student.teacher, {
        $pull: { students: studentId },
      });
    }

    student.teacher = teacherId;
    await student.save();

    await User.findByIdAndUpdate(teacherId, {
      $addToSet: { students: studentId },
    });

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");
    await student.populate("teacher", "name email subjects");

    res.json({
      success: true,
      message: "Teacher assigned successfully",
      student,
    });
  } catch (err) {
    console.error("Error assigning teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/admin/students/:studentId/teacher
router.delete("/students/:studentId/teacher", async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (!student.teacher) {
      return res
        .status(400)
        .json({ message: "Student has no teacher assigned" });
    }

    await User.findByIdAndUpdate(student.teacher, {
      $pull: { students: studentId },
    });

    student.teacher = null;
    await student.save();

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");
    await student.populate("teacher", "name email subjects");

    res.json({
      success: true,
      message: "Teacher removed successfully",
      student,
    });
  } catch (err) {
    console.error("Error removing teacher:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/teachers/:id/students
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

// GET /api/admin/counsellors/:id/students
router.get("/counsellors/:id/students", async (req, res) => {
  try {
    const counsellor = await User.findById(req.params.id).populate(
      "students",
      "name email subjects phone fatherName totalFee paidAmount dueAmount",
    );

    if (!counsellor || counsellor.role !== "counsellor") {
      return res.status(404).json({ message: "Counsellor not found" });
    }

    res.json(counsellor.students || []);
  } catch (err) {
    console.error("Error fetching counsellor students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const { role } = req.query;
    let filter = {};
    if (role) {
      filter.role = role;
    }
    const users = await User.find(filter)
      .select("name email role subjects specialization")
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/admin/subjects
router.get("/subjects", async (req, res) => {
  try {
    const students = await Student.find({});
    const subjectSet = new Set();
    students.forEach((student) => {
      student.subjects?.forEach((subject) => subjectSet.add(subject));
    });
    res.json([...subjectSet].sort());
  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/students/bulk-assign-teacher
router.post("/students/bulk-assign-teacher", async (req, res) => {
  try {
    const { studentIds, teacherId } = req.body;

    if (!studentIds || studentIds.length === 0 || !teacherId) {
      return res
        .status(400)
        .json({ message: "Student IDs and Teacher ID required" });
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const teacherSubjects = (teacher.subjects || []).map((s) =>
      s.trim().toUpperCase(),
    );

    if (teacherSubjects.length === 0) {
      return res.status(400).json({
        message: "Teacher has no subjects assigned.",
      });
    }

    const results = {
      assigned: [],
      failed: [],
    };

    for (const studentId of studentIds) {
      try {
        const student = await Student.findById(studentId);
        if (!student) {
          results.failed.push({ studentId, reason: "Student not found" });
          continue;
        }

        const studentSubjects = (student.subjects || []).map((s) =>
          s.trim().toUpperCase(),
        );

        const hasMatchingSubject = studentSubjects.some((sub) =>
          teacherSubjects.includes(sub),
        );

        if (!hasMatchingSubject) {
          results.failed.push({
            studentId,
            studentName: student.name,
            reason: "No matching subjects",
          });
          continue;
        }

        if (student.teacher) {
          await User.findByIdAndUpdate(student.teacher, {
            $pull: { students: studentId },
          });
        }

        student.teacher = teacherId;
        await student.save();

        await User.findByIdAndUpdate(teacherId, {
          $addToSet: { students: studentId },
        });

        results.assigned.push({
          studentId,
          studentName: student.name,
        });
      } catch (err) {
        results.failed.push({
          studentId,
          reason: err.message || "Unknown error",
        });
      }
    }

    res.json({
      success: true,
      message: `Assigned ${results.assigned.length} students`,
      results,
    });
  } catch (err) {
    console.error("Error in bulk assign:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/students/bulk-assign-counsellor
router.post("/students/bulk-assign-counsellor", async (req, res) => {
  try {
    const { studentIds, counsellorId } = req.body;

    if (!studentIds || studentIds.length === 0 || !counsellorId) {
      return res
        .status(400)
        .json({ message: "Student IDs and Counsellor ID required" });
    }

    const counsellor = await User.findById(counsellorId);
    if (!counsellor || counsellor.role !== "counsellor") {
      return res.status(404).json({ message: "Counsellor not found" });
    }

    const results = {
      assigned: [],
      failed: [],
    };

    for (const studentId of studentIds) {
      try {
        const student = await Student.findById(studentId);
        if (!student) {
          results.failed.push({ studentId, reason: "Student not found" });
          continue;
        }

        if (student.counsellor) {
          await User.findByIdAndUpdate(student.counsellor, {
            $pull: { students: studentId },
          });
        }

        student.counsellor = counsellorId;
        await student.save();

        await User.findByIdAndUpdate(counsellorId, {
          $addToSet: { students: studentId },
        });

        results.assigned.push({
          studentId,
          studentName: student.name,
        });
      } catch (err) {
        results.failed.push({
          studentId,
          reason: err.message || "Unknown error",
        });
      }
    }

    res.json({
      success: true,
      message: `Assigned counsellor to ${results.assigned.length} students`,
      results,
    });
  } catch (err) {
    console.error("Error in bulk assign counsellor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/admin/sync-counsellor-students
router.post("/sync-counsellor-students", async (req, res) => {
  try {
    const students = await Student.find({ counsellor: { $ne: null } });
    
    let updatedCount = 0;
    
    for (const student of students) {
      if (student.counsellor) {
        const result = await User.findByIdAndUpdate(
          student.counsellor,
          { $addToSet: { students: student._id } }
        );
        if (result) updatedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Synced ${updatedCount} students with their counsellors`,
      updatedCount
    });
  } catch (err) {
    console.error("Error syncing counsellor students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;