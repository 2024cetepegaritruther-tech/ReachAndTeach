/* =========================================================
   REACH & TEACH
   STUDENT SYSTEM — MYSQL CONNECTED
   ========================================================= */

"use strict";

/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE = "/api";

let currentUser = null;
let studentId = null;
let activeConversation = null;
let chatPollTimer = null;
let appointmentPollTimer = null;
let moodSubmitting = false;

/* =========================================================
   ELEMENTS
========================================================= */

const chatModal = document.getElementById("chatModal");
const closeChatButton = document.getElementById("closeChat");
const chatInput = document.getElementById("chatInput");
const sendMessageButton = document.getElementById("sendMessage");
const chatBody = document.getElementById("chatBody");

const reservationModal =
    document.getElementById("reservationModal");

const reservationDate =
    document.getElementById("reservationDate");

const reservationTime =
    document.getElementById("reservationTime");

const appointmentPreview =
    document.getElementById("appointmentPreview");

const recordsModal =
    document.getElementById("recordsModal");

const moodMessage =
    document.getElementById("moodMessage");

const themeToggle =
    document.getElementById("themeToggle");

const mobileMenuButton =
    document.getElementById("mobileMenuButton");

const navigation =
    document.querySelector(".navigation");

const moodButtons =
    document.querySelectorAll(".mood");

/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", async function () {

    initializeTheme();
    initializeNavigation();
    initializeMoodSystem();
    initializeReservation();
    initializeChat();
    initializeKeyboardControls();

    setMinimumReservationDate();

    currentUser = getCurrentUser();

    if (currentUser && currentUser.email) {
        await syncStudent();
        await loadStudentAppointments();
    }
});

/* =========================================================
   TOAST
========================================================= */

