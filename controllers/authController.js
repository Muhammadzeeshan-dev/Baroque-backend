const User = require("../models/User");
const nodemailer = require("nodemailer");

// Nodemailer Transporter Setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. Send OTP & Save/Update in MongoDB Compass
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    // Find user in MongoDB Compass or create new
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, otp, name: email.split("@")[0].toUpperCase() });
    } else {
      user.otp = otp;
    }
    await user.save();

    // Try sending email, if fails (due to no internet/credentials), fallback to console for testing
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Verification Code",
        text: `Your 4-digit verification code is: ${otp}`,
      });
    } catch (mailErr) {
      console.log(`[Development Mode] OTP for ${email}: ${otp}`);
    }

    res.status(200).json({ message: "OTP sent successfully to your email!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP code" });
    }

    // Clear OTP after successful verification
    user.otp = "";
    await user.save();

    res.status(200).json({
      message: "Login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Google Login API (Restricted Emails Check)
exports.googleLogin = async (req, res) => {
  try {
    const { email, name, googleId } = req.body;

    // Optional: Restricted emails list
    const allowedEmails = ["zeeshan@gmail.com", "admin@baroque.pk"];
    // if (!allowedEmails.includes(email)) {
    //   return res.status(403).json({ message: "Access Denied: Email not authorized." });
    // }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, googleId });
      await user.save();
    }

    res.status(200).json({
      message: "Google login successful",
      user: { name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
