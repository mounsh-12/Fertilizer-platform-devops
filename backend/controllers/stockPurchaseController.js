
const db = require("../config/db");

// Record one purchase containing one or more fertilizer items.
// Purchase header, item rows, inventory updates and stock movements
// are committed together so a partial purchase cannot be saved.
const createStockPurchase = async (req, res) => {
    let connection;
    let transactionStarted = false;

    try {
        const {
            supplier_id,
            supplier_invoice_number,
            purchase_date,
            notes,
            items
        } = req.body;

        const supplierId = Number(supplier_id);

        if (!Number.isInteger(supplierId) || supplierId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid supplier is required."
            });
        }

        if (
            supplier_invoice_number != null &&
            String(supplier_invoice_number).trim().length > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Supplier invoice number cannot exceed 100 characters."
            });
        }

        if (purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
            return res.status(400).json({
                success: false,
                message: "Purchase date must use YYYY-MM-DD format."
            });
        }

        if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Add between 1 and 100 fertilizer items."
            });
        }

        const seen = new Set();
        const purchaseItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const fertilizerId = Number(item.fertilizer_id);
            const quantity = Number(item.quantity);
            const purchasePrice = Number(item.purchase_price);

            if (
                !Number.isInteger(fertilizerId) ||
                fertilizerId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(purchasePrice) ||
                purchasePrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Each item needs a valid fertilizer, positive whole-number quantity and non-negative purchase price."
                });
            }

            if (seen.has(fertilizerId)) {
                return res.status(400).json({
                    success: false,
                    message:
                        "A fertilizer can appear only once per purchase. Combine its quantities."
                });
            }

            seen.add(fertilizerId);

            const subtotal = Number(
                (quantity * purchasePrice).toFixed(2)
            );

            totalAmount = Number(
                (totalAmount + subtotal).toFixed(2)
            );

            purchaseItems.push({
                fertilizer_id: fertilizerId,
                quantity,
                purchase_price: purchasePrice,
                subtotal
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();
        transactionStarted = true;

        const [suppliers] = await connection.query(
            `SELECT supplier_id
             FROM suppliers
             WHERE supplier_id = ? AND is_active = TRUE
             FOR UPDATE`,
            [supplierId]
        );

        if (suppliers.length === 0) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(404).json({
                success: false,
                message: "Active supplier not found."
            });
        }

        const fertilizerIds = purchaseItems.map(
            item => item.fertilizer_id
        );

        const placeholders = fertilizerIds.map(() => "?").join(",");

        const [fertilizers] = await connection.query(
            `SELECT fertilizer_id
             FROM fertilizers
             WHERE fertilizer_id IN (${placeholders})
             AND is_active = TRUE`,
            fertilizerIds
        );

        if (fertilizers.length !== fertilizerIds.length) {
            await connection.rollback();
            transactionStarted = false;

            return res.status(400).json({
                success: false,
                message:
                    "One or more selected fertilizers do not exist or are inactive."
            });
        }

        const [purchaseResult] = await connection.query(
            `INSERT INTO stock_purchases
                (
                    supplier_id,
                    supplier_invoice_number,
                    purchase_date,
                    total_amount,
                    notes
                )
             VALUES (?, ?, COALESCE(?, CURRENT_DATE), ?, ?)`,
            [
                supplierId,
                supplier_invoice_number
                    ? String(supplier_invoice_number).trim()
                    : null,
                purchase_date || null,
                totalAmount,
                notes ? String(notes).trim() : null
            ]
        );

        const purchaseId = purchaseResult.insertId;

        for (const item of purchaseItems) {
            await connection.query(
                `INSERT INTO stock_purchase_items
                    (
                        purchase_id,
                        fertilizer_id,
                        quantity,
                        purchase_price,
                        subtotal
                    )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    purchaseId,
                    item.fertilizer_id,
                    item.quantity,
                    item.purchase_price,
                    item.subtotal
                ]
            );

            const [inventoryRows] = await connection.query(
                `SELECT available_quantity
                 FROM inventory
                 WHERE fertilizer_id = ?
                 FOR UPDATE`,
                [item.fertilizer_id]
            );

            if (inventoryRows.length === 0) {
                throw new Error(
                    `Inventory record missing for fertilizer ${item.fertilizer_id}`
                );
            }

            const previousQuantity = Number(
                inventoryRows[0].available_quantity
            );

            const newQuantity = previousQuantity + item.quantity;

            await connection.query(
                `UPDATE inventory
                 SET available_quantity = ?
                 WHERE fertilizer_id = ?`,
                [newQuantity, item.fertilizer_id]
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
                 VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)`,
                [
                    item.fertilizer_id,
                    purchaseId,
                    item.quantity,
                    previousQuantity,
                    newQuantity,
                    `Purchase #${purchaseId}${
                        supplier_invoice_number
                            ? ` | Invoice ${String(supplier_invoice_number).trim()}`
                            : ""
                    }`
                ]
            );
        }

        await connection.commit();
        transactionStarted = false;

        return res.status(201).json({
            success: true,
            message:
                "Purchase recorded and inventory updated successfully.",
            purchase: {
                purchase_id: purchaseId,
                supplier_id: supplierId,
                supplier_invoice_number:
                    supplier_invoice_number
                        ? String(supplier_invoice_number).trim()
                        : null,
                purchase_date: purchase_date || null,
                total_amount: totalAmount,
                items: purchaseItems
            }
        });

    } catch (error) {
        if (connection && transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Purchase rollback error:",
                    rollbackError.message
                );
            }
        }

        console.error("Create stock purchase error:", error);

        return res.status(500).json({
            success: false,
            message:
                "Failed to record purchase. No partial inventory changes were saved."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = { createStockPurchase };
