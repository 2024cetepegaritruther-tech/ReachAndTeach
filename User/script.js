
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
let chatPollInFlight = false;
let appointmentPollInFlight = false;
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

const feedbackModal =
    document.getElementById("feedbackModal");
const feedbackForm =
    document.getElementById("feedbackForm");
const feedbackRating =
    document.getElementById("feedbackRating");
const feedbackComments =
    document.getElementById("feedbackComments");
const feedbackMessage =
    document.getElementById("feedbackMessage");
const submitFeedbackButton =
    document.getElementById("submitFeedbackButton");

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

document.addEventListener("DOMContentLoaded", function () {

    document.body.classList.add("auth-locked");

    initializeAuthScreens();
    initializeLogout();
    initializeTheme();
    initializeNavigation();
    initializeMoodSystem();
    initializeReservation();
    initializeChat();
    initializeFeedback();
    initializeKeyboardControls();

    setMinimumReservationDate();
    setMaximumBirthdayDate();

    currentUser = null;
    restoreServerSession();
});

/* =========================================================
   AUTHENTICATION SCREENS — UI ONLY
   These forms do not authenticate users or create accounts.
========================================================= */

function initializeAuthScreens() {

    const goLoginButton = document.getElementById("goLoginBtn");
    const goSignupButton = document.getElementById("goSignupBtn");
    const backToWelcomeButton = document.getElementById("backToWelcomeBtn");
    const signupBackButton = document.getElementById("signupBackBtn");
    const goSignupFromLoginButton = document.getElementById("goSignupFromLogin");
    const signupBackToLoginButton = document.getElementById("signupBackToLoginBtn");
    const loginPasswordInput = document.getElementById("loginPassword");
    const loginPasswordToggle = document.getElementById("loginPasswordToggle");

    loginPasswordToggle?.addEventListener("click", function () {
        const showing = loginPasswordInput?.type === "text";
        if (loginPasswordInput) {
            loginPasswordInput.type = showing ? "password" : "text";
        }
        this.textContent = showing ? "👁" : "🙈";
        this.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        this.setAttribute("aria-pressed", showing ? "false" : "true");
    });

    goLoginButton?.addEventListener("click", () =>
        showAuthScreen("loginScreen", "#loginEmail")
    );

    goSignupButton?.addEventListener("click", () =>
        showAuthScreen("signupScreen", "#firstName")
    );

    backToWelcomeButton?.addEventListener("click", () =>
        showAuthScreen("welcomeScreen", "#goLoginBtn")
    );

    signupBackButton?.addEventListener("click", () =>
        showAuthScreen("welcomeScreen", "#goSignupBtn")
    );

    goSignupFromLoginButton?.addEventListener("click", () =>
        showAuthScreen("signupScreen", "#firstName")
    );

    signupBackToLoginButton?.addEventListener("click", () =>
        showAuthScreen("loginScreen", "#loginEmail")
    );

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    loginForm?.addEventListener("submit", handleLoginSubmit);
    signupForm?.addEventListener("submit", handleSignupSubmit);

    loginForm?.addEventListener("reset", () => {
        window.setTimeout(() => {
            clearAuthFormErrors(loginForm);
            setAuthMessage("loginMessage", "", "");
        }, 0);
    });

    signupForm?.addEventListener("reset", () => {
        window.setTimeout(() => {
            clearAuthFormErrors(signupForm);
            setAuthMessage("signupMessage", "", "");
        }, 0);
    });

    document.getElementById("forgotPasswordBtn")?.addEventListener("click", () => {
        setAuthMessage(
            "loginMessage",
            "Password reset is not connected yet. No email was sent; please contact the school administrator.",
            "info"
        );
    });

    document.getElementById("googleLoginBtn")?.addEventListener("click", () => {
        setAuthMessage(
            "loginMessage",
            "Google sign-in is not configured. No account was authenticated.",
            "info"
        );
    });
}

async function restoreServerSession() {
    const token = localStorage.getItem("rtAuthToken");
    if (!token) { lockStudentApp(); return; }
    try {
        const data = await api(`${API_BASE}/auth/me`);
        saveAuthenticatedUser({ token, user: data.user });
        unlockStudentApp();
        await syncStudent();
        await loadStudentAppointments();
        startAppointmentPolling();
        await loadStudentChat();
    } catch (error) {
        console.warn("Session restore failed:", error.message);
        localStorage.removeItem("rtAuthToken");
        localStorage.removeItem("loggedInUser");
        localStorage.removeItem("reachTeachCurrentUser");
        localStorage.removeItem("loggedInEmail");
        localStorage.removeItem("userEmail");
        currentUser = null;
        lockStudentApp();
    }
}

