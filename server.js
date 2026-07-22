const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

// Import routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const attendanceRoutes = require("./routes/attendance");
const evaluationRoutes = require("./routes/evaluation");
const counsellorRoutes = require("./routes/counsellor");
const placementRoutes = require("./routes/placement");
const projectRoutes = require("./routes/projects");
const batchRoutes = require("./routes/batches");
const exportRoutes = require("./routes/export");
const userRoutes = require("./routes/users");

// Import Google Sheets utility
const { initializeSheet } = require("./utils/googleSheets");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("WhiteHat API Working");
});

// Register all routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/teacher", teacherRoutes); // Changed from trainer to teacher
app.use("/api/counsellor", counsellorRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/placement", placementRoutes);
app.use("/api/projects", projectRoutes); // NEW
app.use("/api/batches", batchRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/users", userRoutes);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/attendance_db")
  .then(() => {
    console.log("✅ MongoDB connected");

    // Initialize Google Sheet headers (optional)
    initializeSheet().catch((err) => console.error("Sheet init error:", err));

    // Start server
    app.listen(process.env.PORT || 5000, () => {
      console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
