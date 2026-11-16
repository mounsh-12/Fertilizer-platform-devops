
const db = require("../config/db");

// Purchase list with summarized item details for the Purchases screen.
const getAllStockPurchases = async (req, res) => {
    try {
        const [purchases] = await db.query(
            `SELECT
                sp.purchase_id,
                sp.supplier_id,
                s.supplier_name,
                s.company_name,
                sp.supplier_invoice_number,
                sp.purchase_date,
                sp.total_amount,
                sp.notes,
                sp.created_at,
                COALESCE(SUM(spi.quantity), 0) AS total_quantity,
                COUNT(spi.purchase_item_id) AS item_count,
                GROUP_CONCAT(
                    DISTINCT CONCAT(
                        f.fertilizer_name,
                        ' (',
                        f.brand_name,
                        ')'
                    )
                    ORDER BY f.fertilizer_name
                    SEPARATOR ', '
                ) AS products
             FROM stock_purchases sp
             INNER JOIN suppliers s
                ON s.supplier_id = sp.supplier_id
             LEFT JOIN stock_purchase_items spi
                ON spi.purchase_id = sp.purchase_id
             LEFT JOIN fertilizers f
                ON f.fertilizer_id = spi.fertilizer_id
             GROUP BY
                sp.purchase_id,
                sp.supplier_id,
                s.supplier_name,
                s.company_name,
                sp.supplier_invoice_number,
                sp.purchase_date,
                sp.total_amount,
                sp.notes,
                sp.created_at
             ORDER BY sp.purchase_id DESC`
        );

        return res.status(200).json({
            success: true,
            count: purchases.length,
            purchases
        });

    } catch (error) {
        console.error(
            "Get stock purchases error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve purchases."
        });
    }
};

const getStockPurchaseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "A valid purchase ID is required."
            });
        }

        const [purchases] = await db.query(
            `SELECT
                sp.purchase_id,
                sp.supplier_id,
                s.supplier_name,
                s.company_name,
                s.mobile_number AS supplier_mobile,
                sp.supplier_invoice_number,
                sp.purchase_date,
                sp.total_amount,
                sp.notes,
                sp.created_at
             FROM stock_purchases sp
             INNER JOIN suppliers s
                ON s.supplier_id = sp.supplier_id
             WHERE sp.purchase_id = ?
             LIMIT 1`,
            [id]
        );

        if (purchases.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found."
            });
        }

        const [items] = await db.query(
            `SELECT
                spi.purchase_item_id,
                spi.fertilizer_id,
                f.fertilizer_name,
                f.brand_name,
                f.bag_size_kg,
                spi.quantity,
                spi.purchase_price,
                spi.subtotal
             FROM stock_purchase_items spi
             INNER JOIN fertilizers f
                ON f.fertilizer_id = spi.fertilizer_id
             WHERE spi.purchase_id = ?
             ORDER BY spi.purchase_item_id ASC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            purchase: {
                ...purchases[0],
                items
            }
        });

    } catch (error) {
        console.error(
            "Get stock purchase error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve purchase details."
        });
    }
};

module.exports = {
    getAllStockPurchases,
    getStockPurchaseById
};
