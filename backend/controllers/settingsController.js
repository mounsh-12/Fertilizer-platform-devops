
const db = require("../config/db");

const defaultSettings = {
    business: {
        name: "Sri Byraweswara Traders",
        owner: "",
        phone: "",
        email: "",
        address: "",
        city: "",
        state: "Andhra Pradesh",
        pincode: "",
        gst: ""
    },
    invoice: {
        prefix: "SBT",
        nextNumber: "1001",
        footer: "Thank you for your business!",
        showLogo: true,
        showBusinessAddress: true,
        showFarmerPhone: true
    },
    preferences: {
        currency: "INR",
        language: "English",
        dateFormat: "DD/MM/YYYY",
        notifications: true,
        lowStockAlerts: true
    },
    security: {
        sessionTimeout: "30",
        confirmDelete: true,
        requireConfirmation: true
    }
};

const mergeSettings = (saved) => ({
    business: {
        ...defaultSettings.business,
        ...(saved.business || {})
    },
    invoice: {
        ...defaultSettings.invoice,
        ...(saved.invoice || {})
    },
    preferences: {
        ...defaultSettings.preferences,
        ...(saved.preferences || {})
    },
    security: {
        ...defaultSettings.security,
        ...(saved.security || {})
    }
});

// GET /api/settings
const getSettings = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT settings_json FROM app_settings WHERE setting_id = 1"
        );

        if (rows.length === 0) {
            return res.status(200).json({
                success: true,
                settings: defaultSettings
            });
        }

        let saved = rows[0].settings_json;

        if (typeof saved === "string") {
            saved = JSON.parse(saved);
        }

        return res.status(200).json({
            success: true,
            settings: mergeSettings(saved)
        });
    } catch (error) {
        console.error("Get settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load settings."
        });
    }
};

// PUT /api/settings
const updateSettings = async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
            return res.status(400).json({
                success: false,
                message: "Valid settings data is required."
            });
        }

        const mergedSettings = mergeSettings(settings);
        const adminId = req.admin?.adminId || null;

        await db.query(
            `INSERT INTO app_settings
                (setting_id, settings_json, updated_by)
             VALUES (1, ?, ?)
             ON DUPLICATE KEY UPDATE
                settings_json = VALUES(settings_json),
                updated_by = VALUES(updated_by)`,
            [JSON.stringify(mergedSettings), adminId]
        );

        return res.status(200).json({
            success: true,
            message: "Settings saved successfully.",
            settings: mergedSettings
        });
    } catch (error) {
        console.error("Update settings error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save settings."
        });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
