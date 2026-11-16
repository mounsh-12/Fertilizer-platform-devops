
const db = require("../config/db");

// Add a new supplier
const addSupplier = async (req, res) => {
    try {
        const {
            supplier_name,
            company_name,
            contact_person,
            mobile_number,
            email,
            address,
            gst_number
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required."
            });
        }

        const [result] = await db.query(
            `INSERT INTO suppliers
            (
                supplier_name,
                company_name,
                contact_person,
                mobile_number,
                email,
                address,
                gst_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                supplier_name.trim(),
                company_name || null,
                contact_person || null,
                mobile_number || null,
                email || null,
                address || null,
                gst_number || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Supplier added successfully.",
            supplier_id: result.insertId
        });

    } catch (error) {
        console.error("Add supplier error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to add supplier."
        });
    }
};

// Get all suppliers
const getAllSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.query(
            `SELECT
                supplier_id,
                supplier_name,
                company_name,
                contact_person,
                mobile_number,
                email,
                address,
                gst_number,
                is_active,
                created_at,
                updated_at
             FROM suppliers
             ORDER BY supplier_id DESC`
        );

        return res.status(200).json({
            success: true,
            count: suppliers.length,
            suppliers
        });

    } catch (error) {
        console.error("Get suppliers error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve suppliers."
        });
    }
};

// Update supplier details
const updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            supplier_name,
            company_name,
            contact_person,
            mobile_number,
            email,
            address,
            gst_number
        } = req.body;

        if (!supplier_name || !supplier_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Supplier name is required."
            });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET
                supplier_name = ?,
                company_name = ?,
                contact_person = ?,
                mobile_number = ?,
                email = ?,
                address = ?,
                gst_number = ?
             WHERE supplier_id = ?`,
            [
                supplier_name.trim(),
                company_name || null,
                contact_person || null,
                mobile_number || null,
                email || null,
                address || null,
                gst_number || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Supplier updated successfully."
        });

    } catch (error) {
        console.error("Update supplier error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update supplier."
        });
    }
};

// Activate or deactivate a supplier
const updateSupplierStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false."
            });
        }

        const [result] = await db.query(
            `UPDATE suppliers
             SET is_active = ?
             WHERE supplier_id = ?`,
            [is_active, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: is_active
                ? "Supplier activated successfully."
                : "Supplier deactivated successfully."
        });

    } catch (error) {
        console.error("Update supplier status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update supplier status."
        });
    }
};

module.exports = {
    addSupplier,
    getAllSuppliers,
    updateSupplier,
    updateSupplierStatus
};
