const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

require("dotenv").config();

const { pool, testConnection } = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET =
    process.env.JWT_SECRET || "reach_and_teach_change_this_secret";

// --------------------------------------------------
// MIDDLEWARE
// --------------------------------------------------

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// FRONTEND FILES
// --------------------------------------------------

const projectRoot = path.join(__dirname, "..");

app.use(
    "/user",
    express.static(path.join(projectRoot, "User"))
);

app.use(
    "/admin",
    express.static(path.join(projectRoot, "Admin"))
);

// --------------------------------------------------
// BASIC TEST API
// --------------------------------------------------

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Reach & Teach API is working."
    });
});

app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS connected");

        res.json({
            success: true,
            database: process.env.DB_NAME,
            message: "Database connection is working.",
            result: rows
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Database connection failed.",
            error: error.message
        });
    }
});

// --------------------------------------------------
// AUTHENTICATION HELPERS
// --------------------------------------------------

function createToken(user) {
    return jwt.sign(
        {
            UserID: user.UserID,
            Email: user.Email,
            Role: user.Role
        },
        JWT_SECRET,
        {
            expiresIn: "8h"
        }
    );
}

function authenticateToken(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).json({
            success: false,
            message: "Authentication required."
        });
    }

    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization format."
        });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
}


// --------------------------------------------------
// ENSURE COUNSELING SESSION FOR CONFIRMED APPOINTMENT
// Creates the counseling-session record that belongs to an
// accepted appointment. Existing sessions are preserved.
// --------------------------------------------------

function normalizeAppointmentTimeForSession(value) {
    const text = String(value || "").trim();

    if (!text) {
        return null;
    }

    // The student interface stores appointment times such as "2:00 PM",
    // while MySQL TIME columns require a 24-hour value such as "14:00:00".
    const twelveHourMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);

    if (twelveHourMatch) {
        let hour = Number(twelveHourMatch[1]);
        const minute = Number(twelveHourMatch[2]);
        const second = Number(twelveHourMatch[3] || 0);
        const meridiem = twelveHourMatch[4].toUpperCase();

        if (
            hour < 1 ||
            hour > 12 ||
            minute < 0 ||
            minute > 59 ||
            second < 0 ||
            second > 59
        ) {
            return null;
        }

        if (meridiem === "AM") {
            hour = hour === 12 ? 0 : hour;
        } else {
            hour = hour === 12 ? 12 : hour + 12;
        }

        return [
            String(hour).padStart(2, "0"),
            String(minute).padStart(2, "0"),
            String(second).padStart(2, "0")
        ].join(":");
    }

    // Also accept an already-normalized MySQL time.
    const twentyFourHourMatch = text.match(
        /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/
    );

    if (twentyFourHourMatch) {
        const hour = Number(twentyFourHourMatch[1]);
        const minute = Number(twentyFourHourMatch[2]);
        const second = Number(twentyFourHourMatch[3] || 0);

        if (
            hour > 23 ||
            minute > 59 ||
            second > 59
        ) {
            return null;
        }

        return [
            String(hour).padStart(2, "0"),
            String(minute).padStart(2, "0"),
            String(second).padStart(2, "0")
        ].join(":");
    }

    return null;
}

async function ensureCounselingSessionForAppointment(appointmentID) {

    const numericAppointmentID = Number(appointmentID);

    if (!Number.isInteger(numericAppointmentID) || numericAppointmentID <= 0) {
        return null;
    }

    const [appointments] = await pool.query(
        `
        SELECT
            AppointmentID,
            StudentID,
            CounselorID,
            AppointmentDate,
            AppointmentTime,
            Reason,
            Status
        FROM appointments
        WHERE AppointmentID = ?
        LIMIT 1
        `,
        [numericAppointmentID]
    );

    if (appointments.length === 0) {
        return null;
    }

    const appointment = appointments[0];
    const status = String(appointment.Status || "").toLowerCase();

    if (status !== "confirmed") {
        return null;
    }

    const sessionTime = normalizeAppointmentTimeForSession(
        appointment.AppointmentTime
    );

    if (!sessionTime) {
        throw new Error(
            "Invalid appointment time. Please use a valid time such as 2:00 PM."
        );
    }

    const [existingSessions] = await pool.query(
        `
        SELECT SessionID
        FROM counseling_session
        WHERE StudentID = ?
          AND SessionDate = ?
          AND TIME_FORMAT(SessionTime, '%H:%i:%s') = ?
        ORDER BY SessionID DESC
        LIMIT 1
        `,
        [
            appointment.StudentID,
            appointment.AppointmentDate,
            sessionTime
        ]
    );

    if (existingSessions.length > 0) {
        return existingSessions[0].SessionID;
    }

    const [result] = await pool.query(
        `
        INSERT INTO counseling_session
        (
            StudentID,
            CounselorID,
            SessionDate,
            SessionTime,
            SessionType,
            SessionStatus,
            Notes
        )
        VALUES (?, ?, ?, ?, 'Individual Counseling', 'Scheduled', ?)
        `,
        [
            appointment.StudentID,
            appointment.CounselorID || null,
            appointment.AppointmentDate,
            sessionTime,
            appointment.Reason || null
        ]
    );

    return result.insertId;
}

// --------------------------------------------------
// REGISTER STUDENT
// --------------------------------------------------

app.post("/api/auth/register", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            gradeLevel
        } = req.body;

        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                success: false,
                message:
                    "First name, last name, email, and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const [existingUsers] = await connection.query(
            "SELECT UserID FROM users WHERE Email = ? LIMIT 1",
            [cleanEmail]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await connection.beginTransaction();

        const [userResult] = await connection.query(
            `
            INSERT INTO users
            (Email, PasswordHash, Role)
            VALUES (?, ?, 'Student')
            `,
            [
                cleanEmail,
                passwordHash
            ]
        );

        const userID = userResult.insertId;

        const [studentResult] = await connection.query(
            `
            INSERT INTO students
            (
                UserID,
                FirstName,
                LastName,
                Email,
                ContactNumber,
                GradeLevel
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                userID,
                firstName.trim(),
                lastName.trim(),
                cleanEmail,
                contactNumber || null,
                gradeLevel || null
            ]
        );

        await connection.commit();

        const user = {
            UserID: userID,
            Email: cleanEmail,
            Role: "Student",
            StudentID: studentResult.insertId
        };

        const token = createToken(user);

        res.status(201).json({
            success: true,
            message: "Student account created successfully.",
            token,
            user
        });

    } catch (error) {

        await connection.rollback();

        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Registration failed.",
            error: error.message
        });

    } finally {
        connection.release();
    }
});

// --------------------------------------------------
// COMMON LOGIN
// --------------------------------------------------

app.post("/api/auth/login", async (req, res) => {
    try {
        const {
            email,
            password
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const [users] = await pool.query(
            `
            SELECT
                UserID,
                Email,
                PasswordHash,
                Role
            FROM users
            WHERE Email = ?
            LIMIT 1
            `,
            [cleanEmail]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const account = users[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            account.PasswordHash
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        let user = {
            UserID: account.UserID,
            Email: account.Email,
            Role: account.Role
        };

        // ----------------------------------------------
        // STUDENT PROFILE
        // ----------------------------------------------

        if (account.Role === "Student") {

            const [students] = await pool.query(
                `
                SELECT
                    StudentID,
                    UserID,
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [account.UserID]
            );

            if (students.length > 0) {
                user = {
                    ...user,
                    ...students[0]
                };
            }
        }

        // ----------------------------------------------
        // ADMIN PROFILE
        // ----------------------------------------------

        if (account.Role === "Admin") {

            const [admins] = await pool.query(
                `
                SELECT
                    AdminID,
                    UserID,
                    Username,
                    FullName,
                    Email,
                    Role
                FROM admins
                WHERE UserID = ?
                LIMIT 1
                `,
                [account.UserID]
            );

            if (admins.length > 0) {
                user = {
                    ...user,
                    ...admins[0]
                };
            }
        }

        const token = createToken(user);

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed.",
            error: error.message
        });
    }
});

