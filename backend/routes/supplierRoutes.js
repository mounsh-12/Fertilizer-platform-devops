
const express = require("express");
const router = express.Router();

const verifyAdmin = require("../middleware/authMiddleware");

const {
    addSupplier,
    getAllSuppliers,
    updateSupplier,
    updateSupplierStatus
} = require("../controllers/supplierController");

// Protect all supplier endpoints
router.use(verifyAdmin);

// Register a supplier
router.post("/", addSupplier);

// Retrieve all suppliers
router.get("/", getAllSuppliers);

// Update supplier information
router.put("/:id", updateSupplier);

// Activate or deactivate a supplier
router.patch("/:id/status", updateSupplierStatus);

module.exports = router;