function showAuthScreen(screenId, focusSelector = null) {

    document.querySelectorAll(".auth-screen").forEach(screen => {
        const active = screen.id === screenId;
        screen.hidden = !active;
        screen.classList.toggle("is-active", active);
    });

    const target = focusSelector
        ? document.querySelector(focusSelector)
        : null;

    window.requestAnimationFrame(() => {
        target?.focus();
    });
}

function setMaximumBirthdayDate() {

    const birthday = document.getElementById("birthday");

    if (!birthday) {
        return;
    }

    const today = new Date();
    birthday.max = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
}

function setAuthFieldError(inputId, message) {

    const input = document.getElementById(inputId);
    const wrapper = input?.closest(".auth-field");
    const error = wrapper?.querySelector(".auth-field-error");

    if (wrapper) {
        wrapper.classList.toggle("has-error", Boolean(message));
    }

    if (input) {
        if (message) {
            input.setAttribute("aria-invalid", "true");
        } else {
            input.removeAttribute("aria-invalid");
        }
    }

    if (error) {
        error.textContent = message || "";
    }
}

function clearAuthFormErrors(form) {

    if (!form) {
        return;
    }

    form.querySelectorAll(".auth-field").forEach(field => {
        field.classList.remove("has-error");
        field.querySelectorAll(".auth-field-error").forEach(error => {
            error.textContent = "";
        });
        field.querySelectorAll("[aria-invalid]").forEach(input => {
            input.removeAttribute("aria-invalid");
        });
    });
}

function setAuthMessage(elementId, message, type = "info") {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.classList.toggle("is-visible", Boolean(message));
    element.classList.toggle("is-error", type === "error" && Boolean(message));
    element.classList.toggle("is-info", type === "info" && Boolean(message));
}

function isValidEmail(value) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearAuthFormErrors(form);
    setAuthMessage("loginMessage", "", "");
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    let firstInvalid = null;
    if (!email) { setAuthFieldError("loginEmail", "Enter your email address."); firstInvalid ||= emailInput; }
    else if (!isValidEmail(email)) { setAuthFieldError("loginEmail", "Enter a valid email address."); firstInvalid ||= emailInput; }
    if (!password) { setAuthFieldError("loginPassword", "Enter your password."); firstInvalid ||= passwordInput; }
    if (firstInvalid) { firstInvalid.focus(); return; }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
        const data = await api(`${API_BASE}/auth/login`, {
            method: "POST",
            body: JSON.stringify({ email, password })
        });
        saveAuthenticatedUser(data);
        passwordInput.value = "";
        unlockStudentApp();
        showToast("Welcome!", `Welcome back, ${data.user.fullName || data.user.firstName || "Student"}.`, "success");
        await syncStudent();
        await loadStudentAppointments();
        startAppointmentPolling();
        await loadStudentChat();
    } catch (error) {
        setAuthMessage("loginMessage", error.message || "Login failed.", "error");
    } finally { if (button) button.disabled = false; }
}

