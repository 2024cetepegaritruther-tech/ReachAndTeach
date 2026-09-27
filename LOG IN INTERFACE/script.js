/* =========================================================
   REACH & TEACH — LOCAL LOGIN SYSTEM
   Firebase removed
   Includes password show/hide eye buttons
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    /* =========================================================
       SCREENS
    ========================================================= */

    const welcomeScreen = document.getElementById("welcomeScreen");
    const loginScreen = document.getElementById("loginScreen");
    const signupScreen = document.getElementById("signupScreen");

    /* =========================================================
       BUTTONS
    ========================================================= */

    const goLoginBtn = document.getElementById("goLoginBtn");
    const goSignupBtn = document.getElementById("goSignupBtn");
    const backToWelcomeBtn = document.getElementById("backToWelcomeBtn");
    const signupBackBtn = document.getElementById("signupBackBtn");
    const googleLoginBtn = document.getElementById("googleLoginBtn");

    /* =========================================================
       FORMS
    ========================================================= */

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    /* =========================================================
       LOCAL USERS
    ========================================================= */

    let users = [];

    try {
        users = JSON.parse(
            localStorage.getItem("reachTeachUsers")
        ) || [];
    } catch (error) {
        users = [];
    }

    if (!Array.isArray(users)) {
        users = [];
    }

    function saveUsers() {
        localStorage.setItem(
            "reachTeachUsers",
            JSON.stringify(users)
        );
    }

    /* =========================================================
       SCREEN SWITCHING
    ========================================================= */

    function showScreen(screen) {
        [welcomeScreen, loginScreen, signupScreen].forEach(function (item) {
            if (item) {
                item.classList.remove("active");
            }
        });

        if (screen) {
            screen.classList.add("active");
        }
    }

    /* =========================================================
       GENERATE USER ID
    ========================================================= */

    function generateUserId() {
        const userId =
            "USR-" +
            String(users.length + 1).padStart(3, "0");

        const input = document.getElementById("userId");

        if (input) {
            input.value = userId;
        }
    }

    /* =========================================================
       EMAIL VALIDATION
    ========================================================= */

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /* =========================================================
       PASSWORD HASH
    ========================================================= */

    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);

        const hashBuffer = await crypto.subtle.digest(
            "SHA-256",
            data
        );

        return Array.from(new Uint8Array(hashBuffer))
            .map(function (byte) {
                return byte
                    .toString(16)
                    .padStart(2, "0");
            })
            .join("");
    }

    /* =========================================================
       SYNC STUDENT WITH MYSQL
    ========================================================= */

    async function syncStudentWithMySQL(user) {
        try {
            const response = await fetch(
                "/api/student/sync",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        Email: user.email,
                        FirstName: user.firstName,
                        LastName: user.lastName,
                        ContactNumber:
                            user.contactNumber || "",
                        GradeLevel:
                            user.gradeLevel ||
                            user.department ||
                            ""
                    })
                }
            );

            let data = {};

            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }

            if (!response.ok) {
                console.error(
                    "MySQL student sync failed:",
                    data
                );

                return null;
            }

            const studentID =
                data.StudentID ||
                data.studentId ||
                data.id ||
                null;

            if (studentID) {
                user.StudentID = studentID;
                user.studentId = studentID;
            }

            console.log(
                "Student successfully connected to MySQL:",
                studentID
            );

            return studentID;

        } catch (error) {
            console.error(
                "MySQL connection error:",
                error
            );

            return null;
        }
    }

    /* =========================================================
       SAVE LOGIN SESSION
    ========================================================= */

    function saveLoginSession(user) {
        const fullName = [
            user.firstName || "",
            user.lastName || ""
        ]
            .filter(Boolean)
            .join(" ");

        const loggedInUser = {
            id: user.id || "",
            uid: user.uid || "",

            StudentID:
                user.StudentID ||
                user.studentId ||
                null,

            studentId:
                user.StudentID ||
                user.studentId ||
                null,

            email: user.email,
            username: user.username || "",

            firstName: user.firstName || "",
            lastName: user.lastName || "",

            fullName: fullName,
            displayName: fullName,

            provider: "Local"
        };

        localStorage.setItem(
            "loggedInUser",
            JSON.stringify(loggedInUser)
        );

        localStorage.setItem(
            "reachTeachCurrentUser",
            JSON.stringify(loggedInUser)
        );

        localStorage.setItem(
            "loggedInEmail",
            user.email
        );

        localStorage.setItem(
            "userEmail",
            user.email
        );

        return loggedInUser;
    }

    /* =========================================================
       OPEN STUDENT WEBSITE
    ========================================================= */

    function openStudentWebsite() {
        window.location.href =
            "../ReachAndTeach/Main System.html";
    }

    /* =========================================================
       LOGIN BUTTON
    ========================================================= */

    if (goLoginBtn) {
        goLoginBtn.addEventListener("click", function () {
            showScreen(loginScreen);

            const email =
                document.getElementById("loginEmail");

            if (email) {
                email.focus();
            }
        });
    }

    /* =========================================================
       SIGN UP BUTTON
    ========================================================= */

    if (goSignupBtn) {
        goSignupBtn.addEventListener("click", function () {
            showScreen(signupScreen);
            generateUserId();
        });
    }

    /* =========================================================
       BACK TO WELCOME
    ========================================================= */

    if (backToWelcomeBtn) {
        backToWelcomeBtn.addEventListener("click", function () {
            if (loginForm) {
                loginForm.reset();
            }

            clearLoginErrors();
            showScreen(welcomeScreen);
        });
    }

    if (signupBackBtn) {
        signupBackBtn.addEventListener("click", function () {
            if (signupForm) {
                signupForm.reset();
            }

            clearSignupErrors();
            resetAddressFields();
            showScreen(welcomeScreen);
        });
    }

    /* =========================================================
       GOOGLE LOGIN REMOVED
    ========================================================= */

    if (googleLoginBtn) {
        googleLoginBtn.style.display = "none";
    }

    const googleError =
        document.getElementById("googleError");

    if (googleError) {
        googleError.textContent = "";
    }

    /* =========================================================
       LOGIN
    ========================================================= */

    if (loginForm) {
        loginForm.addEventListener(
            "submit",
            async function (event) {
                event.preventDefault();

                const emailInput =
                    document.getElementById("loginEmail");

                const passwordInput =
                    document.getElementById("loginPassword");

                const emailError =
                    document.getElementById(
                        "loginEmailError"
                    );

                const passwordError =
                    document.getElementById(
                        "loginPasswordError"
                    );

                const message =
                    document.getElementById(
                        "loginMessage"
                    );

                clearLoginErrors();

                const email =
                    emailInput.value
                        .trim()
                        .toLowerCase();

                const password =
                    passwordInput.value;

                if (!email) {
                    if (emailError) {
                        emailError.textContent =
                            "Email is required.";
                    }

                    emailInput.classList.add("invalid");
                    return;
                }

                if (!isValidEmail(email)) {
                    if (emailError) {
                        emailError.textContent =
                            "Enter a valid email.";
                    }

                    emailInput.classList.add("invalid");
                    return;
                }

                if (!password) {
                    if (passwordError) {
                        passwordError.textContent =
                            "Password is required.";
                    }

                    passwordInput.classList.add("invalid");
                    return;
                }

                if (message) {
                    message.textContent =
                        "Signing in...";

                    message.className =
                        "form-message";
                }

                const user = users.find(function (item) {
                    return String(item.email || "")
                        .trim()
                        .toLowerCase() === email;
                });

                if (!user) {
                    if (message) {
                        message.textContent =
                            "No REACH & TEACH account was found with this email.";

                        message.className =
                            "form-message error";
                    }

                    return;
                }

                try {
                    const enteredHash =
                        await hashPassword(password);

                    if (
                        user.passwordHash !==
                        enteredHash
                    ) {
                        if (message) {
                            message.textContent =
                                "Incorrect password.";

                            message.className =
                                "form-message error";
                        }

                        return;
                    }

                    const studentID =
                        await syncStudentWithMySQL(user);

                    if (studentID) {
                        user.StudentID = studentID;
                        user.studentId = studentID;
                    }

                    saveLoginSession(user);

                    if (message) {
                        message.textContent =
                            "Login successful. Opening Reach & Teach...";

                        message.className =
                            "form-message success";
                    }

                    setTimeout(function () {
                        openStudentWebsite();
                    }, 500);

                } catch (error) {
                    console.error(
                        "Login error:",
                        error
                    );

                    if (message) {
                        message.textContent =
                            "Login failed. Please try again.";

                        message.className =
                            "form-message error";
                    }
                }
            }
        );
    }

    /* =========================================================
       FORGOT PASSWORD
    ========================================================= */

    const forgotPasswordBtn =
        document.getElementById(
            "forgotPasswordBtn"
        );

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener(
            "click",
            function () {
                const message =
                    document.getElementById(
                        "loginMessage"
                    );

                if (message) {
                    message.textContent =
                        "Password reset is handled by the system administrator.";

                    message.className =
                        "form-message error";
                }
            }
        );
    }
        /* =========================================================
       SIGN UP
    ========================================================= */

    if (signupForm) {
        signupForm.addEventListener(
            "submit",
            async function (event) {
                event.preventDefault();

                const fields = [
                    ["birthday", "Birthday"],
                    ["lastName", "Last Name"],
                    ["firstName", "First Name"],
                    ["username", "Username"],
                    ["email", "Email"],
                    ["password", "Password"],
                    ["confirmPassword", "Confirm Password"],
                    ["country", "Country"],
                    ["province", "Province"],
                    ["city", "City"],
                    ["barangay", "Barangay"],
                    ["street", "Street"],
                    ["houseNumber", "House Number"],
                    ["postalCode", "Postal Code"],
                    ["department", "Department"],
                    ["status", "Status"]
                ];

                clearSignupErrors();

                let valid = true;

                /* REQUIRED FIELDS */

                fields.forEach(function (field) {
                    const element =
                        document.getElementById(field[0]);

                    const error =
                        document.getElementById(
                            field[0] + "Error"
                        );

                    if (!element) {
                        return;
                    }

                    if (!String(element.value).trim()) {
                        if (error) {
                            error.textContent =
                                field[1] +
                                " is required.";
                        }

                        element.classList.add("invalid");
                        valid = false;
                    }
                });

                /* EMAIL */

                const email =
                    document.getElementById("email");

                if (
                    email &&
                    email.value.trim() &&
                    !isValidEmail(
                        email.value.trim()
                    )
                ) {
                    const error =
                        document.getElementById(
                            "emailError"
                        );

                    if (error) {
                        error.textContent =
                            "Enter a valid email.";
                    }

                    email.classList.add("invalid");
                    valid = false;
                }

                /* PASSWORD */

                const password =
                    document.getElementById("password");

                const confirmPassword =
                    document.getElementById(
                        "confirmPassword"
                    );

                if (
                    password &&
                    password.value &&
                    password.value.length < 8
                ) {
                    const error =
                        document.getElementById(
                            "passwordError"
                        );

                    if (error) {
                        error.textContent =
                            "Password must be at least 8 characters.";
                    }

                    password.classList.add("invalid");
                    valid = false;
                }

                /* CONFIRM PASSWORD */

                if (
                    password &&
                    confirmPassword &&
                    password.value &&
                    confirmPassword.value &&
                    password.value !==
                        confirmPassword.value
                ) {
                    const error =
                        document.getElementById(
                            "confirmPasswordError"
                        );

                    if (error) {
                        error.textContent =
                            "Passwords do not match.";
                    }

                    confirmPassword.classList.add(
                        "invalid"
                    );

                    valid = false;
                }

                /* POSTAL CODE */

                const postalCode =
                    document.getElementById(
                        "postalCode"
                    );

                if (
                    postalCode &&
                    postalCode.value &&
                    !/^\d{4}$/.test(
                        postalCode.value
                    )
                ) {
                    const error =
                        document.getElementById(
                            "postalCodeError"
                        );

                    if (error) {
                        error.textContent =
                            "Postal code must contain 4 digits.";
                    }

                    postalCode.classList.add("invalid");
                    valid = false;
                }

                if (!valid) {
                    const message =
                        document.getElementById(
                            "signupMessage"
                        );

                    if (message) {
                        message.textContent =
                            "Please correct the highlighted fields.";

                        message.className =
                            "form-message error";
                    }

                    return;
                }

                /* DUPLICATE EMAIL */

                const normalizedEmail =
                    email.value
                        .trim()
                        .toLowerCase();

                const existingUser =
                    users.find(function (user) {
                        return String(
                            user.email || ""
                        )
                            .trim()
                            .toLowerCase() ===
                            normalizedEmail;
                    });

                if (existingUser) {
                    const emailError =
                        document.getElementById(
                            "emailError"
                        );

                    if (emailError) {
                        emailError.textContent =
                            "Email is already registered.";
                    }

                    email.classList.add("invalid");

                    const message =
                        document.getElementById(
                            "signupMessage"
                        );

                    if (message) {
                        message.textContent =
                            "This email is already registered. Please use another email.";

                        message.className =
                            "form-message error";
                    }

                    return;
                }

                /* HASH PASSWORD */

                let passwordHash;

                try {
                    passwordHash =
                        await hashPassword(
                            password.value
                        );
                } catch (error) {
                    console.error(
                        "Password hashing error:",
                        error
                    );

                    const message =
                        document.getElementById(
                            "signupMessage"
                        );

                    if (message) {
                        message.textContent =
                            "Unable to create account.";

                        message.className =
                            "form-message error";
                    }

                    return;
                }

                /* CREATE USER */

                const value = function (id) {
                    const element =
                        document.getElementById(id);

                    return element
                        ? element.value
                        : "";
                };

                const newUser = {
                    id: value("userId"),

                    email: normalizedEmail,

                    username:
                        value("username").trim(),

                    firstName:
                        value("firstName").trim(),

                    lastName:
                        value("lastName").trim(),

                    birthday:
                        value("birthday"),

                    country:
                        value("country"),

                    province:
                        value("province"),

                    city:
                        value("city"),

                    barangay:
                        value("barangay"),

                    street:
                        value("street").trim(),

                    houseNumber:
                        value("houseNumber").trim(),

                    postalCode:
                        value("postalCode"),

                    department:
                        value("department"),

                    status:
                        value("status"),

                    passwordHash:
                        passwordHash,

                    provider: "Local"
                };

                /* SAVE LOCAL USER */

                users.push(newUser);
                saveUsers();

                /* CREATE MYSQL STUDENT */

                const studentID =
                    await syncStudentWithMySQL(
                        newUser
                    );

                if (studentID) {
                    newUser.StudentID =
                        studentID;

                    newUser.studentId =
                        studentID;

                    saveUsers();
                }

                /* AUTOMATIC LOGIN */

                saveLoginSession(newUser);

                const message =
                    document.getElementById(
                        "signupMessage"
                    );

                if (message) {
                    message.textContent =
                        "Account created successfully! Opening Reach & Teach...";

                    message.className =
                        "form-message success";
                }

                signupForm.reset();

                resetAddressFields();

                generateUserId();

                setTimeout(function () {
                    openStudentWebsite();
                }, 700);
            }
        );
    }

    /* =========================================================
       ADDRESS DATA
    ========================================================= */

    const country =
        document.getElementById("country");

    const province =
        document.getElementById("province");

    const city =
        document.getElementById("city");

    const barangay =
        document.getElementById("barangay");

    const locations = {
        Philippines: {
            "South Cotabato": {
                "General Santos City": [
                    "Apopong",
                    "Baluan",
                    "Bula",
                    "Calumpang",
                    "City Heights",
                    "Conel",
                    "Dadiangas East",
                    "Dadiangas North",
                    "Dadiangas South",
                    "Dadiangas West",
                    "Fatima",
                    "Katangawan",
                    "Labangal",
                    "Lagao",
                    "Mabuhay",
                    "San Isidro",
                    "San Jose",
                    "Siguel",
                    "Tambler",
                    "Tinagacan"
                ]
            },

            "Zamboanga del Sur": {
                "Pagadian City": [
                    "Balangasan",
                    "Baliangao",
                    "Banale",
                    "Bumbaran",
                    "Dao",
                    "Dumagoc",
                    "Kawit",
                    "Lala",
                    "San Francisco",
                    "San Pedro",
                    "Santiago"
                ]
            }
        }
    };
        /* =========================================================
       COUNTRY CHANGE
    ========================================================= */

    if (country) {
        country.addEventListener(
            "change",
            function () {
                province.innerHTML =
                    '<option value="">Select Province</option>';

                city.innerHTML =
                    '<option value="">Select City</option>';

                barangay.innerHTML =
                    '<option value="">Select Barangay</option>';

                province.disabled = true;
                city.disabled = true;
                barangay.disabled = true;

                if (!country.value) {
                    return;
                }

                const provinces =
                    locations[country.value];

                if (!provinces) {
                    return;
                }

                Object.keys(provinces).forEach(
                    function (item) {
                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value = item;
                        option.textContent = item;

                        province.appendChild(option);
                    }
                );

                province.disabled = false;
            }
        );
    }

    /* =========================================================
       PROVINCE CHANGE
    ========================================================= */

    if (province) {
        province.addEventListener(
            "change",
            function () {
                city.innerHTML =
                    '<option value="">Select City</option>';

                barangay.innerHTML =
                    '<option value="">Select Barangay</option>';

                city.disabled = true;
                barangay.disabled = true;

                if (!province.value) {
                    return;
                }

                const cities =
                    locations[country.value][
                        province.value
                    ];

                if (!cities) {
                    return;
                }

                Object.keys(cities).forEach(
                    function (item) {
                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value = item;
                        option.textContent = item;

                        city.appendChild(option);
                    }
                );

                city.disabled = false;
            }
        );
    }

    /* =========================================================
       CITY CHANGE
    ========================================================= */

    if (city) {
        city.addEventListener(
            "change",
            function () {
                barangay.innerHTML =
                    '<option value="">Select Barangay</option>';

                barangay.disabled = true;

                if (!city.value) {
                    return;
                }

                const barangays =
                    locations[country.value][
                        province.value
                    ][city.value];

                if (!barangays) {
                    return;
                }

                barangays.forEach(
                    function (item) {
                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value = item;
                        option.textContent = item;

                        barangay.appendChild(option);
                    }
                );

                barangay.disabled = false;
            }
        );
    }

    /* =========================================================
       POSTAL CODE
    ========================================================= */

    const postalInput =
        document.getElementById(
            "postalCode"
        );

    if (postalInput) {
        postalInput.addEventListener(
            "input",
            function () {
                this.value = this.value
                    .replace(/\D/g, "")
                    .slice(0, 4);
            }
        );
    }

    /* =========================================================
       CLEAR LOGIN ERRORS
    ========================================================= */

    function clearLoginErrors() {
        const emailError =
            document.getElementById(
                "loginEmailError"
            );

        const passwordError =
            document.getElementById(
                "loginPasswordError"
            );

        const message =
            document.getElementById(
                "loginMessage"
            );

        if (emailError) {
            emailError.textContent = "";
        }

        if (passwordError) {
            passwordError.textContent = "";
        }

        if (message) {
            message.textContent = "";
            message.className = "form-message";
        }

        const email =
            document.getElementById(
                "loginEmail"
            );

        const password =
            document.getElementById(
                "loginPassword"
            );

        if (email) {
            email.classList.remove("invalid");
        }

        if (password) {
            password.classList.remove("invalid");
        }
    }

    /* =========================================================
       CLEAR SIGN UP ERRORS
    ========================================================= */

    function clearSignupErrors() {
        document
            .querySelectorAll(
                "#signupForm .error-message"
            )
            .forEach(function (error) {
                error.textContent = "";
            });

        document
            .querySelectorAll(
                "#signupForm input, #signupForm select"
            )
            .forEach(function (field) {
                field.classList.remove("invalid");
                field.classList.remove("valid");
            });

        const message =
            document.getElementById(
                "signupMessage"
            );

        if (message) {
            message.textContent = "";
            message.className = "form-message";
        }
    }

    /* =========================================================
       RESET ADDRESS
    ========================================================= */

    function resetAddressFields() {
        if (!province || !city || !barangay) {
            return;
        }

        province.innerHTML =
            '<option value="">Select Province</option>';

        city.innerHTML =
            '<option value="">Select City</option>';

        barangay.innerHTML =
            '<option value="">Select Barangay</option>';

        province.disabled = true;
        city.disabled = true;
        barangay.disabled = true;
    }

    /* =========================================================
       PASSWORD SHOW / HIDE EYE
       LOGIN + SIGN UP + CONFIRM PASSWORD
    ========================================================= */

    function addPasswordToggle(inputId) {
        const input =
            document.getElementById(inputId);

        if (!input) {
            return;
        }

        const parent =
            input.parentElement;

        if (!parent) {
            return;
        }

        if (
            parent.querySelector(
                ".password-toggle"
            )
        ) {
            return;
        }

        parent.style.position = "relative";

        input.style.paddingRight = "48px";

        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "password-toggle";

        button.setAttribute(
            "aria-label",
            "Show password"
        );

        button.setAttribute(
            "title",
            "Show password"
        );

        button.innerHTML = `
            <svg
                class="password-eye-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">

                <path
                    d="M2 12s3.5-7 10-7
                    10 7 10 7
                    -3.5 7-10 7
                    -10-7-10-7z">
                </path>

                <circle
                    cx="12"
                    cy="12"
                    r="3">
                </circle>

            </svg>
        `;

        button.addEventListener(
            "click",
            function () {
                if (
                    input.type === "password"
                ) {
                    input.type = "text";

                    button.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                    button.setAttribute(
                        "title",
                        "Hide password"
                    );

                    button.classList.add(
                        "password-visible"
                    );

                } else {
                    input.type = "password";

                    button.setAttribute(
                        "aria-label",
                        "Show password"
                    );

                    button.setAttribute(
                        "title",
                        "Show password"
                    );

                    button.classList.remove(
                        "password-visible"
                    );
                }
            }
        );

        parent.appendChild(button);
    }

    /* LOGIN PASSWORD */
    addPasswordToggle("loginPassword");

    /* SIGN UP PASSWORD */
    addPasswordToggle("password");

    /* CONFIRM PASSWORD */
    addPasswordToggle("confirmPassword");

    /* =========================================================
       PASSWORD EYE CSS
    ========================================================= */

    const passwordEyeStyle =
        document.createElement("style");

    passwordEyeStyle.textContent = `
        .password-toggle {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);

            width: 36px;
            height: 36px;

            padding: 0;
            margin: 0;

            border: none;
            background: transparent;

            color: #777;

            display: flex;
            align-items: center;
            justify-content: center;

            cursor: pointer;

            border-radius: 50%;

            z-index: 10;

            transition:
                color 0.2s ease,
                background 0.2s ease,
                transform 0.2s ease;
        }

        .password-toggle:hover {
            color: #2e8b57;
            background: rgba(46, 139, 87, 0.08);
        }

        .password-toggle:active {
            transform:
                translateY(-50%)
                scale(0.92);
        }

        .password-toggle.password-visible {
            color: #2e8b57;
        }

        .password-eye-icon {
            width: 21px;
            height: 21px;
            pointer-events: none;
        }

        .login-field,
        .form-group {
            position: relative;
        }
    `;

    document.head.appendChild(
        passwordEyeStyle
    );

    /* =========================================================
       INITIALIZE
    ========================================================= */

    generateUserId();

    console.log(
        "REACH & TEACH local login system loaded."
    );
});
