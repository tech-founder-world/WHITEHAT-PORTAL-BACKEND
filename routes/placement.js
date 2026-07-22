const express = require('express');
const router = express.Router();
const Placement = require('../models/Placement');
const PlacementApplication = require('../models/PlacementApplication');
const { protect, adminOnly } = require('../middleware/auth');

// ============ ADMIN ROUTES ============

// GET: All placements
router.get('/all', protect, async (req, res) => {
  try {
    const placements = await Placement.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
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

// GET: Single placement with applications
router.get('/:id', protect, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    const applications = await PlacementApplication.find({
      placementForm: placement._id
    }).sort({ appliedAt: -1 });

    res.json({
      placement,
      applications
    });
  } catch (error) {
    console.error('Error fetching placement:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST: Create placement
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

    if (!formTitle) {
      return res.status(400).json({ message: 'Form title is required' });
    }

    const shortid = require('shortid');
    const formLink = `placement/${shortid.generate()}`;

    const placement = new Placement({
      formTitle,
      description,
      companyName: companyName || '',
      jobRole: jobRole || '',
      jobLocation: jobLocation || '',
      salaryPackage: salaryPackage || '',
      eligibilityCriteria: eligibilityCriteria || '',
      createdBy: req.user.id,
      formLink,
      expiryDate: expiryDate || null
    });

    await placement.save();

    const baseUrl = process.env.BASE_URL || 'http://localhost:5174';
    const shareableLink = `${baseUrl}/apply/${placement.formLink}`;

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

// PUT: Update placement
router.put('/update/:id', protect, adminOnly, async (req, res) => {
  try {
    const { 
      formTitle, 
      companyName, 
      jobRole, 
      jobLocation, 
      salaryPackage, 
      eligibilityCriteria, 
      expiryDate, 
      description 
    } = req.body;

    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

    placement.formTitle = formTitle;
    placement.companyName = companyName;
    placement.jobRole = jobRole;
    placement.jobLocation = jobLocation || '';
    placement.salaryPackage = salaryPackage || '';
    placement.eligibilityCriteria = eligibilityCriteria || '';
    placement.expiryDate = expiryDate || null;
    placement.description = description || '';

    await placement.save();

    res.json({
      success: true,
      message: 'Placement updated successfully',
      placement
    });
  } catch (error) {
    console.error('Error updating placement:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT: Toggle placement active/inactive
router.put('/:id/toggle', protect, adminOnly, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }
    
    placement.isActive = !placement.isActive;
    await placement.save();

    res.json({
      success: true,
      message: `Placement ${placement.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: placement.isActive
    });
  } catch (error) {
    console.error('Error toggling placement status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE: Delete placement
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const placement = await Placement.findById(req.params.id);
    if (!placement) {
      return res.status(404).json({ message: 'Placement not found' });
    }

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

// ============ PUBLIC ROUTES ============

// GET: Public placement form
router.get('/public/:formLink', async (req, res) => {
  try {
    const { formLink } = req.params;
    
    const placement = await Placement.findOne({ 
      formLink: `placement/${formLink}`,
      isActive: true 
    });

    if (!placement) {
      return res.status(404).json({ message: 'Placement form not found or inactive' });
    }

    if (placement.expiryDate && new Date(placement.expiryDate) < new Date()) {
      return res.status(400).json({ message: 'This placement form has expired' });
    }

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

// POST: Submit application (Student fills basic details)
router.post('/public/submit', async (req, res) => {
  try {
    const {
      placementId,
      studentName,
      studentEmail,
      studentPhone,
      fatherName,
      courseType,
      courseTiming,
      resumeLink
    } = req.body;

    // Validate required fields
    if (!placementId || !studentName || !studentEmail || !studentPhone) {
      return res.status(400).json({ 
        message: 'Name, Email, and Phone are required' 
      });
    }

    const placement = await Placement.findById(placementId);
    if (!placement || !placement.isActive) {
      return res.status(404).json({ message: 'Placement form not available' });
    }

    // Check if already applied
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
      fatherName: fatherName || '',
      courseType: courseType || 'Silver',
      courseTiming: courseTiming || '',
      resumeLink: resumeLink || '',
      status: 'pending'
    });

    await application.save();

    // Add to placement's applications array
    placement.applications.push(application._id);
    await placement.save();

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

// ============ COUNSELOR ROUTES ============

// GET: All applications (for counselor tracker)
router.get('/applications/all', protect, async (req, res) => {
  try {
    const applications = await PlacementApplication.find()
      .populate('placementForm', 'formTitle companyName')
      .sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Error fetching all applications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET: Single application with interview logs
router.get('/applications/:id', protect, async (req, res) => {
  try {
    const application = await PlacementApplication.findById(req.params.id)
      .populate('placementForm', 'formTitle companyName')
      .populate('interviewLogs.updatedBy', 'name email');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Update application (Counselor inline update)
router.put('/applications/:applicationId/counsellor-update', protect, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { 
      branch,
      courseType, 
      totalFees, 
      feesPaid, 
      joinedDate, 
      endedDate, 
      totalInterviewsGiven,
      totalInterviewsRejected
    } = req.body;

    const application = await PlacementApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Student application not found' });
    }

    // Update fields
    if (branch !== undefined) application.branch = branch;
    if (courseType !== undefined) application.courseType = courseType;
    if (joinedDate !== undefined) application.joinedDate = joinedDate ? new Date(joinedDate) : null;
    if (endedDate !== undefined) application.endedDate = endedDate ? new Date(endedDate) : null;

    // Update Fees
    if (totalFees !== undefined) application.totalFees = Number(totalFees);
    if (feesPaid !== undefined) application.feesPaid = Number(feesPaid);
    application.feesPending = application.totalFees - application.feesPaid;
    application.dueClear = application.feesPending <= 0;

    // Update Interview Stats
    if (totalInterviewsGiven !== undefined) application.totalInterviewsGiven = Number(totalInterviewsGiven);
    if (totalInterviewsRejected !== undefined) application.totalInterviewsRejected = Number(totalInterviewsRejected);
    
    // Auto-calculate Selected
    application.totalInterviewsSelected = application.totalInterviewsGiven - application.totalInterviewsRejected;

    await application.save();

    res.json({
      success: true,
      message: 'Student updated successfully',
      application
    });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST: Add interview log
router.post('/applications/:applicationId/interview', protect, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }

    const application = await PlacementApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Add interview log
    application.interviewLogs.push({
      date: new Date(),
      status: status,
      notes: notes || '',
      updatedBy: req.user._id
    });

    // Update main status
    application.status = status;

    // Update interview counts based on status
    if (status === 'shortlisted') {
      application.totalInterviewsShortlisted += 1;
    } else if (status === 'selected') {
      application.totalInterviewsSelected += 1;
    } else if (status === 'rejected') {
      application.totalInterviewsRejected += 1;
    }
    application.totalInterviewsGiven = application.interviewLogs.length;

    await application.save();

    res.json({
      success: true,
      message: 'Interview logged successfully',
      application
    });
  } catch (error) {
    console.error('Error logging interview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET: Applications for a specific placement
router.get('/applications/placement/:placementId', protect, async (req, res) => {
  try {
    const { placementId } = req.params;
    
    const applications = await PlacementApplication.find({
      placementForm: placementId
    }).sort({ appliedAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;