// --------------------------------------------------
// GET CURRENT USER
// --------------------------------------------------

app.get(
    "/api/auth/me",
    authenticateToken,
    async (req, res) => {

        try {

            const [users] = await pool.query(
                `
                SELECT
                    UserID,
                    Email,
                    Role
                FROM users
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User account not found."
                });
            }

            const account = users[0];

            let user = {
                UserID: account.UserID,
                Email: account.Email,
                Role: account.Role
            };

            if (account.Role === "Student") {

                const [students] = await pool.query(
                    `
                    SELECT *
                    FROM students
                    WHERE UserID = ?
                    LIMIT 1
                    `,
                    [account.UserID]
                );

                if (students.length > 0) {
                    user = {
                        ...user,
                        ...students[0]
                    };
                }
            }

            if (account.Role === "Admin") {

                const [admins] = await pool.query(
                    `
                    SELECT
                        AdminID,
                        UserID,
                        Username,
                        FullName,
                        Email,
                        Role
                    FROM admins
                    WHERE UserID = ?
                    LIMIT 1
                    `,
                    [account.UserID]
                );

                if (admins.length > 0) {
                    user = {
                        ...user,
                        ...admins[0]
                    };
                }
            }

            res.json({
                success: true,
                user
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to retrieve account."
            });
        }
    }
);

// --------------------------------------------------
// COUNSELORS
// --------------------------------------------------

app.get(
    "/api/counselors",
    authenticateToken,
    async (req, res) => {

        try {

            const [rows] = await pool.query(
                `
                SELECT
                    CounselorID,
                    CounselorName,
                    Email,
                    ContactNumber
                FROM counselors
                ORDER BY CounselorName ASC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load counselors."
            });
        }
    }
);

// --------------------------------------------------
// STUDENT PROFILE
// --------------------------------------------------

app.get(
    "/api/student/profile",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    StudentID,
                    UserID,
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel,
                    CreatedAt
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            res.json({
                success: true,
                data: rows[0]
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load student profile."
            });
        }
    }
);

// --------------------------------------------------
// STUDENT SYNC
// --------------------------------------------------

app.post(
    "/api/student/sync",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const {
                Email,
                FirstName,
                LastName,
                ContactNumber,
                GradeLevel
            } = req.body;

            const cleanEmail = String(
                Email || req.user.Email || ""
            ).trim().toLowerCase();

            if (!cleanEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Student email is required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT
                    StudentID,
                    UserID,
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const student = students[0];

            await pool.query(
                `
                UPDATE students
                SET
                    FirstName = ?,
                    LastName = ?,
                    Email = ?,
                    ContactNumber = ?,
                    GradeLevel = ?
                WHERE StudentID = ?
                `,
                [
                    String(FirstName || student.FirstName || "").trim(),
                    String(LastName || student.LastName || "").trim(),
                    cleanEmail,
                    ContactNumber || null,
                    GradeLevel || null,
                    student.StudentID
                ]
            );

            const [updatedRows] = await pool.query(
                `
                SELECT
                    StudentID,
                    UserID,
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel
                FROM students
                WHERE StudentID = ?
                LIMIT 1
                `,
                [student.StudentID]
            );

            res.json({
                success: true,
                message: "Student synchronized successfully.",
                StudentID: student.StudentID,
                data: updatedRows[0]
            });

        } catch (error) {
            console.error("Student sync error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to synchronize student profile.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// STUDENT APPOINTMENTS
// --------------------------------------------------

app.get(
    "/api/student/appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    a.AppointmentID,
                    a.StudentID,
                    a.CounselorID,
                    a.AppointmentDate,
                    a.AppointmentTime,
                    a.Reason,
                    a.Status,
                    a.CreatedAt,
                    c.CounselorName
                FROM appointments a
                LEFT JOIN counselors c
                    ON a.CounselorID = c.CounselorID
                INNER JOIN students s
                    ON a.StudentID = s.StudentID
                WHERE s.UserID = ?
                ORDER BY
                    a.AppointmentDate DESC,
                    a.AppointmentTime DESC
                `,
                [req.user.UserID]
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load appointments."
            });
        }
    }
);

// --------------------------------------------------
// CREATE STUDENT APPOINTMENT
// --------------------------------------------------

app.post(
    "/api/student/appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const body = req.body || {};

            // Accept both the original lowercase API field names
            // and the field names used by the current User interface.
            const counselorID =
                body.counselorID ??
                body.CounselorID ??
                body.counselorId ??
                body.CounselorId ??
                null;

            const appointmentDate =
                body.appointmentDate ??
                body.AppointmentDate ??
                body.date ??
                body.Date ??
                "";

            const appointmentTime =
                body.appointmentTime ??
                body.AppointmentTime ??
                body.time ??
                body.Time ??
                "";

            const reason =
                body.reason ??
                body.Reason ??
                null;

            // ------------------------------------------
            // VALIDATE DATE AND TIME
            // ------------------------------------------

            if (!String(appointmentDate).trim() || !String(appointmentTime).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Appointment date and time are required."
                });
            }

            // Keep the time exactly in 12-hour format
            // Example: 1:00 PM
            const formattedAppointmentTime =
                String(appointmentTime).trim();

            // ------------------------------------------
            // FIND STUDENT
            // ------------------------------------------

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            // ------------------------------------------
            // CREATE APPOINTMENT
            // ------------------------------------------

            const [result] = await pool.query(
                `
                INSERT INTO appointments
                (
                    StudentID,
                    CounselorID,
                    AppointmentDate,
                    AppointmentTime,
                    Reason,
                    Status
                )
                VALUES (?, ?, ?, ?, ?, 'Pending')
                `,
                [
                    studentID,
                    counselorID || null,
                    appointmentDate,
                    formattedAppointmentTime,
                    reason || null
                ]
            );

            // ------------------------------------------
            // SUCCESS
            // ------------------------------------------

            res.status(201).json({
                success: true,
                message: "Appointment request submitted.",
                AppointmentID: result.insertId
            });

        } catch (error) {

            console.error(
                "Appointment creation error:",
                error
            );

            res.status(500).json({
                success: false,
                message: "Unable to create appointment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// STUDENT MOOD ASSESSMENTS
// --------------------------------------------------

app.get(
    "/api/student/moods",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            const [rows] = await pool.query(
                `
                SELECT
                    ma.AssessmentID,
                    ma.StudentID,
                    ma.SessionID,
                    ma.AssessmentDate,
                    ma.MoodScore,
                    ma.MoodLevel,
                    ma.Remarks
                FROM mood_assessment ma
                LEFT JOIN counseling_session cs
                    ON ma.SessionID = cs.SessionID
                WHERE ma.StudentID = ?
                ORDER BY ma.AssessmentDate DESC, ma.AssessmentID DESC
                `,
                [studentID]
            );

            res.json({
                success: true,
                data: rows,
                moods: rows
            });

        } catch (error) {

            console.error("Student moods load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load mood assessments."
            });
        }
    }
);

app.post(
    "/api/student/moods",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const moodScore = Number(req.body.MoodScore ?? req.body.moodScore);
            const moodLevel = String(
                req.body.MoodLevel ?? req.body.moodLevel ?? ""
            ).trim();
            const remarks = String(
                req.body.Remarks ?? req.body.remarks ?? "Student mood check-in"
            ).trim();

            if (!moodLevel || !Number.isFinite(moodScore)) {
                return res.status(400).json({
                    success: false,
                    message: "Mood level and mood score are required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            // A mood assessment is linked to the student's latest counseling
            // session when one exists. SessionID is allowed to remain NULL
            // only if the database schema permits it.
            const [sessions] = await pool.query(
                `
                SELECT SessionID
                FROM counseling_session
                WHERE StudentID = ?
                ORDER BY SessionDate DESC, SessionID DESC
                LIMIT 1
                `,
                [studentID]
            );

            const sessionID = sessions.length > 0
                ? sessions[0].SessionID
                : null;

            const [result] = await pool.query(
                `
                INSERT INTO mood_assessment
                (
                    StudentID,
                    SessionID,
                    AssessmentDate,
                    MoodScore,
                    MoodLevel,
                    Remarks
                )
                VALUES (?, ?, CURDATE(), ?, ?, ?)
                `,
                [
                    studentID,
                    sessionID,
                    moodScore,
                    moodLevel,
                    remarks
                ]
            );

            res.status(201).json({
                success: true,
                message: "Mood assessment saved successfully.",
                AssessmentID: result.insertId
            });

        } catch (error) {

            console.error("Student mood save error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to save your mood.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// STUDENT COUNSELING SESSIONS FOR FEEDBACK
// --------------------------------------------------

app.get(
    "/api/student/sessions",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    cs.SessionID,
                    cs.StudentID,
                    cs.CounselorID,
                    cs.SessionDate,
                    cs.SessionTime,
                    cs.SessionType,
                    cs.SessionStatus,
                    c.CounselorName
                FROM counseling_session cs
                INNER JOIN students s
                    ON cs.StudentID = s.StudentID
                LEFT JOIN counselors c
                    ON cs.CounselorID = c.CounselorID
                WHERE s.UserID = ?
                ORDER BY cs.SessionDate DESC, cs.SessionID DESC
                `,
                [req.user.UserID]
            );

            res.json({
                success: true,
                data: rows,
                sessions: rows
            });
        } catch (error) {
            console.error("Student sessions load error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to load counseling sessions."
            });
        }
    }
);

