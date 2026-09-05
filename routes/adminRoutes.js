const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

// Admin Login Route (آپ اپنی مرضی کا ای میل اور پاسورڈ یہاں رکھ سکتے ہیں)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Hardcoded secure admin check (ya database se check karwa sakte hain)
  if (email === "admin@baroque.com" && password === "admin123") {
    const token = jwt.sign(
      { email, role: "admin" },
      process.env.JWT_SECRET || "supersecretkey",
      { expiresIn: "1d" },
    );
    return res.json({
      success: true,
      token,
      message: "Admin logged in successfully",
    });
  }

  res
    .status(401)
    .json({ success: false, message: "Invalid admin credentials" });
});

module.exports = router;
