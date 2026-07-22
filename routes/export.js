const express = require("express");
const router = express.Router();
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Batch = require("../models/Batch");
const { protect } = require("../middleware/auth");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

router.use(protect);

// GET /api/export/student/:id - Export single student data as CSV
router.get("/student/:id/csv", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email")
      .populate("batches", "name timing startDate endDate status");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get attendance records
    const attendance = await Attendance.find({ student: student._id }).sort({
      date: -1,
    });

    // Calculate attendance stats
    const totalDays = attendance.length;
    const presentDays = attendance.filter((a) => a.status === "present").length;
    const attendancePercentage =
      totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0.0";

    // Create CSV
    const headers = [
      "Name",
      "Father's Name",
      "Email",
      "Phone",
      "Subjects",
      "Total Fee",
      "Paid Amount",
      "Due Amount",
      "Added By",
      "Added By Role",
      "Counsellor",
      "Teacher",
      "Batches",
      "Total Attendance Days",
      "Present Days",
      "Attendance Percentage",
    ];

    const batches = student.batches.map((b) => b.name).join("; ");

    const row = [
      `"${student.name}"`,
      `"${student.fatherName || ""}"`,
      `"${student.email}"`,
      `"${student.phone}"`,
      `"${student.subjects.join("; ")}"`,
      student.totalFee || 0,
      student.paidAmount || 0,
      student.dueAmount || 0,
      `"${student.addedBy?.name || "Unknown"}"`,
      `"${student.addedBy?.role || "N/A"}"`,
      `"${student.counsellor?.name || "Not Assigned"}"`,
      `"${student.teacher?.name || "Not Assigned"}"`,
      `"${batches}"`,
      totalDays,
      presentDays,
      `${attendancePercentage}%`,
    ];

    const csvContent = [headers, row].map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${student.name}_data.csv"`,
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Error exporting student CSV:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/export/student/:id/pdf - Export single student data as PDF
router.get("/student/:id/pdf", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email")
      .populate("batches", "name timing startDate endDate status");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Get attendance records
    const attendance = await Attendance.find({ student: student._id }).sort({
      date: -1,
    });

    const totalDays = attendance.length;
    const presentDays = attendance.filter((a) => a.status === "present").length;
    const attendancePercentage =
      totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0.0";

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${student.name}_data.pdf"`,
    );

    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Student Report", { align: "center" });
    doc.moveDown();

    // Student Info
    doc.fontSize(14).font("Helvetica-Bold").text("Personal Information");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Name: ${student.name}`);
    doc.text(`Father's Name: ${student.fatherName || "N/A"}`);
    doc.text(`Email: ${student.email}`);
    doc.text(`Phone: ${student.phone}`);
    doc.moveDown();

    // Academic Info
    doc.fontSize(14).font("Helvetica-Bold").text("Academic Information");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Subjects: ${student.subjects.join(", ") || "None"}`);
    doc.text(
      `Added By: ${student.addedBy?.name || "Unknown"} (${student.addedBy?.role || "N/A"})`,
    );
    doc.text(`Counsellor: ${student.counsellor?.name || "Not Assigned"}`);
    doc.text(`Teacher: ${student.teacher?.name || "Not Assigned"}`);
    doc.moveDown();

    // Fee Information
    doc.fontSize(14).font("Helvetica-Bold").text("Fee Information");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Total Fee: ₹${student.totalFee || 0}`);
    doc.text(`Paid Amount: ₹${student.paidAmount || 0}`);
    doc.text(`Due Amount: ₹${student.dueAmount || 0}`);
    doc.moveDown();

    // Batches
    doc.fontSize(14).font("Helvetica-Bold").text("Batches");
    doc.fontSize(11).font("Helvetica");
    if (student.batches.length > 0) {
      student.batches.forEach((b) => {
        doc.text(`• ${b.name} (${b.timing || "No timing"})`);
        doc.text(
          `  ${b.startDate ? new Date(b.startDate).toLocaleDateString() : "N/A"} - ${b.endDate ? new Date(b.endDate).toLocaleDateString() : "Ongoing"}`,
          { indent: 10 },
        );
      });
    } else {
      doc.text("No batches assigned");
    }
    doc.moveDown();

    // Attendance
    doc.fontSize(14).font("Helvetica-Bold").text("Attendance Summary");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Total Days: ${totalDays}`);
    doc.text(`Present Days: ${presentDays}`);
    doc.text(`Attendance Percentage: ${attendancePercentage}%`);
    doc.moveDown();

    if (attendance.length > 0) {
      doc.fontSize(12).font("Helvetica-Bold").text("Attendance Records");
      doc.fontSize(9).font("Helvetica");

      // Table headers
      const tableTop = doc.y;
      doc.text("Date", 50, tableTop);
      doc.text("Subject", 150, tableTop);
      doc.text("Status", 250, tableTop);
      doc.text("Marked By", 350, tableTop);

      doc.moveDown();

      attendance.slice(0, 20).forEach((a, i) => {
        const y = doc.y;
        doc.text(a.date || "N/A", 50, y);
        doc.text(a.subject || "N/A", 150, y);
        doc.text(a.status || "N/A", 250, y);
        doc.text(a.markedBy?.name || "Unknown", 350, y);
        doc.moveDown();
      });

      if (attendance.length > 20) {
        doc.text(`... and ${attendance.length - 20} more records`);
      }
    }

    doc.end();
  } catch (err) {
    console.error("Error exporting student PDF:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/export/all-students/csv - Export all students as CSV
router.get("/all-students/csv", async (req, res) => {
  try {
    let filter = {};

    // If teacher, only show their students
    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    } else if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter._id = { $in: assignedIds };
    }

    const students = await Student.find(filter)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email")
      .populate("batches", "name");

    // Get attendance for all students
    const studentIds = students.map((s) => s._id);
    const attendanceRecords = await Attendance.find({
      student: { $in: studentIds },
    });

    // Create CSV
    const headers = [
      "Name",
      "Father's Name",
      "Email",
      "Phone",
      "Subjects",
      "Total Fee",
      "Paid Amount",
      "Due Amount",
      "Added By",
      "Added By Role",
      "Counsellor",
      "Teacher",
      "Batches",
      "Total Attendance Days",
      "Present Days",
      "Attendance Percentage",
    ];

    const rows = students.map((student) => {
      const studentAttendance = attendanceRecords.filter(
        (a) => a.student.toString() === student._id.toString(),
      );
      const totalDays = studentAttendance.length;
      const presentDays = studentAttendance.filter(
        (a) => a.status === "present",
      ).length;
      const percentage =
        totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : "0.0";
      const batches = student.batches.map((b) => b.name).join("; ");

      return [
        `"${student.name}"`,
        `"${student.fatherName || ""}"`,
        `"${student.email}"`,
        `"${student.phone}"`,
        `"${student.subjects.join("; ")}"`,
        student.totalFee || 0,
        student.paidAmount || 0,
        student.dueAmount || 0,
        `"${student.addedBy?.name || "Unknown"}"`,
        `"${student.addedBy?.role || "N/A"}"`,
        `"${student.counsellor?.name || "Not Assigned"}"`,
        `"${student.teacher?.name || "Not Assigned"}"`,
        `"${batches}"`,
        totalDays,
        presentDays,
        `${percentage}%`,
      ];
    });

    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="all_students_data.csv"`,
    );
    res.send(csvContent);
  } catch (err) {
    console.error("Error exporting all students CSV:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/export/all-students/pdf - Export all students as PDF
router.get("/all-students/pdf", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    } else if (req.user.role === "counsellor") {
      const counsellor = await User.findById(req.user._id).populate("students");
      const assignedIds = counsellor.students.map((s) => s._id);
      filter._id = { $in: assignedIds };
    }

    const students = await Student.find(filter)
      .populate("addedBy", "name email role")
      .populate("counsellor", "name email")
      .populate("teacher", "name email")
      .populate("batches", "name");

    const doc = new PDFDocument({ margin: 30, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="all_students_report.pdf"`,
    );

    doc.pipe(res);

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("All Students Report", { align: "center" });
    doc
      .fontSize(10)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown();

    students.forEach((student, index) => {
      if (index > 0) {
        doc.addPage();
      }

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Student #${index + 1}: ${student.name}`);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Father's Name: ${student.fatherName || "N/A"}`);
      doc.text(`Email: ${student.email}`);
      doc.text(`Phone: ${student.phone}`);
      doc.text(`Subjects: ${student.subjects.join(", ") || "None"}`);
      doc.text(`Teacher: ${student.teacher?.name || "Not Assigned"}`);
      doc.text(`Counsellor: ${student.counsellor?.name || "Not Assigned"}`);
      doc.text(`Total Fee: ₹${student.totalFee || 0}`);
      doc.text(`Paid Amount: ₹${student.paidAmount || 0}`);
      doc.text(`Due Amount: ₹${student.dueAmount || 0}`);
      doc.text(
        `Batches: ${student.batches.map((b) => b.name).join(", ") || "None"}`,
      );
      doc.moveDown();
      doc.text("─".repeat(50));
    });

    doc.end();
  } catch (err) {
    console.error("Error exporting all students PDF:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
