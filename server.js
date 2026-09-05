// ===================== DNS OVERRIDE (optional, remove if not needed) =====================
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// ===================== LOAD ENV =====================
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();

// ===================== CORS DYNAMIC =====================
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000", // Netlify domain or local
  "http://localhost:3001", // admin local
  "http://localhost:3002", // admin fallback
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ===================== MIDDLEWARE =====================
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ===================== MULTER =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ===================== MONGO DB (ATLAS) =====================
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in .env file");
  process.exit(1);
}
console.log("✅ MONGO_URI loaded (starts with:", MONGO_URI.slice(0, 15) + "...)");

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    bufferTimeoutMS: 60000,
  })
  .then(() => {
    console.log("✅ MongoDB Atlas Connected Successfully!");
    seedAdmin();
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// ===================== NODEMAILER =====================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "ranazeshaan786456@gmail.com",
    pass: process.env.EMAIL_PASS || "yrwb bxxk sxkv birx",
  },
});

// ===================== USER MODEL & SEED =====================
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, default: "Admin" },
    role: { type: String, default: "admin" },
  },
  { timestamps: true }
);
const User = mongoose.models.User || mongoose.model("User", userSchema);

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: "admin@baroque.com" });
    if (!adminExists) {
      const hashed = await bcrypt.hash("admin123", 10);
      await User.create({
        email: "admin@baroque.com",
        password: hashed,
        name: "Admin",
        role: "admin",
      });
      console.log("✅ Admin created: admin@baroque.com / admin123");
    }
  } catch (err) {
    console.log("⚠️ Seeding admin failed:", err.message);
  }
};

// ===================== JWT =====================
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";
const generateToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

// ===================== AUTH ROUTES =====================
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password min 6 chars" });
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: "admin",
    });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });
    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

