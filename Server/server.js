// ============================================================
// REACH & TEACH
// SERVER.JS
// ============================================================

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("./db");

const app = express();
const PORT = 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Main System folder
app.use(express.static(path.join(__dirname, "..")));

// ============================================================
// BASIC TEST
// ============================================================

app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT 1 AS connected");

        res.json({
            success: true,
            message: "MySQL connection successful.",
            data: rows
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "MySQL connection failed.",
            error: error.message
        });
    }
});

// ============================================================
// ADMIN REGISTER
// ============================================================

app.post("/api/admin/register", async (req, res) => {

    try {

        const {
            FullName,
            Email,
            Password,
            Role
        } = req.body;

        if (!FullName || !Email || !Password) {
            return res.status(400).json({
                success: false,
                message: "Full name, email, and password are required."
            });
        }

        const hashedPassword = await bcrypt.hash(Password, 10);

        const [result] = await pool.query(
            `
            INSERT INTO admin
            (FullName, Email, Password, Role)
            VALUES (?, ?, ?, ?)
            `,
            [
                FullName,
                Email,
                hashedPassword,
                Role || "Admin"
            ]
        );

        res.json({
            success: true,
            message: "Admin account created.",
            adminId: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.code === "ER_DUP_ENTRY"
                ? "Email already exists."
                : error.message
        });
    }
});

// ============================================================
// ADMIN LOGIN
// ============================================================

