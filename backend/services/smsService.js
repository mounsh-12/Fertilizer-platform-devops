
const db = require("../config/db");

const MSG91_API_URL = "https://control.msg91.com/api/v5/flow";
const MAX_SMS_ATTEMPTS = 3;

const sendInvoiceSms = async ({
    invoiceId,
    farmerMobile,
    invoiceUrl
}) => {
    let connection;
    let smsLogId = null;
    let transactionOpen = false;

    try {
        // Validate configuration before reserving an SMS attempt.
        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID;

        if (!authKey || !templateId) {
            throw new Error("MSG91 credentials are not configured.");
        }

        if (!invoiceUrl) {
            throw new Error("Invoice URL is missing.");
        }

        const mobile = String(farmerMobile || "").replace(/\D/g, "");

        if (!/^(91)?[6-9]\d{9}$/.test(mobile)) {
            throw new Error("Invalid Indian mobile number.");
        }

        const formattedMobile = mobile.startsWith("91")
            ? mobile
            : `91${mobile}`;

        // Acquire a database connection.
        connection = await db.getConnection();

        await connection.beginTransaction();
        transactionOpen = true;

        // Lock the invoice row.
        // All SMS attempts for this invoice must acquire this lock.
        const [invoices] = await connection.query(
            `SELECT invoice_id, invoice_status
             FROM invoices
             WHERE invoice_id = ?
             FOR UPDATE`,
            [invoiceId]
        );

        if (invoices.length === 0) {
            throw new Error("Invoice not found.");
        }

        if (invoices[0].invoice_status !== "ACTIVE") {
            throw new Error("Cannot send SMS for an inactive invoice.");
        }

        // Count all attempts for this invoice while holding the lock.
        const [attempts] = await connection.query(
            `SELECT COUNT(*) AS attempt_count
             FROM sms_logs
             WHERE invoice_id = ?`,
            [invoiceId]
        );

        if (
            Number(attempts[0].attempt_count) >= MAX_SMS_ATTEMPTS
        ) {
            throw new Error(
                `Maximum of ${MAX_SMS_ATTEMPTS} SMS attempts reached for this invoice.`
            );
        }

        const messageContent =
            "Your invoice from Sri Byraweswara Traders is ready. Secure invoice link sent via SMS.";

        // Reserve the attempt by creating its PENDING log.
        const [logResult] = await connection.query(
            `INSERT INTO sms_logs (
                invoice_id,
                farmer_mobile,
                message_content,
                delivery_status,
                attempt_count
             )
             VALUES (?, ?, ?, 'PENDING', 1)`,
            [
                invoiceId,
                farmerMobile,
                messageContent
            ]
        );

        smsLogId = logResult.insertId;

        // Commit the attempt reservation before contacting MSG91.
        await connection.commit();
        transactionOpen = false;

        connection.release();
        connection = null;

        // Submit the SMS to MSG91.
        const response = await fetch(MSG91_API_URL, {
            method: "POST",

            headers: {
                accept: "application/json",
                authkey: authKey,
                "content-type": "application/json"
            },

            body: JSON.stringify({
                template_id: templateId,
                short_url: "0",
                realTimeResponse: "1",

                recipients: [
                    {
                        mobiles: formattedMobile,
                        VAR1: invoiceUrl
                    }
                ]
            }),

            signal: AbortSignal.timeout(15000)
        });

        const responseData = await response.json();

        const providerMessageId =
            responseData.request_id ||
            responseData.requestId ||
            responseData.message_id ||
            responseData.messageId ||
            null;

        if (
            !response.ok ||
            String(responseData.type || "").toLowerCase() === "error"
        ) {
            throw new Error(
                responseData.message ||
                responseData.error ||
                "MSG91 rejected the SMS request."
            );
        }

        if (!providerMessageId) {
            throw new Error(
                "MSG91 response did not contain a message identifier."
            );
        }

        // Record provider acceptance.
        await db.query(
            `UPDATE sms_logs
             SET
                delivery_status = 'SENT',
                provider_message_id = ?,
                sent_at = CURRENT_TIMESTAMP,
                error_message = NULL
             WHERE sms_id = ?`,
            [
                String(providerMessageId),
                smsLogId
            ]
        );

        return {
            success: true,
            smsLogId,
            providerMessageId: String(providerMessageId),
            message: "SMS submitted successfully."
        };

    } catch (error) {
        console.error("Invoice SMS error:", error.message);

        // Roll back only if the reservation transaction is still open.
        if (transactionOpen && connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "SMS transaction rollback failed:",
                    rollbackError
                );
            }
        }

        // If an attempt was already reserved, preserve its failure details.
        if (smsLogId) {
            try {
                await db.query(
                    `UPDATE sms_logs
                     SET
                        delivery_status = 'FAILED',
                        error_message = ?
                     WHERE sms_id = ?
                       AND delivery_status = 'PENDING'`,
                    [
                        error.message.slice(0, 1000),
                        smsLogId
                    ]
                );
            } catch (updateError) {
                console.error(
                    "Unable to update SMS log:",
                    updateError
                );
            }
        }

        return {
            success: false,
            smsLogId,
            message: error.message
        };

    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    sendInvoiceSms
};
