const db = require("../config/db");

const recoverStuckSmsLogs = async () => {
    try {
        const [result] = await db.query(
            `UPDATE sms_logs
             SET
                delivery_status = 'FAILED',
                error_message = 'SMS attempt timed out or was interrupted. Verify provider status before retrying.'
             WHERE
                delivery_status = 'PENDING'
                AND created_at < DATE_SUB(
                    CURRENT_TIMESTAMP,
                    INTERVAL 10 MINUTE
                )`
        );

        console.log(
            `SMS recovery completed. Records marked for review: ${result.affectedRows}`
        );

        return {
            success: true,
            recoveredCount: result.affectedRows
        };

    } catch (error) {
        console.error("SMS recovery failed:", error);

        return {
            success: false,
            recoveredCount: 0,
            message: error.message
        };
    }
};

module.exports = {
    recoverStuckSmsLogs
};