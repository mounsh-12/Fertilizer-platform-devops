const db = require("../config/db");

// GET /api/credits/farmers
// Display credit balances for all farmers
const getAllFarmerCredits = async (req, res) => {
    try {
        const [farmers] = await db.query(`
            SELECT
                f.farmer_id,
                f.farmer_name,
                f.mobile_number,
                f.village,

                COALESCE(t.total_sales, 0) AS total_sales,
                COALESCE(t.total_paid, 0) AS total_paid,
                COALESCE(t.outstanding_balance, 0) AS outstanding_balance,
                COALESCE(t.outstanding_invoice_count, 0) AS outstanding_invoice_count

            FROM farmers f

            LEFT JOIN (
                SELECT
                    s.farmer_id,

                    SUM(s.total_amount) AS total_sales,

                    SUM(COALESCE(p.total_paid, 0)) AS total_paid,

                    SUM(
                        GREATEST(
                            s.total_amount - COALESCE(p.total_paid, 0),
                            0
                        )
                    ) AS outstanding_balance,

                    SUM(
                        CASE
                            WHEN s.total_amount - COALESCE(p.total_paid, 0) > 0
                            THEN 1
                            ELSE 0
                        END
                    ) AS outstanding_invoice_count

                FROM sales s

                LEFT JOIN (
                    SELECT
                        sale_id,
                        SUM(amount) AS total_paid
                    FROM payments
                    GROUP BY sale_id
                ) p ON p.sale_id = s.sale_id

                WHERE s.sale_status = 'COMPLETED'

                GROUP BY s.farmer_id
            ) t ON t.farmer_id = f.farmer_id

            WHERE f.is_active = TRUE

            ORDER BY outstanding_balance DESC
        `);

        return res.status(200).json({
            success: true,
            count: farmers.length,
            farmers
        });

    } catch (error) {
        console.error("Get farmer credits error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve farmer credit balances."
        });
    }
};


// GET /api/credits/farmers/:id
// Display one farmer's outstanding invoices
const getFarmerCreditDetails = async (req, res) => {
    try {
        const farmerId = Number(req.params.id);

        if (!Number.isInteger(farmerId) || farmerId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid farmer ID."
            });
        }

        const [farmers] = await db.query(
            `SELECT farmer_id, farmer_name, mobile_number, village, address
             FROM farmers
             WHERE farmer_id = ?`,
            [farmerId]
        );

        if (farmers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Farmer not found."
            });
        }

        const [invoices] = await db.query(`
            SELECT
                s.sale_id,
                s.invoice_number,
                s.sale_date,
                s.total_amount,

                COALESCE(p.total_paid, 0) AS total_paid,

                GREATEST(
                    s.total_amount - COALESCE(p.total_paid, 0),
                    0
                ) AS outstanding_amount

            FROM sales s

            LEFT JOIN (
                SELECT
                    sale_id,
                    SUM(amount) AS total_paid
                FROM payments
                GROUP BY sale_id
            ) p ON p.sale_id = s.sale_id

            WHERE
                s.farmer_id = ?
                AND s.sale_status = 'COMPLETED'
                AND s.total_amount > COALESCE(p.total_paid, 0)

            ORDER BY s.sale_date DESC
        `, [farmerId]);

        const totalOutstanding = invoices.reduce(
            (total, invoice) => total + Number(invoice.outstanding_amount),
            0
        );

        return res.status(200).json({
            success: true,
            farmer: farmers[0],
            outstanding_invoice_count: invoices.length,
            total_outstanding: totalOutstanding,
            invoices
        });

    } catch (error) {
        console.error("Get farmer credit details error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve farmer credit details."
        });
    }
};


module.exports = {
    getAllFarmerCredits,
    getFarmerCreditDetails
};