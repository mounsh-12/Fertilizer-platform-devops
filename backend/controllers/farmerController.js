
const db = require("../config/db");

// Register a new farmer
const addFarmer = async (req, res) => {
    try {
        const {
            farmer_name,
            mobile_number,
            village,
            address
        } = req.body;

        if (
            !farmer_name ||
            typeof farmer_name !== "string" ||
            !farmer_name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Farmer name is required."
            });
        }

        if (
            !mobile_number ||
            !/^\+?[0-9]{10,15}$/.test(String(mobile_number).trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid mobile number."
            });
        }

        const [result] = await db.query(
            `INSERT INTO farmers
            (farmer_name, mobile_number, village, address)
            VALUES (?, ?, ?, ?)`,
            [
                farmer_name.trim(),
                String(mobile_number).trim(),
                village?.trim() || null,
                address?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Farmer registered successfully.",
            farmer_id: result.insertId
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A farmer with this mobile number already exists."
            });
        }

        console.error("Add farmer error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to register farmer."
        });
    }
};


// Get all farmers with purchase and payment calculations
const getAllFarmers = async (req, res) => {
    try {
        const [farmers] = await db.query(
            `SELECT
                f.farmer_id,
                f.farmer_name,
                f.mobile_number,
                f.village,
                f.address,
                f.is_active,
                f.created_at,
                f.updated_at,

                COALESCE(s.purchase_count, 0) AS purchase_count,
                COALESCE(s.total_purchases, 0) AS total_purchases,
                COALESCE(p.total_paid, 0) AS total_paid,

                GREATEST(
                    COALESCE(s.total_purchases, 0) -
                    COALESCE(p.total_paid, 0),
                    0
                ) AS outstanding

            FROM farmers f

            LEFT JOIN (
                SELECT
                    farmer_id,
                    COUNT(*) AS purchase_count,
                    SUM(total_amount) AS total_purchases
                FROM sales
                WHERE sale_status = 'COMPLETED'
                GROUP BY farmer_id
            ) s ON s.farmer_id = f.farmer_id

            LEFT JOIN (
                SELECT
                    s.farmer_id,
                    SUM(p.amount) AS total_paid
                FROM sales s
                INNER JOIN payments p
                    ON p.sale_id = s.sale_id
                WHERE s.sale_status = 'COMPLETED'
                GROUP BY s.farmer_id
            ) p ON p.farmer_id = f.farmer_id

            ORDER BY f.farmer_id DESC`
        );

        return res.status(200).json({
            success: true,
            count: farmers.length,
            farmers
        });

    } catch (error) {
        console.error("Get farmers error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve farmers."
        });
    }
};


// Get farmer by mobile number
const getFarmerByMobile = async (req, res) => {
    try {
        const { mobile } = req.params;

        if (!/^\+?[0-9]{10,15}$/.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid mobile number."
            });
        }

        const [farmers] = await db.query(
            `SELECT
                farmer_id,
                farmer_name,
                mobile_number,
                village,
                address,
                is_active
             FROM farmers
             WHERE mobile_number = ?
             LIMIT 1`,
            [mobile]
        );

        if (farmers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Farmer not found."
            });
        }

        return res.status(200).json({
            success: true,
            farmer: farmers[0]
        });

    } catch (error) {
        console.error("Get farmer by mobile error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve farmer."
        });
    }
};


// Update farmer details
const updateFarmer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            farmer_name,
            mobile_number,
            village,
            address
        } = req.body;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid farmer ID is required."
            });
        }

        if (
            !farmer_name ||
            typeof farmer_name !== "string" ||
            !farmer_name.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Farmer name is required."
            });
        }

        if (
            !mobile_number ||
            !/^\+?[0-9]{10,15}$/.test(String(mobile_number).trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid mobile number."
            });
        }

        const [result] = await db.query(
            `UPDATE farmers
             SET
                farmer_name = ?,
                mobile_number = ?,
                village = ?,
                address = ?
             WHERE farmer_id = ?`,
            [
                farmer_name.trim(),
                String(mobile_number).trim(),
                village?.trim() || null,
                address?.trim() || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.query(
                "SELECT farmer_id FROM farmers WHERE farmer_id = ?",
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Farmer not found."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Farmer details updated successfully."
        });

    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This mobile number is already registered."
            });
        }

        console.error("Update farmer error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update farmer."
        });
    }
};


// Activate or deactivate farmer
const updateFarmerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid farmer ID is required."
            });
        }

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false."
            });
        }

        const [result] = await db.query(
            `UPDATE farmers
             SET is_active = ?
             WHERE farmer_id = ?`,
            [is_active, id]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.query(
                "SELECT farmer_id FROM farmers WHERE farmer_id = ?",
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Farmer not found."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: is_active
                ? "Farmer activated successfully."
                : "Farmer deactivated successfully."
        });

    } catch (error) {
        console.error("Update farmer status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update farmer status."
        });
    }
};


module.exports = {
    addFarmer,
    getAllFarmers,
    getFarmerByMobile,
    updateFarmer,
    updateFarmerStatus
};
