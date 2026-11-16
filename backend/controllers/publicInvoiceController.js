
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const db = require("../config/db");

const BACKEND_DIRECTORY = path.resolve(__dirname, "..");

const INVOICE_DIRECTORY = path.join(
  BACKEND_DIRECTORY,
  "uploads",
  "invoices"
);

// GET /api/invoices/public/:token
const viewPublicInvoice = async (req, res) => {
  try {
    const { token } = req.params;

    // Validate the 64-character hexadecimal access token.
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid invoice link."
      });
    }

    // Hash the token before database lookup.
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Support invoice tokens and access-token records.
    const [invoices] = await db.query(
      `SELECT
          i.invoice_id,
          i.invoice_number,
          i.pdf_storage_path,
          i.invoice_status
       FROM invoices i
       WHERE
          i.invoice_status = 'ACTIVE'
          AND (
              i.token_hash = ?
              OR EXISTS (
                  SELECT 1
                  FROM invoice_access_tokens t
                  WHERE
                      t.invoice_id = i.invoice_id
                      AND t.token_hash = ?
                      AND t.token_status = 'ACTIVE'
              )
          )
       LIMIT 1`,
      [tokenHash, tokenHash]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found or invoice link is invalid."
      });
    }

    const invoice = invoices[0];

    if (!invoice.pdf_storage_path) {
      return res.status(404).json({
        success: false,
        message: "Invoice PDF is unavailable."
      });
    }

    // Resolve paths against the backend directory.
    // Absolute paths are supported for existing records.
    const filePath = path.isAbsolute(invoice.pdf_storage_path)
      ? path.resolve(invoice.pdf_storage_path)
      : path.resolve(
          BACKEND_DIRECTORY,
          invoice.pdf_storage_path
        );

    // Prevent access to files outside uploads/invoices.
    const relativePath = path.relative(
      INVOICE_DIRECTORY,
      filePath
    );

    if (
      !relativePath ||
      relativePath.startsWith("..") ||
      path.isAbsolute(relativePath)
    ) {
      console.error("Invoice path validation failed.");

      return res.status(500).json({
        success: false,
        message: "Invoice file location is invalid."
      });
    }

    // Check that the PDF exists and is readable.
    try {
      await fs.promises.access(
        filePath,
        fs.constants.R_OK
      );
    } catch {
      return res.status(404).json({
        success: false,
        message: "Invoice PDF is unavailable."
      });
    }

    // Set secure PDF response headers.
    const safeFileName = String(invoice.invoice_number || "invoice")
      .replace(/[^a-zA-Z0-9_-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeFileName}.pdf"`
    );

    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // Stream the invoice PDF.
    const pdfStream = fs.createReadStream(filePath);

    pdfStream.on("error", (error) => {
      console.error("Invoice PDF streaming error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to open invoice."
        });
      } else {
        res.destroy(error);
      }
    });

    pdfStream.pipe(res);

  } catch (error) {
    console.error("Public invoice access error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Unable to retrieve invoice."
      });
    }
  }
};

module.exports = {
  viewPublicInvoice
};
