
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");
const {
    getSettings,
    updateSettings
} = require("../controllers/settingsController");

router.use(verifyAdmin);

router.get("/", getSettings);
router.put("/", updateSettings);

module.exports = router;