// --------------------------------------------------
// SUBMIT STUDENT FEEDBACK
// --------------------------------------------------

app.post(
    "/api/student/feedback",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const sessionID = Number(
                req.body.SessionID ?? req.body.sessionID
            );
            const rating = Number(
                req.body.Rating ?? req.body.rating
            );
            const comments = String(
                req.body.Comments ?? req.body.comments ?? ""
            ).trim();

            if (!Number.isInteger(sessionID) || sessionID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a counseling session."
                });
            }

            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Please select a rating from 1 to 5."
                });
            }

            if (!comments) {
                return res.status(400).json({
                    success: false,
                    message: "Please write your feedback."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            const [sessions] = await pool.query(
                `
                SELECT
                    SessionID,
                    CounselorID,
                    SessionStatus
                FROM counseling_session
                WHERE SessionID = ?
                  AND StudentID = ?
                LIMIT 1
                `,
                [sessionID, studentID]
            );

            if (sessions.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "The selected counseling session was not found."
                });
            }

            const session = sessions[0];
            const status = String(session.SessionStatus || "").toLowerCase();

            if (status && status !== "completed") {
                return res.status(400).json({
                    success: false,
                    message: "Feedback can be submitted after the counseling session is completed."
                });
            }

            const [existing] = await pool.query(
                `
                SELECT FeedbackID
                FROM feedback
                WHERE StudentID = ?
                  AND SessionID = ?
                LIMIT 1
                `,
                [studentID, sessionID]
            );

            if (existing.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "You have already submitted feedback for this counseling session."
                });
            }

            const [result] = await pool.query(
                `
                INSERT INTO feedback
                (
                    StudentID,
                    SessionID,
                    CounselorID,
                    Rating,
                    Comments,
                    FeedbackDate
                )
                VALUES (?, ?, ?, ?, ?, CURDATE())
                `,
                [
                    studentID,
                    sessionID,
                    session.CounselorID || null,
                    rating,
                    comments
                ]
            );

            res.status(201).json({
                success: true,
                message: "Thank you. Your feedback was submitted successfully.",
                FeedbackID: result.insertId
            });
        } catch (error) {
            console.error("Student feedback submit error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to submit feedback.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// STUDENT FEEDBACK RECORDS
// --------------------------------------------------

app.get(
    "/api/student/feedback",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    f.FeedbackID,
                    f.SessionID,
                    f.CounselorID,
                    f.Rating,
                    f.Comments,
                    f.FeedbackDate,
                    c.CounselorName
                FROM feedback f
                INNER JOIN counseling_session cs
                    ON f.SessionID = cs.SessionID
                LEFT JOIN counselors c
                    ON f.CounselorID = c.CounselorID
                WHERE cs.StudentID = ?
                ORDER BY f.FeedbackDate DESC, f.FeedbackID DESC
                `,
                [students[0].StudentID]
            );

            res.json({
                success: true,
                data: rows,
                feedback: rows
            });

        } catch (error) {

            console.error("Student feedback load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load feedback records."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN DASHBOARD STATS
// --------------------------------------------------

app.get(
    "/api/dashboard/stats",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [
                students,
                appointments,
                sessions,
                moodAssessments
            ] = await Promise.all([

                pool.query(
                    "SELECT COUNT(*) AS total FROM students"
                ),

                pool.query(
                    "SELECT COUNT(*) AS total FROM appointments"
                ),

                pool.query(
                    "SELECT COUNT(*) AS total FROM counseling_session"
                ),

                pool.query(
                    "SELECT COUNT(*) AS total FROM mood_assessment"
                )
            ]);

            res.json({
                success: true,
                stats: {
                    students: students[0][0].total,
                    appointments: appointments[0][0].total,
                    sessions: sessions[0][0].total,
                    moodAssessments:
                        moodAssessments[0][0].total
                }
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load dashboard statistics."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN STUDENTS
// --------------------------------------------------

app.get(
    "/api/admin/students",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    StudentID,
                    UserID,
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel,
                    CreatedAt
                FROM students
                ORDER BY StudentID DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load students."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN STUDENT UPDATE
// --------------------------------------------------

app.put(
    "/api/admin/students/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const studentId = Number(req.params.id);

            if (!Number.isInteger(studentId) || studentId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID."
                });
            }

            const {
                FirstName,
                LastName,
                Email,
                ContactNumber,
                GradeLevel
            } = req.body;

            const firstName = String(FirstName || "").trim();
            const lastName = String(LastName || "").trim();
            const email = String(Email || "").trim().toLowerCase();
            const contactNumber = String(ContactNumber || "").trim();
            const gradeLevel = String(GradeLevel || "").trim();

            if (!firstName || !lastName || !email || !contactNumber || !gradeLevel) {
                return res.status(400).json({
                    success: false,
                    message: "All student fields are required."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid email address."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID, UserID
                FROM students
                WHERE StudentID = ?
                LIMIT 1
                `,
                [studentId]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student record not found."
                });
            }

            const userId = students[0].UserID;
            const connection = await pool.getConnection();

            try {
                await connection.beginTransaction();

                await connection.query(
                    `
                    UPDATE students
                    SET
                        FirstName = ?,
                        LastName = ?,
                        Email = ?,
                        ContactNumber = ?,
                        GradeLevel = ?
                    WHERE StudentID = ?
                    `,
                    [
                        firstName,
                        lastName,
                        email,
                        contactNumber,
                        gradeLevel,
                        studentId
                    ]
                );

                // Keep the login email synchronized with the student's email.
                if (userId !== null && userId !== undefined) {
                    await connection.query(
                        `
                        UPDATE users
                        SET Email = ?
                        WHERE UserID = ?
                        `,
                        [email, userId]
                    );
                }

                await connection.commit();

            } catch (error) {
                await connection.rollback();
                throw error;
            } finally {
                connection.release();
            }

            return res.json({
                success: true,
                message: "Student record updated successfully."
            });

        } catch (error) {

            console.error("Admin student update error:", error);

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    success: false,
                    message: "That email address is already in use."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Unable to update student record."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN STUDENT DELETE
// Deletes the student profile, login account, and every record
// belonging to that student in the current application schema.
// --------------------------------------------------

app.delete(
    "/api/admin/students/:id",
    authenticateToken,
    async (req, res) => {

        let connection;

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const studentId = Number(req.params.id);

            if (!Number.isInteger(studentId) || studentId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID."
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [students] = await connection.query(
                `
                SELECT
                    s.StudentID,
                    s.UserID
                FROM students s
                WHERE s.StudentID = ?
                LIMIT 1
                FOR UPDATE
                `,
                [studentId]
            );

            if (students.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Student record not found."
                });
            }

            const userId = students[0].UserID;

            // Messages depend on conversations, so remove messages first.
            const [conversations] = await connection.query(
                `
                SELECT ConversationID
                FROM conversations
                WHERE StudentID = ?
                `,
                [studentId]
            );

            const conversationIds = conversations
                .map(row => row.ConversationID)
                .filter(id => id !== null && id !== undefined);

            if (conversationIds.length > 0) {
                await connection.query(
                    `
                    DELETE FROM messages
                    WHERE ConversationID IN (?)
                    `,
                    [conversationIds]
                );
            }

            await connection.query(
                `
                DELETE FROM feedback
                WHERE StudentID = ?
                `,
                [studentId]
            );

            await connection.query(
                `
                DELETE FROM mood_assessment
                WHERE StudentID = ?
                `,
                [studentId]
            );

            await connection.query(
                `
                DELETE FROM counseling_session
                WHERE StudentID = ?
                `,
                [studentId]
            );

            await connection.query(
                `
                DELETE FROM appointments
                WHERE StudentID = ?
                `,
                [studentId]
            );

            await connection.query(
                `
                DELETE FROM conversations
                WHERE StudentID = ?
                `,
                [studentId]
            );

            await connection.query(
                `
                DELETE FROM students
                WHERE StudentID = ?
                `,
                [studentId]
            );

            // Delete the login account last. This makes the old email/password
            // unusable for login because the users row no longer exists.
            if (userId !== null && userId !== undefined) {
                await connection.query(
                    `
                    DELETE FROM users
                    WHERE UserID = ?
                      AND Role = 'Student'
                    `,
                    [userId]
                );
            }

            await connection.commit();

            return res.json({
                success: true,
                message: "Student account and all related data were permanently deleted."
            });

        } catch (error) {

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Student delete rollback error:", rollbackError);
                }
            }

            console.error("Admin student delete error:", error);

            if (
                error.code === "ER_ROW_IS_REFERENCED_2" ||
                error.code === "ER_ROW_IS_REFERENCED"
            ) {
                return res.status(409).json({
                    success: false,
                    message: "The student could not be deleted because another related record still references the account."
                });
            }

            return res.status(500).json({
                success: false,
                message: "Unable to permanently delete the student account.",
                error: error.message
            });

        } finally {

            if (connection) {
                connection.release();
            }

        }
    }
);