async function handleSignupSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    clearAuthFormErrors(form);
    setAuthMessage("signupMessage", "", "");
    const requiredFields = [
        ["birthday", "Select your birthday."], ["lastName", "Enter your last name."],
        ["firstName", "Enter your first name."], ["username", "Enter a username."],
        ["email", "Enter your email address."], ["password", "Create a password."],
        ["confirmPassword", "Confirm your password."], ["country", "Select your country."],
        ["province", "Enter your province."], ["city", "Enter your city or municipality."],
        ["barangay", "Enter your barangay."], ["street", "Enter your street."],
        ["houseNumber", "Enter your house number."], ["postalCode", "Enter a four-digit postal code."]
    ];
    let firstInvalid = null, hasError = false;
    for (const [id, message] of requiredFields) {
        const input = document.getElementById(id); const value = String(input?.value || "").trim();
        if (!value) { setAuthFieldError(id, message); firstInvalid ||= input; hasError = true; }
    }
    const email = document.getElementById("email"), username = document.getElementById("username"),
        password = document.getElementById("password"), confirmPassword = document.getElementById("confirmPassword"),
        postalCode = document.getElementById("postalCode"), birthday = document.getElementById("birthday");
    if (email.value.trim() && !isValidEmail(email.value)) { setAuthFieldError("email", "Enter a valid email address."); firstInvalid ||= email; hasError = true; }
    if (username.value.trim() && username.value.trim().length < 3) { setAuthFieldError("username", "Use at least 3 characters for your username."); firstInvalid ||= username; hasError = true; }
    if (password.value && password.value.length < 8) { setAuthFieldError("password", "Use at least 8 characters."); firstInvalid ||= password; hasError = true; }
    if (confirmPassword.value && password.value !== confirmPassword.value) { setAuthFieldError("confirmPassword", "The passwords do not match."); firstInvalid ||= confirmPassword; hasError = true; }
    if (postalCode.value.trim() && !/^\d{4}$/.test(postalCode.value.trim())) { setAuthFieldError("postalCode", "Enter a four-digit postal code."); firstInvalid ||= postalCode; hasError = true; }
    if (birthday.value && birthday.value > birthday.max) { setAuthFieldError("birthday", "Birthday cannot be in the future."); firstInvalid ||= birthday; hasError = true; }
    if (hasError) { setAuthMessage("signupMessage", "Please correct the highlighted fields.", "error"); firstInvalid?.focus(); return; }

    const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
    const payload = {};
    for (const id of ["birthday","lastName","firstName","username","email","password","country","province","city","barangay","street","houseNumber","postalCode","department","status"]) {
        const el = document.getElementById(id); payload[id] = el?.value?.trim?.() || el?.value || "";
    }
    try {
        const data = await api(`${API_BASE}/auth/register`, { method: "POST", body: JSON.stringify(payload) });
        saveAuthenticatedUser(data);
        password.value = ""; confirmPassword.value = "";
        unlockStudentApp();
        showToast("Account created", `Welcome, ${data.user.fullName || "Student"}!`, "success");
        await syncStudent();
        await loadStudentAppointments();
        startAppointmentPolling();
        await loadStudentChat();
    } catch (error) {
        setAuthMessage("signupMessage", error.message || "Account creation failed.", "error");
    } finally { if (button) button.disabled = false; }
}

function initializeLogout() {

    const logoutButton =
        document.getElementById("logoutButton");

    logoutButton?.addEventListener("click", logoutStudent);
}

function logoutStudent() {

    stopAppointmentPolling();
    stopChatPolling();

    localStorage.removeItem("rtAuthToken");
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("reachTeachCurrentUser");
    localStorage.removeItem("loggedInEmail");
    localStorage.removeItem("userEmail");

    currentUser = null;
    studentId = null;
    activeConversation = null;

    lockStudentApp();
    showAuthScreen("welcomeScreen", "#goLoginBtn");

    const loginForm =
        document.getElementById("loginForm");
    const signupForm =
        document.getElementById("signupForm");

    loginForm?.reset();
    signupForm?.reset();

    if (loginForm) {
        clearAuthFormErrors(loginForm);
    }

    if (signupForm) {
        clearAuthFormErrors(signupForm);
    }

    setAuthMessage("loginMessage", "", "");
    setAuthMessage("signupMessage", "", "");

    if (chatBody) {
        chatBody.innerHTML = "";
    }

    if (chatInput) {
        chatInput.value = "";
    }

    showToast(
        "Logged out",
        "You have been logged out successfully.",
        "success"
    );
}

function saveAuthenticatedUser(data) {
    const user = normalizeUser(data.user || {});
    localStorage.setItem("rtAuthToken", data.token || "");
    localStorage.setItem("loggedInUser", JSON.stringify(user));
    localStorage.setItem("reachTeachCurrentUser", JSON.stringify(user));
    localStorage.setItem("loggedInEmail", user.email || "");
    localStorage.setItem("userEmail", user.email || "");
    currentUser = user;
    studentId = user.StudentID || user.studentId || null;
}

function unlockStudentApp() {
    const authShell = document.getElementById("authShell");
    const appContent = document.getElementById("appContent");
    if (authShell) { authShell.hidden = true; authShell.setAttribute("aria-hidden", "true"); }
    if (appContent) { appContent.hidden = false; appContent.inert = false; appContent.setAttribute("aria-hidden", "false"); }
    document.body.classList.remove("auth-locked");
}

