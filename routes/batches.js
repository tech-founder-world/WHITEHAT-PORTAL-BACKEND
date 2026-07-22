const express = require("express");
const router = express.Router();
const Batch = require("../models/Batch");
const Student = require("../models/Student");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET: Fetch all batches
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      filter.createdBy = req.user._id;
    } else if (req.user.role === "counsellor") {
      // Counsellors see all batches (read-only)
    }
    // Admin sees all batches (no filter)

    const batches = await Batch.find(filter)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone subjects totalFee paidAmount dueAmount status courseType",
      )
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching batches" });
  }
});

// GET: Get a single batch by ID
router.get("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone subjects totalFee paidAmount dueAmount status courseType",
      );

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (
      req.user.role === "teacher" &&
      batch.createdBy._id.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You don't have access to this batch" });
    }

    res.json(batch);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Create a new batch
router.post("/", async (req, res) => {
  try {
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only teachers and admins can create batches" });
    }

    let createdBy = req.user._id;
    if (req.user.role === "admin" && req.body.createdBy) {
      createdBy = req.body.createdBy;
    }

    const newBatch = new Batch({
      name: req.body.name,
      description: req.body.description || "",
      timing: req.body.timing || "",
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      maxStudents: req.body.maxStudents || 30,
      fee: req.body.fee || 0,
      createdBy: createdBy,
      students: req.body.students || [],
      status: req.body.status || "active",
      topics: req.body.topics || [],
      category: req.body.category || "custom",
      duration: req.body.duration || 0,
      durationType: req.body.durationType || "days",
    });

    const savedBatch = await newBatch.save();

    if (req.body.students && req.body.students.length > 0) {
      await Student.updateMany(
        { _id: { $in: req.body.students } },
        { $addToSet: { batches: savedBatch._id } },
      );
    }

    const populatedBatch = await Batch.findById(savedBatch._id)
      .populate("createdBy", "name email role")
      .populate("students", "name fatherName email phone");

    res.status(201).json({
      success: true,
      message: "Batch created successfully",
      batch: populatedBatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Update a batch
router.put("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only edit your own batches" });
    }

    if (req.body.name) batch.name = req.body.name;
    if (req.body.description !== undefined)
      batch.description = req.body.description;
    if (req.body.timing !== undefined) batch.timing = req.body.timing;
    if (req.body.startDate) batch.startDate = req.body.startDate;
    if (req.body.endDate) batch.endDate = req.body.endDate;
    if (req.body.maxStudents !== undefined)
      batch.maxStudents = req.body.maxStudents;
    if (req.body.fee !== undefined) batch.fee = req.body.fee;
    if (req.body.status) batch.status = req.body.status;
    if (req.body.category) batch.category = req.body.category;

    if (
      req.body.duration !== undefined &&
      req.body.duration !== null &&
      req.body.duration !== ""
    ) {
      batch.duration = Number(req.body.duration);
    }
    if (req.body.durationType) batch.durationType = req.body.durationType;

    if (req.body.createdBy) {
      try {
        const teacher = await User.findById(req.body.createdBy);
        if (
          teacher &&
          (teacher.role === "teacher" || teacher.role === "admin")
        ) {
          batch.createdBy = req.body.createdBy;
        }
      } catch (err) {
        // Silently handle error
      }
    }

    if (req.body.topics && Array.isArray(req.body.topics)) {
      batch.topics = req.body.topics;
    }

    if (req.body.studentIds && Array.isArray(req.body.studentIds)) {
      req.body.studentIds.forEach((id) => {
        if (!batch.students.includes(id)) {
          batch.students.push(id);
        }
      });

      await Student.updateMany(
        { _id: { $in: req.body.studentIds } },
        { $addToSet: { batches: batch._id } },
      );
    }

    await batch.save();

    const updatedBatch = await Batch.findById(batch._id)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone totalFee paidAmount dueAmount status courseType",
      );

    res.json({
      success: true,
      message: "Batch updated successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Add students to batch
router.post("/:id/add-students", async (req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || studentIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Please select at least one student" });
    }

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only add students to your own batches",
      });
    }

    if (batch.students.length + studentIds.length > batch.maxStudents) {
      return res.status(400).json({
        message: `Batch is full. Max capacity: ${batch.maxStudents}, Current: ${batch.students.length}`,
      });
    }

    let validStudentIds = studentIds;
    if (req.user.role === "teacher") {
      const teacherStudents = await Student.find({
        teacher: req.user._id,
      }).select("_id");
      const teacherStudentIds = teacherStudents.map((s) => s._id.toString());

      validStudentIds = studentIds.filter((id) =>
        teacherStudentIds.includes(id.toString()),
      );

      if (validStudentIds.length === 0) {
        return res.status(400).json({
          message: "None of the selected students are assigned to you",
        });
      }
    }

    const addedStudents = [];
    validStudentIds.forEach((id) => {
      if (!batch.students.includes(id)) {
        batch.students.push(id);
        addedStudents.push(id);
      }
    });

    await batch.save();

    if (addedStudents.length > 0) {
      await Student.updateMany(
        { _id: { $in: addedStudents } },
        { $addToSet: { batches: batch._id } },
      );
    }

    const updatedBatch = await Batch.findById(batch._id)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone totalFee paidAmount dueAmount status",
      );

    res.json({
      success: true,
      message: `Added ${addedStudents.length} students to batch`,
      batch: updatedBatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Remove student from batch
router.delete("/:batchId/students/:studentId", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only remove students from your own batches",
      });
    }

    batch.students = batch.students.filter(
      (id) => id.toString() !== req.params.studentId,
    );
    await batch.save();

    await Student.findByIdAndUpdate(req.params.studentId, {
      $pull: { batches: batch._id },
    });

    const updatedBatch = await Batch.findById(batch._id)
      .populate("createdBy", "name email role")
      .populate("students", "name fatherName email phone");

    res.json({
      success: true,
      message: "Student removed from batch",
      batch: updatedBatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE: Delete a batch
router.delete("/:id", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only delete your own batches" });
    }

    await Student.updateMany(
      { batches: batch._id },
      { $pull: { batches: batch._id } },
    );

    await batch.deleteOne();
    res.json({
      success: true,
      message: "Batch deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Add topic to batch
router.post("/:id/topics", async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (batch.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "You can only add topics to your own batches" });
    }

    const { topic, date } = req.body;
    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    batch.topics.push({
      topic,
      date: date || new Date().toISOString().split("T")[0],
    });

    await batch.save();

    const updatedBatch = await Batch.findById(batch._id)
      .populate("createdBy", "name email")
      .populate("students", "name rollNumber");

    res.json({
      success: true,
      message: "Topic added successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
