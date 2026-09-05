const jwt = require("jsonwebtoken");

const protectAdmin = (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith("Bearer")) {
    try {
      token = token.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "supersecretkey",
      );

      if (decoded.role !== "admin") {
        return res.status(403).json({ message: "Access denied: Not an admin" });
      }

      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token provided" });
  }
};

module.exports = { protectAdmin };