function lockStudentApp() {
    const authShell = document.getElementById("authShell");
    const appContent = document.getElementById("appContent");
    if (authShell) { authShell.hidden = false; authShell.setAttribute("aria-hidden", "false"); }
    if (appContent) { appContent.hidden = true; appContent.inert = true; appContent.setAttribute("aria-hidden", "true"); }
    document.body.classList.add("auth-locked");
}

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

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(localStorage.getItem("rtAuthToken")
                    ? { Authorization: `Bearer ${localStorage.getItem("rtAuthToken")}` }
                    : {}),
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
    } catch (error) {
        if (error?.name === "AbortError") {
            throw new Error("The server took too long to respond. Please make sure Reach & Teach server is running.");
        }
        throw error;
    } finally {
        window.clearTimeout(timeout);
    }
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

    let saved = null;

    try {
        saved = localStorage.getItem("reachTeachTheme");
    } catch {
        /* Storage can be unavailable in privacy-restricted contexts. */
    }

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

            try {
                localStorage.setItem(
                    "reachTeachTheme",
                    dark ? "dark" : "light"
                );
            } catch {
                /* Theme still changes for this page view without storage. */
            }

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

    reservationModal.classList.add("show");
    reservationModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    updateAppointmentPreview();

    // Never block the modal while the server is loading data.
    Promise.resolve(loadStudentAppointments()).catch(error => {
        console.error("Appointment loading error:", error);
    });
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

function getAppointmentNotificationKey(appointmentID, status) {
    return `rtAppointmentNotice:${appointmentID}:${String(status || "").toLowerCase()}`;
}

function hasAppointmentNotificationBeenShown(appointmentID, status) {
    if (!appointmentID || !status) {
        return false;
    }

    try {
        return localStorage.getItem(
            getAppointmentNotificationKey(
                appointmentID,
                status
            )
        ) === "1";
    } catch {
        return false;
    }
}

function markAppointmentNotificationShown(appointmentID, status) {
    if (!appointmentID || !status) {
        return;
    }

    try {
        localStorage.setItem(
            getAppointmentNotificationKey(
                appointmentID,
                status
            ),
            "1"
        );
    } catch {
        // Notifications should never prevent appointments from loading.
    }
}

function checkAppointmentStatusNotifications(appointments) {
    if (!Array.isArray(appointments)) {
        return;
    }

    appointments.forEach(appointment => {
        const appointmentID =
            appointment.AppointmentID ||
            appointment.appointmentID ||
            appointment.id;

        const status = String(
            appointment.Status ||
            appointment.status ||
            ""
        ).trim().toLowerCase();

        if (!appointmentID) {
            return;
        }

        if (
            status === "confirmed" ||
            status === "accepted"
        ) {
            if (
                !hasAppointmentNotificationBeenShown(
                    appointmentID,
                    "accepted"
                )
            ) {
                showToast(
                    "Appointment Accepted",
                    "Your Appointment Has Been Accepted",
                    "success"
                );

                markAppointmentNotificationShown(
                    appointmentID,
                    "accepted"
                );
            }

            return;
        }

        if (
            status === "cancelled" ||
            status === "declined"
        ) {
            if (
                !hasAppointmentNotificationBeenShown(
                    appointmentID,
                    "declined"
                )
            ) {
                showToast(
                    "Appointment Declined",
                    "Your Appointment Has Been Declined",
                    "warning"
                );

                markAppointmentNotificationShown(
                    appointmentID,
                    "declined"
                );
            }
        }
    });
}

