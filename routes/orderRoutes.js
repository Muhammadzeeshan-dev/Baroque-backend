const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { protectAdmin } = require("../middleware/authMiddleware");

// 1. Create New Order (Public - Customer ke liye)
router.post("/", async (req, res) => {
  try {
    const { userEmail, shippingAddress, orderItems, totalAmount } = req.body;
    const newOrder = new Order({
      userEmail,
      shippingAddress,
      orderItems,
      totalAmount,
    });
    const savedOrder = await newOrder.save();
    res
      .status(201)
      .json({
        success: true,
        message: "Order placed successfully",
        order: savedOrder,
      });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Get All Orders (Protected - Sirf Admin ke liye)
router.get("/", protectAdmin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