function showToast(title, message, type = "info") {

    let container =
        document.getElementById("rtToastContainer");

    if (!container) {

        container = document.createElement("div");

        container.id = "rtToastContainer";

        container.style.cssText = `
            position:fixed;
            top:20px;
            right:20px;
            z-index:99999;
            display:flex;
            flex-direction:column;
            gap:10px;
        `;

        document.body.appendChild(container);
    }

    const toast = document.createElement("div");

    toast.style.cssText = `
        min-width:280px;
        max-width:380px;
        padding:15px 18px;
        border-radius:14px;
        background:var(--card,#ffffff);
        color:var(--text,#222);
        box-shadow:0 10px 30px rgba(0,0,0,.15);
        border-left:4px solid ${type === "error"
            ? "#dc3545"
            : type === "warning"
            ? "#ffc107"
            : "#198754"};
        animation:rtToastIn .25s ease;
    `;

    toast.innerHTML = `
        <strong>${escapeHTML(title)}</strong>
        <div style="margin-top:4px;">
            ${escapeHTML(message)}
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

window.showReachTeachToast = showToast;

/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   LOCAL STORAGE
========================================================= */

function parseStorageValue(key) {

    try {

        const value =
            localStorage.getItem(key);

        if (!value) {
            return null;
        }

        return JSON.parse(value);

    } catch {

        return localStorage.getItem(key);
    }
}

/* =========================================================
   USER IDENTITY
========================================================= */

function normalizeUser(value) {

    if (!value) {
        return null;
    }

    if (Array.isArray(value)) {
        value = value[0];
    }

    if (typeof value === "string") {

        try {
            value = JSON.parse(value);
        } catch {
            return {
                email: value
            };
        }
    }

    if (
        !value ||
        typeof value !== "object"
    ) {
        return null;
    }

    const firstName =
        value.firstName ||
        value.FirstName ||
        value.firstname ||
        "";

    const middleName =
        value.middleName ||
        value.MiddleName ||
        "";

    const lastName =
        value.lastName ||
        value.LastName ||
        value.lastname ||
        "";

    const email =
        value.email ||
        value.Email ||
        value.userEmail ||
        "";

    const fullName =
        value.fullName ||
        value.FullName ||
        [
            firstName,
            middleName,
            lastName
        ]
            .filter(Boolean)
            .join(" ")
            .trim();

    return {
        ...value,
        firstName,
        middleName,
        lastName,
        email,
        fullName
    };
}

function getCurrentUser() {

    const keys = [
        "loggedInUser",
        "reachTeachCurrentUser",
        "currentUser",
        "userData"
    ];

    let bestUser = null;

    for (const key of keys) {

        const user =
            normalizeUser(
                parseStorageValue(key)
            );

        if (
            user &&
            (
                user.email ||
                user.firstName ||
                user.lastName ||
                user.StudentID ||
                user.studentId
            )
        ) {
            bestUser = user;
            break;
        }
    }

    /*
       If the login page saved only an email, recover the
       complete account from reachTeachUsers.
    */
    const users =
        parseStorageValue("reachTeachUsers");

    const loggedEmail =
        localStorage.getItem("loggedInEmail") ||
        localStorage.getItem("userEmail") ||
        bestUser?.email ||
        "";

    if (Array.isArray(users) && loggedEmail) {

        const found =
            users.find(user =>
                String(user.email || "")
                    .trim()
                    .toLowerCase() ===
                String(loggedEmail || "")
                    .trim()
                    .toLowerCase()
            );

        if (found) {
            const normalized = normalizeUser(found);

            return normalizeUser({
                ...normalized,
                ...(bestUser || {}),
                email: normalized.email || bestUser?.email || loggedEmail,
                firstName: normalized.firstName || bestUser?.firstName || "",
                lastName: normalized.lastName || bestUser?.lastName || "",
                StudentID:
                    bestUser?.StudentID ||
                    bestUser?.studentId ||
                    normalized?.StudentID ||
                    normalized?.studentId ||
                    null,
                studentId:
                    bestUser?.studentId ||
                    bestUser?.StudentID ||
                    normalized?.studentId ||
                    normalized?.StudentID ||
                    null
            });
        }
    }

    return bestUser;
}

function getContactNumber(user) {

    return (
        user.contactNumber ||
        user.ContactNumber ||
        user.phone ||
        user.Phone ||
        ""
    );
}

function getGradeLevel(user) {

    return (
        user.gradeLevel ||
        user.GradeLevel ||
        user.department ||
        user.Department ||
        ""
    );
}

/* =========================================================
   API HELPER
========================================================= */

async function api(url, options = {}) {

    const response =
        await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {

        throw new Error(
            data.message ||
            data.error ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

/* =========================================================
   STUDENT SYNC
========================================================= */

async function syncStudent() {

    currentUser = getCurrentUser();

    if (
        !currentUser ||
        !currentUser.email
    ) {
        console.warn("No logged-in student found.");
        return null;
    }

    try {

        const data =
            await api(
                `${API_BASE}/student/sync`,
                {
                    method: "POST",

                    body: JSON.stringify({

                        Email:
                            currentUser.email,

                        FirstName:
                            currentUser.firstName ||
                            "Student",

                        LastName:
                            currentUser.lastName ||
                            "",

                        ContactNumber:
                            getContactNumber(
                                currentUser
                            ),

                        GradeLevel:
                            getGradeLevel(
                                currentUser
                            )
                    })
                }
            );

        studentId =
            data.StudentID ||
            data.studentId ||
            data.id ||
            currentUser.StudentID ||
            currentUser.studentId ||
            null;

        if (studentId) {

            currentUser.StudentID =
                studentId;

            currentUser.studentId =
                studentId;

            localStorage.setItem(
                "loggedInUser",
                JSON.stringify(currentUser)
            );

            localStorage.setItem(
                "reachTeachCurrentUser",
                JSON.stringify(currentUser)
            );
        }

        console.log(
            "Student connected:",
            currentUser.fullName ||
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim(),
            "StudentID:",
            studentId
        );

        return {
            ...data,
            StudentID: studentId,
            studentId: studentId
        };

    } catch (error) {

        console.error(
            "Student sync error:",
            error
        );

        return null;
    }
}

async function ensureStudent() {

    currentUser = getCurrentUser();

    if (!currentUser || !currentUser.email) {
        return null;
    }

    if (currentUser.StudentID || currentUser.studentId) {
        studentId =
            currentUser.StudentID ||
            currentUser.studentId;

        return studentId;
    }

    const result =
        await syncStudent();

    return (
        result?.StudentID ||
        result?.studentId ||
        studentId ||
        null
    );
}

/* =========================================================
   THEME
========================================================= */

function initializeTheme() {

    const saved =
        localStorage.getItem(
            "reachTeachTheme"
        );

    if (saved === "dark") {
        document.body.classList.add("dark");

        if (themeToggle) {
            themeToggle.textContent = "☀️";
        }
    } else {

        document.body.classList.remove("dark");

        if (themeToggle) {
            themeToggle.textContent = "🌙";
        }
    }

    if (!themeToggle) {
        return;
    }

    themeToggle.addEventListener(
        "click",
        function () {

            const dark =
                document.body.classList.toggle(
                    "dark"
                );

            localStorage.setItem(
                "reachTeachTheme",
                dark ? "dark" : "light"
            );

            themeToggle.textContent =
                dark ? "☀️" : "🌙";
        }
    );
}

/* =========================================================
   NAVIGATION
========================================================= */

function initializeNavigation() {

    const links =
        document.querySelectorAll(
            ".navigation a"
        );

    links.forEach(link => {

        link.addEventListener(
            "click",
            function () {

                links.forEach(item =>
                    item.classList.remove(
                        "active"
                    )
                );

                link.classList.add(
                    "active"
                );

                closeMobileNavigation();
            }
        );
    });

    if (mobileMenuButton) {

        mobileMenuButton.addEventListener(
            "click",
            function () {

                if (!navigation) {
                    return;
                }

                navigation.classList.toggle(
                    "mobile-open"
                );

                mobileMenuButton.textContent =
                    navigation.classList.contains(
                        "mobile-open"
                    )
                        ? "×"
                        : "☰";
            }
        );
    }
}

function closeMobileNavigation() {

    if (navigation) {
        navigation.classList.remove(
            "mobile-open"
        );
    }

    if (mobileMenuButton) {
        mobileMenuButton.textContent = "☰";
    }
}
/* =========================================================
   MOOD SYSTEM
========================================================= */

const moodScores = {
    Happy: 5,
    Okay: 4,
    Neutral: 3,
    Sad: 2
};

function initializeMoodSystem() {

    moodButtons.forEach(button => {

        button.addEventListener(
            "click",
            function () {

                moodButtons.forEach(item =>
                    item.classList.remove(
                        "selected"
                    )
                );

                button.classList.add(
                    "selected"
                );

                const mood =
                    button.getAttribute(
                        "data-mood"
                    );

                if (moodMessage) {

                    moodMessage.textContent =
                        "You selected: " +
                        mood;
                }
            }
        );
    });
}

/* =========================================================
   SAVE MOOD TO MYSQL
========================================================= */

async function moodCheck() {

    if (moodSubmitting) {
        return;
    }

    const selected =
        document.querySelector(
            ".mood.selected"
        );

    if (!selected) {

        showToast(
            "Choose a mood",
            "Please select your mood first.",
            "warning"
        );

        return;
    }

    const mood =
        selected.getAttribute(
            "data-mood"
        );

    moodSubmitting = true;

    const checkButton =
        document.querySelector(".check-button");

    if (checkButton) {
        checkButton.disabled = true;
        checkButton.style.opacity = "0.7";
    }

    try {

        const id =
            await ensureStudent();

        if (!id || !currentUser?.email) {

            showToast(
                "Login required",
                "Please log in before submitting your mood.",
                "warning"
            );

            return;
        }

        await api(
            `${API_BASE}/student/moods`,
            {
                method: "POST",

                body: JSON.stringify({

                    email:
                        currentUser.email,

                    StudentID:
                        id,

                    MoodScore:
                        moodScores[mood] || 3,

                    MoodLevel:
                        mood,

                    Remarks:
                        "Student mood check-in"
                })
            }
        );

        localStorage.setItem(
            "reachTeachLatestMood",
            JSON.stringify({
                mood,
                date:
                    new Date()
                        .toISOString()
            })
        );

        if (moodMessage) {

            moodMessage.textContent =
                "Saved mood: " +
                mood;
        }

        showToast(
            "Mood saved",
            `Your ${mood} mood was recorded successfully.`,
            "success"
        );

    } catch (error) {

        console.error(
            "Mood save error:",
            error
        );

        showToast(
            "Mood not saved",
            error.message ||
            "Unable to save your mood.",
            "error"
        );

    } finally {

        moodSubmitting = false;

        if (checkButton) {
            checkButton.disabled = false;
            checkButton.style.opacity = "";
        }
    }
}

window.moodCheck = moodCheck;

/* =========================================================
   RESERVATION SYSTEM
========================================================= */

function initializeReservation() {

    if (reservationDate) {

        reservationDate.addEventListener(
            "change",
            updateAppointmentPreview
        );
    }

    if (reservationTime) {

        reservationTime.addEventListener(
            "change",
            updateAppointmentPreview
        );
    }

    const closeReservationButton =
        document.getElementById(
            "closeReservation"
        );

    if (closeReservationButton) {

        closeReservationButton.addEventListener(
            "click",
            closeReservation
        );
    }

    const cancelReservationButton =
        document.getElementById(
            "cancelReservation"
        );

    if (cancelReservationButton) {

        cancelReservationButton.addEventListener(
            "click",
            closeReservation
        );
    }

    const confirmButton =
        document.getElementById(
            "confirmReservation"
        );

    if (confirmButton) {

        confirmButton.addEventListener(
            "click",
            confirmReservation
        );
    }
}

function setMinimumReservationDate() {

    if (!reservationDate) {
        return;
    }

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    reservationDate.min =
        `${year}-${month}-${day}`;
}

function updateAppointmentPreview() {

    if (!appointmentPreview) {
        return;
    }

    const date =
        reservationDate?.value || "";

    const time =
        reservationTime?.value || "";

    if (!date && !time) {

        appointmentPreview.textContent =
            "Select your preferred date and time.";

        return;
    }

    let formattedDate =
        date;

    if (date) {

        const parsedDate =
            new Date(
                date + "T00:00:00"
            );

        if (!Number.isNaN(
            parsedDate.getTime()
        )) {

            formattedDate =
                parsedDate.toLocaleDateString(
                    undefined,
                    {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    }
                );
        }
    }

    appointmentPreview.textContent =
        `${formattedDate}${time ? " at " + time : ""}`;
}

function openReservation() {

    if (!reservationModal) {
        return;
    }

    reservationModal.classList.add(
        "show"
    );

    reservationModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

    updateAppointmentPreview();

    loadStudentAppointments();
}

window.openReservation =
    openReservation;

function closeReservation() {

    if (!reservationModal) {
        return;
    }

    reservationModal.classList.remove(
        "show"
    );

    reservationModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow =
        "";
}

window.closeReservation =
    closeReservation;

/* =========================================================
   COUNSELOR LIST
========================================================= */

async function loadCounselors() {

    const select =
        document.getElementById(
            "counselorSelect"
        );

    if (!select) {
        return;
    }

    try {

        const data =
            await api(
                `${API_BASE}/counselors`
            );

        const counselors =
            Array.isArray(data)
                ? data
                : data.counselors || [];

        select.innerHTML =
            `<option value="">
                Select counselor
            </option>`;

        counselors.forEach(
            counselor => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    counselor.CounselorID ||
                    counselor.id;

                option.textContent =
                    counselor.CounselorName ||
                    counselor.name ||
                    "Guidance Counselor";

                select.appendChild(
                    option
                );
            }
        );

    } catch (error) {

        console.error(
            "Counselor loading error:",
            error
        );
    }
}

/* =========================================================
   CONFIRM APPOINTMENT
========================================================= */

async function confirmReservation() {

    if (!reservationDate?.value) {

        showToast(
            "Date required",
            "Please select an appointment date.",
            "warning"
        );

        return;
    }

    if (!reservationTime?.value) {

        showToast(
            "Time required",
            "Please select an appointment time.",
            "warning"
        );

        return;
    }

    const id =
        await ensureStudent();

    if (!id || !currentUser?.email) {

        showToast(
            "Login required",
            "Please log in first.",
            "warning"
        );

        return;
    }

    const reasonInput =
        document.getElementById(
            "appointmentReason"
        );

    const counselorSelect =
        document.getElementById(
            "counselorSelect"
        );

    const reason =
        reasonInput?.value?.trim() ||
        "General counseling";

    const counselorId =
        counselorSelect?.value || null;

    const confirmButton =
        document.getElementById(
            "confirmReservation"
        );

    if (confirmButton) {
        confirmButton.disabled = true;
    }

    try {

        const data =
            await api(
                `${API_BASE}/student/appointments`,
                {
                    method: "POST",

                    body: JSON.stringify({

                        email:
                            currentUser.email,

                        StudentID:
                            id,

                        CounselorID:
                            counselorId,

                        AppointmentDate:
                            reservationDate.value,

                        AppointmentTime:
                            reservationTime.value,

                        Reason:
                            reason
                    })
                }
            );

        showToast(
            "Appointment submitted",
            data.message ||
            "Your appointment request was submitted.",
            "success"
        );

        if (reasonInput) {
            reasonInput.value = "";
        }

        if (reservationDate) {
            reservationDate.value = "";
        }

        if (reservationTime) {
            reservationTime.value = "";
        }

        if (counselorSelect) {
            counselorSelect.value = "";
        }

        updateAppointmentPreview();

        await loadStudentAppointments();

    } catch (error) {

        console.error(
            "Appointment error:",
            error
        );

        showToast(
            "Appointment failed",
            error.message ||
            "Unable to submit appointment.",
            "error"
        );

    } finally {

        if (confirmButton) {
            confirmButton.disabled = false;
        }
    }
}

window.confirmReservation =
    confirmReservation;

/* =========================================================
   LOAD APPOINTMENTS
========================================================= */

async function loadStudentAppointments() {

    if (!currentUser?.email) {
        return;
    }

    try {

        const data =
            await api(
                `${API_BASE}/student/appointments?email=${encodeURIComponent(
                    currentUser.email
                )}`
            );

        const appointments =
            Array.isArray(data)
                ? data
                : data.appointments || [];

        renderStudentAppointments(
            appointments
        );

    } catch (error) {

        console.error(
            "Appointment loading error:",
            error
        );
    }
}

function renderStudentAppointments(
    appointments
) {

    const container =
        document.getElementById(
            "studentAppointments"
        );

    if (!container) {
        return;
    }

    if (!appointments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No appointments yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        appointments
            .map(
                appointment => {

                    const date =
                        appointment.AppointmentDate ||
                        appointment.appointmentDate ||
                        "";

                    const time =
                        appointment.AppointmentTime ||
                        appointment.appointmentTime ||
                        "";

                    const reason =
                        appointment.Reason ||
                        appointment.reason ||
                        "General counseling";

                    const status =
                        appointment.Status ||
                        appointment.status ||
                        "Pending";

                    const counselor =
                        appointment.CounselorName ||
                        appointment.counselorName ||
                        "Guidance Counselor";

                    return `
                        <div class="appointment-item">
                            <div>
                                <strong>
                                    ${escapeHTML(
                                        counselor
                                    )}
                                </strong>

                                <div>
                                    ${escapeHTML(
                                        date
                                    )}
                                    ${
                                        time
                                            ? " • " +
                                              escapeHTML(
                                                  time
                                              )
                                            : ""
                                    }
                                </div>

                                <div>
                                    ${escapeHTML(
                                        reason
                                    )}
                                </div>
                            </div>

                            <span class="appointment-status">
                                ${escapeHTML(
                                    status
                                )}
                            </span>
                        </div>
                    `;
                }
            )
            .join("");
}

/* =========================================================
   APPOINTMENT POLLING
========================================================= */

function startAppointmentPolling() {

    stopAppointmentPolling();

    appointmentPollTimer =
        setInterval(
            () => {
                if (currentUser?.email) {
                    loadStudentAppointments();
                }
            },
            10000
        );
}

function stopAppointmentPolling() {

    if (appointmentPollTimer) {

        clearInterval(
            appointmentPollTimer
        );

        appointmentPollTimer = null;
    }
}
/* =========================================================
   CHAT
========================================================= */

function initializeChat() {

    if (closeChatButton) {

        closeChatButton.addEventListener(
            "click",
            closeChat
        );
    }

    if (sendMessageButton) {

        sendMessageButton.addEventListener(
            "click",
            sendChatMessage
        );
    }

    if (chatInput) {

        chatInput.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Enter"
                ) {

                    event.preventDefault();

                    sendChatMessage();
                }
            }
        );
    }

    if (chatModal) {

        chatModal.addEventListener(
            "click",
            function (event) {

                if (
                    event.target ===
                    chatModal
                ) {

                    closeChat();
                }
            }
        );
    }
}

function openChat() {

    if (!chatModal) {
        return;
    }

    chatModal.classList.add(
        "show"
    );

    chatModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

    ensureStudent().then(async id => {

        if (!id) {

            setChatEnabled(false);

            clearChatBody();

            showChatSystemMessage(
                "Please log in first so your counseling chat can be connected to your student account."
            );

            return;
        }

        await loadStudentChat();

        startChatPolling();

        if (
            chatInput &&
            !chatInput.disabled
        ) {

            setTimeout(() => {
                chatInput.focus();
            }, 200);
        }
    });
}

window.openChat =
    openChat;

function closeChat() {

    if (!chatModal) {
        return;
    }

    chatModal.classList.remove(
        "show"
    );

    chatModal.setAttribute(
        "aria-hidden",
        "true"
    );

    stopChatPolling();

    restoreBodyScroll();
}

window.closeChat =
    closeChat;

/* =========================================================
   CHAT HELPERS
========================================================= */

function clearChatBody() {

    if (chatBody) {
        chatBody.innerHTML = "";
    }
}

function scrollChatToBottom() {

    if (chatBody) {
        chatBody.scrollTop =
            chatBody.scrollHeight;
    }
}

function setChatEnabled(enabled) {

    if (chatInput) {

        chatInput.disabled =
            !enabled;

        chatInput.placeholder =
            enabled
                ? "Type your message..."
                : "Chat will activate after your appointment is accepted.";
    }

    if (sendMessageButton) {

        sendMessageButton.disabled =
            !enabled;
    }
}

function showChatSystemMessage(message) {

    if (!chatBody) {
        return;
    }

    const box =
        document.createElement("div");

    box.style.cssText = `
        padding:14px;
        margin:10px 0;
        border-radius:12px;
        text-align:center;
        background:rgba(0,128,96,.08);
    `;

    box.textContent =
        message;

    chatBody.appendChild(box);

    scrollChatToBottom();
}

function addStudentMessage(
    message,
    sentAt = null
) {

    if (!chatBody) {
        return;
    }

    const box =
        document.createElement("div");

    box.className =
        "student-message";

    const text =
        document.createElement("p");

    text.textContent =
        message;

    box.appendChild(text);

    if (sentAt) {

        const time =
            document.createElement("small");

        time.textContent =
            formatDateTime(sentAt);

        box.appendChild(time);
    }

    chatBody.appendChild(box);

    scrollChatToBottom();
}

function addCounselorMessage(
    message,
    counselorName = "Counselor",
    sentAt = null
) {

    if (!chatBody) {
        return;
    }

    const container =
        document.createElement("div");

    container.className =
        "welcome-message";

    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";

    avatar.textContent =
        getInitials(counselorName);

    const messageBox =
        document.createElement("div");

    messageBox.className =
        "message";

    const name =
        document.createElement("strong");

    name.textContent =
        counselorName;

    const text =
        document.createElement("p");

    text.textContent =
        message;

    messageBox.appendChild(name);
    messageBox.appendChild(text);

    if (sentAt) {

        const time =
            document.createElement("small");

        time.textContent =
            formatDateTime(sentAt);

        messageBox.appendChild(time);
    }

    container.appendChild(avatar);
    container.appendChild(messageBox);

    chatBody.appendChild(container);

    scrollChatToBottom();
}

function getInitials(name) {

    const parts =
        String(name || "Counselor")
            .trim()
            .split(/\s+/);

    if (parts.length === 1) {
        return parts[0]
            .slice(0, 2)
            .toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}

function formatDateTime(value) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleString(
        undefined,
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
}

/* =========================================================
   LOAD STUDENT CHAT
========================================================= */

async function loadStudentChat() {

    if (!currentUser?.email) {
        return;
    }

    try {

        const data =
            await api(
                `${API_BASE}/student/chat?email=${encodeURIComponent(
                    currentUser.email
                )}`
            );

        const conversation =
            data.conversation ||
            data;

        if (
            !conversation ||
            !conversation.ConversationID
        ) {

            activeConversation =
                null;

            setChatEnabled(false);

            clearChatBody();

            showChatSystemMessage(
                "No counseling conversation is available yet. Submit an appointment first."
            );

            return;
        }

        activeConversation =
            conversation;

        const status =
            String(
                conversation.Status ||
                ""
            ).toLowerCase();

        const isActive =
            status === "active";

        setChatEnabled(
            isActive
        );

        clearChatBody();

        if (!isActive) {

            showChatSystemMessage(
                "Your counseling chat will become available after your appointment is accepted by the counselor."
            );

            return;
        }

        const messages =
            Array.isArray(
                data.messages
            )
                ? data.messages
                : [];

        if (!messages.length) {

            showChatSystemMessage(
                "Your counseling chat is ready. You can send a message to your counselor."
            );

            return;
        }

        messages.forEach(message => {

            const senderType =
                String(
                    message.SenderType ||
                    ""
                ).toLowerCase();

            const text =
                message.MessageText ||
                "";

            if (
                senderType === "student"
            ) {

                addStudentMessage(
                    text,
                    message.SentAt
                );

            } else {

                addCounselorMessage(
                    text,
                    message.CounselorName ||
                    message.SenderName ||
                    "Counselor",
                    message.SentAt
                );
            }
        });

    } catch (error) {

        console.error(
            "Chat load error:",
            error
        );

        clearChatBody();

        setChatEnabled(false);

        showChatSystemMessage(
            "Unable to load your counseling chat. Please make sure the server is running."
        );
    }
}

/* =========================================================
   SEND CHAT MESSAGE
========================================================= */

async function sendChatMessage(
    messageOverride = null
) {

    const message =
        messageOverride !== null
            ? String(
                messageOverride
            ).trim()
            : String(
                chatInput?.value || ""
            ).trim();

    if (!message) {

        showToast(
            "Empty message",
            "Please type a message first.",
            "warning"
        );

        return;
    }

    if (
        !activeConversation ||
        String(
            activeConversation.Status
        ).toLowerCase() !== "active"
    ) {

        showToast(
            "Chat unavailable",
            "Your appointment must be accepted before counseling chat becomes active.",
            "warning"
        );

        return;
    }

    try {

        await api(
            `${API_BASE}/student/chat/messages`,
            {
                method: "POST",

                body: JSON.stringify({

                    email:
                        currentUser.email,

                    ConversationID:
                        activeConversation.ConversationID,

                    MessageText:
                        message
                })
            }
        );

        if (
            chatInput &&
            messageOverride === null
        ) {

            chatInput.value = "";
        }

        await loadStudentChat();

    } catch (error) {

        console.error(
            "Send chat error:",
            error
        );

        showToast(
            "Message not sent",
            error.message ||
            "Unable to send your message.",
            "error"
        );
    }
}

window.sendChatMessage =
    sendChatMessage;

function sendQuickMessage(message) {

    sendChatMessage(message);
}

window.sendQuickMessage =
    sendQuickMessage;

/* =========================================================
   CHAT POLLING
========================================================= */

function startChatPolling() {

    stopChatPolling();

    chatPollTimer =
        setInterval(
            async function () {

                if (
                    chatModal &&
                    chatModal.classList.contains(
                        "show"
                    )
                ) {

                    await loadStudentChat();
                }

            },
            3000
        );
}

function stopChatPolling() {

    if (chatPollTimer) {

        clearInterval(
            chatPollTimer
        );

        chatPollTimer = null;
    }
}

/* =========================================================
   RECORDS
========================================================= */

function openRecords() {

    if (!recordsModal) {
        return;
    }

    recordsModal.classList.add(
        "show"
    );

    recordsModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow =
        "hidden";

    loadRecords();
}

window.openRecords =
    openRecords;

function closeRecords() {

    if (!recordsModal) {
        return;
    }

    recordsModal.classList.remove(
        "show"
    );

    recordsModal.setAttribute(
        "aria-hidden",
        "true"
    );

    restoreBodyScroll();
}

window.closeRecords =
    closeRecords;

async function loadRecords() {

    if (!currentUser?.email) {
        return;
    }

    try {

        const appointments =
            await api(
                `${API_BASE}/student/appointments?email=${encodeURIComponent(
                    currentUser.email
                )}`
            );

        const moods =
            await api(
                `${API_BASE}/student/moods?email=${encodeURIComponent(
                    currentUser.email
                )}`
            );

        const feedback =
            await api(
                `${API_BASE}/student/feedback?email=${encodeURIComponent(
                    currentUser.email
                )}`
            );

        renderRecords(
            Array.isArray(appointments)
                ? appointments
                : appointments.appointments ||
                  appointments.data ||
                  [],

            Array.isArray(moods)
                ? moods
                : moods.moods ||
                  moods.data ||
                  [],

            Array.isArray(feedback)
                ? feedback
                : feedback.feedback ||
                  feedback.data ||
                  []
        );

    } catch (error) {

        console.error(
            "Records error:",
            error
        );
    }
}

function renderRecords(
    appointments,
    moods,
    feedback
) {

    if (!recordsModal) {
        return;
    }

    const tables =
        recordsModal.querySelectorAll(
            "table"
        );

    if (!tables.length) {
        return;
    }

    if (tables[0]) {

        fillTable(
            tables[0],
            appointments,
            [
                item =>
                    item.AppointmentDate ||
                    "-",

                item =>
                    item.AppointmentTime ||
                    "-",

                item =>
                    item.Status ||
                    "-"
            ]
        );
    }

    if (tables[1]) {

        fillTable(
            tables[1],
            moods,
            [
                item =>
                    item.AssessmentDate ||
                    item.RecordedDate ||
                    "-",

                item =>
                    item.MoodLevel ||
                    item.MoodStatus ||
                    "-",

                item =>
                    item.Remarks ||
                    item.Recommendation ||
                    "-"
            ]
        );
    }

    if (tables.length >= 3) {

        fillTable(
            tables[tables.length - 1],
            feedback,
            [
                item =>
                    item.Rating ??
                    "-",

                item =>
                    item.Comments ||
                    "-",

                item =>
                    item.FeedbackDate ||
                    "-"
            ]
        );
    }
}

function fillTable(
    table,
    rows,
    getters
) {

    const tbody =
        table.querySelector("tbody");

    if (!tbody) {
        return;
    }

    tbody.innerHTML = "";

    if (!rows.length) {

        const tr =
            document.createElement("tr");

        const td =
            document.createElement("td");

        td.colSpan =
            getters.length;

        td.textContent =
            "No records found.";

        td.style.textAlign =
            "center";

        tr.appendChild(td);

        tbody.appendChild(tr);

        return;
    }

    rows.forEach(row => {

        const tr =
            document.createElement("tr");

        getters.forEach(getter => {

            const td =
                document.createElement("td");

            td.textContent =
                getter(row);

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

/* =========================================================
   SCROLL TO MOOD
========================================================= */

function scrollToMood() {

    const moodCard =
        document.querySelector(
            ".visual-card"
        );

    if (moodCard) {

        moodCard.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}

window.scrollToMood =
    scrollToMood;

/* =========================================================
   KEYBOARD
========================================================= */

function initializeKeyboardControls() {

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key !== "Escape"
            ) {
                return;
            }

            if (
                recordsModal &&
                recordsModal.classList.contains(
                    "show"
                )
            ) {
                closeRecords();
            }

            if (
                chatModal &&
                chatModal.classList.contains(
                    "show"
                )
            ) {
                closeChat();
            }

            if (
                reservationModal &&
                reservationModal.classList.contains(
                    "show"
                )
            ) {
                closeReservation();
            }

            closeMobileNavigation();
        }
    );
}

/* =========================================================
   RESTORE BODY SCROLL
========================================================= */

function restoreBodyScroll() {

    const modalOpen =
        document.querySelector(
            ".modal-overlay.show"
        );

    if (!modalOpen) {

        document.body.style.overflow =
            "";
    }
}

/* =========================================================
   WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    function () {

        if (
            window.innerWidth > 700
        ) {
            closeMobileNavigation();
        }
    }
);