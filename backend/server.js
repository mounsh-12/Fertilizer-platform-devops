
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const client = require("prom-client");

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

// --------------------------------------------------
// EXPRESS APPLICATION
// --------------------------------------------------

const app = express();

// --------------------------------------------------
// PROMETHEUS CONFIGURATION
// --------------------------------------------------

const register = new client.Registry();

client.collectDefaultMetrics({
    register,
    prefix: "nodejs_"
});

// Total HTTP requests
const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [register]
});

// HTTP request duration
const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5],
    registers: [register]
});

// --------------------------------------------------
// PROMETHEUS METRICS ENDPOINT
// --------------------------------------------------

app.get("/metrics", async (req, res) => {
    try {
        res.set("Content-Type", register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        console.error("Prometheus metrics error:", error);
        res.status(500).end("Unable to generate metrics");
    }
});

// --------------------------------------------------
// HTTP REQUEST MONITORING MIDDLEWARE
// --------------------------------------------------

app.use((req, res, next) => {
    // Do not count Prometheus scraping requests.
    if (req.path === "/metrics") {
        return next();
    }

    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
        const duration =
            Number(process.hrtime.bigint() - startTime) / 1e9;

        // Use the Express route pattern instead of raw URLs
        // to avoid high-cardinality metric labels.
        const route = req.route
            ? `${req.baseUrl || ""}${req.route.path}`
            : "unmatched";

        const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode)
        };

        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, duration);
    });

    next();
});

// --------------------------------------------------
// GENERAL MIDDLEWARE
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// GENERAL API STATUS
// --------------------------------------------------

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Sri Byraweswara Traders API is running."
    });
});

// --------------------------------------------------
// DATABASE HEALTH CHECK
// --------------------------------------------------

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

// --------------------------------------------------
// PUBLIC AUTHENTICATION ROUTES
// --------------------------------------------------

app.use("/api/auth", authRoutes);

// --------------------------------------------------
// PROTECTED BUSINESS APIs
// --------------------------------------------------

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

// --------------------------------------------------
// INVOICE ROUTES
// --------------------------------------------------

app.use("/api/invoices", invoiceRoutes);

// --------------------------------------------------
// SMS ROUTES
// --------------------------------------------------

// Public SMS provider webhook.
app.use("/api/sms/webhook", smsWebhookRoutes);

// Protected SMS operations.
app.use("/api/sms", verifyAdmin, smsRetryRoutes);
app.use("/api/sms", verifyAdmin, smsRoutes);

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);

    res.status(500).json({
        success: false,
        message: "Internal server error."
    });
});

// --------------------------------------------------
// SERVER CONFIGURATION
// --------------------------------------------------

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

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Prometheus metrics: http://localhost:${PORT}/metrics`);

    // Run once when the backend starts.
    runSmsRecovery();

    // Run again every 5 minutes.
    const recoveryInterval = setInterval(() => {
        runSmsRecovery();
    }, 5 * 60 * 1000);

    recoveryInterval.unref();
});

// --------------------------------------------------
// SERVER ERROR HANDLING
// --------------------------------------------------

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
    } else {
        console.error("Server startup error:", error);
    }
});
