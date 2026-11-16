
const db = require("../config/db");

// Add a single fertilizer
const addFertilizer = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const {
            fertilizer_name,
            brand_name,
            fertilizer_type,
            bag_size_kg,
            purchase_price,
            selling_price,
            initial_quantity = 0
        } = req.body;

        if (
            !fertilizer_name ||
            !brand_name ||
            !bag_size_kg ||
            purchase_price === undefined ||
            selling_price === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "Required fertilizer details are missing."
            });
        }

        if (
            Number(bag_size_kg) <= 0 ||
            Number(purchase_price) < 0 ||
            Number(selling_price) < 0 ||
            !Number.isInteger(Number(initial_quantity)) ||
            Number(initial_quantity) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid fertilizer quantity or price."
            });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO fertilizers
            (
                fertilizer_name,
                brand_name,
                fertilizer_type,
                bag_size_kg,
                purchase_price,
                selling_price
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                fertilizer_name.trim(),
                brand_name.trim(),
                fertilizer_type || null,
                bag_size_kg,
                purchase_price,
                selling_price
            ]
        );

        const fertilizerId = result.insertId;

        await connection.query(
            `INSERT INTO inventory
            (fertilizer_id, available_quantity)
            VALUES (?, ?)`,
            [fertilizerId, initial_quantity]
        );

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Fertilizer added successfully.",
            fertilizer_id: fertilizerId
        });

    } catch (error) {
        await connection.rollback();

        console.error("Add fertilizer error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This fertilizer, brand and bag size already exist."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to add fertilizer."
        });

    } finally {
        connection.release();
    }
};

// View all fertilizers
const getAllFertilizers = async (req, res) => {
    try {
        const [fertilizers] = await db.query(
            `SELECT
                f.*,
                i.available_quantity,
                i.reorder_level
             FROM fertilizers f
             LEFT JOIN inventory i
                ON f.fertilizer_id = i.fertilizer_id
             ORDER BY f.fertilizer_id DESC`
        );

        return res.status(200).json({
            success: true,
            count: fertilizers.length,
            fertilizers
        });

    } catch (error) {
        console.error("Get fertilizers error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve fertilizers."
        });
    }
};

// Update fertilizer details and prices
const updateFertilizer = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            fertilizer_name,
            brand_name,
            fertilizer_type,
            bag_size_kg,
            purchase_price,
            selling_price
        } = req.body;

        const [result] = await db.query(
            `UPDATE fertilizers
             SET
                fertilizer_name = ?,
                brand_name = ?,
                fertilizer_type = ?,
                bag_size_kg = ?,
                purchase_price = ?,
                selling_price = ?
             WHERE fertilizer_id = ?`,
            [
                fertilizer_name,
                brand_name,
                fertilizer_type || null,
                bag_size_kg,
                purchase_price,
                selling_price,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Fertilizer not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Fertilizer updated successfully."
        });

    } catch (error) {
        console.error("Update fertilizer error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update fertilizer."
        });
    }
};

// Activate or deactivate fertilizer
const updateFertilizerStatus = async (req, res) => {
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
            `UPDATE fertilizers
             SET is_active = ?
             WHERE fertilizer_id = ?`,
            [is_active, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Fertilizer not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: `Fertilizer ${is_active ? "activated" : "deactivated"} successfully.`
        });

    } catch (error) {
        console.error("Fertilizer status error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to update fertilizer status."
        });
    }
};

module.exports = {
    addFertilizer,
    getAllFertilizers,
    updateFertilizer,
    updateFertilizerStatus
};
