const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "reachandteach",

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function testConnection() {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.query("SELECT 1");

        console.log("✅ MySQL database connected successfully.");

        return true;
    } catch (error) {
        console.error("❌ MySQL connection failed:");
        console.error(error.message);

        return false;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    pool,
    testConnection
};