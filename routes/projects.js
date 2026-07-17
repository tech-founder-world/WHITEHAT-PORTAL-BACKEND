const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const Student = require("../models/Student");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET /api/projects - Get all projects (filtered by role)
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      // Teacher sees their own projects
      filter.teacher = req.user._id;
    } else if (req.user.role === "counsellor") {
      // Counsellor sees projects of their assigned students
      const counsellor = await User.findById(req.user._id).populate("students");
      const studentIds = counsellor.students.map((s) => s._id);
      filter.students = { $in: studentIds };
    }
    // Admin sees all projects

    const projects = await Project.find(filter)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/projects/:id - Get single project
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("teacher", "name email")
      .populate("students", "name rollNumber email");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check access based on role
    if (req.user.role === "admin") {
      // Admin can access all projects
      return res.json(project);
    }

    if (req.user.role === "teacher") {
      // Teacher can only access their own projects
      if (project.teacher._id.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Access denied - This is not your project" });
      }
      return res.json(project);
    }

    if (req.user.role === "counsellor") {
      // Counsellor can only access projects where their assigned students are enrolled
      const counsellor = await User.findById(req.user._id).populate("students");
      const studentIds = counsellor.students.map((s) => s._id.toString());

      // Check if any student in the project is assigned to this counsellor
      const hasAccess = project.students.some((s) =>
        studentIds.includes(s._id.toString()),
      );

      if (!hasAccess) {
        return res.status(403).json({
          message: "Access denied - No assigned students in this project",
        });
      }
      return res.json(project);
    }

    return res.status(403).json({ message: "Access denied" });
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/projects - Create a new project (Teacher only)
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      subject,
      startDate,
      endDate,
      students,
      maxScore,
    } = req.body;

    if (!name || !subject) {
      return res
        .status(400)
        .json({ message: "Project name and subject required" });
    }

    // Only teachers can create projects
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only teachers can create projects" });
    }

    const project = await Project.create({
      name,
      description: description || "",
      teacher: req.user._id,
      subject,
      startDate: startDate || "",
      endDate: endDate || "",
      students: students || [],
      maxScore: maxScore || 100,
      status: "active",
    });

    // Update students with project reference
    if (students && students.length > 0) {
      await Student.updateMany(
        { _id: { $in: students } },
        { $addToSet: { projects: project._id } },
      );
    }

    await project.populate("teacher", "name email");
    await project.populate("students", "name rollNumber");

    res.status(201).json(project);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      description,
      subject,
      startDate,
      endDate,
      students,
      maxScore,
      status,
    } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership - only teacher who created it or admin can edit
    if (req.user.role === "admin") {
      // Admin can edit any project
    } else if (req.user.role === "teacher") {
      if (project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only edit your own projects",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Update project
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      {
        name: name || project.name,
        description:
          description !== undefined ? description : project.description,
        subject: subject || project.subject,
        startDate: startDate || project.startDate,
        endDate: endDate || project.endDate,
        students: students || project.students,
        maxScore: maxScore || project.maxScore,
        status: status || project.status,
      },
      { new: true },
    )
      .populate("teacher", "name email")
      .populate("students", "name rollNumber");

    res.json(updated);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete("/:id", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (req.user.role === "admin") {
      // Admin can delete any project
    } else if (req.user.role === "teacher") {
      if (project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only delete your own projects",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Remove project reference from students
    await Student.updateMany(
      { projects: project._id },
      { $pull: { projects: project._id } },
    );

    await project.deleteOne();
    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/projects/:id/students - Add students to project
router.post("/:id/students", async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ message: "Student IDs required" });
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (req.user.role === "admin") {
      // Admin can add students to any project
    } else if (req.user.role === "teacher") {
      if (project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only modify your own projects",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Add students (avoid duplicates)
    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: { $each: studentIds } } },
      { new: true },
    ).populate("students", "name rollNumber");

    // Update students with project reference
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { projects: project._id } },
    );

    res.json(updated);
  } catch (err) {
    console.error("Error adding students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/projects/:id/students/:studentId - Remove student from project
router.delete("/:id/students/:studentId", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Check ownership
    if (req.user.role === "admin") {
      // Admin can remove students from any project
    } else if (req.user.role === "teacher") {
      if (project.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only modify your own projects",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    const updated = await Project.findByIdAndUpdate(
      req.params.id,
      { $pull: { students: req.params.studentId } },
      { new: true },
    ).populate("students", "name rollNumber");

    // Remove project from student
    await Student.findByIdAndUpdate(req.params.studentId, {
      $pull: { projects: project._id },
    });

    res.json(updated);
  } catch (err) {
    console.error("Error removing student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