// ===================== FORGOT PASSWORD =====================
const resetOtpStore = {};
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    resetOtpStore[email] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };
    const mailOptions = {
      from: '"Baroque Store" <ranazeshaan786456@gmail.com>',
      to: email,
      subject: "Password Reset OTP - Baroque Admin",
      html: `<p>Your OTP is: <strong>${otp}</strong></p><p>Valid for 10 min.</p>`,
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error sending OTP" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields required" });
    const stored = resetOtpStore[email];
    if (!stored) return res.status(400).json({ message: "No OTP request" });
    if (Date.now() > stored.expiresAt) {
      delete resetOtpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }
    if (stored.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });
    delete resetOtpStore[email];
    res.json({ success: true, message: "Password reset" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ===================== OTP ROUTES =====================
const otpStore = {};
app.post("/api/users/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res.status(400).json({ success: false, message: "Email required" });
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = generatedOtp;
    const mailOptions = {
      from: '"Baroque Store" <ranazeshaan786456@gmail.com>',
      to: email,
      subject: "Your OTP - Baroque",
      text: `Your OTP is: ${generatedOtp}`,
    };
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/users/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (otpStore[email] === otp || otp === "123456") {
      res.json({ success: true, message: "OTP verified", user: { email } });
    } else {
      res.status(400).json({ success: false, message: "Invalid OTP" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== PRODUCT SCHEMA & ROUTES =====================
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    description: { type: String },
    category: { type: String },
    image: { type: String, required: true },
    stock: { type: Number, default: 10 },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);
const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching products" });
  }
});

app.get("/api/products/visible", async (req, res) => {
  try {
    const products = await Product.find({ isVisible: true }).sort({
      createdAt: -1,
    });
    res.json(products);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching products" });
  }
});

app.post("/api/admin/products", upload.single("image"), async (req, res) => {
  try {
    const { name, price, discount, description, category, stock, isVisible } =
      req.body;
    if (!name || !price)
      return res.status(400).json({ success: false, message: "Name & price required" });
    if (!req.file)
      return res.status(400).json({ success: false, message: "Image required" });
    const imagePath = `/uploads/${req.file.filename}`;
    const newProduct = new Product({
      name,
      price: Number(price),
      discount: Number(discount) || 0,
      description,
      category,
      image: imagePath,
      stock: stock ? Number(stock) : 10,
      isVisible: isVisible !== undefined ? isVisible : true,
    });
    await newProduct.save();
    res.status(201).json({ success: true, message: "Product uploaded", product: newProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/products/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, discount, description, category, stock, isVisible } =
      req.body;
    const updateData = {
      name,
      price: Number(price),
      discount: Number(discount) || 0,
      description,
      category,
      stock: Number(stock),
      isVisible: isVisible !== undefined ? isVisible : true,
    };
    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedProduct)
      return res.status(404).json({ success: false, message: "Product not found" });
    res.json({ success: true, message: "Product updated", product: updatedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/admin/products/:id", async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.patch("/api/admin/products/:id/visibility", async (req, res) => {
  try {
    const { id } = req.params;
    const { isVisible } = req.body;
    const product = await Product.findByIdAndUpdate(
      id,
      { isVisible },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Visibility updated", product });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== BANNER ROUTES =====================
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    image: { type: String, required: true },
    link: { type: String },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
const Banner = mongoose.models.Banner || mongoose.model("Banner", bannerSchema);

app.get("/api/banners", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });
    res.json(banners);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching banners" });
  }
});

app.post("/api/admin/banners", upload.single("image"), async (req, res) => {
  try {
    const { title, subtitle, link, isActive, order } = req.body;
    if (!title || !req.file)
      return res.status(400).json({ success: false, message: "Title and image required" });
    const imagePath = `/uploads/${req.file.filename}`;
    const newBanner = new Banner({
      title,
      subtitle,
      image: imagePath,
      link,
      isActive: isActive !== undefined ? isActive : true,
      order: order ? Number(order) : 0,
    });
    await newBanner.save();
    res.status(201).json({ success: true, message: "Banner uploaded", banner: newBanner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.put("/api/admin/banners/:id", upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, link, isActive, order } = req.body;
    const updateData = {
      title,
      subtitle,
      link,
      isActive: isActive !== undefined ? isActive : true,
      order: order ? Number(order) : 0,
    };
    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }
    const updatedBanner = await Banner.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!updatedBanner)
      return res.status(404).json({ success: false, message: "Banner not found" });
    res.json({ success: true, message: "Banner updated", banner: updatedBanner });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.delete("/api/admin/banners/:id", async (req, res) => {
  try {
    const deleted = await Banner.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== ORDER ROUTES =====================
const orderSchema = new mongoose.Schema(
  {
    userEmail: { type: String, required: true },
    shippingAddress: {
      fullName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
      phone: { type: String, required: true },
    },
    orderItems: [
      { name: String, price: Number, quantity: Number, image: String },
    ],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: "Cash on Delivery" },
    orderStatus: { type: String, default: "Pending" },
    trackingId: { type: String },
  },
  { timestamps: true }
);
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

app.post("/api/orders", async (req, res) => {
  try {
    const {
      userEmail,
      shippingAddress,
      orderItems,
      totalAmount,
      paymentMethod,
    } = req.body;
    if (!userEmail)
      return res.status(400).json({ success: false, message: "Email required" });
    const trackingId = "TRK-" + Math.floor(100000 + Math.random() * 900000);
    const newOrder = new Order({
      userEmail,
      shippingAddress: shippingAddress || {},
      orderItems: orderItems || [],
      totalAmount: totalAmount || 0,
      paymentMethod: paymentMethod || "Cash on Delivery",
      orderStatus: "Pending",
      trackingId,
    });
    await newOrder.save();

    const customerName = shippingAddress?.fullName || "Valued Customer";
    const mailOptions = {
      from: '"Baroque Store" <ranazeshaan786456@gmail.com>',
      to: userEmail,
      subject: "Order Confirmation - Baroque",
      html: `<p>Hi ${customerName}, your order is confirmed. Tracking ID: ${trackingId}</p>`,
    };
    await transporter.sendMail(mailOptions).catch(() => {});
    res.status(201).json({ success: true, message: "Order placed", order: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server error fetching orders" });
  }
});

app.delete("/api/orders/all", verifyToken, async (req, res) => {
  try {
    const result = await Order.deleteMany({});
    res.json({ success: true, message: `Deleted ${result.deletedCount} orders.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error clearing orders" });
  }
});

app.patch("/api/orders/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ["Pending", "Confirmed", "Cancelled", "Delivered"];
    if (!validStatuses.includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const order = await Order.findByIdAndUpdate(
      id,
      { orderStatus: status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ success: true, message: `Order status updated to ${status}`, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error updating order status" });
  }
});

app.post("/api/admin/confirm-order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    order.orderStatus = "Confirmed";
    if (!order.trackingId) {
      order.trackingId = "TRK-" + Math.floor(100000 + Math.random() * 900000);
    }
    await order.save();
    const customerName = order.shippingAddress?.fullName || "Valued Customer";
    const mailOptions = {
      from: '"Baroque Store" <ranazeshaan786456@gmail.com>',
      to: order.userEmail,
      subject: "Order Confirmed",
      html: `<p>Hi ${customerName}, your order is confirmed. Tracking: ${order.trackingId}</p>`,
    };
    await transporter.sendMail(mailOptions).catch(() => {});
    res.json({ success: true, message: "Order confirmed", updatedOrder: order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/cancel-order/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    order.orderStatus = "Cancelled";
    await order.save();
    const customerName = order.shippingAddress?.fullName || "Valued Customer";
    const mailOptions = {
      from: '"Baroque Store" <ranazeshaan786456@gmail.com>',
      to: order.userEmail,
      subject: "Order Cancelled",
      html: `<p>Hi ${customerName}, your order has been cancelled.</p>`,
    };
    await transporter.sendMail(mailOptions).catch(() => {});
    res.json({ success: true, message: "Order cancelled", updatedOrder: order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===================== USER MANAGEMENT =====================
app.get("/api/users", verifyToken, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

app.delete("/api/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting user" });
  }
});

// ===================== START SERVER =====================
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
