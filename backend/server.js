
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const fertilizerRoutes = require("./routes/fertilizerRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const stockPurchaseRoutes = require("./routes/stockPurchaseRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const farmerRoutes = require("./routes/farmerRoutes");
const salesRoutes = require("./routes/salesRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const farmerCreditRoutes = require("./routes/farmerCreditRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const smsRoutes = require("./routes/smsRoutes");
const smsWebhookRoutes = require("./routes/smsWebhookRoutes");
const smsRetryRoutes = require("./routes/smsRetryRoutes");

const verifyAdmin = require("./middleware/authMiddleware");
const settingsRoutes = require("./routes/settingsRoutes");

const reportRoutes = require("./routes/reportRoutes");
const {
    recoverStuckSmsLogs
} = require("./services/smsRecoveryService");

const app = express();

app.use(cors());
app.use(express.json());

// General API status
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Sri Byraweswara Traders API is running."
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        await db.query("SELECT 1 AS database_status");

        res.status(200).json({
            success: true,
            message: "Backend and database are healthy."
        });

    } catch (error) {
        console.error("Health check failed:", error.message);

        res.status(503).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// Public authentication routes.
// Login is public; the profile endpoint has its own JWT middleware.
app.use("/api/auth", authRoutes);

// Protected business APIs
app.use("/api/fertilizers", verifyAdmin, fertilizerRoutes);
app.use("/api/suppliers", verifyAdmin, supplierRoutes);
app.use("/api/stock-purchases", verifyAdmin, stockPurchaseRoutes);
app.use("/api/inventory", verifyAdmin, inventoryRoutes);
app.use("/api/farmers", verifyAdmin, farmerRoutes);
app.use("/api/sales", verifyAdmin, salesRoutes);
app.use("/api/payments", verifyAdmin, paymentRoutes);
app.use("/api/credits", verifyAdmin, farmerCreditRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", verifyAdmin, reportRoutes);
app.use("/api/reports", reportRoutes);
// Invoice routes remain unchanged for public invoice-link compatibility.
app.use("/api/invoices", invoiceRoutes);

// Public SMS provider webhook.
// The provider must be able to send delivery-status callbacks.
app.use("/api/sms/webhook", smsWebhookRoutes);

// Protected SMS operations
app.use("/api/sms", verifyAdmin, smsRetryRoutes);
app.use("/api/sms", verifyAdmin, smsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);

    res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

const PORT = process.env.PORT || 5001;

let recoveryRunning = false;

const runSmsRecovery = async () => {
    if (recoveryRunning) {
        console.log(
            "SMS recovery skipped: previous run is still active."
        );
        return;
    }

    recoveryRunning = true;

    try {
        await recoverStuckSmsLogs();
    } catch (error) {
        console.error("SMS recovery scheduler error:", error);
    } finally {
        recoveryRunning = false;
    }
};

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);

    // Run once when the backend starts.
    runSmsRecovery();

    // Run again every 5 minutes.
    const recoveryInterval = setInterval(() => {
        runSmsRecovery();
    }, 5 * 60 * 1000);

    recoveryInterval.unref();
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
    } else {
        console.error("Server startup error:", error);
    }
});
