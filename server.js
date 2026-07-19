const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const trainerRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const attendanceRoutes = require('./routes/attendance');
const evaluationRoutes = require('./routes/evaluation');
const counsellorRoutes = require('./routes/counsellor'); // ✅ Fixed spelling
const placementRoutes = require('./routes/placement');

// Import Google Sheets utility
const { initializeSheet } = require('./utils/googleSheets');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  console.log("Root route hit");
  res.send("WhiteHat API Working");
});

// Register all routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trainer', trainerRoutes);
app.use('/api/counsellor', counsellorRoutes); // ✅ Fixed spelling
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/placement', placementRoutes);

// ============ PROJECTS ROUTES ============
const Project = require('./models/Project'); 

// 1. GET: Fetch all projects (Populates the teacher's name!)
app.get('/api/projects', async (req, res) => {
  try {
    // ✅ The key fix: .populate('teacher', 'name')
    const projects = await Project.find()
      .populate('teacher', 'name email') 
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

// 1.5 GET: Fetch a single project by ID (For Evaluations page)
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teacher', 'name email')
      .populate('students', 'name rollNumber');
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json(project);
  } catch (error) {
    console.error('❌ Error fetching project by ID:', error.message);
    res.status(500).json({ message: 'Server error fetching project' });
  }
});

// 2. POST: Create a new project (Rejects Invalid IDs!)
app.post('/api/projects', async (req, res) => {
  try {
    let teacherId = req.body.teacher;
    
    // 🛑 BLOCK: If the ID is invalid (not 24 hex chars), reject it immediately!
    if (teacherId && !mongoose.Types.ObjectId.isValid(teacherId)) {
       return res.status(400).json({ 
         success: false, 
         message: "Invalid Teacher ID. Please select a valid teacher from the dropdown." 
       });
    }

    const newProject = new Project({
      name: req.body.name,
      description: req.body.description || '',
      teacher: teacherId,
      students: req.body.students || [],
      subject: req.body.subject,
      startDate: req.body.startDate || '',
      endDate: req.body.endDate || '',
      status: req.body.status || 'active',
      maxScore: req.body.maxScore || 100
    });

    const savedProject = await newProject.save();
    
    // ✅ Return the project with the teacher name populated immediately
    const populatedProject = await Project.findById(savedProject._id)
      .populate('teacher', 'name email');

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      project: populatedProject
    });

  } catch (error) {
    console.error("❌ Server Error creating project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. PUT: Update an existing project
app.put('/api/projects/:id', async (req, res) => {
  try {
    let teacherId = req.body.teacher;
    if (teacherId && !mongoose.Types.ObjectId.isValid(teacherId)) {
       return res.status(400).json({ success: false, message: "Invalid Teacher ID." });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      {
        name: req.body.name,
        description: req.body.description || '',
        teacher: teacherId,
        students: req.body.students || [],
        subject: req.body.subject,
        startDate: req.body.startDate || '',
        endDate: req.body.endDate || '',
        status: req.body.status || 'active',
        maxScore: req.body.maxScore || 100
      },
      { new: true, runValidators: true }
    ).populate('teacher', 'name email'); // Populate on update too

    if (!updatedProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json({ success: true, message: "Project updated successfully", project: updatedProject });

  } catch (error) {
    console.error("❌ Error updating project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. DELETE: Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const deletedProject = await Project.findByIdAndDelete(req.params.id);
    if (!deletedProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting project:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 5. POST: Add students to an existing project
app.post('/api/projects/:id/students', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const newStudents = req.body.studentIds || [];
    newStudents.forEach(id => {
      if (!project.students.includes(id)) {
        project.students.push(id);
      }
    });

    await project.save();
    res.json({ success: true, message: "Students added successfully", project });

  } catch (error) {
    console.error("❌ Error adding students:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// MongoDB Connection - SINGLE CONNECTION
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_db')
  .then(() => {
    console.log('✅ MongoDB connected');
    
    // Initialize Google Sheet headers (optional)
    initializeSheet().catch(err => console.error('Sheet init error:', err));
    
    // Start server
    app.listen(process.env.PORT || 5000, () => {
      console.log(`✅ Server running on port ${process.env.PORT || 5000}`);
      console.log(`📋 Test the placement route: http://localhost:${process.env.PORT || 5000}/api/placement/test`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });