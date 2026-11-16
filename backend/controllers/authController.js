
const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Admin Login
const loginAdmin = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Email/mobile and password are required"
            });
        }

        // Find admin using email or mobile number
        const [admins] = await db.query(
            `SELECT admin_id, full_name, email,
                    mobile_number, password_hash, is_active
             FROM admins
             WHERE email = ? OR mobile_number = ?
             LIMIT 1`,
            [identifier, identifier]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const admin = admins[0];

        // Check account status
        if (!admin.is_active) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive"
            });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Generate JWT
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const token = jwt.sign(
            {
                adminId: admin.admin_id,
                email: admin.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "8h"
            }
        );

        // Send response
        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            admin: {
                admin_id: admin.admin_id,
                full_name: admin.full_name,
                email: admin.email,
                mobile_number: admin.mobile_number
            }
        });

    } catch (error) {
        console.error("Admin login error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    loginAdmin
};
