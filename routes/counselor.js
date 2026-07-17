const express = require('express');
const router = express.Router();

const { protect, counselorOnly } = require('../middleware/auth');

router.use(protect, counselorOnly);

router.get('/me', (req, res) => {
  res.json(req.user);
});

module.exports = router;