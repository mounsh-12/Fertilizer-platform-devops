
const db = require("../config/db");

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const getDateRange = (period) => {
    const now = new Date();

    const currentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );

    let startDate;

    switch (period) {
        case "Last 3 Months":
            startDate = new Date(
                now.getFullYear(),
                now.getMonth() - 2,
                1
            );
            break;

        case "Last 6 Months":
            startDate = new Date(
                now.getFullYear(),
                now.getMonth() - 5,
                1
            );
            break;

        case "This Year":
        default:
            startDate = new Date(now.getFullYear(), 0, 1);
    }

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(now),
        firstMonth: startDate,
        currentMonth,
        now
    };
};

const generateMonthLabels = (firstMonth, currentMonth) => {
    const months = [];
    const cursor = new Date(firstMonth);

    while (cursor <= currentMonth) {
        months.push({
            key: `${cursor.getFullYear()}-${String(
                cursor.getMonth() + 1
            ).padStart(2, "0")}`,
            month: cursor.toLocaleString("en-IN", {
                month: "short"
            }),
            sales: 0,
            purchases: 0
        });

        cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
};

// GET /api/reports?period=This%20Year
const getBusinessReports = async (req, res) => {
    try {
        const allowedPeriods = [
            "This Year",
            "Last 6 Months",
            "Last 3 Months"
        ];

        const period = allowedPeriods.includes(req.query.period)
            ? req.query.period
            : "This Year";

        const {
            startDate,
            endDate,
            firstMonth,
            currentMonth,
            now
        } = getDateRange(period);

        const dateParams = [startDate, now];

        // 1. Monthly sales
        const [salesRows] = await db.query(
            `SELECT
                DATE_FORMAT(sale_date, '%Y-%m') AS month_key,
                COALESCE(SUM(total_amount), 0) AS total_sales
             FROM sales
             WHERE sale_status = 'COMPLETED'
               AND sale_date >= ?
               AND sale_date <= ?
             GROUP BY DATE_FORMAT(sale_date, '%Y-%m')
             ORDER BY month_key`,
            dateParams
        );

        // 2. Monthly purchases
        const [purchaseRows] = await db.query(
            `SELECT
                DATE_FORMAT(purchase_date, '%Y-%m') AS month_key,
                COALESCE(SUM(total_amount), 0) AS total_purchases
             FROM stock_purchases
             WHERE purchase_date >= ?
               AND purchase_date <= ?
             GROUP BY DATE_FORMAT(purchase_date, '%Y-%m')
             ORDER BY month_key`,
            dateParams
        );

        const monthlyData = generateMonthLabels(
            firstMonth,
            currentMonth
        );

        const monthMap = new Map(
            monthlyData.map((item) => [item.key, item])
        );

        salesRows.forEach((row) => {
            const month = monthMap.get(row.month_key);

            if (month) {
                month.sales = Number(row.total_sales);
            }
        });

        purchaseRows.forEach((row) => {
            const month = monthMap.get(row.month_key);

            if (month) {
                month.purchases = Number(row.total_purchases);
            }
        });

        // 3. Payment method breakdown
        const [paymentRows] = await db.query(
            `SELECT
                payment_method,
                COALESCE(SUM(amount), 0) AS total_amount
             FROM payments
             WHERE payment_date >= ?
               AND payment_date <= ?
             GROUP BY payment_method`,
            dateParams
        );

        const paymentLabels = {
            CASH: "Cash",
            UPI: "UPI",
            BANK_TRANSFER: "Bank Transfer",
            CARD: "Card",
            OTHER: "Other"
        };

        const paymentData = paymentRows.map((row) => ({
            name: paymentLabels[row.payment_method] || row.payment_method,
            value: Number(row.total_amount)
        }));

        const totalPayments = paymentData.reduce(
            (sum, item) => sum + item.value,
            0
        );

        // 4. Outstanding credit for completed sales in the period
        const [creditRows] = await db.query(
            `SELECT
                COALESCE(
                    SUM(
                        GREATEST(
                            s.total_amount - COALESCE(p.total_paid, 0),
                            0
                        )
                    ),
                    0
                ) AS outstanding_credit
             FROM sales s
             LEFT JOIN (
                SELECT sale_id, SUM(amount) AS total_paid
                FROM payments
                GROUP BY sale_id
             ) p ON p.sale_id = s.sale_id
             WHERE s.sale_status = 'COMPLETED'
               AND s.sale_date >= ?
               AND s.sale_date <= ?`,
            dateParams
        );

        const outstandingCredit = Number(
            creditRows[0].outstanding_credit || 0
        );

        paymentData.push({
            name: "Credit",
            value: outstandingCredit
        });

        // 5. Fertilizer-wise quantity sold
        const [productRows] = await db.query(
            `SELECT
                f.fertilizer_name AS name,
                COALESCE(SUM(si.quantity), 0) AS quantity
             FROM sale_items si
             INNER JOIN sales s
                ON s.sale_id = si.sale_id
             INNER JOIN fertilizers f
                ON f.fertilizer_id = si.fertilizer_id
             WHERE s.sale_status = 'COMPLETED'
               AND s.sale_date >= ?
               AND s.sale_date <= ?
             GROUP BY f.fertilizer_id, f.fertilizer_name
             ORDER BY quantity DESC`,
            dateParams
        );

        const productData = productRows.map((row) => ({
            name: row.name,
            quantity: Number(row.quantity)
        }));

        // 6. Summary totals
        const totalSales = monthlyData.reduce(
            (sum, item) => sum + item.sales,
            0
        );

        const totalPurchases = monthlyData.reduce(
            (sum, item) => sum + item.purchases,
            0
        );

        const estimatedProfit = totalSales - totalPurchases;

        return res.status(200).json({
            success: true,
            period,
            dateRange: {
                startDate,
                endDate
            },
            summary: {
                totalSales,
                totalPurchases,
                estimatedProfit,
                totalPayments,
                outstandingCredit
            },
            monthlyData: monthlyData.map(
                ({ month, sales, purchases }) => ({
                    month,
                    sales,
                    purchases
                })
            ),
            paymentData,
            productData
        });

    } catch (error) {
        console.error("Business reports error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate business reports."
        });
    }
};

module.exports = {
    getBusinessReports
};
