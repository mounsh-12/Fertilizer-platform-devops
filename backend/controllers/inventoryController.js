
const db = require("../config/db");

// Get complete inventory
const getInventory = async (req, res) => {
    try {
        const [inventory] = await db.query(
            `SELECT
                i.inventory_id,
                i.fertilizer_id,
                f.fertilizer_name,
                f.brand_name,
                f.fertilizer_type,
                f.bag_size_kg,
                i.available_quantity,
                i.reorder_level,
                i.last_updated,
                CASE
                    WHEN i.available_quantity = 0 THEN 'OUT_OF_STOCK'
                    WHEN i.available_quantity <= i.reorder_level THEN 'LOW_STOCK'
                    ELSE 'IN_STOCK'
                END AS stock_status
             FROM inventory i
             INNER JOIN fertilizers f
                ON i.fertilizer_id = f.fertilizer_id
             ORDER BY f.fertilizer_name ASC`
        );

        return res.status(200).json({
            success: true,
            count: inventory.length,
            inventory
        });

    } catch (error) {
        console.error("Get inventory error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve inventory."
        });
    }
};

// Get low-stock and out-of-stock fertilizers
const getLowStockItems = async (req, res) => {
    try {
        const [items] = await db.query(
            `SELECT
                i.fertilizer_id,
                f.fertilizer_name,
                f.brand_name,
                f.bag_size_kg,
                i.available_quantity,
                i.reorder_level,
                CASE
                    WHEN i.available_quantity = 0 THEN 'OUT_OF_STOCK'
                    ELSE 'LOW_STOCK'
                END AS stock_status
             FROM inventory i
             INNER JOIN fertilizers f
                ON i.fertilizer_id = f.fertilizer_id
             WHERE i.available_quantity <= i.reorder_level
             AND f.is_active = TRUE
             ORDER BY i.available_quantity ASC`
        );

        return res.status(200).json({
            success: true,
            count: items.length,
            items
        });

    } catch (error) {
        console.error("Low stock error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve low-stock items."
        });
    }
};

// Update reorder level
const updateReorderLevel = async (req, res) => {
    try {
        const { id } = req.params;
        const { reorder_level } = req.body;

        if (
            !/^[1-9]\d*$/.test(id) ||
            !Number.isInteger(reorder_level) ||
            reorder_level < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid fertilizer ID and non-negative reorder level are required."
            });
        }

        const [result] = await db.query(
            `UPDATE inventory
             SET reorder_level = ?
             WHERE fertilizer_id = ?`,
            [reorder_level, id]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.query(
                `SELECT inventory_id
                 FROM inventory
                 WHERE fertilizer_id = ?`,
                [id]
            );

            if (existing.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Inventory record not found."
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Reorder level updated successfully."
        });

    } catch (error) {
        console.error("Update reorder level error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to update reorder level."
        });
    }
};

// Manually adjust inventory
const adjustInventory = async (req, res) => {
    let connection;

    try {
        const { id } = req.params;
        const { adjustment_quantity, notes } = req.body;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid fertilizer ID is required."
            });
        }

        if (
            !Number.isInteger(adjustment_quantity) ||
            adjustment_quantity === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Adjustment quantity must be a non-zero integer."
            });
        }

        if (!notes || !notes.trim()) {
            return res.status(400).json({
                success: false,
                message: "An adjustment reason is required."
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [rows] = await connection.query(
            `SELECT available_quantity
             FROM inventory
             WHERE fertilizer_id = ?
             FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Inventory record not found."
            });
        }

        const previousQuantity = Number(rows[0].available_quantity);
        const newQuantity = previousQuantity + adjustment_quantity;

        if (newQuantity < 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Adjustment cannot reduce inventory below zero."
            });
        }

        await connection.query(
            `UPDATE inventory
             SET available_quantity = ?
             WHERE fertilizer_id = ?`,
            [newQuantity, id]
        );

        await connection.query(
            `INSERT INTO stock_movements
            (
                fertilizer_id,
                movement_type,
                reference_id,
                quantity,
                previous_quantity,
                new_quantity,
                notes
            )
            VALUES (?, 'ADJUSTMENT', NULL, ?, ?, ?, ?)`,
            [
                id,
                Math.abs(adjustment_quantity),
                previousQuantity,
                newQuantity,
                notes.trim()
            ]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Inventory adjusted successfully.",
            inventory: {
                fertilizer_id: Number(id),
                previous_quantity: previousQuantity,
                adjustment_quantity,
                new_quantity: newQuantity
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Inventory adjustment error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to adjust inventory."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

// Get stock movement history
const getStockMovements = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid fertilizer ID is required."
            });
        }

        const [movements] = await db.query(
            `SELECT
                movement_id,
                fertilizer_id,
                movement_type,
                reference_id,
                quantity,
                previous_quantity,
                new_quantity,
                notes,
                created_at
             FROM stock_movements
             WHERE fertilizer_id = ?
             ORDER BY movement_id DESC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            count: movements.length,
            movements
        });

    } catch (error) {
        console.error("Stock movements error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve stock movements."
        });
    }
};

module.exports = {
    getInventory,
    getLowStockItems,
    updateReorderLevel,
    adjustInventory,
    getStockMovements
};
