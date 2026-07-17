// routes/placement.js
const express = require('express');
const router = express.Router();
const Placement = require('../models/Placement');
const PlacementApplication = require('../models/PlacementApplication');
const { protect, adminOnly } = require('../middleware/auth');
const { addToSheet } = require('../utils/googleSheets');

// ✅ TEST ROUTE - Add this at the very top
router.get('/test', (req, res) => {
  console.log('✅ Placement test route hit!');
  res.json({ 
    success: true, 
    message: 'Placement routes are working!',
    timestamp: new Date().toISOString(),
    routes: {
      test: 'GET /api/placement/test',
      create: 'POST /api/placement/create (admin)',
      all: 'GET /api/placement/all (admin)',
      public: 'GET /api/placement/public/:formLink',
      submit: 'POST /api/placement/public/submit'
    }
  });
});

// ============ ADMIN ROUTES ============

// Create a new placement form (Admin only)
router.post('/create', protect, adminOnly, async (req, res) => {
  try {
    const { 
      formTitle, 
      description, 
      companyName, 
      jobRole, 
      jobLocation,
      salaryPackage,
      eligibilityCriteria,
      expiryDate 
    } = req.body;

    // Validate required fields
    if (!formTitle || !companyName || !jobRole) {
      return res.status(400).json({ 
        message: 'Form title, company name, and job role are required' 
      });
    }

    // Generate unique form link
    const shortid = require('shortid');
    const formLink = `placement/${shortid.generate()}`;

    const placement = new Placement({
      formTitle,
      description,
      companyName,
      jobRole,
      jobLocation,
      salaryPackage,
      eligibilityCriteria,
      createdBy: req.user.id,
      formLink,
      expiryDate: expiryDate || null
    });

    await placement.save();

    // Create shareable link
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const shareableLink = `${baseUrl}/api/placement/public/${placement.formLink}`;

    res.status(201).json({
      success: true,
      message: 'Placement form created successfully',
      placement,
      shareableLink
    });
  } catch (error) {
    console.error('Error creating placement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all placements (Admin)
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const placements = await Placement.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Get application count for each placement
    const placementsWithCount = await Promise.all(placements.map(async (placement) => {
      const applicationCount = await PlacementApplication.countDocuments({
        placementForm: placement._id
      });
      return {
        ...placement.toObject(),
        applicationCount
      };
    }));

    res.json(placementsWithCount);
  } catch (error) {
    console.error('Error fetching placements:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific placement (Admin)
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    res.json(placement);
  } catch (error) {
    console.error('Error fetching placement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update placement (Admin)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { 
      formTitle, 
      description, 
      companyName, 
      jobRole,
      jobLocation,
      salaryPackage,
      eligibilityCriteria,
      expiryDate,
      isActive 
    } = req.body;

    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    // Update fields
    if (formTitle) placement.formTitle = formTitle;
    if (description) placement.description = description;
    if (companyName) placement.companyName = companyName;
    if (jobRole) placement.jobRole = jobRole;
    if (jobLocation) placement.jobLocation = jobLocation;
    if (salaryPackage) placement.salaryPackage = salaryPackage;
    if (eligibilityCriteria) placement.eligibilityCriteria = eligibilityCriteria;
    if (expiryDate) placement.expiryDate = expiryDate;
    if (isActive !== undefined) placement.isActive = isActive;

    await placement.save();

    res.json({
      success: true,
      message: 'Placement updated successfully',
      placement
    });
  } catch (error) {
    console.error('Error updating placement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete placement (Admin)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    // Delete all associated applications
    await PlacementApplication.deleteMany({ placementForm: req.params.id });
    await placement.deleteOne();

    res.json({
      success: true,
      message: 'Placement and all applications deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting placement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all applications for a placement (Admin)
router.get('/applications/:placementId', protect, adminOnly, async (req, res) => {
  try {
    const { placementId } = req.params;
    
    const placement = await Placement.findById(placementId);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    const applications = await PlacementApplication.find({
      placementForm: placementId
    }).sort({ appliedAt: -1 });

    res.json({
      placement: placement.formTitle,
      totalApplications: applications.length,
      applications
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update application status (Admin)
router.put('/applications/:applicationId/status', protect, adminOnly, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, comments } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const application = await PlacementApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    if (comments) application.comments = comments;
    await application.save();

    res.json({
      success: true,
      message: 'Application status updated successfully',
      application
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ PUBLIC ROUTES ============

// Get placement form by link (Public)
router.get('/public/:formLink', async (req, res) => {
  try {
    const { formLink } = req.params;
    
    const placement = await Placement.findOne({ 
      formLink: `placement/${formLink}`,
      isActive: true 
    });

    if (!placement) {
      return res.status(404).json({ 
        message: 'Placement form not found or inactive' 
      });
    }

    // Check if expired
    if (placement.expiryDate && new Date(placement.expiryDate) < new Date()) {
      return res.status(400).json({ 
        message: 'This placement form has expired' 
      });
    }

    // Return only necessary data for the form
    res.json({
      placementId: placement._id,
      formTitle: placement.formTitle,
      description: placement.description,
      companyName: placement.companyName,
      jobRole: placement.jobRole,
      jobLocation: placement.jobLocation,
      salaryPackage: placement.salaryPackage,
      eligibilityCriteria: placement.eligibilityCriteria,
      expiryDate: placement.expiryDate
    });
  } catch (error) {
    console.error('Error fetching public placement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit application to placement (Public)
router.post('/public/submit', async (req, res) => {
  try {
    const {
      placementId,
      studentName,
      studentEmail,
      studentPhone,
      studentId,
      branch,
      year,
      semester,
      cgpa,
      skills,
      experience,
      resumeLink,
      additionalInfo
    } = req.body;

    // Validate required fields
    if (!placementId || !studentName || !studentEmail || !studentPhone || 
        !studentId || !branch || !year || !semester || cgpa === undefined) {
      return res.status(400).json({ 
        message: 'All required fields must be filled' 
      });
    }

    // Check if placement exists and is active
    const placement = await Placement.findById(placementId);
    if (!placement || !placement.isActive) {
      return res.status(404).json({ message: 'Placement form not available' });
    }

    // Check if student already applied
    const existingApplication = await PlacementApplication.findOne({
      placementForm: placementId,
      studentEmail: studentEmail.toLowerCase()
    });

    if (existingApplication) {
      return res.status(400).json({ 
        message: 'You have already applied for this placement' 
      });
    }

    // Create application
    const application = new PlacementApplication({
      placementForm: placementId,
      studentName,
      studentEmail: studentEmail.toLowerCase(),
      studentPhone,
      studentId,
      branch,
      year,
      semester,
      cgpa,
      skills: skills || [],
      experience: experience || '',
      resumeLink: resumeLink || '',
      additionalInfo: additionalInfo || ''
    });

    await application.save();

    // Add to Google Sheet
    await addToSheet(application, placement.formTitle);

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      applicationId: application._id
    });
  } catch (error) {
    console.error('Error submitting application:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;