const express = require("express");
const router = express.Router();
const Batch = require("../models/Batch");
const Student = require("../models/Student");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET: Fetch all batches
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      // Teachers see batches they created
      filter.createdBy = req.user._id;
    } else if (req.user.role === "counsellor") {
      // Counsellors see all batches (read-only)
      // No filter - they can see all batches
    }
    // Admin sees all batches (no filter)

    const batches = await Batch.find(filter)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone subjects totalFee paidAmount dueAmount status",
      )
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    console.error("❌ Error fetching batches:", error.message);
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
        "name fatherName email phone subjects totalFee paidAmount dueAmount status",
      );

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check if user has access to this batch
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
    console.error("❌ Error fetching batch:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST: Create a new batch
router.post("/", async (req, res) => {
  try {
    // Only teachers and admins can create batches
    if (req.user.role !== "teacher" && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only teachers and admins can create batches" });
    }

    console.log("📝 Creating new batch:", req.body);

    const newBatch = new Batch({
      name: req.body.name,
      description: req.body.description || "",
      timing: req.body.timing || "",
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      maxStudents: req.body.maxStudents || 30,
      fee: req.body.fee || 0,
      createdBy: req.user._id,
      students: req.body.students || [],
      status: req.body.status || "active",
      topics: req.body.topics || [],
    });

    const savedBatch = await newBatch.save();

    // Update students with batch reference
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
    console.error("❌ Server Error creating batch:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Update a batch
router.put("/:id", async (req, res) => {
  try {
    console.log("✏️ Updating batch:", req.params.id);

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    // Check permissions
    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only edit your own batches" });
    }

    // Update fields
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

    // Handle topics
    if (req.body.topics && Array.isArray(req.body.topics)) {
      batch.topics = req.body.topics;
    }

    // Handle students - Teachers can add students to their batches
    if (req.body.studentIds && Array.isArray(req.body.studentIds)) {
      // Teacher can add students that are assigned to them
      if (req.user.role === "teacher") {
        // Get students assigned to this teacher
        const teacherStudents = await Student.find({
          teacher: req.user._id,
        }).select("_id");
        const teacherStudentIds = teacherStudents.map((s) => s._id.toString());

        // Filter only students assigned to this teacher
        const validStudentIds = req.body.studentIds.filter((id) =>
          teacherStudentIds.includes(id.toString()),
        );

        // Add valid students to batch
        validStudentIds.forEach((id) => {
          if (!batch.students.includes(id)) {
            batch.students.push(id);
          }
        });

        // Update students with batch reference
        await Student.updateMany(
          { _id: { $in: validStudentIds } },
          { $addToSet: { batches: batch._id } },
        );
      } else if (req.user.role === "admin") {
        // Admin can add any student
        req.body.studentIds.forEach((id) => {
          if (!batch.students.includes(id)) {
            batch.students.push(id);
          }
        });

        // Update students with batch reference
        await Student.updateMany(
          { _id: { $in: req.body.studentIds } },
          { $addToSet: { batches: batch._id } },
        );
      }
    }

    await batch.save();

    const updatedBatch = await Batch.findById(batch._id)
      .populate("createdBy", "name email role")
      .populate(
        "students",
        "name fatherName email phone totalFee paidAmount dueAmount status",
      );

    res.json({
      success: true,
      message: "Batch updated successfully",
      batch: updatedBatch,
    });
  } catch (error) {
    console.error("❌ Error updating batch:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST: Add students to batch (Teacher route)
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

    // Check if teacher owns this batch
    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only add students to your own batches",
      });
    }

    // Check if batch is full
    if (batch.students.length + studentIds.length > batch.maxStudents) {
      return res.status(400).json({
        message: `Batch is full. Max capacity: ${batch.maxStudents}, Current: ${batch.students.length}`,
      });
    }

    // If teacher, verify students are assigned to them
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

      const invalidCount = studentIds.length - validStudentIds.length;
      if (invalidCount > 0) {
        console.log(
          `⚠️ Skipping ${invalidCount} students not assigned to this teacher`,
        );
      }
    }

    // Add students to batch (avoid duplicates)
    const addedStudents = [];
    validStudentIds.forEach((id) => {
      if (!batch.students.includes(id)) {
        batch.students.push(id);
        addedStudents.push(id);
      }
    });

    await batch.save();

    // Update students with batch reference
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
    console.error("❌ Error adding students to batch:", error.message);
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

    // Check permissions
    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({
          message: "You can only remove students from your own batches",
        });
    }

    // Remove student from batch
    batch.students = batch.students.filter(
      (id) => id.toString() !== req.params.studentId,
    );
    await batch.save();

    // Remove batch from student
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
    console.error("❌ Error removing student from batch:", error.message);
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

    // Check permissions
    if (
      req.user.role === "teacher" &&
      batch.createdBy.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only delete your own batches" });
    }

    // Remove batch reference from students
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
    console.error("❌ Error deleting batch:", error.message);
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

    // Only teacher who created the batch can add topics
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
    console.error("❌ Error adding topic:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