app.post("/api/admin/login", async (req, res) => {

    try {

        const {
            Email,
            Password
        } = req.body;

        if (!Email || !Password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT *
            FROM admin
            WHERE Email = ?
            LIMIT 1
            `,
            [Email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const admin = rows[0];

        const passwordCorrect = await bcrypt.compare(
            Password,
            admin.Password
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            admin: {
                AdminID: admin.AdminID,
                FullName: admin.FullName,
                Email: admin.Email,
                Role: admin.Role
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// DASHBOARD STATISTICS
// ============================================================

app.get("/api/dashboard/stats", async (req, res) => {

    try {

        const [
            [students],
            [appointments],
            [sessions],
            [moods],
            [pending],
            [messages]
        ] = await Promise.all([

            pool.query(
                "SELECT COUNT(*) AS count FROM student"
            ),

            pool.query(
                "SELECT COUNT(*) AS count FROM appointment"
            ),

            pool.query(
                "SELECT COUNT(*) AS count FROM counseling_session"
            ),

            pool.query(
                "SELECT COUNT(*) AS count FROM mood_assessment"
            ),

            pool.query(
                `
                SELECT COUNT(*) AS count
                FROM appointment
                WHERE Status = 'Pending'
                `
            ),

            pool.query(
                `
                SELECT COUNT(*) AS count
                FROM chat_message
                WHERE IsRead = 0
                `
            )

        ]);

        res.json({
            success: true,
            stats: {
                students: students[0].count,
                appointments: appointments[0].count,
                sessions: sessions[0].count,
                moodAssessments: moods[0].count,
                pendingAppointments: pending[0].count,
                unreadMessages: messages[0].count
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT SYNC
//
// This is VERY IMPORTANT.
//
// The student's website sends the registered account information
// here. The server finds the student by EMAIL.
//
// The database StudentID becomes the permanent link between
// the student and every activity they create.
// ============================================================

app.post("/api/student/sync", async (req, res) => {

    try {

        const {
            Email,
            FirstName,
            LastName,
            ContactNumber,
            GradeLevel
        } = req.body;

        if (!Email || !FirstName || !LastName) {

            return res.status(400).json({
                success: false,
                message: "Email, first name, and last name are required."
            });

        }

        const [existing] = await pool.query(
            `
            SELECT *
            FROM student
            WHERE Email = ?
            LIMIT 1
            `,
            [Email]
        );

        let student;

        if (existing.length > 0) {

            await pool.query(
                `
                UPDATE student
                SET
                    FirstName = ?,
                    LastName = ?,
                    ContactNumber = ?,
                    GradeLevel = ?
                WHERE StudentID = ?
                `,
                [
                    FirstName,
                    LastName,
                    ContactNumber || null,
                    GradeLevel || null,
                    existing[0].StudentID
                ]
            );

            const [updated] = await pool.query(
                `
                SELECT *
                FROM student
                WHERE StudentID = ?
                `,
                [existing[0].StudentID]
            );

            student = updated[0];

        } else {

            const [result] = await pool.query(
                `
                INSERT INTO student
                (
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber,
                    GradeLevel
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    FirstName,
                    LastName,
                    Email,
                    ContactNumber || null,
                    GradeLevel || null
                ]
            );

            const [created] = await pool.query(
                `
                SELECT *
                FROM student
                WHERE StudentID = ?
                `,
                [result.insertId]
            );

            student = created[0];
        }

        res.json({
            success: true,
            student: {
                StudentID: student.StudentID,
                FirstName: student.FirstName,
                LastName: student.LastName,
                FullName:
                    `${student.FirstName} ${student.LastName}`.trim(),
                Email: student.Email,
                ContactNumber: student.ContactNumber,
                GradeLevel: student.GradeLevel
            }
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// GET STUDENT BY EMAIL
// ============================================================

app.get("/api/student/profile", async (req, res) => {

    try {

        const email = req.query.email;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                StudentID,
                FirstName,
                LastName,
                CONCAT(FirstName, ' ', LastName) AS FullName,
                Email,
                ContactNumber,
                GradeLevel
            FROM student
            WHERE Email = ?
            LIMIT 1
            `,
            [email]
        );

        if (rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        res.json({
            success: true,
            student: rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// COUNSELORS
// ============================================================

app.get("/api/counselors", async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                CounselorID,
                CounselorName,
                Email,
                ContactNumber
            FROM guidance_counselor
            ORDER BY CounselorName
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
            message: error.message
        });
    }
});

// ============================================================
// STUDENT APPOINTMENT
// ============================================================

app.post("/api/student/appointments", async (req, res) => {

    try {

        const {
            Email,
            CounselorID,
            AppointmentDate,
            AppointmentTime,
            Reason
        } = req.body;

        if (
            !Email ||
            !AppointmentDate ||
            !AppointmentTime
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Email, appointment date, and appointment time are required."
            });
        }

        // Find student
        const [students] = await pool.query(
            `
            SELECT StudentID
            FROM student
            WHERE Email = ?
            LIMIT 1
            `,
            [Email]
        );

        if (students.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Student account was not found. Please sign in again."
            });
        }

        const StudentID = students[0].StudentID;

        // Prevent duplicate pending appointment
        const [duplicates] = await pool.query(
            `
            SELECT AppointmentID
            FROM appointment
            WHERE StudentID = ?
              AND AppointmentDate = ?
              AND AppointmentTime = ?
              AND Status = 'Pending'
            LIMIT 1
            `,
            [
                StudentID,
                AppointmentDate,
                AppointmentTime
            ]
        );

        if (duplicates.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    "You already have a pending appointment at this date and time."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO appointment
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
                StudentID,
                CounselorID || null,
                AppointmentDate,
                AppointmentTime,
                Reason || null
            ]
        );

        // Create waiting conversation
        await pool.query(
            `
            INSERT INTO chat_conversation
            (
                StudentID,
                CounselorID,
                AppointmentID,
                Status
            )
            VALUES (?, ?, ?, 'Waiting')
            `,
            [
                StudentID,
                CounselorID || null,
                result.insertId
            ]
        );

        res.json({
            success: true,
            message:
                "Appointment request submitted. Waiting for counselor approval.",
            appointmentId: result.insertId,
            status: "Pending"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT APPOINTMENTS
// ============================================================

app.get("/api/student/appointments", async (req, res) => {

    try {

        const email = req.query.email;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                a.AppointmentID,
                a.StudentID,
                CONCAT(s.FirstName, ' ', s.LastName)
                    AS StudentName,
                a.CounselorID,
                c.CounselorName,
                a.AppointmentDate,
                a.AppointmentTime,
                a.Reason,
                a.Status
            FROM appointment a

            INNER JOIN student s
                ON s.StudentID = a.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = a.CounselorID

            WHERE s.Email = ?

            ORDER BY
                a.AppointmentDate DESC,
                a.AppointmentTime DESC
            `,
            [email]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN APPOINTMENT STATUS
//
// Pending
//    ↓
// Approved
//    ↓
// Counseling Session
//    ↓
// Chat Active
// ============================================================

app.put("/api/admin/appointments/:id/status", async (req, res) => {

    const connection = await pool.getConnection();

    try {

        const appointmentId = Number(req.params.id);
        const status = req.body.status;

        const allowedStatuses = [
            "Pending",
            "Approved",
            "Rejected",
            "Cancelled",
            "Completed"
        ];

        if (!allowedStatuses.includes(status)) {

            connection.release();

            return res.status(400).json({
                success: false,
                message: "Invalid appointment status."
            });
        }

        await connection.beginTransaction();

        const [appointments] = await connection.query(
            `
            SELECT *
            FROM appointment
            WHERE AppointmentID = ?
            FOR UPDATE
            `,
            [appointmentId]
        );

        if (appointments.length === 0) {

            await connection.rollback();
            connection.release();

            return res.status(404).json({
                success: false,
                message: "Appointment not found."
            });
        }

        const appointment = appointments[0];

        await connection.query(
            `
            UPDATE appointment
            SET Status = ?
            WHERE AppointmentID = ?
            `,
            [
                status,
                appointmentId
            ]
        );

        // ====================================================
        // APPROVED
        // ====================================================

        if (status === "Approved") {

            // Create counseling session if it doesn't exist
            const [sessions] = await connection.query(
                `
                SELECT SessionID
                FROM counseling_session
                WHERE StudentID = ?
                  AND SessionDate = ?
                  AND SessionTime = ?
                LIMIT 1
                `,
                [
                    appointment.StudentID,
                    appointment.AppointmentDate,
                    appointment.AppointmentTime
                ]
            );

            if (sessions.length === 0) {

                await connection.query(
                    `
                    INSERT INTO counseling_session
                    (
                        StudentID,
                        SessionDate,
                        SessionTime,
                        SessionType,
                        SessionStatus,
                        Notes
                    )
                    VALUES (?, ?, ?, 'Online Counseling', 'Scheduled', NULL)
                    `,
                    [
                        appointment.StudentID,
                        appointment.AppointmentDate,
                        appointment.AppointmentTime
                    ]
                );
            }

            // Activate chat
            await connection.query(
                `
                UPDATE chat_conversation
                SET
                    CounselorID = ?,
                    Status = 'Active'
                WHERE AppointmentID = ?
                `,
                [
                    appointment.CounselorID || null,
                    appointmentId
                ]
            );
        }

        // ====================================================
        // REJECTED / CANCELLED
        // ====================================================

        if (
            status === "Rejected" ||
            status === "Cancelled"
        ) {

            await connection.query(
                `
                UPDATE chat_conversation
                SET Status = 'Closed'
                WHERE AppointmentID = ?
                `,
                [appointmentId]
            );
        }

        // ====================================================
        // COMPLETED
        // ====================================================

        if (status === "Completed") {

            await connection.query(
                `
                UPDATE counseling_session
                SET SessionStatus = 'Completed'
                WHERE StudentID = ?
                  AND SessionDate = ?
                  AND SessionTime = ?
                `,
                [
                    appointment.StudentID,
                    appointment.AppointmentDate,
                    appointment.AppointmentTime
                ]
            );

            await connection.query(
                `
                UPDATE chat_conversation
                SET Status = 'Closed'
                WHERE AppointmentID = ?
                `,
                [appointmentId]
            );
        }

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: `Appointment ${status.toLowerCase()}.`,
            status
        });

    } catch (error) {

        await connection.rollback();
        connection.release();

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT MOOD
// ============================================================

app.post("/api/student/moods", async (req, res) => {

    try {

        const {
            Email,
            MoodLevel,
            MoodScore,
            Remarks
        } = req.body;

        if (!Email || !MoodLevel) {

            return res.status(400).json({
                success: false,
                message: "Email and mood are required."
            });
        }

        // Find student
        const [students] = await pool.query(
            `
            SELECT StudentID
            FROM student
            WHERE Email = ?
            LIMIT 1
            `,
            [Email]
        );

        if (students.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Student account not found."
            });
        }

        const StudentID = students[0].StudentID;

        // Find latest counseling session if available
        const [sessions] = await pool.query(
            `
            SELECT SessionID
            FROM counseling_session
            WHERE StudentID = ?
            ORDER BY SessionDate DESC, SessionTime DESC
            LIMIT 1
            `,
            [StudentID]
        );

        const SessionID =
            sessions.length > 0
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
                StudentID,
                SessionID,
                MoodScore || null,
                MoodLevel,
                Remarks || null
            ]
        );

        res.json({
            success: true,
            message: "Mood check-in saved.",
            assessmentId: result.insertId,
            studentId: StudentID,
            mood: MoodLevel
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT MOOD HISTORY
// ============================================================

app.get("/api/student/moods", async (req, res) => {

    try {

        const email = req.query.email;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                ma.AssessmentID,
                ma.StudentID,
                CONCAT(
                    s.FirstName,
                    ' ',
                    s.LastName
                ) AS StudentName,
                ma.SessionID,
                ma.AssessmentDate,
                ma.MoodScore,
                ma.MoodLevel,
                ma.Remarks
            FROM mood_assessment ma

            INNER JOIN student s
                ON s.StudentID = ma.StudentID

            WHERE s.Email = ?

            ORDER BY ma.AssessmentDate DESC,
                     ma.AssessmentID DESC
            `,
            [email]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT CHAT
// ============================================================

// Get student's conversation
app.get("/api/student/chat", async (req, res) => {

    try {

        const email = req.query.email;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const [conversations] = await pool.query(
            `
            SELECT
                cc.ConversationID,
                cc.StudentID,
                CONCAT(
                    s.FirstName,
                    ' ',
                    s.LastName
                ) AS StudentName,
                cc.CounselorID,
                c.CounselorName,
                cc.AppointmentID,
                cc.Status,
                cc.CreatedAt,
                cc.UpdatedAt

            FROM chat_conversation cc

            INNER JOIN student s
                ON s.StudentID = cc.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = cc.CounselorID

            WHERE s.Email = ?

            ORDER BY cc.UpdatedAt DESC
            LIMIT 1
            `,
            [email]
        );

        if (conversations.length === 0) {

            return res.json({
                success: true,
                conversation: null,
                messages: []
            });
        }

        const conversation = conversations[0];

        const [messages] = await pool.query(
            `
            SELECT
                MessageID,
                ConversationID,
                SenderType,
                SenderID,
                MessageText,
                SentAt,
                IsRead
            FROM chat_message
            WHERE ConversationID = ?
            ORDER BY SentAt ASC
            `,
            [conversation.ConversationID]
        );

        res.json({
            success: true,
            conversation,
            messages
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT SEND CHAT MESSAGE
// ============================================================

app.post("/api/student/chat/messages", async (req, res) => {

    try {

        const {
            Email,
            MessageText
        } = req.body;

        if (!Email || !MessageText?.trim()) {

            return res.status(400).json({
                success: false,
                message: "Email and message are required."
            });
        }

        // Find active conversation
        const [conversations] = await pool.query(
            `
            SELECT
                cc.ConversationID,
                cc.StudentID,
                cc.Status
            FROM chat_conversation cc

            INNER JOIN student s
                ON s.StudentID = cc.StudentID

            WHERE s.Email = ?
              AND cc.Status = 'Active'

            ORDER BY cc.UpdatedAt DESC

            LIMIT 1
            `,
            [Email]
        );

        if (conversations.length === 0) {

            return res.status(403).json({
                success: false,
                message:
                    "Chat is not available yet. Your appointment must be accepted first."
            });
        }

        const conversation =
            conversations[0];

        const [result] = await pool.query(
            `
            INSERT INTO chat_message
            (
                ConversationID,
                SenderType,
                SenderID,
                MessageText,
                IsRead
            )
            VALUES (?, 'Student', ?, ?, 0)
            `,
            [
                conversation.ConversationID,
                conversation.StudentID,
                MessageText.trim()
            ]
        );

        await pool.query(
            `
            UPDATE chat_conversation
            SET UpdatedAt = CURRENT_TIMESTAMP
            WHERE ConversationID = ?
            `,
            [conversation.ConversationID]
        );

        res.json({
            success: true,
            messageId: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN CHAT CONVERSATIONS
// ============================================================

app.get("/api/admin/messages", async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                cc.ConversationID,
                cc.StudentID,

                CONCAT(
                    s.FirstName,
                    ' ',
                    s.LastName
                ) AS StudentName,

                s.Email AS StudentEmail,

                cc.CounselorID,
                c.CounselorName,

                cc.AppointmentID,
                cc.Status,
                cc.CreatedAt,
                cc.UpdatedAt,

                (
                    SELECT cm.MessageText
                    FROM chat_message cm
                    WHERE cm.ConversationID = cc.ConversationID
                    ORDER BY cm.SentAt DESC
                    LIMIT 1
                ) AS LastMessage,

                (
                    SELECT COUNT(*)
                    FROM chat_message cm2
                    WHERE cm2.ConversationID = cc.ConversationID
                      AND cm2.IsRead = 0
                      AND cm2.SenderType = 'Student'
                ) AS UnreadCount

            FROM chat_conversation cc

            INNER JOIN student s
                ON s.StudentID = cc.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = cc.CounselorID

            ORDER BY cc.UpdatedAt DESC
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
            message: error.message
        });
    }
});

// ============================================================
// ADMIN GET CHAT MESSAGES
// ============================================================

app.get(
    "/api/admin/messages/:conversationId",
    async (req, res) => {

        try {

            const conversationId =
                Number(req.params.conversationId);

            const [messages] = await pool.query(
                `
                SELECT
                    MessageID,
                    ConversationID,
                    SenderType,
                    SenderID,
                    MessageText,
                    SentAt,
                    IsRead
                FROM chat_message
                WHERE ConversationID = ?
                ORDER BY SentAt ASC
                `,
                [conversationId]
            );

            // Mark student messages as read
            await pool.query(
                `
                UPDATE chat_message
                SET IsRead = 1
                WHERE ConversationID = ?
                  AND SenderType = 'Student'
                `,
                [conversationId]
            );

            res.json({
                success: true,
                data: messages
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ============================================================
// ADMIN SEND CHAT MESSAGE
// ============================================================

app.post(
    "/api/admin/messages/:conversationId",
    async (req, res) => {

        try {

            const conversationId =
                Number(req.params.conversationId);

            const {
                SenderID,
                MessageText
            } = req.body;

            if (!MessageText?.trim()) {

                return res.status(400).json({
                    success: false,
                    message: "Message is required."
                });
            }

            const [conversations] = await pool.query(
                `
                SELECT
                    ConversationID,
                    Status
                FROM chat_conversation
                WHERE ConversationID = ?
                LIMIT 1
                `,
                [conversationId]
            );

            if (conversations.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Conversation not found."
                });
            }

            if (conversations[0].Status !== "Active") {

                return res.status(403).json({
                    success: false,
                    message:
                        "This conversation is not active."
                });
            }

            const [result] = await pool.query(
                `
                INSERT INTO chat_message
                (
                    ConversationID,
                    SenderType,
                    SenderID,
                    MessageText,
                    IsRead
                )
                VALUES (?, 'Counselor', ?, ?, 0)
                `,
                [
                    conversationId,
                    SenderID || null,
                    MessageText.trim()
                ]
            );

            await pool.query(
                `
                UPDATE chat_conversation
                SET UpdatedAt = CURRENT_TIMESTAMP
                WHERE ConversationID = ?
                `,
                [conversationId]
            );

            res.json({
                success: true,
                messageId: result.insertId
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
);

// ============================================================
// STUDENT FEEDBACK
// ============================================================

app.post("/api/student/feedback", async (req, res) => {

    try {

        const {
            Email,
            SessionID,
            CounselorID,
            Rating,
            Comments
        } = req.body;

        if (!Email || !Rating) {

            return res.status(400).json({
                success: false,
                message:
                    "Email and rating are required."
            });
        }

        const [students] = await pool.query(
            `
            SELECT StudentID
            FROM student
            WHERE Email = ?
            LIMIT 1
            `,
            [Email]
        );

        if (students.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const StudentID =
            students[0].StudentID;

        let finalSessionID = SessionID;

        // If no session was supplied, use latest session
        if (!finalSessionID) {

            const [sessions] = await pool.query(
                `
                SELECT SessionID
                FROM counseling_session
                WHERE StudentID = ?
                ORDER BY SessionDate DESC,
                         SessionTime DESC
                LIMIT 1
                `,
                [StudentID]
            );

            if (sessions.length > 0) {
                finalSessionID =
                    sessions[0].SessionID;
            }
        }

        if (!finalSessionID) {

            return res.status(400).json({
                success: false,
                message:
                    "A counseling session is required before submitting feedback."
            });
        }

        // Prevent duplicate feedback
        const [existing] = await pool.query(
            `
            SELECT FeedbackID
            FROM feedback
            WHERE SessionID = ?
            LIMIT 1
            `,
            [finalSessionID]
        );

        if (existing.length > 0) {

            return res.status(409).json({
                success: false,
                message:
                    "Feedback has already been submitted for this session."
            });
        }

        const [result] = await pool.query(
            `
            INSERT INTO feedback
            (
                SessionID,
                CounselorID,
                Rating,
                Comments,
                FeedbackDate
            )
            VALUES (?, ?, ?, ?, CURDATE())
            `,
            [
                finalSessionID,
                CounselorID || null,
                Rating,
                Comments || null
            ]
        );

        res.json({
            success: true,
            message: "Feedback submitted successfully.",
            feedbackId: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// STUDENT FEEDBACK HISTORY
// ============================================================

app.get("/api/student/feedback", async (req, res) => {

    try {

        const email = req.query.email;

        if (!email) {

            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const [rows] = await pool.query(
            `
            SELECT
                f.FeedbackID,
                f.SessionID,
                f.CounselorID,
                c.CounselorName,
                f.Rating,
                f.Comments,
                f.FeedbackDate

            FROM feedback f

            INNER JOIN counseling_session cs
                ON cs.SessionID = f.SessionID

            INNER JOIN student s
                ON s.StudentID = cs.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = f.CounselorID

            WHERE s.Email = ?

            ORDER BY f.FeedbackDate DESC
            `,
            [email]
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN DATA
// ============================================================

app.get("/api/admin/students", async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                StudentID,
                FirstName,
                LastName,
                CONCAT(
                    FirstName,
                    ' ',
                    LastName
                ) AS FullName,
                Email,
                ContactNumber,
                GradeLevel
            FROM student
            ORDER BY StudentID DESC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN APPOINTMENTS
// ============================================================

app.get("/api/admin/appointments", async (req, res) => {

    try {

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
                a.Status

            FROM appointment a

            INNER JOIN student s
                ON s.StudentID = a.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = a.CounselorID

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

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN MOODS
// ============================================================

app.get("/api/admin/moods", async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                ma.AssessmentID,
                ma.StudentID,

                CONCAT(
                    s.FirstName,
                    ' ',
                    s.LastName
                ) AS StudentName,

                s.Email AS StudentEmail,

                ma.SessionID,
                ma.AssessmentDate,
                ma.MoodScore,
                ma.MoodLevel,
                ma.Remarks

            FROM mood_assessment ma

            INNER JOIN student s
                ON s.StudentID = ma.StudentID

            ORDER BY
                ma.AssessmentDate DESC,
                ma.AssessmentID DESC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN SESSIONS
// ============================================================

app.get("/api/admin/sessions", async (req, res) => {

    try {

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

                s.Email AS StudentEmail,

                cs.SessionDate,
                cs.SessionTime,
                cs.SessionType,
                cs.SessionStatus,
                cs.Notes

            FROM counseling_session cs

            INNER JOIN student s
                ON s.StudentID = cs.StudentID

            ORDER BY
                cs.SessionDate DESC,
                cs.SessionTime DESC
            `
        );

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// ADMIN FEEDBACK
// ============================================================

app.get("/api/admin/feedback", async (req, res) => {

    try {

        const [rows] = await pool.query(
            `
            SELECT
                f.FeedbackID,
                f.SessionID,

                cs.StudentID,

                CONCAT(
                    s.FirstName,
                    ' ',
                    s.LastName
                ) AS StudentName,

                s.Email AS StudentEmail,

                f.CounselorID,
                c.CounselorName,

                f.Rating,
                f.Comments,
                f.FeedbackDate

            FROM feedback f

            INNER JOIN counseling_session cs
                ON cs.SessionID = f.SessionID

            INNER JOIN student s
                ON s.StudentID = cs.StudentID

            LEFT JOIN guidance_counselor c
                ON c.CounselorID = f.CounselorID

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

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// GENERIC ADMIN CRUD
// ============================================================

const tables = {

    students: {
        table: "student",
        pk: "StudentID",
        fields: [
            "FirstName",
            "LastName",
            "Email",
            "ContactNumber",
            "GradeLevel"
        ]
    },

    appointments: {
        table: "appointment",
        pk: "AppointmentID",
        fields: [
            "StudentID",
            "CounselorID",
            "AppointmentDate",
            "AppointmentTime",
            "Reason",
            "Status"
        ]
    },

    sessions: {
        table: "counseling_session",
        pk: "SessionID",
        fields: [
            "StudentID",
            "SessionDate",
            "SessionTime",
            "SessionType",
            "SessionStatus",
            "Notes"
        ]
    },

    counselors: {
        table: "guidance_counselor",
        pk: "CounselorID",
        fields: [
            "CounselorName",
            "Email",
            "ContactNumber"
        ]
    },

    moods: {
        table: "mood_assessment",
        pk: "AssessmentID",
        fields: [
            "StudentID",
            "SessionID",
            "AssessmentDate",
            "MoodScore",
            "MoodLevel",
            "Remarks"
        ]
    },

    mood_records: {
        table: "mood_record",
        pk: "AssessmentID",
        fields: [
            "RecordedDate",
            "MoodStatus",
            "Recommendation"
        ]
    },

    feedback: {
        table: "feedback",
        pk: "FeedbackID",
        fields: [
            "SessionID",
            "CounselorID",
            "Rating",
            "Comments",
            "FeedbackDate"
        ]
    },

    resources: {
        table: "wellness_resource",
        pk: "ResourceID",
        fields: [
            "FeedbackID",
            "ResourceTitle",
            "ResourceType",
            "Description",
            "ResourceDate"
        ]
    }
};

// ============================================================
// GENERIC GET
// ============================================================

app.get("/api/admin/:type", async (req, res) => {

    try {

        const config = tables[req.params.type];

        if (!config) {

            return res.status(404).json({
                success: false,
                message: "Unknown data type."
            });
        }

        let sql = `
            SELECT *
            FROM ${config.table}
        `;

        // Add names for important admin records
        if (req.params.type === "appointments") {

            sql = `
                SELECT
                    a.*,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    c.CounselorName
                FROM appointment a
                INNER JOIN student s
                    ON s.StudentID = a.StudentID
                LEFT JOIN guidance_counselor c
                    ON c.CounselorID = a.CounselorID
                ORDER BY a.AppointmentID DESC
            `;

        } else if (req.params.type === "moods") {

            sql = `
                SELECT
                    ma.*,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    s.Email AS StudentEmail
                FROM mood_assessment ma
                INNER JOIN student s
                    ON s.StudentID = ma.StudentID
                ORDER BY ma.AssessmentID DESC
            `;

        } else if (req.params.type === "sessions") {

            sql = `
                SELECT
                    cs.*,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    s.Email AS StudentEmail
                FROM counseling_session cs
                INNER JOIN student s
                    ON s.StudentID = cs.StudentID
                ORDER BY cs.SessionID DESC
            `;

        } else if (req.params.type === "feedback") {

            sql = `
                SELECT
                    f.*,
                    cs.StudentID,
                    CONCAT(
                        s.FirstName,
                        ' ',
                        s.LastName
                    ) AS StudentName,
                    c.CounselorName
                FROM feedback f
                INNER JOIN counseling_session cs
                    ON cs.SessionID = f.SessionID
                INNER JOIN student s
                    ON s.StudentID = cs.StudentID
                LEFT JOIN guidance_counselor c
                    ON c.CounselorID = f.CounselorID
                ORDER BY f.FeedbackID DESC
            `;
        }

        const [rows] = await pool.query(sql);

        res.json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// GENERIC POST
// ============================================================

app.post("/api/admin/:type", async (req, res) => {

    try {

        const config = tables[req.params.type];

        if (!config) {

            return res.status(404).json({
                success: false,
                message: "Unknown data type."
            });
        }

        const fields = config.fields.filter(
            field =>
                req.body[field] !== undefined
        );

        if (fields.length === 0) {

            return res.status(400).json({
                success: false,
                message: "No valid fields supplied."
            });
        }

        const values = fields.map(
            field => req.body[field]
        );

        const placeholders =
            fields.map(() => "?").join(", ");

        const [result] = await pool.query(
            `
            INSERT INTO ${config.table}
            (${fields.join(", ")})
            VALUES (${placeholders})
            `,
            values
        );

        res.json({
            success: true,
            message: "Record created.",
            id: result.insertId
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// GENERIC PUT
// ============================================================

app.put("/api/admin/:type/:id", async (req, res) => {

    try {

        const config = tables[req.params.type];

        if (!config) {

            return res.status(404).json({
                success: false,
                message: "Unknown data type."
            });
        }

        const fields = config.fields.filter(
            field =>
                req.body[field] !== undefined
        );

        if (fields.length === 0) {

            return res.status(400).json({
                success: false,
                message: "No valid fields supplied."
            });
        }

        const values = fields.map(
            field => req.body[field]
        );

        const assignments =
            fields
                .map(field => `${field} = ?`)
                .join(", ");

        values.push(req.params.id);

        await pool.query(
            `
            UPDATE ${config.table}
            SET ${assignments}
            WHERE ${config.pk} = ?
            `,
            values
        );

        res.json({
            success: true,
            message: "Record updated."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// GENERIC DELETE
// ============================================================

app.delete("/api/admin/:type/:id", async (req, res) => {

    try {

        const config = tables[req.params.type];

        if (!config) {

            return res.status(404).json({
                success: false,
                message: "Unknown data type."
            });
        }

        await pool.query(
            `
            DELETE FROM ${config.table}
            WHERE ${config.pk} = ?
            `,
            [req.params.id]
        );

        res.json({
            success: true,
            message: "Record deleted."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ============================================================
// 404 API
// ============================================================

app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {

    console.log(
        `REACH & TEACH server running at http://localhost:${PORT}`
    );

});