// --------------------------------------------------
// ADMIN APPOINTMENTS
// --------------------------------------------------

app.get(
    "/api/admin/appointments",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    a.AppointmentID,
                    a.StudentID,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    s.Email AS StudentEmail,
                    a.CounselorID,
                    c.CounselorName,
                    a.AppointmentDate,
                    a.AppointmentTime,
                    a.Reason,
                    a.Status,
                    a.CreatedAt
                FROM appointments a
                INNER JOIN students s
                    ON a.StudentID = s.StudentID
                LEFT JOIN counselors c
                    ON a.CounselorID = c.CounselorID
                ORDER BY
                    a.AppointmentDate DESC,
                    a.AppointmentTime DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load appointments."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN UPDATE APPOINTMENT
// Supports both the Accept/Decline status actions and the
// full Edit form used by the Admin table.
// --------------------------------------------------

app.put(
    "/api/admin/appointments/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const appointmentID = Number(req.params.id);

            if (!Number.isInteger(appointmentID) || appointmentID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid appointment ID."
                });
            }

            const [existingRows] = await pool.query(
                `
                SELECT
                    AppointmentDate,
                    AppointmentTime,
                    Reason,
                    Status
                FROM appointments
                WHERE AppointmentID = ?
                LIMIT 1
                `,
                [appointmentID]
            );

            if (existingRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Appointment not found."
                });
            }

            const current = existingRows[0];
            const body = req.body || {};

            const appointmentDate =
                body.AppointmentDate ??
                body.appointmentDate ??
                current.AppointmentDate;

            const appointmentTime =
                body.AppointmentTime ??
                body.appointmentTime ??
                current.AppointmentTime;

            const reason =
                body.Reason ??
                body.reason ??
                current.Reason;

            const status =
                body.Status ??
                body.status ??
                current.Status;

            const allowedStatuses = [
                "Pending",
                "Confirmed",
                "Cancelled",
                "Completed"
            ];

            if (!allowedStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid appointment status."
                });
            }

            if (!String(appointmentDate || "").trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Appointment date is required."
                });
            }

            if (!String(appointmentTime || "").trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Appointment time is required."
                });
            }

            await pool.query(
                `
                UPDATE appointments
                SET
                    AppointmentDate = ?,
                    AppointmentTime = ?,
                    Reason = ?,
                    Status = ?
                WHERE AppointmentID = ?
                `,
                [
                    appointmentDate,
                    appointmentTime,
                    reason || null,
                    status,
                    appointmentID
                ]
            );

            if (String(status).toLowerCase() === "confirmed") {
                try {
                    await ensureCounselingSessionForAppointment(appointmentID);
                } catch (sessionError) {
                    // Do not leave an appointment marked Confirmed when its
                    // required counseling-session record could not be created.
                    await pool.query(
                        `
                        UPDATE appointments
                        SET
                            AppointmentDate = ?,
                            AppointmentTime = ?,
                            Reason = ?,
                            Status = ?
                        WHERE AppointmentID = ?
                        `,
                        [
                            current.AppointmentDate,
                            current.AppointmentTime,
                            current.Reason || null,
                            current.Status,
                            appointmentID
                        ]
                    );

                    throw sessionError;
                }
            }

            res.json({
                success: true,
                message: "Appointment updated successfully."
            });

        } catch (error) {

            console.error("Admin appointment update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update appointment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN DELETE APPOINTMENT
// --------------------------------------------------

app.delete(
    "/api/admin/appointments/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const appointmentID = Number(req.params.id);

            if (!Number.isInteger(appointmentID) || appointmentID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid appointment ID."
                });
            }

            const [result] = await pool.query(
                `
                DELETE FROM appointments
                WHERE AppointmentID = ?
                `,
                [appointmentID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Appointment not found."
                });
            }

            res.json({
                success: true,
                message: "Appointment deleted successfully."
            });

        } catch (error) {

            console.error("Admin appointment delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete appointment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN MOOD MONITORING
// --------------------------------------------------

app.get(
    "/api/admin/moods",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    ma.AssessmentID,
                    ma.StudentID,
                    ma.SessionID,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    ma.AssessmentDate,
                    ma.MoodScore,
                    ma.MoodLevel,
                    ma.Remarks
                FROM mood_assessment ma
                LEFT JOIN students s
                    ON ma.StudentID = s.StudentID
                ORDER BY
                    ma.AssessmentDate DESC,
                    ma.AssessmentID DESC
                `
            );

            res.json({
                success: true,
                data: rows,
                moods: rows
            });

        } catch (error) {

            console.error("Admin mood monitoring load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load mood monitoring records.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN CREATE MOOD ASSESSMENT
// --------------------------------------------------

app.post(
    "/api/admin/moods",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const body = req.body || {};

            const sessionID =
                body.SessionID ??
                body.sessionID ??
                null;

            const assessmentDate = String(
                body.AssessmentDate ??
                body.assessmentDate ??
                ""
            ).trim();

            const moodScore = Number(
                body.MoodScore ??
                body.moodScore
            );

            const moodLevel = String(
                body.MoodLevel ??
                body.moodLevel ??
                ""
            ).trim();

            const remarks = String(
                body.Remarks ??
                body.remarks ??
                ""
            ).trim();

            if (
                !assessmentDate ||
                !Number.isFinite(moodScore) ||
                !moodLevel
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Assessment date, mood score, and mood level are required."
                });
            }

            const [result] = await pool.query(
                `
                INSERT INTO mood_assessment
                (
                    SessionID,
                    AssessmentDate,
                    MoodScore,
                    MoodLevel,
                    Remarks
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    sessionID || null,
                    assessmentDate,
                    moodScore,
                    moodLevel,
                    remarks || null
                ]
            );

            res.status(201).json({
                success: true,
                message: "Mood assessment created successfully.",
                AssessmentID: result.insertId
            });

        } catch (error) {

            console.error("Admin mood assessment create error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to create mood assessment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN UPDATE MOOD ASSESSMENT
// --------------------------------------------------

app.put(
    "/api/admin/moods/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const assessmentID = Number(req.params.id);
            const body = req.body || {};

            if (!Number.isInteger(assessmentID) || assessmentID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid mood assessment ID."
                });
            }

            const assessmentDate = String(
                body.AssessmentDate ??
                body.assessmentDate ??
                ""
            ).trim();

            const moodScore = Number(
                body.MoodScore ??
                body.moodScore
            );

            const moodLevel = String(
                body.MoodLevel ??
                body.moodLevel ??
                ""
            ).trim();

            const remarks = String(
                body.Remarks ??
                body.remarks ??
                ""
            ).trim();

            if (
                !assessmentDate ||
                !Number.isFinite(moodScore) ||
                !moodLevel
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Assessment date, mood score, and mood level are required."
                });
            }

            const [result] = await pool.query(
                `
                UPDATE mood_assessment
                SET
                    AssessmentDate = ?,
                    MoodScore = ?,
                    MoodLevel = ?,
                    Remarks = ?
                WHERE AssessmentID = ?
                `,
                [
                    assessmentDate,
                    moodScore,
                    moodLevel,
                    remarks || null,
                    assessmentID
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Mood assessment not found."
                });
            }

            res.json({
                success: true,
                message: "Mood assessment updated successfully."
            });

        } catch (error) {

            console.error("Admin mood assessment update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update mood assessment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN DELETE MOOD ASSESSMENT
// --------------------------------------------------

app.delete(
    "/api/admin/moods/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const assessmentID = Number(req.params.id);

            if (!Number.isInteger(assessmentID) || assessmentID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid mood assessment ID."
                });
            }

            const [result] = await pool.query(
                `
                DELETE FROM mood_assessment
                WHERE AssessmentID = ?
                `,
                [assessmentID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Mood assessment not found."
                });
            }

            res.json({
                success: true,
                message: "Mood assessment deleted successfully."
            });

        } catch (error) {

            console.error("Admin mood assessment delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete mood assessment.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELORS
// --------------------------------------------------

app.get(
    "/api/admin/counselors",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT *
                FROM counselors
                ORDER BY CounselorID DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load counselors."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN MESSAGES
// --------------------------------------------------

app.get(
    "/api/admin/messages",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    m.MessageID,
                    m.ConversationID,
                    m.SenderType,
                    m.SenderID,
                    m.MessageText,
                    m.SentAt,
                    c.StudentID,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    s.Email AS StudentEmail
                FROM messages m
                INNER JOIN conversations c
                    ON m.ConversationID = c.ConversationID
                INNER JOIN students s
                    ON c.StudentID = s.StudentID
                ORDER BY m.SentAt ASC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load messages."
            });
        }
    }
);

