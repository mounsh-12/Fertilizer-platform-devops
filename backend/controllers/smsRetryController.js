
const crypto = require("crypto");

const db = require("../config/db");

const {
    sendInvoiceSms
} = require("../services/smsService");

const MAX_SMS_ATTEMPTS = 3;

const retryFailedSms = async (req, res) => {
    const connection = await db.getConnection();

    let sms = null;
    let retryStarted = false;
    let transactionOpen = false;

    try {
        const smsId = Number(req.params.smsId);

        if (!Number.isInteger(smsId) || smsId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid SMS record ID."
            });
        }

        const baseUrl = process.env.PUBLIC_API_BASE_URL;

        if (!baseUrl) {
            return res.status(500).json({
                success: false,
                message: "Public invoice URL is not configured."
            });
        }

        await connection.beginTransaction();
        transactionOpen = true;

        // Lock the original SMS record.
        const [records] = await connection.query(
            `SELECT
                sl.sms_id,
                sl.invoice_id,
                sl.farmer_mobile,
                sl.delivery_status,
                i.invoice_status
             FROM sms_logs sl
             INNER JOIN invoices i
                ON i.invoice_id = sl.invoice_id
             WHERE sl.sms_id = ?
             FOR UPDATE`,
            [smsId]
        );

        if (records.length === 0) {
            await connection.rollback();
            transactionOpen = false;

            return res.status(404).json({
                success: false,
                message: "SMS record not found."
            });
        }

        sms = records[0];

        if (sms.delivery_status !== "FAILED") {
            await connection.rollback();
            transactionOpen = false;

            return res.status(409).json({
                success: false,
                message: "Only failed SMS records can be retried."
            });
        }

        if (sms.invoice_status !== "ACTIVE") {
            await connection.rollback();
            transactionOpen = false;

            return res.status(409).json({
                success: false,
                message: "This invoice is not active."
            });
        }

        // Check the maximum number of SMS attempts.
        const [attempts] = await connection.query(
            `SELECT COUNT(*) AS attempt_count
             FROM sms_logs
             WHERE invoice_id = ?`,
            [sms.invoice_id]
        );

        if (
            Number(attempts[0].attempt_count) >=
            MAX_SMS_ATTEMPTS
        ) {
            await connection.rollback();
            transactionOpen = false;

            return res.status(429).json({
                success: false,
                message: "Maximum SMS attempts reached for this invoice."
            });
        }

        // Claim the original failed record.
        const [claimResult] = await connection.query(
            `UPDATE sms_logs
             SET delivery_status = 'PENDING'
             WHERE sms_id = ?
               AND delivery_status = 'FAILED'`,
            [smsId]
        );

        if (claimResult.affectedRows !== 1) {
            await connection.rollback();
            transactionOpen = false;

            return res.status(409).json({
                success: false,
                message: "This SMS record is already being processed."
            });
        }

        // Generate a new 256-bit random access token.
        const accessToken = crypto
            .randomBytes(32)
            .toString("hex");

        // Store only the SHA-256 hash.
        const tokenHash = crypto
            .createHash("sha256")
            .update(accessToken)
            .digest("hex");

        await connection.query(
            `INSERT INTO invoice_access_tokens (
                invoice_id,
                token_hash,
                token_status
             )
             VALUES (?, ?, 'ACTIVE')`,
            [
                sms.invoice_id,
                tokenHash
            ]
        );

        await connection.commit();
        transactionOpen = false;
        retryStarted = true;

        // Construct the new public invoice URL.
        const invoiceUrl =
            `${baseUrl.replace(/\/+$/, "")}/api/invoices/public/${accessToken}`;

        // The SMS service creates a separate SMS log.
        const result = await sendInvoiceSms({
            invoiceId: sms.invoice_id,
            farmerMobile: sms.farmer_mobile,
            invoiceUrl
        });

        // Keep the original attempt marked as FAILED.
        await db.query(
            `UPDATE sms_logs
             SET
                delivery_status = 'FAILED',
                error_message = ?
             WHERE sms_id = ?`,
            [
                result.success
                    ? "Retry submitted. See the newer SMS log for its delivery status."
                    : "Retry unsuccessful. See the newer SMS log for details.",
                smsId
            ]
        );

        if (!result.success) {
            return res.status(502).json({
                success: false,
                message: "SMS retry was unsuccessful.",
                details: result.message
            });
        }

        return res.status(200).json({
            success: true,
            message: "SMS retry submitted successfully.",
            originalSmsId: smsId,
            retryMessage: result
        });

    } catch (error) {
        if (transactionOpen) {
            await connection.rollback();
        }

        if (retryStarted && sms) {
            try {
                await db.query(
                    `UPDATE sms_logs
                     SET
                        delivery_status = 'FAILED',
                        error_message = 'Retry processing was interrupted. Check newer SMS logs and provider status.'
                     WHERE sms_id = ?`,
                    [sms.sms_id]
                );
            } catch (updateError) {
                console.error(
                    "Unable to update original SMS record:",
                    updateError
                );
            }
        }

        console.error("SMS retry error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to process SMS retry."
        });

    } finally {
        connection.release();
    }
};

module.exports = {
    retryFailedSms
};
