const db = require("../config/db");

// GET /api/sms
// Admin: View all SMS history
const getAllSmsLogs = async (req, res) => {
    try {
        const [smsLogs] = await db.query(`
            SELECT
                sl.sms_id,
                sl.invoice_id,
                sl.farmer_mobile,
                sl.message_content,
                sl.provider_message_id,
                sl.delivery_status,
                sl.attempt_count,
                sl.error_message,
                sl.sent_at,
                sl.delivered_at,
                sl.created_at,

                i.invoice_number

            FROM sms_logs sl

            INNER JOIN invoices i
                ON i.invoice_id = sl.invoice_id

            ORDER BY sl.created_at DESC
            LIMIT 200
        `);

        return res.status(200).json({
            success: true,
            count: smsLogs.length,
            sms_logs: smsLogs
        });

    } catch (error) {
        console.error("Get SMS logs error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve SMS history."
        });
    }
};


// GET /api/sms/invoice/:invoiceId
// Admin: View SMS history for a particular invoice
const getSmsLogsByInvoice = async (req, res) => {
    try {
        const invoiceId = Number(req.params.invoiceId);

        if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid invoice ID."
            });
        }

        const [smsLogs] = await db.query(
            `SELECT
                sms_id,
                invoice_id,
                farmer_mobile,
                message_content,
                provider_message_id,
                delivery_status,
                attempt_count,
                error_message,
                sent_at,
                delivered_at,
                created_at
             FROM sms_logs
             WHERE invoice_id = ?
             ORDER BY created_at DESC`,
            [invoiceId]
        );

        return res.status(200).json({
            success: true,
            count: smsLogs.length,
            sms_logs: smsLogs
        });

    } catch (error) {
        console.error("Get invoice SMS history error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve invoice SMS history."
        });
    }
};


module.exports = {
    getAllSmsLogs,
    getSmsLogsByInvoice
};