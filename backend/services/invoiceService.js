
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const db = require("../config/db");

const generateInvoiceForSale = async (saleId) => {
  // Validate configuration BEFORE creating files or database records.
  const publicBaseUrl = process.env.PUBLIC_API_BASE_URL;

  if (!publicBaseUrl) {
    throw new Error("PUBLIC_API_BASE_URL is not configured.");
  }

  const connection = await db.getConnection();

  let generatedPdfPath = null;
  let transactionStarted = false;
  let transactionCommitted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Fetch sale and farmer details.
    const [sales] = await connection.execute(
      `SELECT
         s.sale_id,
         s.invoice_number,
         s.sale_date,
         s.subtotal,
         s.discount,
         s.tax_amount,
         s.total_amount,
         s.sale_status,
         s.notes,
         f.farmer_name,
         f.mobile_number,
         f.village,
         f.address
       FROM sales s
       INNER JOIN farmers f ON f.farmer_id = s.farmer_id
       WHERE s.sale_id = ?
       FOR UPDATE`,
      [saleId]
    );

    if (sales.length === 0) {
      throw new Error("Sale not found.");
    }

    const sale = sales[0];

    if (sale.sale_status !== "COMPLETED") {
      throw new Error(
        "Invoices can only be generated for completed sales."
      );
    }

    // 2. Prevent duplicate invoices.
    const [existingInvoices] = await connection.execute(
      "SELECT invoice_id FROM invoices WHERE sale_id = ?",
      [saleId]
    );

    if (existingInvoices.length > 0) {
      throw new Error("An invoice already exists for this sale.");
    }

    // 3. Fetch sale items.
    const [items] = await connection.execute(
      `SELECT
         f.fertilizer_name,
         f.brand_name,
         f.bag_size_kg,
         si.quantity,
         si.selling_price,
         si.subtotal
       FROM sale_items si
       INNER JOIN fertilizers f
         ON f.fertilizer_id = si.fertilizer_id
       WHERE si.sale_id = ?`,
      [saleId]
    );

    if (items.length === 0) {
      throw new Error("No sale items found.");
    }

    // 4. Calculate payment summary.
    const [paymentRows] = await connection.execute(
      `SELECT COALESCE(SUM(amount), 0) AS amount_paid
       FROM payments
       WHERE sale_id = ?`,
      [saleId]
    );

    const amountPaid = Number(paymentRows[0].amount_paid || 0);
    const totalAmount = Number(sale.total_amount || 0);
    const outstanding = Math.max(0, totalAmount - amountPaid);

    // 5. Generate secure public access token.
    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 6. Prepare invoice number and file paths.
    const invoiceNumber =
      sale.invoice_number || `INV-${Date.now()}-${saleId}`;

    const invoiceDirectory = path.join(
      __dirname,
      "..",
      "uploads",
      "invoices"
    );

    fs.mkdirSync(invoiceDirectory, { recursive: true });

    const safeInvoiceNumber = invoiceNumber.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    );

    const fileName = `${safeInvoiceNumber}.pdf`;

    generatedPdfPath = path.join(invoiceDirectory, fileName);

    // Store a backend-relative path in the database.
    const relativePdfPath = path.join(
      "uploads",
      "invoices",
      fileName
    );

    // 7. Generate PDF.
    await new Promise((resolve, reject) => {
      const pdf = new PDFDocument({
        size: "A4",
        margin: 50
      });

      const output = fs.createWriteStream(generatedPdfPath);

      let settled = false;

      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      };

      output.on("finish", () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      });

      output.on("error", fail);
      pdf.on("error", fail);

      pdf.pipe(output);

      pdf
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("SRI BYRAWESWARA TRADERS", {
          align: "center"
        });

      pdf
        .moveDown(0.4)
        .fontSize(10)
        .font("Helvetica")
        .text("Fertilizer Sales Invoice", {
          align: "center"
        });

      pdf.moveDown(1);

      pdf
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Invoice Details");

      pdf.moveDown(0.4);

      pdf.fontSize(10).font("Helvetica");

      pdf.text(`Invoice Number: ${invoiceNumber}`);
      pdf.text(`Sale ID: ${sale.sale_id}`);
      pdf.text(
        `Date: ${new Date(sale.sale_date).toLocaleDateString("en-IN")}`
      );

      pdf.moveDown(1);

      pdf
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Farmer Details");

      pdf.moveDown(0.4);

      pdf.fontSize(10).font("Helvetica");

      pdf.text(`Name: ${sale.farmer_name || "N/A"}`);
      pdf.text(`Mobile: ${sale.mobile_number || "N/A"}`);
      pdf.text(`Village: ${sale.village || "N/A"}`);
      pdf.text(`Address: ${sale.address || "N/A"}`);

      pdf.moveDown(1);

      pdf
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Items");

      pdf.moveDown(0.5);

      let y = pdf.y;

      const columns = {
        fertilizer: 50,
        quantity: 285,
        price: 365,
        amount: 455
      };

      pdf.font("Helvetica-Bold").fontSize(9);

      pdf.text("Fertilizer", columns.fertilizer, y);
      pdf.text("Qty", columns.quantity, y);
      pdf.text("Price", columns.price, y);
      pdf.text("Amount", columns.amount, y);

      y += 22;

      pdf.moveTo(50, y - 5).lineTo(545, y - 5).stroke();

      pdf.font("Helvetica").fontSize(9);

      for (const item of items) {
        if (y > 700) {
          pdf.addPage();
          y = 60;
        }

        const fertilizerName = [
          item.fertilizer_name,
          item.brand_name,
          item.bag_size_kg
            ? `${item.bag_size_kg} kg`
            : null
        ]
          .filter(Boolean)
          .join(" - ");

        pdf.text(fertilizerName, columns.fertilizer, y, {
          width: 225
        });

        pdf.text(String(item.quantity), columns.quantity, y);

        pdf.text(
          Number(item.selling_price).toFixed(2),
          columns.price,
          y
        );

        pdf.text(
          Number(item.subtotal).toFixed(2),
          columns.amount,
          y
        );

        y += 25;
      }

      y = Math.max(y + 15, pdf.y + 15);

      if (y > 700) {
        pdf.addPage();
        y = 60;
      }

      pdf.moveTo(50, y).lineTo(545, y).stroke();

      pdf.y = y + 15;

      pdf.fontSize(10).font("Helvetica");

      pdf.text(
        `Subtotal: Rs. ${Number(sale.subtotal).toFixed(2)}`,
        { align: "right" }
      );

      pdf.text(
        `Discount: Rs. ${Number(sale.discount).toFixed(2)}`,
        { align: "right" }
      );

      pdf.text(
        `Tax: Rs. ${Number(sale.tax_amount).toFixed(2)}`,
        { align: "right" }
      );

      pdf.moveDown(0.5);

      pdf
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Total: Rs. ${totalAmount.toFixed(2)}`, {
          align: "right"
        });

      pdf.moveDown(0.5);

      pdf
        .font("Helvetica")
        .fontSize(10)
        .text(`Amount Paid: Rs. ${amountPaid.toFixed(2)}`, {
          align: "right"
        });

      pdf.text(
        `Outstanding: Rs. ${outstanding.toFixed(2)}`,
        { align: "right" }
      );

      if (sale.notes) {
        pdf.moveDown(1);

        pdf
          .font("Helvetica-Bold")
          .text("Notes");

        pdf
          .font("Helvetica")
          .text(sale.notes);
      }

      pdf.moveDown(2);

      pdf
        .fontSize(10)
        .text("Thank you for your business!", {
          align: "center"
        });

      pdf.end();
    });

    // 8. Insert invoice record.
    const [invoiceResult] = await connection.execute(
      `INSERT INTO invoices
       (
         sale_id,
         invoice_number,
         token_hash,
         pdf_storage_path,
         invoice_status
       )
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [
        saleId,
        invoiceNumber,
        tokenHash,
        relativePdfPath
      ]
    );

    const invoiceId = invoiceResult.insertId;

    // 9. Insert public access token record.
    await connection.execute(
      `INSERT INTO invoice_access_tokens
       (
         invoice_id,
         token_hash,
         token_status
       )
       VALUES (?, ?, 'ACTIVE')`,
      [invoiceId, tokenHash]
    );

    // 10. Commit only after PDF and both records are ready.
    await connection.commit();
    transactionCommitted = true;

    // 11. Return the public invoice URL.
    const invoiceUrl =
      `${publicBaseUrl.replace(/\/+$/, "")}` +
      `/api/invoices/public/${rawToken}`;

    return {
      invoiceId,
      invoiceUrl,
      invoiceNumber
    };

  } catch (error) {
    // Roll back only if the transaction is still open.
    if (transactionStarted && !transactionCommitted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Invoice transaction rollback failed:",
          rollbackError
        );
      }
    }

    // Remove the PDF only when generation/database work failed
    // before a successful commit.
    if (
      !transactionCommitted &&
      generatedPdfPath &&
      fs.existsSync(generatedPdfPath)
    ) {
      try {
        fs.unlinkSync(generatedPdfPath);
      } catch (fileError) {
        console.error(
          "Failed to remove incomplete invoice PDF:",
          fileError
        );
      }
    }

    throw error;

  } finally {
    connection.release();
  }
};

module.exports = {
  generateInvoiceForSale
};
