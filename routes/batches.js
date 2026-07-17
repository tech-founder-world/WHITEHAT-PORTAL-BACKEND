const express = require("express");
const router = express.Router();
const { Batch, defaultBatches } = require("../models/Batch");
const Student = require("../models/Student");
const User = require("../models/User");
const Project = require("../models/Project");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET /api/batches - Get all batches
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "counsellor") {
      // Counsellor sees their own batches
      filter.counsellor = req.user._id;
    } else if (req.user.role === "admin") {
      // Admin sees all batches
    } else if (req.user.role === "teacher") {
      // Teacher sees batches that have their students
      const teacherProjects = await Project.find({
        teacher: req.user._id,
      }).select("_id");
      const projectIds = teacherProjects.map((p) => p._id);
      const batchesWithProjects = await Batch.find({
        project: { $in: projectIds },
      }).select("_id");
      const batchIds = batchesWithProjects.map((b) => b._id);

      // Also get batches where teacher's students are enrolled
      const teacherStudents = await Student.find({
        teacher: req.user._id,
      }).select("_id");
      const studentIds = teacherStudents.map((s) => s._id);
      const batchesWithStudents = await Batch.find({
        students: { $in: studentIds },
      }).select("_id");

      filter._id = {
        $in: [...batchIds, ...batchesWithStudents.map((b) => b._id)],
      };
    }

    const batches = await Batch.find(filter)
      .populate("counsellor", "name email")
      .populate("students", "name rollNumber email")
      .populate("project", "name subject")
      .sort({ createdAt: -1 });

    res.json(batches);
  } catch (err) {
    console.error("Error fetching batches:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/batches/default - Get or create default batches
router.get("/default/create", async (req, res) => {
  try {
    // Only counsellors and admins can create default batches
    if (req.user.role !== "counsellor" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const existingBatches = await Batch.find({
      counsellor: req.user._id,
      category: { $in: ["silver", "platinum", "premium"] },
    });

    const createdBatches = [];

    for (const defaultBatch of defaultBatches) {
      // Check if this default batch already exists for this counsellor
      const exists = existingBatches.some(
        (b) => b.category === defaultBatch.category,
      );

      if (!exists) {
        const batch = await Batch.create({
          ...defaultBatch,
          counsellor: req.user._id,
          status: "active",
        });
        createdBatches.push(batch);
      }
    }

    // Get all batches for this counsellor
    const allBatches = await Batch.find({ counsellor: req.user._id })
      .populate("counsellor", "name email")
      .populate("students", "name rollNumber")
      .populate("project", "name subject");

    res.json({
      message:
        createdBatches.length > 0
          ? "Default batches created"
          : "Default batches already exist",
      batches: allBatches,
    });
  } catch (err) {
    console.error("Error creating default batches:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/batches - Create a new batch
router.post("/", async (req, res) => {
  try {
    const {
      name,
      category,
      duration,
      durationType,
      description,
      startDate,
      endDate,
      maxStudents,
      fee,
      project,
    } = req.body;

    if (!name || !duration) {
      return res
        .status(400)
        .json({ message: "Batch name and duration required" });
    }

    // Only counsellors and admins can create batches
    if (req.user.role !== "counsellor" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only counsellors and admins can create batches" });
    }

    // REMOVED: students field from creation - counsellors cannot add students
    const batch = await Batch.create({
      name,
      category: category || "custom",
      duration,
      durationType: durationType || "days",
      description: description || "",
      counsellor: req.user._id,
      startDate: startDate || "",
      endDate: endDate || "",
      maxStudents: maxStudents || 30,
      fee: fee || 0,
      project: project || null,
      students: [], // Always empty - students are added only by admin
      status: "active",
    });

    await batch.populate("counsellor", "name email");
    await batch.populate("students", "name rollNumber");
    await batch.populate("project", "name subject");

    res.status(201).json(batch);
  } catch (err) {
    console.error("Error creating batch:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET /api/batches/:id - Get single batch
router.get("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate("counsellor", "name email")
      .populate("students", "name rollNumber email")
      .populate("project", "name subject");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check access
    if (req.user.role === "admin") {
      // Admin can access all batches
    } else if (req.user.role === "counsellor") {
      if (batch.counsellor._id.toString() !== req.user._id.toString()) {
        return res
          .status(403)
          .json({ message: "Access denied - This is not your batch" });
      }
    } else if (req.user.role === "teacher") {
      // Teacher can access if their students are in this batch
      const teacherStudents = await Student.find({
        teacher: req.user._id,
      }).select("_id");
      const studentIds = teacherStudents.map((s) => s._id.toString());
      const hasAccess = batch.students.some((s) =>
        studentIds.includes(s._id.toString()),
      );
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(batch);
  } catch (err) {
    console.error("Error fetching batch:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/batches/:id - Update batch
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      category,
      duration,
      durationType,
      description,
      startDate,
      endDate,
      maxStudents,
      fee,
      project,
      status,
    } = req.body;

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Only counsellor who created it or admin can update
    if (req.user.role === "admin") {
      // Admin can update any batch
    } else if (req.user.role === "counsellor") {
      if (batch.counsellor.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only update your own batches",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // REMOVED: students field from update - only admin can manage students
    const updated = await Batch.findByIdAndUpdate(
      req.params.id,
      {
        name: name || batch.name,
        category: category || batch.category,
        duration: duration || batch.duration,
        durationType: durationType || batch.durationType,
        description:
          description !== undefined ? description : batch.description,
        startDate: startDate || batch.startDate,
        endDate: endDate || batch.endDate,
        maxStudents: maxStudents || batch.maxStudents,
        fee: fee !== undefined ? fee : batch.fee,
        project: project || batch.project,
        status: status || batch.status,
        // students field is NOT updated here - only admin can change it
      },
      { new: true },
    )
      .populate("counsellor", "name email")
      .populate("students", "name rollNumber")
      .populate("project", "name subject");

    res.json(updated);
  } catch (err) {
    console.error("Error updating batch:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/batches/:id - Delete batch
router.delete("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Only counsellor who created it or admin can delete
    if (req.user.role === "admin") {
      // Admin can delete any batch
    } else if (req.user.role === "counsellor") {
      if (batch.counsellor.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Access denied - You can only delete your own batches",
        });
      }
    } else {
      return res.status(403).json({ message: "Access denied" });
    }

    // Remove batch reference from students
    await Student.updateMany(
      { batches: batch._id },
      { $pull: { batches: batch._id } },
    );

    await batch.deleteOne();
    res.json({ message: "Batch deleted successfully" });
  } catch (err) {
    console.error("Error deleting batch:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// ADMIN ONLY ROUTES - Student Management
// ============================================

// POST /api/batches/:id/students - Add students to batch (ADMIN ONLY)
router.post("/:id/students", async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ message: "Student IDs required" });
    }

    // ADMIN ONLY - Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied - Only admins can add students to batches",
      });
    }

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check if batch is full
    if (batch.students.length + studentIds.length > batch.maxStudents) {
      return res.status(400).json({
        message: `Batch is full. Max capacity: ${batch.maxStudents}`,
      });
    }

    // Add students (avoid duplicates)
    const updated = await Batch.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { students: { $each: studentIds } } },
      { new: true },
    ).populate("students", "name rollNumber");

    // Update students with batch reference
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { $addToSet: { batches: batch._id } },
    );

    res.json(updated);
  } catch (err) {
    console.error("Error adding students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/batches/:id/students/:studentId - Remove student from batch (ADMIN ONLY)
router.delete("/:id/students/:studentId", async (req, res) => {
  try {
    // ADMIN ONLY - Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied - Only admins can remove students from batches",
      });
    }

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const updated = await Batch.findByIdAndUpdate(
      req.params.id,
      { $pull: { students: req.params.studentId } },
      { new: true },
    ).populate("students", "name rollNumber");

    // Remove batch from student
    await Student.findByIdAndUpdate(req.params.studentId, {
      $pull: { batches: batch._id },
    });

    res.json(updated);
  } catch (err) {
    console.error("Error removing student:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
