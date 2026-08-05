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
      filter.subjects = { $in: [subject] };
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
      
      // CRITICAL FIX: Teacher must be assigned to the student AND subject must match
      filter.teacher = req.user._id;
      
      // If subject is specified, only return students with that subject
      if (subject) {
        filter.subjects = { $in: [subject] };
      } else {
        filter.subjects = { $in: teacherSubjects };
      }
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

// GET /api/students/all-subjects - Get all unique subjects from all students
router.get("/all-subjects", async (req, res) => {
  try {
    const students = await Student.find({});
    const subjectSet = new Set();
    students.forEach((student) => {
      student.subjects?.forEach((subject) => subjectSet.add(subject));
    });
    res.json([...subjectSet].sort());
  } catch (err) {
    console.error("Error fetching all subjects:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/students - Create a new student
router.post("/", async (req, res) => {
  try {
    console.log("📥 Received POST request body:", req.body);
    
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
      joiningDate,
      duration,
    } = req.body;

    console.log("📋 Extracted values:", {
      name,
      fatherName,
      email,
      phone,
      subjects,
      batchType,
      mode,
      counsellor,
      joiningDate: joiningDate || "NOT PROVIDED",
      duration: duration || "NOT PROVIDED"
    });

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

    // Determine counsellor - use provided or set based on role
    let counsellorId = counsellor || null;
    if (req.user.role === "counsellor" && !counsellorId) {
      counsellorId = req.user._id;
    }

    // Parse joining date if provided
    let parsedJoiningDate = null;
    if (joiningDate) {
      parsedJoiningDate = new Date(joiningDate);
      if (isNaN(parsedJoiningDate.getTime())) {
        console.warn("⚠️ Invalid joining date, using current date");
        parsedJoiningDate = new Date(); // Default to today if invalid
      }
    } else {
      // If no joining date provided, use current date
      parsedJoiningDate = new Date();
    }
    
    console.log("📅 Parsed joining date:", parsedJoiningDate);

    // Create student with all fields
    const studentData = {
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
      counsellor: counsellorId,
      joiningDate: parsedJoiningDate,
      duration: duration || "", // Make sure duration is saved as string
    };

    console.log("💾 Student data to save:", studentData);

    const student = await Student.create(studentData);

    // IMPORTANT: Add student to counsellor's students array
    if (counsellorId) {
      await User.findByIdAndUpdate(
        counsellorId, 
        { 
          $addToSet: { students: student._id } 
        }
      );
    }

    // If counsellor is creating, also add to their list
    if (req.user.role === "counsellor") {
      await User.findByIdAndUpdate(
        req.user._id, 
        { 
          $addToSet: { students: student._id } 
        }
      );
    }

    await student.populate("addedBy", "name email role");
    await student.populate("counsellor", "name email");

    console.log("✅ Created student:", student);

    res.status(201).json({
      success: true,
      message: "Student added successfully",
      student
    });
  } catch (err) {
    console.error("❌ Error creating student:", err);
    
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
    console.log("📥 Received PUT request body:", req.body);
    
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
      joiningDate,
      duration,
    } = req.body;

    console.log("📋 Update values:", {
      id: req.params.id,
      name,
      fatherName,
      email,
      phone,
      subjects,
      batchType,
      mode,
      counsellor,
      joiningDate: joiningDate || "NOT PROVIDED",
      duration: duration || "NOT PROVIDED"
    });

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

    // Handle counsellor change - remove from old, add to new
    const oldCounsellorId = student.counsellor?.toString();
    const newCounsellorId = counsellor !== undefined ? counsellor : student.counsellor?.toString();

    if (newCounsellorId !== oldCounsellorId) {
      // Remove from old counsellor's list
      if (oldCounsellorId) {
        await User.findByIdAndUpdate(
          oldCounsellorId,
          { $pull: { students: student._id } }
        );
      }
      
      // Add to new counsellor's list
      if (newCounsellorId) {
        await User.findByIdAndUpdate(
          newCounsellorId,
          { $addToSet: { students: student._id } }
        );
      }
    }

    // Parse joining date if provided
    let parsedJoiningDate = student.joiningDate;
    if (joiningDate !== undefined) {
      if (joiningDate) {
        parsedJoiningDate = new Date(joiningDate);
        if (isNaN(parsedJoiningDate.getTime())) {
          parsedJoiningDate = student.joiningDate; // Keep existing if invalid
        }
      } else {
        parsedJoiningDate = null;
      }
    }
    
    console.log("📅 Parsed joining date for update:", parsedJoiningDate);

    const updateData = {
      name: name !== undefined ? name.trim() : student.name,
      fatherName: fatherName !== undefined ? fatherName.trim() : student.fatherName,
      email: email !== undefined ? email.trim().toLowerCase() : student.email,
      phone: phone !== undefined ? phone.trim() : student.phone,
      subjects: subjects !== undefined ? capitalizedSubjects : student.subjects,
      batchType: batchType !== undefined ? batchType : student.batchType,
      mode: mode !== undefined ? mode : student.mode || "Online",
      totalFee: total,
      paidAmount: paid,
      dueAmount: due,
      counsellor: newCounsellorId || null,
      joiningDate: parsedJoiningDate,
      duration: duration !== undefined ? duration : student.duration || "",
    };

    console.log("💾 Update data:", updateData);

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    )
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email subjects");

    console.log("✅ Updated student:", updated);

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
    console.error("❌ Error updating student:", err);
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

    // Remove student from counsellor's list
    if (student.counsellor) {
      await User.findByIdAndUpdate(
        student.counsellor,
        { $pull: { students: student._id } }
      );
    }

    // Remove student from teacher's list
    if (student.teacher) {
      await User.findByIdAndUpdate(
        student.teacher,
        { $pull: { students: student._id } }
      );
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

module.exports = router;