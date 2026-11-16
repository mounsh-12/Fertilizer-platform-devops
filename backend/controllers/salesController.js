
const db = require("../config/db");

// Create a new fertilizer sale
const createSale = async (req, res) => {
    let connection;

    try {
        const {
            farmer_mobile,
            discount = 0,
            notes,
            items,
            payment
        } = req.body;

        // Validate farmer mobile number
        if (
            !farmer_mobile ||
            !/^\+?[0-9]{10,15}$/.test(String(farmer_mobile).trim())
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid farmer mobile number is required."
            });
        }

        // Validate sale items
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one fertilizer item is required."
            });
        }

        if (items.length > 100) {
            return res.status(400).json({
                success: false,
                message: "A maximum of 100 items is allowed per sale."
            });
        }

        const seenFertilizers = new Set();

        for (const item of items) {
            const fertilizerId = Number(item.fertilizer_id);
            const quantity = Number(item.quantity);
            const sellingPrice = Number(item.selling_price);

            if (
                !Number.isInteger(fertilizerId) ||
                fertilizerId <= 0 ||
                !Number.isInteger(quantity) ||
                quantity <= 0 ||
                !Number.isFinite(sellingPrice) ||
                sellingPrice < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Each item requires a valid fertilizer ID, positive whole-number quantity, and non-negative selling price."
                });
            }

            if (seenFertilizers.has(fertilizerId)) {
                return res.status(400).json({
                    success: false,
                    message: "A fertilizer cannot appear more than once in the same sale. Combine its quantities."
                });
            }

            seenFertilizers.add(fertilizerId);
        }

        // Validate discount
        const discountAmount = Number(discount);

        if (
            !Number.isFinite(discountAmount) ||
            discountAmount < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Discount must be a non-negative amount."
            });
        }

        // Validate optional initial payment
        const paymentAmount = payment
            ? Number(payment.amount)
            : 0;

        if (
            !Number.isFinite(paymentAmount) ||
            paymentAmount < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment amount must be non-negative."
            });
        }

        const paymentMethod = payment?.payment_method || null;

        const allowedPaymentMethods = [
            "CASH",
            "UPI",
            "BANK_TRANSFER",
            "CARD",
            "OTHER"
        ];

        if (
            paymentAmount > 0 &&
            !allowedPaymentMethods.includes(paymentMethod)
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid payment method is required when recording a payment."
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        // Find existing active farmer
        const [farmers] = await connection.query(
            `SELECT farmer_id, farmer_name, mobile_number
             FROM farmers
             WHERE mobile_number = ?
             AND is_active = TRUE
             FOR UPDATE`,
            [String(farmer_mobile).trim()]
        );

        if (farmers.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Active farmer not found. Register the farmer first."
            });
        }

        const farmer = farmers[0];

        // Fetch active fertilizers
        const fertilizerIds = items.map(
            item => Number(item.fertilizer_id)
        );

        const placeholders = fertilizerIds
            .map(() => "?")
            .join(", ");

        const [fertilizers] = await connection.query(
            `SELECT fertilizer_id, fertilizer_name
             FROM fertilizers
             WHERE fertilizer_id IN (${placeholders})
             AND is_active = TRUE`,
            fertilizerIds
        );

        if (fertilizers.length !== fertilizerIds.length) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "One or more fertilizers are unavailable or inactive."
            });
        }

        // Calculate sale item totals
        let subtotal = 0;

        const saleItems = items.map(item => {
            const quantity = Number(item.quantity);
            const sellingPrice = Number(item.selling_price);

            const itemSubtotal = Number(
                (quantity * sellingPrice).toFixed(2)
            );

            subtotal = Number(
                (subtotal + itemSubtotal).toFixed(2)
            );

            return {
                fertilizer_id: Number(item.fertilizer_id),
                quantity,
                selling_price: sellingPrice,
                subtotal: itemSubtotal
            };
        });

        if (discountAmount > subtotal) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Discount cannot exceed the sale subtotal."
            });
        }

        const totalAmount = Number(
            (subtotal - discountAmount).toFixed(2)
        );

        if (paymentAmount > totalAmount) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Payment cannot exceed the sale total."
            });
        }

        // Lock inventory rows and check available stock
        for (const item of saleItems) {
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

            const availableQuantity = Number(
                inventoryRows[0].available_quantity
            );

            if (availableQuantity < item.quantity) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for fertilizer ID ${item.fertilizer_id}. Available: ${availableQuantity}, requested: ${item.quantity}.`
                });
            }
        }

        // Generate invoice number
        const [settings] = await connection.query(
            `SELECT invoice_prefix
             FROM business_settings
             ORDER BY setting_id ASC
             LIMIT 1`
        );

        const invoicePrefix =
            settings.length > 0 && settings[0].invoice_prefix
                ? settings[0].invoice_prefix
                : "SBT";

        const invoiceNumber =
            `${invoicePrefix}-${Date.now()}`;

        // Create sale
        const [saleResult] = await connection.query(
            `INSERT INTO sales
            (
                invoice_number,
                farmer_id,
                admin_id,
                subtotal,
                discount,
                tax_amount,
                total_amount,
                notes
            )
            VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            [
                invoiceNumber,
                farmer.farmer_id,
                req.admin.adminId,
                subtotal,
                discountAmount,
                totalAmount,
                notes || null
            ]
        );

        const saleId = saleResult.insertId;

        // Insert sale items and deduct inventory
        for (const item of saleItems) {
            await connection.query(
                `INSERT INTO sale_items
                (
                    sale_id,
                    fertilizer_id,
                    quantity,
                    selling_price,
                    subtotal
                )
                VALUES (?, ?, ?, ?, ?)`,
                [
                    saleId,
                    item.fertilizer_id,
                    item.quantity,
                    item.selling_price,
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

            const previousQuantity = Number(
                inventoryRows[0].available_quantity
            );

            const newQuantity =
                previousQuantity - item.quantity;

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
                VALUES (?, 'SALE', ?, ?, ?, ?, ?)`,
                [
                    item.fertilizer_id,
                    saleId,
                    item.quantity,
                    previousQuantity,
                    newQuantity,
                    `Sale invoice ${invoiceNumber}`
                ]
            );
        }

        // Record initial payment if provided
        if (paymentAmount > 0) {
            await connection.query(
                `INSERT INTO payments
                (
                    sale_id,
                    admin_id,
                    amount,
                    payment_method,
                    transaction_reference,
                    notes
                )
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    saleId,
                    req.admin.adminId,
                    paymentAmount,
                    paymentMethod,
                    payment.transaction_reference || null,
                    payment.notes || null
                ]
            );
        }

        await connection.commit();

        const outstandingAmount = Number(
            (totalAmount - paymentAmount).toFixed(2)
        );

        return res.status(201).json({
            success: true,
            message: "Sale recorded and inventory updated successfully.",
            sale: {
                sale_id: saleId,
                invoice_number: invoiceNumber,
                farmer: {
                    farmer_id: farmer.farmer_id,
                    farmer_name: farmer.farmer_name,
                    mobile_number: farmer.mobile_number
                },
                subtotal,
                discount: discountAmount,
                tax_amount: 0,
                total_amount: totalAmount,
                amount_paid: paymentAmount,
                outstanding_amount: outstandingAmount,
                payment_status:
                    outstandingAmount === 0
                        ? "PAID"
                        : paymentAmount > 0
                            ? "PARTIALLY_PAID"
                            : "UNPAID",
                items: saleItems
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Create sale error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to create sale."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    createSale
};
