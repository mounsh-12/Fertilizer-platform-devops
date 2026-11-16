
const db = require("../config/db");

// ==========================================
// GET ALL PAYMENTS
// ==========================================
const getAllPayments = async (req, res) => {
    try {
        const [payments] = await db.query(`
            SELECT
                p.payment_id,
                p.sale_id,
                p.amount,
                p.payment_method,
                p.payment_date,
                p.transaction_reference,
                p.notes,

                s.invoice_number,
                s.total_amount,
                s.sale_status,

                f.farmer_id,
                f.farmer_name,
                f.mobile_number,

                COALESCE(ps.total_paid, 0) AS total_paid,

                GREATEST(
                    s.total_amount - COALESCE(ps.total_paid, 0),
                    0
                ) AS outstanding_amount

            FROM payments p

            INNER JOIN sales s
                ON p.sale_id = s.sale_id

            INNER JOIN farmers f
                ON s.farmer_id = f.farmer_id

            LEFT JOIN (
                SELECT
                    sale_id,
                    SUM(amount) AS total_paid
                FROM payments
                GROUP BY sale_id
            ) ps
                ON s.sale_id = ps.sale_id

            ORDER BY p.payment_id DESC
        `);

        return res.status(200).json({
            success: true,
            count: payments.length,
            payments
        });

    } catch (error) {
        console.error("Get all payments error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve payments."
        });
    }
};


// ==========================================
// RECORD PAYMENT
// ==========================================
const collectPayment = async (req, res) => {
    let connection;

    try {
        const {
            sale_id,
            amount,
            payment_method,
            transaction_reference,
            notes
        } = req.body;

        if (
            !Number.isInteger(Number(sale_id)) ||
            Number(sale_id) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid sale ID is required."
            });
        }

        const paymentAmount = Number(amount);

        if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Payment amount must be greater than zero."
            });
        }

        const allowedMethods = [
            "CASH",
            "UPI",
            "BANK_TRANSFER",
            "CARD",
            "OTHER"
        ];

        if (!allowedMethods.includes(payment_method)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method."
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        const [sales] = await connection.query(
            `SELECT
                sale_id,
                invoice_number,
                total_amount,
                sale_status
             FROM sales
             WHERE sale_id = ?
             FOR UPDATE`,
            [sale_id]
        );

        if (sales.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        const sale = sales[0];

        if (sale.sale_status !== "COMPLETED") {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Cannot collect payment for a cancelled sale."
            });
        }

        const [paymentRows] = await connection.query(
            `SELECT COALESCE(SUM(amount), 0) AS total_paid
             FROM payments
             WHERE sale_id = ?`,
            [sale_id]
        );

        const totalPaid = Number(paymentRows[0].total_paid);
        const totalAmount = Number(sale.total_amount);

        const outstanding = Number(
            (totalAmount - totalPaid).toFixed(2)
        );

        if (outstanding <= 0) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "This sale is already fully paid."
            });
        }

        if (paymentAmount > outstanding) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: `Payment exceeds outstanding balance of ${outstanding}.`
            });
        }

        const [result] = await connection.query(
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
                sale_id,
                req.admin.adminId,
                paymentAmount,
                payment_method,
                transaction_reference || null,
                notes || null
            ]
        );

        await connection.commit();

        const newTotalPaid = Number(
            (totalPaid + paymentAmount).toFixed(2)
        );

        const newOutstanding = Number(
            (totalAmount - newTotalPaid).toFixed(2)
        );

        return res.status(201).json({
            success: true,
            message: "Payment recorded successfully.",
            payment: {
                payment_id: result.insertId,
                sale_id: Number(sale_id),
                invoice_number: sale.invoice_number,
                amount: paymentAmount,
                payment_method,
                total_paid: newTotalPaid,
                outstanding_amount: newOutstanding
            }
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("Collect payment error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to record payment."
        });

    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// ==========================================
// GET PAYMENTS FOR ONE SALE
// ==========================================
const getPaymentsBySaleId = async (req, res) => {
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
                sale_id,
                invoice_number,
                total_amount
             FROM sales
             WHERE sale_id = ?
             LIMIT 1`,
            [id]
        );

        if (sales.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Sale not found."
            });
        }

        const [payments] = await db.query(
            `SELECT
                p.payment_id,
                p.amount,
                p.payment_method,
                p.payment_date,
                p.transaction_reference,
                p.notes,
                a.full_name AS recorded_by
             FROM payments p
             INNER JOIN admins a
                ON p.admin_id = a.admin_id
             WHERE p.sale_id = ?
             ORDER BY p.payment_id DESC`,
            [id]
        );

        const [summary] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) AS total_paid
             FROM payments
             WHERE sale_id = ?`,
            [id]
        );

        const totalAmount = Number(sales[0].total_amount);
        const totalPaid = Number(summary[0].total_paid);

        const outstanding = Number(
            (totalAmount - totalPaid).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            sale: {
                sale_id: sales[0].sale_id,
                invoice_number: sales[0].invoice_number,
                total_amount: totalAmount,
                total_paid: totalPaid,
                outstanding_amount: outstanding
            },
            count: payments.length,
            payments
        });

    } catch (error) {
        console.error("Get payment history error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve payment history."
        });
    }
};


module.exports = {
    getAllPayments,
    collectPayment,
    getPaymentsBySaleId
};
