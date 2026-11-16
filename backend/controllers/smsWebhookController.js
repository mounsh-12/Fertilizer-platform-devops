const db = require("../config/db");
const crypto = require("crypto");

// Convert MSG91 delivery statuses into our database statuses
const mapDeliveryStatus = (status) => {
    const normalized = String(status || "").toLowerCase();

    if (
        normalized === "1" ||
        normalized === "delivered" ||
        normalized === "success"
    ) {
        return "DELIVERED";
    }

    if (
        normalized === "0" ||
        normalized === "sent"
    ) {
        return "SENT";
    }

    if (
        normalized === "2" ||
        normalized === "9" ||
        normalized === "16" ||
        normalized === "17" ||
        normalized === "20" ||
        normalized === "25" ||
        normalized === "failed" ||
        normalized === "rejected" ||
        normalized === "blocked"
    ) {
        return "FAILED";
    }

    return null;
};


// Validate webhook secret
const verifyWebhookSecret = (req) => {
    const configuredSecret = process.env.MSG91_WEBHOOK_SECRET;
    const receivedSecret = req.headers["x-webhook-secret"];

    if (!configuredSecret || !receivedSecret) {
        return false;
    }

    const expected = Buffer.from(configuredSecret);
    const received = Buffer.from(String(receivedSecret));

    if (expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, received);
};


// POST /api/sms/webhook
const receiveSmsDeliveryReport = async (req, res) => {
    try {
        // Authenticate the incoming webhook
        if (!verifyWebhookSecret(req)) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized webhook request."
            });
        }

        let reports = [];

        // Support MSG91's new webhook format
        if (Array.isArray(req.body)) {
            reports = req.body;
        } else if (Array.isArray(req.body.data)) {
            reports = req.body.data;
        } else if (req.body.data && typeof req.body.data === "string") {
            try {
                reports = JSON.parse(req.body.data);
            } catch {
                reports = [];
            }
        } else if (req.body.requestId || req.body.request_id) {
            reports = [req.body];
        }

        if (!Array.isArray(reports) || reports.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid or empty delivery report."
            });
        }

        let updatedCount = 0;
        let ignoredCount = 0;

        for (const report of reports) {
            const requestId =
                report.requestId ||
                report.request_id;

            const mobile =
                report.telNum ||
                report.number ||
                report.mobiles;

            const statusValue =
                report.status ||
                report.event ||
                report.eventName;

            const failureReason =
                report.failureReason ||
                report.failedReason ||
                report.desc ||
                null;

            const deliveryStatus = mapDeliveryStatus(statusValue);

            if (!requestId || !deliveryStatus) {
                ignoredCount++;
                continue;
            }

            // Normalize mobile number
            const normalizedMobile = mobile
                ? String(mobile).replace(/\D/g, "")
                : null;

            // Match the provider request ID and recipient
            let sql = `
                SELECT sms_id
                FROM sms_logs
                WHERE provider_message_id = ?
            `;

            const params = [String(requestId)];

            if (normalizedMobile) {
                sql += `
                    AND REGEXP_REPLACE(farmer_mobile, '[^0-9]', '') = ?
                `;
                params.push(normalizedMobile);
            }

            sql += " ORDER BY created_at DESC LIMIT 1";

            const [logs] = await db.query(sql, params);

            if (logs.length === 0) {
                ignoredCount++;
                continue;
            }

            const smsId = logs[0].sms_id;

            // Do not overwrite a final delivery result with a late
            // non-final SENT event.
            const [result] = await db.query(
                `UPDATE sms_logs
                 SET
                    delivery_status = ?,
                    delivered_at = CASE
                        WHEN ? = 'DELIVERED'
                        THEN COALESCE(delivered_at, CURRENT_TIMESTAMP)
                        ELSE delivered_at
                    END,
                    error_message = CASE
                        WHEN ? = 'FAILED' THEN ?
                        ELSE NULL
                    END
                 WHERE sms_id = ?
                   AND delivery_status NOT IN ('DELIVERED', 'FAILED')`,
                [
                    deliveryStatus,
                    deliveryStatus,
                    deliveryStatus,
                    failureReason,
                    smsId
                ]
            );

            if (result.affectedRows > 0) {
                updatedCount++;
            } else {
                ignoredCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: "SMS delivery reports processed.",
            updated: updatedCount,
            ignored: ignoredCount
        });

    } catch (error) {
        console.error("SMS webhook error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process SMS delivery report."
        });
    }
};

module.exports = {
    receiveSmsDeliveryReport
};