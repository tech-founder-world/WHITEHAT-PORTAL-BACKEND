const express = require("express");
const router = express.Router();
const Evaluation = require("../models/Evaluation");
const Project = require("../models/Project");
const Student = require("../models/Student");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/evaluations - Get evaluations with filters
router.get("/", async (req, res) => {
  try {
    const { projectId, studentId, subject, date } = req.query;
    const filter = {};

    if (projectId) filter.project = projectId;
    if (studentId) filter.student = studentId;
    if (subject) filter.subject = subject;
    if (date) filter.date = date;

    // Admin can see everything
    if (req.user.role === "admin") {
      // No restrictions
    }
    // Teacher - only see evaluations from their projects
    else if (req.user.role === "teacher") {
      const teacherProjects = await Project.find({
        teacher: req.user._id,
      }).select("_id");
      const projectIds = teacherProjects.map((p) => p._id);

      if (projectId) {
        if (!projectIds.some((id) => id.toString() === projectId.toString())) {
          return res
            .status(403)
            .json({ message: "Access denied to this project" });
        }
        filter.project = projectId;
      } else {
        filter.project = { $in: projectIds };
      }
    }
    // Counsellor - only see evaluations for their assigned students
    else if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const studentIds = counsellor.students.map((s) => s._id);

      if (studentId) {
        if (!studentIds.some((id) => id.toString() === studentId.toString())) {
          return res
            .status(403)
            .json({ message: "Student not assigned to you" });
        }
        filter.student = studentId;
      } else {
        filter.student = { $in: studentIds };
      }
    }

    const evaluations = await Evaluation.find(filter)
      .populate("student", "name rollNumber")
      .populate("project", "name subject")
      .populate("markedBy", "name")
      .sort({ date: -1 });

    res.json(evaluations);
  } catch (err) {
    console.error("Error fetching evaluations:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST /api/evaluations/bulk - Save evaluations for project students
router.post("/bulk", async (req, res) => {
  try {
    const { records, projectId, date } = req.body;

    if (!records || !projectId || !date) {
      return res
        .status(400)
        .json({ message: "Records, projectId, and date required" });
    }

    // Get project and verify access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access
    if (req.user.role === "admin") {
      // Admin can evaluate any project
    } else if (req.user.role === "teacher") {
      if (project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only evaluate your own projects",
        });
      }
    } else {
      return res.status(403).json({
        message: "Access denied - Only teachers can evaluate projects",
      });
    }

    // Get project student IDs
    const projectStudentIds = project.students.map((id) => id.toString());

    const results = [];
    for (const rec of records) {
      // Only evaluate students in this project
      if (!projectStudentIds.includes(rec.studentId.toString())) {
        continue;
      }

      const evaluation = await Evaluation.findOneAndUpdate(
        {
          student: rec.studentId,
          project: projectId,
          date: date,
        },
        {
          student: rec.studentId,
          project: projectId,
          subject: project.subject,
          date: date,
          score: rec.score,
          maxScore: rec.maxScore || project.maxScore || 100,
          remarks: rec.remarks || "",
          markedBy: req.user._id,
          evaluationType: rec.evaluationType || "project",
        },
        { upsert: true, new: true },
      )
        .populate("student", "name rollNumber")
        .populate("project", "name");

      results.push(evaluation);
    }

    res.json({
      message: `Saved ${results.length} evaluations`,
      records: results,
    });
  } catch (err) {
    console.error("Error saving evaluations:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/evaluations/:id - Update a single evaluation
router.put("/:id", async (req, res) => {
  try {
    const { score, maxScore, remarks } = req.body;
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ message: "Evaluation not found" });
    }

    // Check access
    if (req.user.role === "admin") {
      // Admin can update any evaluation
    } else if (req.user.role === "teacher") {
      const project = await Project.findById(evaluation.project);
      if (!project || project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only update your own evaluations",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    evaluation.score = score;
    evaluation.maxScore = maxScore;
    evaluation.remarks = remarks;
    await evaluation.save();
    await evaluation.populate("student", "name rollNumber");
    await evaluation.populate("project", "name");

    res.json(evaluation);
  } catch (err) {
    console.error("Error updating evaluation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/evaluations/:id - Delete an evaluation
router.delete("/:id", async (req, res) => {
  try {
    const evaluation = await Evaluation.findById(req.params.id);
    if (!evaluation) {
      return res.status(404).json({ message: "Evaluation not found" });
    }

    // Check access
    if (req.user.role === "admin") {
      // Admin can delete any evaluation
    } else if (req.user.role === "teacher") {
      const project = await Project.findById(evaluation.project);
      if (!project || project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only delete your own evaluations",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    await evaluation.deleteOne();
    res.json({ message: "Evaluation deleted successfully" });
  } catch (err) {
    console.error("Error deleting evaluation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
