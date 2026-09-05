// backend/seed.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // assuming you use bcrypt
const User = require("./models/User");
require("dotenv").config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existingAdmin = await User.findOne({ email: "admin@admin.com" });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      const admin = new User({
        name: "Admin",
        email: "admin@admin.com",
        password: hashedPassword,
        role: "admin",
      });
      await admin.save();
      console.log("Default admin created: admin@admin.com / admin123");
    } else {
      console.log("Admin already exists");
    }
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedAdmin();
