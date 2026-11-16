
const db = require("../config/db");

// Bulk add fertilizers
const bulkAddFertilizers = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { fertilizers } = req.body;

        // Validate request
        if (!Array.isArray(fertilizers) || fertilizers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one fertilizer."
            });
        }

        if (fertilizers.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Maximum 100 fertilizers can be added at once."
            });
        }

        // Validate every product before starting transaction
        for (let i = 0; i < fertilizers.length; i++) {
            const item = fertilizers[i];

            if (
                !item.fertilizer_name ||
                !item.brand_name ||
                item.bag_size_kg === undefined ||
                item.purchase_price === undefined ||
                item.selling_price === undefined
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Required details missing for product ${i + 1}.`
                });
            }

            const bagSize = Number(item.bag_size_kg);
            const purchasePrice = Number(item.purchase_price);
            const sellingPrice = Number(item.selling_price);
            const quantity = Number(item.initial_quantity ?? 0);

            if (
                !Number.isFinite(bagSize) ||
                bagSize <= 0 ||
                !Number.isFinite(purchasePrice) ||
                purchasePrice < 0 ||
                !Number.isFinite(sellingPrice) ||
                sellingPrice < 0 ||
                !Number.isInteger(quantity) ||
                quantity < 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid price, bag size or quantity for product ${i + 1}.`
                });
            }
        }

        // Prevent duplicate products within the same request
        const productKeys = fertilizers.map((item) => {
            return [
                item.fertilizer_name.trim().toLowerCase(),
                item.brand_name.trim().toLowerCase(),
                Number(item.bag_size_kg)
            ].join("|");
        });

        if (new Set(productKeys).size !== productKeys.length) {
            return res.status(400).json({
                success: false,
                message: "Duplicate fertilizers found in the request."
            });
        }

        await connection.beginTransaction();

        const addedProducts = [];

        for (const item of fertilizers) {
            const [result] = await connection.query(
                `INSERT INTO fertilizers (
                    fertilizer_name,
                    brand_name,
                    fertilizer_type,
                    bag_size_kg,
                    purchase_price,
                    selling_price
                )
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    item.fertilizer_name.trim(),
                    item.brand_name.trim(),
                    item.fertilizer_type || null,
                    item.bag_size_kg,
                    item.purchase_price,
                    item.selling_price
                ]
            );

            const fertilizerId = result.insertId;

            await connection.query(
                `INSERT INTO inventory (
                    fertilizer_id,
                    available_quantity
                )
                VALUES (?, ?)`,
                [
                    fertilizerId,
                    Number(item.initial_quantity ?? 0)
                ]
            );

            addedProducts.push({
                fertilizer_id: fertilizerId,
                fertilizer_name: item.fertilizer_name,
                brand_name: item.brand_name
            });
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "All fertilizers added successfully.",
            total_added: addedProducts.length,
            fertilizers: addedProducts
        });

    } catch (error) {
        await connection.rollback();

        console.error("Bulk fertilizer error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "One or more fertilizers already exist."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Unable to add fertilizers."
        });

    } finally {
        connection.release();
    }
};

module.exports = {
    bulkAddFertilizers
};
