const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Student = require("../models/Student");
const { protect } = require("../middleware/auth");

router.use(protect);

// GET /api/counsellor/students — get counsellor's assigned students
router.get("/students", async (req, res) => {
  try {
    const counsellor = await User.findById(req.user._id).populate(
      "students",
      "name rollNumber subjects email",
    );
    if (!counsellor)
      return res.status(404).json({ message: "Counsellor not found" });
    res.json(counsellor.students || []);
  } catch (err) {
    console.error("Error fetching counsellor students:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/counsellor/me — get own profile
router.get("/me", (req, res) => {
  res.json(req.user);
});

module.exports = router;