// --------------------------------------------------
// STUDENT CONVERSATION
// --------------------------------------------------

app.get(
    "/api/student/chat",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            let [conversations] = await pool.query(
                `
                SELECT
                    ConversationID,
                    StudentID,
                    CounselorID,
                    CreatedAt
                FROM conversations
                WHERE StudentID = ?
                ORDER BY ConversationID DESC
                LIMIT 1
                `,
                [studentID]
            );

            let conversationID;

            if (conversations.length === 0) {

                const [result] = await pool.query(
                    `
                    INSERT INTO conversations
                    (StudentID)
                    VALUES (?)
                    `,
                    [studentID]
                );

                conversationID = result.insertId;

                conversations = [{
                    ConversationID: conversationID,
                    StudentID: studentID,
                    CounselorID: null
                }];

            } else {
                conversationID = conversations[0].ConversationID;
            }

            // The existing database uses appointment Status to determine
            // whether the counseling chat is active. Confirmed = Active.
            const [appointments] = await pool.query(
                `
                SELECT
                    a.AppointmentID,
                    a.Status,
                    a.CounselorID,
                    c.CounselorName
                FROM appointments a
                LEFT JOIN counselors c
                    ON a.CounselorID = c.CounselorID
                WHERE a.StudentID = ?
                ORDER BY a.AppointmentID DESC
                LIMIT 1
                `,
                [studentID]
            );

            const appointment = appointments[0] || null;

            // Recover older confirmed appointments that were accepted before
            // counseling-session creation was connected to appointment approval.
            if (appointment?.Status && String(appointment.Status).toLowerCase() === "confirmed") {
                await ensureCounselingSessionForAppointment(
                    appointment.AppointmentID
                );
            }

            const appointmentStatus = String(
                appointment?.Status || "Pending"
            ).toLowerCase();

            const chatStatus = appointmentStatus === "confirmed"
                ? "Active"
                : appointmentStatus === "cancelled"
                    ? "Cancelled"
                    : appointmentStatus === "completed"
                        ? "Completed"
                        : "Pending";

            const [messages] = await pool.query(
                `
                SELECT
                    m.MessageID,
                    m.ConversationID,
                    m.SenderType,
                    m.SenderID,
                    m.MessageText,
                    m.SentAt,
                    c.CounselorName
                FROM messages m
                LEFT JOIN counselors c
                    ON m.SenderType = 'Counselor'
                    AND m.SenderID = c.CounselorID
                WHERE m.ConversationID = ?
                ORDER BY m.SentAt ASC
                `,
                [conversationID]
            );

            res.json({
                success: true,
                conversation: {
                    ...conversations[0],
                    CounselorID:
                        conversations[0].CounselorID ||
                        appointment?.CounselorID ||
                        null,
                    CounselorName:
                        appointment?.CounselorName ||
                        null,
                    Status: chatStatus
                },
                messages
            });

        } catch (error) {

            console.error("Student conversation error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load conversation.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// STUDENT CHAT MESSAGES
// --------------------------------------------------

app.get(
    "/api/student/chat/messages",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            const [rows] = await pool.query(
                `
                SELECT
                    m.MessageID,
                    m.ConversationID,
                    m.SenderType,
                    m.SenderID,
                    m.MessageText,
                    m.SentAt
                FROM messages m
                INNER JOIN conversations c
                    ON m.ConversationID = c.ConversationID
                WHERE c.StudentID = ?
                ORDER BY m.SentAt ASC
                `,
                [studentID]
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load chat messages."
            });
        }
    }
);

