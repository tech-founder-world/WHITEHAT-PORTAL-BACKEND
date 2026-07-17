const express = require("express");
const router = express.Router();
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/attendance?subject=&date=&studentId=
router.get("/", async (req, res) => {
  try {
    const { subject, date, studentId } = req.query;
    const filter = {};
    if (subject) filter.subject = subject;
    if (date) filter.date = date;
    if (studentId) filter.student = studentId;

    // If teacher and subject provided, restrict to only students enrolled in that subject
    if (req.user.role === "teacher" && subject) {
      if (!req.user.subjects.includes(subject)) {
        return res
          .status(403)
          .json({ message: "You are not assigned to this subject" });
      }
      const enrolledStudents = await Student.find({ subjects: subject }).select(
        "_id",
      );
      const enrolledIds = enrolledStudents.map((s) => s._id);
      filter.student = { $in: enrolledIds };
      if (studentId) filter.student = studentId; // override if specific student requested
    }

    // For counsellors, only show their assigned students
    if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      if (studentId) {
        if (!assignedIds.includes(studentId)) {
          return res
            .status(403)
            .json({ message: "Student not assigned to you" });
        }
        filter.student = studentId;
      } else {
        filter.student = { $in: assignedIds };
      }
    }

    const records = await Attendance.find(filter)
      .populate("student", "name rollNumber subjects")
      .populate("markedBy", "name")
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    console.error("Error fetching attendance:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/attendance/bulk — mark attendance for enrolled students on a date
router.post("/bulk", async (req, res) => {
  try {
    const { records, subject, date } = req.body;
    if (!records || !subject || !date) {
      return res
        .status(400)
        .json({ message: "Records, subject, and date required" });
    }

    // Verify teacher is assigned to this subject
    if (req.user.role === "teacher" && !req.user.subjects.includes(subject)) {
      return res
        .status(403)
        .json({ message: "You are not assigned to this subject" });
    }

    // Get IDs of students enrolled in this subject for validation
    const enrolledStudents = await Student.find({ subjects: subject }).select(
      "_id",
    );
    const enrolledIds = new Set(enrolledStudents.map((s) => s._id.toString()));

    const results = [];
    for (const rec of records) {
      // Only save attendance for students actually enrolled in this subject
      if (!enrolledIds.has(rec.studentId.toString())) continue;

      try {
        const result = await Attendance.findOneAndUpdate(
          { student: rec.studentId, subject, date },
          {
            status: rec.status,
            markedBy: req.user._id,
          },
          { upsert: true, new: true },
        ).populate("student", "name rollNumber subjects");
        results.push(result);
      } catch (err) {
        console.error("Error saving attendance record:", err);
      }
    }

    res.json({
      message: `Saved ${results.length} attendance records`,
      records: results,
    });
  } catch (err) {
    console.error("Error saving attendance:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/attendance/:id — edit a single record
router.put("/:id", async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["present", "absent"].includes(status)) {
      return res
        .status(400)
        .json({ message: "Valid status (present/absent) required" });
    }

    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // Verify teacher owns this subject
    if (
      req.user.role === "teacher" &&
      !req.user.subjects.includes(record.subject)
    ) {
      return res
        .status(403)
        .json({ message: "You are not assigned to this subject" });
    }

    // Verify counsellor has access
    if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id.toString());
      if (!assignedIds.includes(record.student.toString())) {
        return res.status(403).json({ message: "Student not assigned to you" });
      }
    }

    record.status = status;
    await record.save();
    await record.populate("student", "name rollNumber subjects");
    res.json(record);
  } catch (err) {
    console.error("Error updating attendance:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/attendance/stats — attendance percentage per student
router.get("/stats", async (req, res) => {
  try {
    const { subject } = req.query;
    let filter = {};

    // Teachers can only see stats for their own subjects
    if (req.user.role === "teacher") {
      if (subject) {
        if (!req.user.subjects.includes(subject)) {
          return res
            .status(403)
            .json({ message: "You are not assigned to this subject" });
        }
        filter.subject = subject;
      } else {
        filter.subject = { $in: req.user.subjects };
      }
    } else if (req.user.role === "counsellor") {
      // Counsellors only see their assigned students
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter.student = { $in: assignedIds };
      if (subject) filter.subject = subject;
    } else {
      // Admin
      if (subject) filter.subject = subject;
    }

    const records = await Attendance.find(filter).populate(
      "student",
      "name rollNumber subjects",
    );

    const stats = {};
    for (const rec of records) {
      if (!rec.student) continue;
      const id = rec.student._id.toString();
      if (!stats[id]) {
        stats[id] = {
          student: rec.student,
          total: 0,
          present: 0,
        };
      }
      stats[id].total++;
      if (rec.status === "present") stats[id].present++;
    }

    const result = Object.values(stats).map((s) => ({
      student: s.student,
      total: s.total,
      present: s.present,
      percentage:
        s.total > 0 ? ((s.present / s.total) * 100).toFixed(1) : "0.0",
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
