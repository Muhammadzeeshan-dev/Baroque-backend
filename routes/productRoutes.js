const router = require("express").Router();
const {
  getProducts,
  createProduct,
} = require("../controllers/productController");

router.get("/", getProducts);
router.post("/", createProduct);

module.exports = router;
