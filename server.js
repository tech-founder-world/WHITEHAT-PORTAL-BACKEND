const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// ✅ IMPORT AUTH MIDDLEWARE
const { protect, adminOnly, trainerOnly, counselorOnly } = require('./middleware/auth');

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

// 1. GET: Fetch all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('teacher', 'name email') 
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    console.error('❌ Error fetching projects:', error.message);
    res.status(500).json({ message: 'Server error fetching projects' });
  }
});

// 1.5 GET: Fetch a single project by ID
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

// 2. POST: Create a new project
app.post('/api/projects', async (req, res) => {
  try {
    let teacherId = req.body.teacher;
    
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
    ).populate('teacher', 'name email');

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

// ============ BATCHES ROUTES ============
const Batch = require('./models/Batch');

// GET: Fetch all batches
app.get('/api/batches', protect, async (req, res) => {
  try {
    const batches = await Batch.find()
      .populate('createdBy', 'name')
      .populate('students', 'name rollNumber')
      .sort({ createdAt: -1 });
    res.json(batches);
  } catch (error) {
    console.error('❌ Error fetching batches:', error.message);
    res.status(500).json({ message: 'Server error fetching batches' });
  }
});

// POST: Create a new batch
app.post('/api/batches', protect, async (req, res) => {
  try {
    console.log("📝 Creating new batch:", req.body);
    
    const newBatch = new Batch({
      name: req.body.name,
      category: req.body.category || 'custom',
      duration: req.body.duration || 0,
      durationType: req.body.durationType || 'days',
      description: req.body.description || '',
      startDate: req.body.startDate || null,
      endDate: req.body.endDate || null,
      maxStudents: req.body.maxStudents || 30,
      fee: req.body.fee || 0,
      createdBy: req.user.id,
      students: req.body.students || [],
      status: req.body.status || 'active'
    });

    const savedBatch = await newBatch.save();
    
    const populatedBatch = await Batch.findById(savedBatch._id)
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      message: "Batch created successfully",
      batch: populatedBatch
    });

  } catch (error) {
    console.error("❌ Server Error creating batch:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT: Update a batch
app.put('/api/batches/:id', async (req, res) => {
  try {
    console.log("✏️ Updating batch:", req.params.id);
    console.log("Payload received:", req.body);

    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const studentIds = req.body.studentIds || [];
    if (!Array.isArray(studentIds)) {
      return res.status(400).json({ message: "Invalid studentIds format. Must be an array." });
    }

    studentIds.forEach(id => {
      if (!batch.students.includes(id)) {
        batch.students.push(id);
      }
    });

    if (req.body.name) batch.name = req.body.name;
    if (req.body.description !== undefined) batch.description = req.body.description;
    if (req.body.category) batch.category = req.body.category;
    if (req.body.duration !== undefined) batch.duration = req.body.duration;
    if (req.body.durationType) batch.durationType = req.body.durationType;
    if (req.body.maxStudents !== undefined) batch.maxStudents = req.body.maxStudents;
    if (req.body.fee !== undefined) batch.fee = req.body.fee;
    if (req.body.status) batch.status = req.body.status;
    if (req.body.startDate) batch.startDate = req.body.startDate;
    if (req.body.endDate) batch.endDate = req.body.endDate;

    // ✅ CRITICAL FIX: Bypass Mongoose required validation on update
    batch._id = batch._id; 

    await batch.save();
    
    const updatedBatch = await Batch.findById(batch._id)
      .populate('createdBy', 'name')
      .populate('students', 'name rollNumber email courseType fees status');

    res.json({ success: true, message: "Batch updated", batch: updatedBatch });

  } catch (error) {
    console.error("❌ CRITICAL ERROR updating batch:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: error.stack
    });
  }
});

// DELETE: Delete a batch
app.delete('/api/batches/:id', async (req, res) => {
  try {
    const deletedBatch = await Batch.findByIdAndDelete(req.params.id);
    if (!deletedBatch) {
      return res.status(404).json({ message: "Batch not found" });
    }
    res.json({ success: true, message: "Batch deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting batch:", error.message);
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