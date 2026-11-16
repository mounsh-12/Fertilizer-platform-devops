const db = require("../config/db");

const {
    generateInvoiceForSale
} = require("../services/invoiceService");

const {
    sendInvoiceSms
} = require("../services/smsService");

// POST /api/invoices/generate/:saleId
const generateInvoice = async (req, res) => {
    try {
        const saleId = Number(req.params.saleId);

        if (!Number.isInteger(saleId) || saleId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid sale ID."
            });
        }

        // Generate PDF and secure invoice URL
        const invoice = await generateInvoiceForSale(saleId);

        if (!invoice.invoiceUrl) {
            return res.status(500).json({
                success: false,
                message: "Invoice generated, but public URL configuration is missing.",
                invoice_number: invoice.invoiceNumber
            });
        }

        // Retrieve invoice ID and farmer mobile number
        const [records] = await db.query(
            `SELECT
                i.invoice_id,
                f.mobile_number
             FROM invoices i
             INNER JOIN sales s
                ON s.sale_id = i.sale_id
             INNER JOIN farmers f
                ON f.farmer_id = s.farmer_id
             WHERE i.sale_id = ?
             LIMIT 1`,
            [saleId]
        );

        if (records.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Invoice was generated, but farmer information could not be retrieved."
            });
        }

        const { invoice_id, mobile_number } = records[0];

        // Send invoice link through SMS
        const smsResult = await sendInvoiceSms({
            invoiceId: invoice_id,
            farmerMobile: mobile_number,
            invoiceUrl: invoice.invoiceUrl
        });

        return res.status(201).json({
            success: true,
            message: "Invoice generated successfully.",
            invoice: {
                invoice_number: invoice.invoiceNumber,
                invoice_url: invoice.invoiceUrl
            },
            sms: {
                success: smsResult.success,
                status: smsResult.deliveryStatus,
                message: smsResult.success
                    ? "SMS request accepted by the provider."
                    : "Invoice generated, but SMS sending failed."
            }
        });

    } catch (error) {
        console.error("Invoice generation error:", error);

        if (error.message === "Sale not found.") {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        }

        if (
            error.message === "An invoice already exists for this sale." ||
            error.message === "Invoices can only be generated for completed sales."
        ) {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to generate invoice."
        });
    }
};

module.exports = {
    generateInvoice
};