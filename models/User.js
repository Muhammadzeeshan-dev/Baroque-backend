const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String },
    googleId: { type: String },
    otp: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
