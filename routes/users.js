const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect } = require("../middleware/auth");

// All routes require authentication
router.use(protect);

// GET: Get users by role
router.get("/", async (req, res) => {
  try {
    const { role } = req.query;
    
    // Build filter
    let filter = {};
    if (role) {
      filter.role = role;
    }
    
    // Only admins can see all users
    if (req.user.role !== "admin" && !role) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const users = await User.find(filter)
      .select("name email role specialization")
      .sort({ name: 1 });
    
    res.json(users);
  } catch (error) {
    console.error("❌ Error fetching users:", error.message);
    res.status(500).json({ message: "Server error fetching users" });
  }
});

// GET: Get a single user
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name email role specialization");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("❌ Error fetching user:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;