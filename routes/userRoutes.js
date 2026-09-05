const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// Temporary store for OTPs (Production mein database use hota hai)
const otpStorage = {};

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. Send OTP Route
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Generate random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Save OTP temporarily
    otpStorage[email] = otp;

    // Email Options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP Code - Baroque",
      text: `Your verification code is: ${otp}. It is valid for a short time.`,
    };

    // Send Email
    await transporter.sendMail(mailOptions);
    console.log(`OTP ${otp} sent successfully to ${email}`);

    res
      .status(200)
      .json({ success: true, message: "OTP sent successfully to your email" });
  } catch (error) {
    console.error("Error sending email:", error);
    res
      .status(500)
      .json({ message: "Failed to send email. Check backend configuration." });
  }
});

// 2. Verify OTP Route
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Check if OTP matches
    if (otpStorage[email] === otp) {
      // Clear OTP after successful verification
      delete otpStorage[email];

      res.status(200).json({
        success: true,
        message: "Login successful",
        user: { email },
      });
    } else {
      res.status(400).json({ message: "Invalid or expired OTP code" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
