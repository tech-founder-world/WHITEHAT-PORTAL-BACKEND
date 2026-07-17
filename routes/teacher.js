const express = require("express");
const router = express.Router();
const { protect, teacherOnly } = require("../middleware/auth");

router.use(protect, teacherOnly);

// GET /api/teacher/me
router.get("/me", (req, res) => {
  res.json(req.user);
});

module.exports = router;
