const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Student = require("../models/Student");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET: Fetch all projects
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    } else if (req.user.role === "counsellor") {
      // Counsellors see projects with their students
      const User = require("../models/User");
      const counsellor = await User.findById(req.user._id).populate("students");
      const studentIds = counsellor.students.map((s) => s._id);
      filter.students = { $in: studentIds };
    }
    // Admin sees all projects (no filter)

    const projects = await Project.find(filter)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email")
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error("❌ Error fetching projects:", error.message);
    res.status(500).json({ message: "Server error fetching projects" });
  }
});

// GET: Fetch a single project
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email");
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error("❌ Error fetching project by ID:", error.message);
    res.status(500).json({ message: "Server error fetching project" });
  }
});

// POST: Create a new project
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      teacher,
      students,
      subject,
      startDate,
      endDate,
      maxScore,
    } = req.body;

    // If teacher is creating, auto-assign themselves
    let teacherId = teacher;
    if (req.user.role === "teacher") {
      teacherId = req.user._id;
    } else if (req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins and teachers can create projects" });
    }

    if (!teacherId) {
      return res.status(400).json({ message: "Teacher is required" });
    }

    const newProject = new Project({
      name,
      description: description || "",
      teacher: teacherId,
      students: students || [],
      subject,
      startDate: startDate || "",
      endDate: endDate || "",
      status: req.body.status || "active",
      maxScore: maxScore || 100,
    });

    const savedProject = await newProject.save();

    // Update students with project reference
    if (students && students.length > 0) {
      await Student.updateMany(
        { _id: { $in: students } },
        { $addToSet: { projects: savedProject._id } },
      );
    }

    const populatedProject = await Project.findById(savedProject._id)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email");

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: populatedProject,
    });
  } catch (error) {
    console.error("❌ Server Error creating project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Update a project
router.put("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check permissions
    if (
      req.user.role === "teacher" &&
      project.teacher.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only edit your own projects" });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name || project.name,
        description:
          req.body.description !== undefined
            ? req.body.description
            : project.description,
        teacher: req.body.teacher || project.teacher,
        students:
          req.body.students !== undefined
            ? req.body.students
            : project.students,
        subject: req.body.subject || project.subject,
        startDate:
          req.body.startDate !== undefined
            ? req.body.startDate
            : project.startDate,
        endDate:
          req.body.endDate !== undefined ? req.body.endDate : project.endDate,
        status: req.body.status || project.status,
        maxScore: req.body.maxScore || project.maxScore,
      },
      { new: true, runValidators: true },
    )
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email");

    res.json({
      success: true,
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (error) {
    console.error("❌ Error updating project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Delete a project
router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check permissions
    if (
      req.user.role === "teacher" &&
      project.teacher.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only delete your own projects" });
    }

    // Remove project reference from students
    await Student.updateMany(
      { projects: project._id },
      { $pull: { projects: project._id } },
    );

    // Delete associated evaluations
    const Evaluation = require("../models/Evaluation");
    await Evaluation.deleteMany({ project: project._id });

    await project.deleteOne();
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Add students to project
router.post("/:id/students", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check permissions
    if (
      req.user.role === "teacher" &&
      project.teacher.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only modify your own projects" });
    }

    const newStudents = req.body.studentIds || [];
    newStudents.forEach((id) => {
      if (!project.students.includes(id)) {
        project.students.push(id);
      }
    });

    await project.save();

    // Update students with project reference
    await Student.updateMany(
      { _id: { $in: newStudents } },
      { $addToSet: { projects: project._id } },
    );

    const populatedProject = await Project.findById(project._id)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email");

    res.json({
      success: true,
      message: "Students added successfully",
      project: populatedProject,
    });
  } catch (error) {
    console.error("❌ Error adding students:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Remove student from project
router.delete("/:id/students/:studentId", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check permissions
    if (
      req.user.role === "teacher" &&
      project.teacher.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only modify your own projects" });
    }

    project.students = project.students.filter(
      (id) => id.toString() !== req.params.studentId,
    );
    await project.save();

    // Remove project from student
    await Student.findByIdAndUpdate(req.params.studentId, {
      $pull: { projects: project._id },
    });

    res.json({ success: true, message: "Student removed from project" });
  } catch (error) {
    console.error("❌ Error removing student:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
