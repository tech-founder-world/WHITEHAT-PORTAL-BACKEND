const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/evaluations?subject=&date=&studentId=
router.get('/', async (req, res) => {
  try {
    const { subject, date, studentId } = req.query;
    const filter = {};
    if (date) filter.date = date;

    // Subject scoping — teachers restricted to their own subjects
    if (req.user.role === 'teacher') {
      if (subject) {
        if (!req.user.subjects.includes(subject))
          return res.status(403).json({ message: 'Not assigned to this subject' });
        filter.subject = subject;
      } else {
        filter.subject = { $in: req.user.subjects };
      }
    } else {
      // Admin: filter by subject only if explicitly passed
      if (subject) filter.subject = subject;
    }

    // Student scoping — when subject is set, restrict to enrolled students only
    const resolvedSubject = subject || null;
    if (resolvedSubject) {
      const enrolled = await Student.find({ subjects: resolvedSubject }).select('_id');
      const ids = enrolled.map(s => s._id);
      filter.student = studentId ? studentId : { $in: ids };
    } else if (studentId) {
      filter.student = studentId;
    }

    const records = await Evaluation.find(filter)
      .populate('student', 'name rollNumber subjects')
      .populate('markedBy', 'name')
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/evaluations/bulk — save evaluations for enrolled students on any date
router.post('/bulk', async (req, res) => {
  try {
    const { records, subject, date } = req.body;
    if (!records || !subject || !date)
      return res.status(400).json({ message: 'Records, subject, and date required' });

    if (req.user.role === 'teacher' && !req.user.subjects.includes(subject))
      return res.status(403).json({ message: 'Not assigned to this subject' });

    const enrolled = await Student.find({ subjects: subject }).select('_id');
    const enrolledIds = new Set(enrolled.map(s => s._id.toString()));

    const results = [];
    for (const rec of records) {
      if (!enrolledIds.has(rec.studentId.toString())) continue;
      if (rec.score === null || rec.score === undefined) continue;

      const result = await Evaluation.findOneAndUpdate(
        { student: rec.studentId, subject, date },
        {
          score: rec.score,
          maxScore: rec.maxScore || 100,
          remarks: rec.remarks || '',
          markedBy: req.user._id,
        },
        { upsert: true, new: true }
      ).populate('student', 'name rollNumber');
      results.push(result);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/evaluations/:id
router.put('/:id', async (req, res) => {
  try {
    const { score, maxScore, remarks } = req.body;
    const record = await Evaluation.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (req.user.role === 'teacher' && !req.user.subjects.includes(record.subject))
      return res.status(403).json({ message: 'Not assigned to this subject' });

    Object.assign(record, { score, maxScore, remarks });
    await record.save();
    await record.populate('student', 'name rollNumber');
    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/evaluations/:id
router.delete('/:id', async (req, res) => {
  try {
    const record = await Evaluation.findById(req.params.id);
    if (!record) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'teacher' && !req.user.subjects.includes(record.subject))
      return res.status(403).json({ message: 'Not assigned to this subject' });
    await record.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
