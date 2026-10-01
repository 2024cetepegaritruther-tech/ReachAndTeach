const bcrypt = require("bcryptjs");
const { pool } = require("./db");

const ADMIN_EMAIL = "admin@reachandteach.com";
const ADMIN_PASSWORD = "Admin123!";
const ADMIN_USERNAME = "Admin";
const ADMIN_NAME = "REACH & TEACH Admin";

async function main() {
    let connection;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

        // Create or update the account in the table used by /api/auth/login.
        const [existingUsers] = await connection.query(
            "SELECT UserID FROM users WHERE Email = ? LIMIT 1",
            [ADMIN_EMAIL]
        );

        let userId;

        if (existingUsers.length > 0) {
            userId = existingUsers[0].UserID;

            await connection.query(
                `UPDATE users
                 SET PasswordHash = ?, Role = 'Admin'
                 WHERE UserID = ?`,
                [passwordHash, userId]
            );
        } else {
            const [result] = await connection.query(
                `INSERT INTO users (Email, PasswordHash, Role)
                 VALUES (?, ?, 'Admin')`,
                [ADMIN_EMAIL, passwordHash]
            );

            userId = result.insertId;
        }

        // Create/update the matching Admin profile.
        const [existingAdmins] = await connection.query(
            "SELECT AdminID FROM admins WHERE UserID = ? LIMIT 1",
            [userId]
        );

        if (existingAdmins.length > 0) {
            await connection.query(
                `UPDATE admins
                 SET Username = ?,
                     FullName = ?,
                     Email = ?,
                     Password = ?,
                     Role = 'Admin'
                 WHERE AdminID = ?`,
                [
                    ADMIN_USERNAME,
                    ADMIN_NAME,
                    ADMIN_EMAIL,
                    passwordHash,
                    existingAdmins[0].AdminID
                ]
            );
        } else {
            await connection.query(
                `INSERT INTO admins
                 (UserID, Username, FullName, Email, Password, Role)
                 VALUES (?, ?, ?, ?, ?, 'Admin')`,
                [
                    userId,
                    ADMIN_USERNAME,
                    ADMIN_NAME,
                    ADMIN_EMAIL,
                    passwordHash
                ]
            );
        }

        await connection.commit();

        console.log("");
        console.log("========================================");
        console.log(" REACH & TEACH DEFAULT ADMIN CREATED");
        console.log("========================================");
        console.log("Email:    " + ADMIN_EMAIL);
        console.log("Password: " + ADMIN_PASSWORD);
        console.log("Username: " + ADMIN_USERNAME);
        console.log("Name:     " + ADMIN_NAME);
        console.log("Role:     Admin");
        console.log("========================================");
        console.log("");
        console.log("You can now log in at:");
        console.log("http://localhost:3000/admin/");
        console.log("");
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch {}
        }

        console.error("");
        console.error("ADMIN SETUP FAILED");
        console.error("----------------------------------------");
        console.error(error.message);
        console.error("");
        process.exitCode = 1;
    } finally {
        if (connection) connection.release();
        try {
            await pool.end();
        } catch {}
    }
}

main();
