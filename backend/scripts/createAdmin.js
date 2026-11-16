
require("dotenv").config();

const bcrypt = require("bcrypt");
const readline = require("readline");
const db = require("../config/db");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
};

const askPassword = () => {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        const stdout = process.stdout;

        stdout.write("Enter admin password: ");

        let password = "";

        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding("utf8");

        const handleInput = (key) => {
            if (key === "\u0003") {
                cleanup();
                process.exit(1);
            }

            if (key === "\r" || key === "\n") {
                cleanup();
                stdout.write("\n");
                resolve(password);
                return;
            }

            if (key === "\u007f" || key === "\b") {
                password = password.slice(0, -1);
                return;
            }

            if (key >= " " && key <= "~") {
                password += key;
            }
        };

        const cleanup = () => {
            stdin.removeListener("data", handleInput);
            stdin.setRawMode(false);
            stdin.pause();
        };

        stdin.on("data", handleInput);
    });
};

const createAdmin = async () => {
    try {
        console.log("\n================================");
        console.log("Sri Byraweswara Traders");
        console.log("Initial Admin Setup");
        console.log("================================\n");

        const [existingAdmins] = await db.query(
            "SELECT COUNT(*) AS total FROM admins"
        );

        if (existingAdmins[0].total > 0) {
            console.log("An admin account already exists.");
            console.log("Initial setup is not permitted again.");
            return;
        }

        const fullName = await ask("Enter admin name: ");
        const email = (await ask("Enter admin email: ")).toLowerCase();
        const mobile = await ask("Enter admin mobile number: ");
        const password = await askPassword();

        if (!fullName || !email || !mobile || !password) {
            throw new Error("All fields are required.");
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Enter a valid email address.");
        }

        if (!/^[6-9]\d{9}$/.test(mobile)) {
            throw new Error("Enter a valid 10-digit Indian mobile number.");
        }

        if (password.length < 12) {
            throw new Error("Password must contain at least 12 characters.");
        }

        const passwordHash = await bcrypt.hash(password, 12);

        await db.query(
            `INSERT INTO admins
            (full_name, email, mobile_number, password_hash)
            VALUES (?, ?, ?, ?)`,
            [fullName, email, mobile, passwordHash]
        );

        console.log("\nAdmin account created successfully!");

    } catch (error) {
        console.error("\nAdmin setup failed:", error.message);
        process.exitCode = 1;

    } finally {
        rl.close();
        await db.end();
    }
};

createAdmin();
