
const db = require("../config/db");

// Get all sales with their fertilizer items and payment details
const getAllSales = async (req, res) => {
    try {
        const [sales] = await db.query(
            `SELECT
                s.sale_id,
                s.invoice_number,
                s.sale_date,
                s.subtotal,
                s.discount,
                s.tax_amount,
                s.total_amount,
                s.sale_status,
                s.notes,

                f.farmer_id,
                f.farmer_name,
                f.mobile_number,

                COALESCE(
                    (
                        SELECT SUM(p.amount)
                        FROM payments p
                        WHERE p.sale_id = s.sale_id
                    ),
                    0
                ) AS amount_paid,

                GREATEST(
                    s.total_amount - COALESCE(
                        (
                            SELECT SUM(p.amount)
                            FROM payments p
                            WHERE p.sale_id = s.sale_id
                        ),
                        0
                    ),
                    0
                ) AS outstanding_amount

             FROM sales s

             INNER JOIN farmers f
                ON s.farmer_id = f.farmer_id

             ORDER BY s.sale_id DESC`
        );

        if (sales.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                sales: []
            });
        }

        const saleIds = sales.map(sale => sale.sale_id);
        const placeholders = saleIds.map(() => "?").join(", ");

        // Retrieve all sale items in one query
        const [items] = await db.query(
            `SELECT
                si.sale_id,
                si.sale_item_id,
                si.fertilizer_id,
                fert.fertilizer_name,
                fert.brand_name,
                fert.bag_size_kg,
                si.quantity,
                si.selling_price,
                si.subtotal

             FROM sale_items si

             INNER JOIN fertilizers fert
                ON si.fertilizer_id = fert.fertilizer_id

             WHERE si.sale_id IN (${placeholders})

             ORDER BY si.sale_item_id ASC`,
            saleIds
        );

        // Retrieve all payment methods in one query
        const [payments] = await db.query(
            `SELECT
                sale_id,
                payment_method,
                amount,
                payment_date
             FROM payments
             WHERE sale_id IN (${placeholders})
             ORDER BY payment_id ASC`,
            saleIds
        );

        const itemsBySale = {};
        const paymentsBySale = {};

        for (const item of items) {
            if (!itemsBySale[item.sale_id]) {
                itemsBySale[item.sale_id] = [];
            }

            itemsBySale[item.sale_id].push(item);
        }

        for (const payment of payments) {
            if (!paymentsBySale[payment.sale_id]) {
                paymentsBySale[payment.sale_id] = [];
            }

            paymentsBySale[payment.sale_id].push(payment);
        }

        const formattedSales = sales.map(sale => {
            const amountPaid = Number(sale.amount_paid);
            const totalAmount = Number(sale.total_amount);
            const outstanding = Math.max(
                0,
                totalAmount - amountPaid
            );

            return {
                ...sale,
                subtotal: Number(sale.subtotal),
                discount: Number(sale.discount),
                tax_amount: Number(sale.tax_amount),
                total_amount: totalAmount,
                amount_paid: amountPaid,
                outstanding_amount: Number(outstanding.toFixed(2)),

                payment_status:
                    outstanding === 0
                        ? "PAID"
                        : amountPaid > 0
                            ? "PARTIALLY_PAID"
                            : "UNPAID",

                items: itemsBySale[sale.sale_id] || [],
                payments: paymentsBySale[sale.sale_id] || []
            };
        });

        return res.status(200).json({
            success: true,
            count: formattedSales.length,
            sales: formattedSales
        });

    } catch (error) {
        console.error("Get sales error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sales."
        });
    }
};


// Get one sale with all its items and payments
const getSaleById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid sale ID is required."
            });
        }

        const [sales] = await db.query(
            `SELECT
                s.sale_id,
                s.invoice_number,
                s.sale_date,
                s.subtotal,
                s.discount,
                s.tax_amount,
                s.total_amount,
                s.sale_status,
                s.notes,

                f.farmer_id,
                f.farmer_name,
                f.mobile_number,

                a.full_name AS admin_name,

                COALESCE(
                    (
                        SELECT SUM(p.amount)
                        FROM payments p
                        WHERE p.sale_id = s.sale_id
                    ),
                    0
                ) AS amount_paid

             FROM sales s

             INNER JOIN farmers f
                ON s.farmer_id = f.farmer_id

             INNER JOIN admins a
                ON s.admin_id = a.admin_id

             WHERE s.sale_id = ?
             LIMIT 1`,
            [id]
        );

        if (sales.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        const [items] = await db.query(
            `SELECT
                si.sale_item_id,
                si.fertilizer_id,
                fert.fertilizer_name,
                fert.brand_name,
                fert.bag_size_kg,
                si.quantity,
                si.selling_price,
                si.subtotal

             FROM sale_items si

             INNER JOIN fertilizers fert
                ON si.fertilizer_id = fert.fertilizer_id

             WHERE si.sale_id = ?

             ORDER BY si.sale_item_id ASC`,
            [id]
        );

        const [payments] = await db.query(
            `SELECT
                payment_id,
                amount,
                payment_method,
                payment_date,
                transaction_reference,
                notes

             FROM payments

             WHERE sale_id = ?

             ORDER BY payment_id ASC`,
            [id]
        );

        const sale = sales[0];

        const amountPaid = Number(sale.amount_paid);
        const totalAmount = Number(sale.total_amount);

        const outstanding = Math.max(
            0,
            totalAmount - amountPaid
        );

        return res.status(200).json({
            success: true,

            sale: {
                ...sale,

                subtotal: Number(sale.subtotal),
                discount: Number(sale.discount),
                tax_amount: Number(sale.tax_amount),
                total_amount: totalAmount,

                amount_paid: amountPaid,

                outstanding_amount: Number(
                    outstanding.toFixed(2)
                ),

                payment_status:
                    outstanding === 0
                        ? "PAID"
                        : amountPaid > 0
                            ? "PARTIALLY_PAID"
                            : "UNPAID",

                items,
                payments
            }
        });

    } catch (error) {
        console.error("Get sale details error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve sale details."
        });
    }
};


module.exports = {
    getAllSales,
    getSaleById
};
