const mongoose = require("mongoose");

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
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        image: { type: String },
      },
    ],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: "Cash on Delivery" },
    orderStatus: { type: String, default: "Pending" }, // Pending, Shipped, Delivered
  },
  { timestamps: true }, // یہ خود بخود تاریخ اور وقت (date & time) سیو کرے گا کہ آرڈر کب آیا
);

module.exports = mongoose.model("Order", orderSchema);
