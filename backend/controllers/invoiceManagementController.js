
const db = require("../config/db");

// GET /api/invoices
const getAllInvoices = async (req, res) => {
  try {
    const [invoices] = await db.query(`
      SELECT
        i.invoice_id,
        i.invoice_number,
        i.invoice_status,
        i.generated_at,
        i.revoked_at,
        s.sale_id,
        s.sale_date,
        s.total_amount,
        s.sale_status,
        f.farmer_id,
        f.farmer_name,
        f.mobile_number,
        COALESCE(p.total_paid, 0) AS total_paid,
        GREATEST(
          s.total_amount - COALESCE(p.total_paid, 0),
          0
        ) AS outstanding_amount
      FROM invoices i
      INNER JOIN sales s
        ON s.sale_id = i.sale_id
      INNER JOIN farmers f
        ON f.farmer_id = s.farmer_id
      LEFT JOIN (
        SELECT sale_id, SUM(amount) AS total_paid
        FROM payments
        GROUP BY sale_id
      ) p ON p.sale_id = s.sale_id
      ORDER BY i.generated_at DESC
    `);

    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices
    });

  } catch (error) {
    console.error("Get invoices error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve invoices."
    });
  }
};


// PATCH /api/invoices/:id/revoke
const revokeInvoice = async (req, res) => {
  const invoiceId = Number(req.params.id);
  const adminId = req.admin?.adminId;

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid invoice ID."
    });
  }

  if (!adminId) {
    return res.status(401).json({
      success: false,
      message: "Admin authentication is required."
    });
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await db.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Lock invoice row to prevent simultaneous revocation.
    const [invoices] = await connection.execute(
      `SELECT invoice_id, invoice_status
       FROM invoices
       WHERE invoice_id = ?
       FOR UPDATE`,
      [invoiceId]
    );

    if (invoices.length === 0) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Invoice not found."
      });
    }

    if (invoices[0].invoice_status === "REVOKED") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "Invoice is already revoked."
      });
    }

    // Revoke the invoice.
    const [invoiceUpdate] = await connection.execute(
      `UPDATE invoices
       SET
         invoice_status = 'REVOKED',
         revoked_at = CURRENT_TIMESTAMP,
         revoked_by = ?
       WHERE invoice_id = ?
         AND invoice_status = 'ACTIVE'`,
      [adminId, invoiceId]
    );

    if (invoiceUpdate.affectedRows !== 1) {
      throw new Error("Invoice status could not be updated.");
    }

    // Revoke every active public access token for this invoice.
    await connection.execute(
      `UPDATE invoice_access_tokens
       SET
         token_status = 'REVOKED',
         revoked_at = CURRENT_TIMESTAMP
       WHERE invoice_id = ?
         AND token_status = 'ACTIVE'`,
      [invoiceId]
    );

    // Commit both changes together.
    await connection.commit();
    transactionStarted = false;

    return res.status(200).json({
      success: true,
      message: "Invoice and public access token revoked successfully."
    });

  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Invoice revocation rollback error:",
          rollbackError
        );
      }
    }

    console.error("Revoke invoice error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to revoke invoice link."
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
};


module.exports = {
  getAllInvoices,
  revokeInvoice
};