async function loadStudentAppointments() {

    if (!currentUser?.email || appointmentPollInFlight) {
        return;
    }

    appointmentPollInFlight = true;

    try {
        const data = await api(
            `${API_BASE}/student/appointments?email=${encodeURIComponent(
                currentUser.email
            )}`
        );

        const appointments = Array.isArray(data)
            ? data
            : data.appointments || [];

        // Notify the student when Admin changes the appointment status.
        // This runs on the existing 10-second appointment polling and does
        // not block or delay the appointment UI.
        checkAppointmentStatusNotifications(
            appointments
        );

        // A declined/cancelled appointment should no longer appear
        // in the student's appointment list.
        const visibleAppointments =
            appointments.filter(appointment => {
                const status = String(
                    appointment.Status ||
                    appointment.status ||
                    ""
                ).trim().toLowerCase();

                return (
                    status !== "cancelled" &&
                    status !== "declined"
                );
            });

        renderStudentAppointments(
            visibleAppointments
        );
    } catch (error) {
        console.error("Appointment loading error:", error);
    } finally {
        appointmentPollInFlight = false;
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

    appointmentPollTimer = setInterval(() => {
        if (currentUser?.email) {
            loadStudentAppointments();
        }
    }, 10000);
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

    // Show the modal immediately. Network requests must never prevent the UI from opening.
    chatModal.classList.add("show");
    chatModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    Promise.resolve(ensureStudent())
        .then(async id => {
            if (!id) {
                setChatEnabled(false);
                clearChatBody();
                showChatSystemMessage(
                    "Please log in first so your counseling chat can be connected to your student account."
                );
                return;
            }

            try {
                await loadStudentChat();
                startChatPolling();
            } catch (error) {
                console.error("Chat loading error:", error);
                showChatSystemMessage(
                    "The counseling chat could not connect to the server right now. Please try again."
                );
            }

            if (chatInput && !chatInput.disabled) {
                window.setTimeout(() => chatInput.focus(), 200);
            }
        })
        .catch(error => {
            console.error("Opening chat error:", error);
            setChatEnabled(false);
            showChatSystemMessage(
                "The counseling chat could not connect to the server right now. Please try again."
            );
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

    chatPollTimer = setInterval(async function () {
        if (
            chatModal &&
            chatModal.classList.contains("show") &&
            !chatPollInFlight
        ) {
            chatPollInFlight = true;
            try {
                await loadStudentChat();
            } catch (error) {
                console.error("Chat polling error:", error);
            } finally {
                chatPollInFlight = false;
            }
        }
    }, 3000);
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
   STUDENT FEEDBACK
========================================================= */
function initializeFeedback() {
    feedbackForm?.addEventListener("submit", submitFeedback);

    document.querySelectorAll(".feedback-star").forEach(star => {
        star.addEventListener("click", () => {
            const rating = Number(star.dataset.rating || 0);
            if (feedbackRating) {
                feedbackRating.value = String(rating);
            }
            updateFeedbackStars(rating);
            setFeedbackMessage(`${rating} out of 5 stars selected.`, "");
        });
    });
}
async function openFeedback() {
    if (!feedbackModal) return;
    feedbackModal.classList.add("show");
    feedbackModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    resetFeedbackForm();
    if (!currentUser?.email) {
        setFeedbackMessage("Please log in before submitting feedback.", "error");
    }
}
window.openFeedback = openFeedback;
function closeFeedback() {
    if (!feedbackModal) return;
    feedbackModal.classList.remove("show");
    feedbackModal.setAttribute("aria-hidden", "true");
    restoreBodyScroll();
}
window.closeFeedback = closeFeedback;
function resetFeedbackForm() {
    feedbackForm?.reset();
    if (feedbackRating) feedbackRating.value = "";
    updateFeedbackStars(0);
    setFeedbackMessage("", "");
    if (submitFeedbackButton) { submitFeedbackButton.disabled = false; submitFeedbackButton.textContent = "Submit Feedback"; }
}
function updateFeedbackStars(rating) {
    document.querySelectorAll(".feedback-star").forEach(star => {
        const value = Number(star.dataset.rating || 0);
        const active = value <= Number(rating || 0);
        star.classList.toggle("selected", active);
        star.setAttribute("aria-pressed", active ? "true" : "false");
    });
}
function setFeedbackMessage(message, type = "") { if (!feedbackMessage) return; feedbackMessage.textContent = message || ""; feedbackMessage.className = `feedback-message ${type}`.trim(); }
async function submitFeedback(event) {
    event.preventDefault();
    const rating=feedbackRating?.value||"", comments=String(feedbackComments?.value||"").trim();
    if(!rating){setFeedbackMessage("Please select a rating from 1 to 5 stars.","error");return;}
    if(!comments){setFeedbackMessage("Please write your feedback.","error");feedbackComments?.focus();return;}
    if(!currentUser?.email){setFeedbackMessage("Please log in before submitting feedback.","error");return;}
    if(submitFeedbackButton){submitFeedbackButton.disabled=true;submitFeedbackButton.textContent="Submitting...";}
    try {
        await api(`${API_BASE}/student/feedback`,{method:"POST",body:JSON.stringify({Rating:Number(rating),Comments:comments})});
        setFeedbackMessage("Thank you. Your feedback was submitted successfully.","success");
        showToast("Feedback submitted","Thank you for sharing your counseling experience.","success");
        await loadRecords();
        window.setTimeout(closeFeedback,900);
    } catch(error) {
        console.error("Feedback submit error:",error); setFeedbackMessage(error.message||"Unable to submit feedback.","error");
        if(submitFeedbackButton){submitFeedbackButton.disabled=false;submitFeedbackButton.textContent="Submit Feedback";}
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