// --------------------------------------------------
// SEND STUDENT MESSAGE
// --------------------------------------------------

app.post(
    "/api/student/chat/messages",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Student") {
                return res.status(403).json({
                    success: false,
                    message: "Student access required."
                });
            }

            const messageText = String(
                req.body.messageText ||
                req.body.MessageText ||
                ""
            ).trim();

            if (!messageText) {
                return res.status(400).json({
                    success: false,
                    message: "Message cannot be empty."
                });
            }

            const [students] = await pool.query(
                `
                SELECT StudentID
                FROM students
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            if (students.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Student profile not found."
                });
            }

            const studentID = students[0].StudentID;

            let [conversations] = await pool.query(
                `
                SELECT ConversationID
                FROM conversations
                WHERE StudentID = ?
                ORDER BY ConversationID DESC
                LIMIT 1
                `,
                [studentID]
            );

            let conversationID;

            if (conversations.length === 0) {

                const [result] = await pool.query(
                    `
                    INSERT INTO conversations
                    (StudentID)
                    VALUES (?)
                    `,
                    [studentID]
                );

                conversationID = result.insertId;

            } else {

                conversationID =
                    conversations[0].ConversationID;
            }

            const [result] = await pool.query(
                `
                INSERT INTO messages
                (
                    ConversationID,
                    SenderType,
                    SenderID,
                    MessageText
                )
                VALUES (?, 'Student', ?, ?)
                `,
                [
                    conversationID,
                    studentID,
                    messageText
                ]
            );

            res.status(201).json({
                success: true,
                message: "Message sent.",
                MessageID: result.insertId
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to send message."
            });
        }
    }
);

// --------------------------------------------------
// ADMIN SEND MESSAGE
// --------------------------------------------------

app.post(
    "/api/admin/messages",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const {
                conversationID,
                messageText
            } = req.body;

            if (!conversationID || !messageText) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Conversation ID and message are required."
                });
            }

            const [admins] = await pool.query(
                `
                SELECT AdminID
                FROM admins
                WHERE UserID = ?
                LIMIT 1
                `,
                [req.user.UserID]
            );

            const senderID =
                admins.length > 0
                    ? admins[0].AdminID
                    : req.user.UserID;

            const [result] = await pool.query(
                `
                INSERT INTO messages
                (
                    ConversationID,
                    SenderType,
                    SenderID,
                    MessageText
                )
                VALUES (?, 'Admin', ?, ?)
                `,
                [
                    conversationID,
                    senderID,
                    String(messageText).trim()
                ]
            );

            res.status(201).json({
                success: true,
                message: "Reply sent.",
                MessageID: result.insertId
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to send reply."
            });
        }
    }
);


// --------------------------------------------------
// ADMIN COUNSELING SESSIONS
// --------------------------------------------------

app.get(
    "/api/admin/sessions",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    cs.SessionID,
                    cs.StudentID,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    cs.CounselorID,
                    c.CounselorName,
                    cs.SessionDate,
                    cs.SessionTime,
                    cs.SessionType,
                    cs.SessionStatus,
                    cs.Notes,
                    cs.CreatedAt
                FROM counseling_session cs
                INNER JOIN students s
                    ON cs.StudentID = s.StudentID
                LEFT JOIN counselors c
                    ON cs.CounselorID = c.CounselorID
                ORDER BY
                    cs.SessionDate DESC,
                    cs.SessionTime DESC,
                    cs.SessionID DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error("Admin sessions load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load counseling sessions.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELING SESSION CHAT
// --------------------------------------------------

app.get(
    "/api/admin/sessions/:id/chat",
    authenticateToken,
    async (req, res) => {
        try {
            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const sessionID = Number(req.params.id);
            if (!Number.isInteger(sessionID) || sessionID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counseling session ID."
                });
            }

            const [sessions] = await pool.query(
                `
                SELECT
                    cs.SessionID,
                    cs.StudentID,
                    cs.CounselorID,
                    cs.SessionStatus,
                    CONCAT(s.FirstName, ' ', s.LastName) AS StudentName
                FROM counseling_session cs
                INNER JOIN students s
                    ON cs.StudentID = s.StudentID
                WHERE cs.SessionID = ?
                LIMIT 1
                `,
                [sessionID]
            );

            if (sessions.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Counseling session not found."
                });
            }

            const session = sessions[0];

            let [conversations] = await pool.query(
                `
                SELECT
                    ConversationID,
                    StudentID,
                    CounselorID,
                    CreatedAt
                FROM conversations
                WHERE StudentID = ?
                ORDER BY ConversationID DESC
                LIMIT 1
                `,
                [session.StudentID]
            );

            let conversationID;

            if (conversations.length === 0) {
                const [result] = await pool.query(
                    `
                    INSERT INTO conversations
                    (StudentID, CounselorID)
                    VALUES (?, ?)
                    `,
                    [session.StudentID, session.CounselorID || null]
                );

                conversationID = result.insertId;

                [conversations] = await pool.query(
                    `
                    SELECT
                        ConversationID,
                        StudentID,
                        CounselorID,
                        CreatedAt
                    FROM conversations
                    WHERE ConversationID = ?
                    LIMIT 1
                    `,
                    [conversationID]
                );
            } else {
                conversationID = conversations[0].ConversationID;
            }

            const [messages] = await pool.query(
                `
                SELECT
                    MessageID,
                    ConversationID,
                    SenderType,
                    SenderID,
                    MessageText,
                    SentAt
                FROM messages
                WHERE ConversationID = ?
                ORDER BY SentAt ASC, MessageID ASC
                `,
                [conversationID]
            );

            res.json({
                success: true,
                conversation: {
                    ...conversations[0],
                    SessionID: session.SessionID,
                    StudentID: session.StudentID,
                    StudentName: session.StudentName,
                    CounselorID:
                        conversations[0]?.CounselorID ||
                        session.CounselorID ||
                        null,
                    SessionStatus: session.SessionStatus
                },
                messages
            });
        } catch (error) {
            console.error("Admin counseling chat load error:", error);
            res.status(500).json({
                success: false,
                message: "Unable to load counseling chat.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN FEEDBACK
// --------------------------------------------------

app.get(
    "/api/admin/feedback",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    f.FeedbackID,
                    f.StudentID,
                    f.SessionID,
                    f.Rating,
                    f.Comments,
                    f.FeedbackDate,
                    f.CreatedAt,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName
                FROM feedback f
                INNER JOIN students s
                    ON f.StudentID = s.StudentID
                ORDER BY
                    f.FeedbackDate DESC,
                    f.FeedbackID DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error("Admin feedback load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load feedback.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN WELLNESS RESOURCES
// --------------------------------------------------

app.get(
    "/api/admin/resources",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const [rows] = await pool.query(
                `
                SELECT
                    ResourceID,
                    ResourceTitle,
                    ResourceType,
                    Description,
                    ResourceDate,
                    CreatedAt
                FROM resources
                ORDER BY
                    ResourceDate DESC,
                    ResourceID DESC
                `
            );

            res.json({
                success: true,
                data: rows
            });

        } catch (error) {

            console.error("Admin resources load error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to load wellness resources.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELING SESSION UPDATE
// --------------------------------------------------

app.put(
    "/api/admin/sessions/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const sessionID = Number(req.params.id);
            const body = req.body || {};

            if (!Number.isInteger(sessionID) || sessionID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counseling session ID."
                });
            }

            const sessionDate = String(body.SessionDate ?? "").trim();
            const sessionTime = String(body.SessionTime ?? "").trim();
            const sessionType = String(body.SessionType ?? "").trim();
            const sessionStatus = String(body.SessionStatus ?? "").trim();
            const notes = String(body.Notes ?? "").trim();

            const allowedStatuses = [
                "Scheduled",
                "Ongoing",
                "Completed",
                "Cancelled"
            ];

            if (!sessionDate || !sessionTime || !sessionType) {
                return res.status(400).json({
                    success: false,
                    message: "Session date, time, and type are required."
                });
            }

            if (!allowedStatuses.includes(sessionStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counseling session status."
                });
            }

            const [result] = await pool.query(
                `
                UPDATE counseling_session
                SET
                    SessionDate = ?,
                    SessionTime = ?,
                    SessionType = ?,
                    SessionStatus = ?,
                    Notes = ?
                WHERE SessionID = ?
                `,
                [
                    sessionDate,
                    sessionTime,
                    sessionType,
                    sessionStatus,
                    notes || null,
                    sessionID
                ]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Counseling session not found."
                });
            }

            res.json({
                success: true,
                message: "Counseling session updated successfully."
            });

        } catch (error) {

            console.error("Admin counseling session update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update counseling session.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELING SESSION DELETE
// Deletes child mood/feedback records first so foreign-key
// constraints do not leave the Admin button broken.
// --------------------------------------------------

app.delete(
    "/api/admin/sessions/:id",
    authenticateToken,
    async (req, res) => {

        let connection;

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const sessionID = Number(req.params.id);

            if (!Number.isInteger(sessionID) || sessionID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counseling session ID."
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [sessions] = await connection.query(
                `
                SELECT SessionID
                FROM counseling_session
                WHERE SessionID = ?
                LIMIT 1
                FOR UPDATE
                `,
                [sessionID]
            );

            if (sessions.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Counseling session not found."
                });
            }

            await connection.query(
                `
                DELETE FROM feedback
                WHERE SessionID = ?
                `,
                [sessionID]
            );

            await connection.query(
                `
                DELETE FROM mood_assessment
                WHERE SessionID = ?
                `,
                [sessionID]
            );

            await connection.query(
                `
                DELETE FROM counseling_session
                WHERE SessionID = ?
                `,
                [sessionID]
            );

            await connection.commit();

            res.json({
                success: true,
                message: "Counseling session deleted successfully."
            });

        } catch (error) {

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Session delete rollback error:", rollbackError);
                }
            }

            console.error("Admin counseling session delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete counseling session.",
                error: error.message
            });

        } finally {

            if (connection) {
                connection.release();
            }
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELOR UPDATE
// --------------------------------------------------

app.put(
    "/api/admin/counselors/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const counselorID = Number(req.params.id);
            const counselorName = String(req.body?.CounselorName ?? "").trim();
            const email = String(req.body?.Email ?? "").trim().toLowerCase();
            const contactNumber = String(req.body?.ContactNumber ?? "").trim();

            if (!Number.isInteger(counselorID) || counselorID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counselor ID."
                });
            }

            if (!counselorName || !email || !contactNumber) {
                return res.status(400).json({
                    success: false,
                    message: "Counselor name, email, and contact number are required."
                });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a valid counselor email address."
                });
            }

            const [result] = await pool.query(
                `
                UPDATE counselors
                SET
                    CounselorName = ?,
                    Email = ?,
                    ContactNumber = ?
                WHERE CounselorID = ?
                `,
                [counselorName, email, contactNumber, counselorID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Counselor not found."
                });
            }

            res.json({
                success: true,
                message: "Counselor updated successfully."
            });

        } catch (error) {

            console.error("Admin counselor update error:", error);

            if (error.code === "ER_DUP_ENTRY") {
                return res.status(409).json({
                    success: false,
                    message: "That counselor email is already in use."
                });
            }

            res.status(500).json({
                success: false,
                message: "Unable to update counselor.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN COUNSELOR DELETE
// Keeps historical records and removes only the counselor links.
// --------------------------------------------------

app.delete(
    "/api/admin/counselors/:id",
    authenticateToken,
    async (req, res) => {

        let connection;

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const counselorID = Number(req.params.id);

            if (!Number.isInteger(counselorID) || counselorID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid counselor ID."
                });
            }

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [counselors] = await connection.query(
                `
                SELECT CounselorID
                FROM counselors
                WHERE CounselorID = ?
                LIMIT 1
                FOR UPDATE
                `,
                [counselorID]
            );

            if (counselors.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: "Counselor not found."
                });
            }

            await connection.query(
                `
                UPDATE appointments
                SET CounselorID = NULL
                WHERE CounselorID = ?
                `,
                [counselorID]
            );

            await connection.query(
                `
                UPDATE counseling_session
                SET CounselorID = NULL
                WHERE CounselorID = ?
                `,
                [counselorID]
            );

            await connection.query(
                `
                UPDATE feedback
                SET CounselorID = NULL
                WHERE CounselorID = ?
                `,
                [counselorID]
            );

            await connection.query(
                `
                DELETE FROM counselors
                WHERE CounselorID = ?
                `,
                [counselorID]
            );

            await connection.commit();

            res.json({
                success: true,
                message: "Counselor deleted successfully."
            });

        } catch (error) {

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Counselor delete rollback error:", rollbackError);
                }
            }

            console.error("Admin counselor delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete counselor.",
                error: error.message
            });

        } finally {

            if (connection) {
                connection.release();
            }
        }
    }
);

// --------------------------------------------------
// ADMIN FEEDBACK UPDATE
// --------------------------------------------------

app.put(
    "/api/admin/feedback/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const feedbackID = Number(req.params.id);
            const rating = Number(req.body?.Rating);
            const comments = String(req.body?.Comments ?? "").trim();
            const feedbackDate = String(req.body?.FeedbackDate ?? "").trim();

            if (!Number.isInteger(feedbackID) || feedbackID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid feedback ID."
                });
            }

            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be a whole number from 1 to 5."
                });
            }

            if (!comments || !feedbackDate) {
                return res.status(400).json({
                    success: false,
                    message: "Feedback and feedback date are required."
                });
            }

            const [result] = await pool.query(
                `
                UPDATE feedback
                SET
                    Rating = ?,
                    Comments = ?,
                    FeedbackDate = ?
                WHERE FeedbackID = ?
                `,
                [rating, comments, feedbackDate, feedbackID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Feedback record not found."
                });
            }

            res.json({
                success: true,
                message: "Feedback updated successfully."
            });

        } catch (error) {

            console.error("Admin feedback update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update feedback.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN FEEDBACK DELETE
// --------------------------------------------------

app.delete(
    "/api/admin/feedback/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const feedbackID = Number(req.params.id);

            if (!Number.isInteger(feedbackID) || feedbackID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid feedback ID."
                });
            }

            const [result] = await pool.query(
                `
                DELETE FROM feedback
                WHERE FeedbackID = ?
                `,
                [feedbackID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Feedback record not found."
                });
            }

            res.json({
                success: true,
                message: "Feedback deleted successfully."
            });

        } catch (error) {

            console.error("Admin feedback delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete feedback.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN WELLNESS RESOURCE UPDATE
// --------------------------------------------------

app.put(
    "/api/admin/resources/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const resourceID = Number(req.params.id);
            const resourceTitle = String(req.body?.ResourceTitle ?? "").trim();
            const resourceType = String(req.body?.ResourceType ?? "").trim();
            const description = String(req.body?.Description ?? "").trim();
            const resourceDate = String(req.body?.ResourceDate ?? "").trim();

            if (!Number.isInteger(resourceID) || resourceID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid resource ID."
                });
            }

            if (!resourceTitle || !resourceType || !description || !resourceDate) {
                return res.status(400).json({
                    success: false,
                    message: "Resource title, type, description, and date are required."
                });
            }

            const [result] = await pool.query(
                `
                UPDATE resources
                SET
                    ResourceTitle = ?,
                    ResourceType = ?,
                    Description = ?,
                    ResourceDate = ?
                WHERE ResourceID = ?
                `,
                [resourceTitle, resourceType, description, resourceDate, resourceID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Wellness resource not found."
                });
            }

            res.json({
                success: true,
                message: "Wellness resource updated successfully."
            });

        } catch (error) {

            console.error("Admin resource update error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to update wellness resource.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// ADMIN WELLNESS RESOURCE DELETE
// --------------------------------------------------

app.delete(
    "/api/admin/resources/:id",
    authenticateToken,
    async (req, res) => {

        try {

            if (req.user.Role !== "Admin") {
                return res.status(403).json({
                    success: false,
                    message: "Admin access required."
                });
            }

            const resourceID = Number(req.params.id);

            if (!Number.isInteger(resourceID) || resourceID <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid resource ID."
                });
            }

            const [result] = await pool.query(
                `
                DELETE FROM resources
                WHERE ResourceID = ?
                `,
                [resourceID]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Wellness resource not found."
                });
            }

            res.json({
                success: true,
                message: "Wellness resource deleted successfully."
            });

        } catch (error) {

            console.error("Admin resource delete error:", error);

            res.status(500).json({
                success: false,
                message: "Unable to delete wellness resource.",
                error: error.message
            });
        }
    }
);

// --------------------------------------------------
// 404 API HANDLER
// --------------------------------------------------

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

async function startServer() {
    
    const connected = await testConnection();

    if (!connected) {
        console.error(
            "❌ Server stopped because the database connection failed."
        );

        process.exit(1);
    }

    app.listen(PORT, () => {

        console.log("");
        console.log("========================================");
        console.log("   REACH & TEACH SERVER");
        console.log("========================================");
        console.log(`Server: http://localhost:${PORT}`);
        console.log(`User:   http://localhost:${PORT}/user/`);
        console.log(`Admin:  http://localhost:${PORT}/admin/`);
        console.log("");
        console.log("API:    http://localhost:${PORT}/api/test");
        console.log("DB:     reachandteach");
        console.log("========================================");
        console.log("");
    });
}

startServer();