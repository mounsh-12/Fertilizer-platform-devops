
const express = require("express");

const router = express.Router();

const {
    loginAdmin
} = require("../controllers/authController");

const verifyAdmin = require("../middleware/authMiddleware");

// Admin login
router.post("/login", loginAdmin);

// Protected admin profile test
router.get("/profile", verifyAdmin, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Admin authentication verified",
        admin: req.admin
    });
});

module.exports = router;
