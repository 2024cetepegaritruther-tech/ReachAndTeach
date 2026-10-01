/* =========================================================
   REACH & TEACH — ADMIN FRONTEND ONLY
   No Server
   No API
   No Database
========================================================= */


/* =========================================================
   LOGIN ELEMENTS
========================================================= */

const adminLoginView = document.getElementById("adminLoginView");
const adminApp = document.getElementById("adminApp");

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");


/* =========================================================
   SAMPLE DATA
========================================================= */

const dataStore = {
    students: [],
    appointments: [],
    sessions: [],
    counselors: [],
    moods: [],
    mood_records: [],
    feedback: [],
    resources: []
};


/* =========================================================
   LOGIN
========================================================= */

function showLogin() {
    adminLoginView.style.display = "flex";
    adminApp.classList.add("admin-app-hidden");
}

function showDashboard() {
    adminLoginView.style.display = "none";
    adminApp.classList.remove("admin-app-hidden");
}

passwordToggle?.addEventListener("click", () => {
    const visible = passwordInput.type === "text";

    passwordInput.type = visible ? "password" : "text";
    passwordToggle.textContent = visible ? "👁" : "🙈";
    passwordToggle.setAttribute(
        "aria-label",
        visible ? "Show password" : "Hide password"
    );
});

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    loginMessage.textContent = "";
    loginMessage.className = "login-message";

    if (!email) {
        loginMessage.textContent = "Please enter your email address.";
        loginMessage.classList.add("error");
        emailInput.focus();
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        loginMessage.textContent = "Please enter a valid email address.";
        loginMessage.classList.add("error");
        emailInput.focus();
        return;
    }

    if (!password || !password.trim()) {
        loginMessage.textContent = "Please enter your password.";
        loginMessage.classList.add("error");
        passwordInput.focus();
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "LOGGING IN...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || "Invalid email or password."
            );
        }

        const user = data.user || {};
        const role = String(user.role || user.Role || "").toLowerCase();

        if (role !== "admin") {
            throw new Error("This account does not have Admin access.");
        }

        const admin = {
            ...user,
            UserID: user.UserID || user.userID || user.userId,
            AdminID: user.AdminID || user.adminID || user.adminId,
            Email: user.Email || user.email || email,
            Username: user.Username || user.username || "admin",
            FullName: user.FullName || user.fullName || "REACH & TEACH Admin",
            Role: user.Role || user.role || "Admin"
        };

        sessionStorage.setItem("admin", JSON.stringify(admin));
        sessionStorage.setItem("adminToken", data.token || "");

        loginMessage.textContent = "Login successful!";
        loginMessage.classList.add("success");

        passwordInput.value = "";

        setTimeout(() => {
            showDashboard();
            initializeAdminDashboard();
        }, 300);

    } catch (error) {
        console.error("Admin login error:", error);

        loginMessage.textContent =
            error.message || "Unable to connect to the server.";

        loginMessage.classList.add("error");

    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Continue";
    }
});

/* =========================================================
   ELEMENTS
========================================================= */

const navItems =
    document.querySelectorAll(".nav-item");

const quickActions =
    document.querySelectorAll(".quick-action");

const dashboardPage =
    document.getElementById("dashboardPage");

const dataPage =
    document.getElementById("dataPage");

const pageTitle =
    document.getElementById("pageTitle");

const pageSubtitle =
    document.getElementById("pageSubtitle");

const dataTitle =
    document.getElementById("dataTitle");

const dataDescription =
    document.getElementById("dataDescription");

const adminName =
    document.getElementById("adminName");

const adminRole =
    document.getElementById("adminRole");

const studentCount =
    document.getElementById("studentCount");

const appointmentCount =
    document.getElementById("appointmentCount");

const sessionCount =
    document.getElementById("sessionCount");

const moodCount =
    document.getElementById("moodCount");

const refreshButton =
    document.getElementById("refreshButton");

const searchInput =
    document.getElementById("searchInput");

const tableHead =
    document.getElementById("tableHead");

const tableBody =
    document.getElementById("tableBody");

const emptyState =
    document.getElementById("emptyState");

const recordModal =
    document.getElementById("recordModal");

const closeModal =
    document.getElementById("closeModal");

const cancelButton =
    document.getElementById("cancelButton");

const recordForm =
    document.getElementById("recordForm");

const formFields =
    document.getElementById("formFields");

const modalTitle =
    document.getElementById("modalTitle");

const toast =
    document.getElementById("toast");

const logoutButton =
    document.getElementById("logoutButton");


/* =========================================================
   PAGE CONFIGURATION
========================================================= */

const pageConfig = {

    students: {
        title: "Students",
        description:
            "Manage student information and records."
    },

    appointments: {
        title: "Appointments",
        description:
            "Manage student counseling appointments."
    },

    moods: {
        title: "Mood Monitoring",
        description:
            "Monitor student mood assessments."
    },

    sessions: {
        title: "Counseling Sessions",
        description:
            "Manage counseling sessions."
    },

    counselors: {
        title: "Counselors",
        description:
            "Manage guidance counselors."
    },

    resources: {
        title: "Wellness Resources",
        description:
            "Manage student wellness resources."
    },

    feedback: {
        title: "Feedback",
        description:
            "Manage counseling feedback."
    },

    mood_records: {
        title: "Mood Records",
        description:
            "Manage recorded mood information."
    }

};


/* =========================================================
   TABLE COLUMNS
========================================================= */

const columns = {

    students: [
        ["StudentID", "ID"],
        ["FirstName", "First Name"],
        ["LastName", "Last Name"],
        ["Email", "Email"],
        ["ContactNumber", "Contact"],
        ["GradeLevel", "Grade Level"]
    ],

    appointments: [
        ["AppointmentID", "ID"],
        ["StudentName", "Student"],
        ["CounselorName", "Counselor"],
        ["AppointmentDate", "Date"],
        ["AppointmentTime", "Time"],
        ["Reason", "Reason"],
        ["Status", "Status"]
    ],

    sessions: [
        ["SessionID", "ID"],
        ["StudentName", "Student"],
        ["SessionDate", "Date"],
        ["SessionTime", "Time"],
        ["SessionType", "Type"],
        ["SessionStatus", "Status"],
        ["Notes", "Notes"]
    ],

    counselors: [
        ["CounselorID", "ID"],
        ["CounselorName", "Name"],
        ["Email", "Email"],
        ["ContactNumber", "Contact"]
    ],

    moods: [
        ["AssessmentID", "ID"],
        ["SessionID", "Session"],
        ["AssessmentDate", "Date"],
        ["MoodScore", "Score"],
        ["MoodLevel", "Mood"],
        ["Remarks", "Remarks"]
    ],

    mood_records: [
        ["MoodRecordID", "ID"],
        ["AssessmentID", "Assessment"],
        ["RecordedDate", "Date"],
        ["MoodStatus", "Mood Status"],
        ["Recommendation", "Recommendation"]
    ],

    feedback: [
        ["FeedbackID", "ID"],
        ["SessionID", "Session"],
        ["CounselorID", "Counselor"],
        ["Rating", "Rating"],
        ["Comments", "Comments"],
        ["FeedbackDate", "Date"]
    ],

    resources: [
        ["ResourceID", "ID"],
        ["ResourceTitle", "Title"],
        ["ResourceType", "Type"],
        ["Description", "Description"],
        ["ResourceDate", "Date"]
    ]

};


/* =========================================================
   STATE
========================================================= */

let currentPage =
    "dashboard";

let currentDataType =
    null;

let currentRecords =
    [];

let editingId =
    null;


/* =========================================================
   DATABASE API
========================================================= */

async function adminAPI(endpoint, options = {}) {

    const token =
        sessionStorage.getItem("adminToken") || "";

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response =
        await fetch(
            endpoint,
            {
                ...options,
                headers
            }
        );

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}


function normalizeRecords(type, records) {

    if (!Array.isArray(records)) {
        return [];
    }

    return records.map(record => ({
        ...record
    }));

}


/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

function initializeAdminDashboard() {

    const admin =
        JSON.parse(
            sessionStorage.getItem("admin")
        );


    if (admin) {

        const name =
            admin.FullName ||
            admin.Username ||
            admin.Email ||
            "Admin";


        adminName.textContent =
            name;

        adminRole.textContent =
            admin.Role ||
            "Administrator";


        const avatar =
            document.querySelector(
                ".admin-avatar"
            );


        if (avatar) {

            avatar.textContent =
                name
                    .trim()
                    .charAt(0)
                    .toUpperCase();

        }

    }


    loadDashboardStats();

}


/* =========================================================
   DASHBOARD STATISTICS
========================================================= */

async function loadDashboardStats() {

    try {

        const response =
            await adminAPI(
                "/api/dashboard/stats"
            );

        const stats =
            response.stats || {};

        studentCount.textContent =
            Number(stats.students || 0);

        appointmentCount.textContent =
            Number(stats.appointments || 0);

        sessionCount.textContent =
            Number(stats.sessions || 0);

        moodCount.textContent =
            Number(stats.moodAssessments || 0);

    } catch (error) {

        console.error(
            "Dashboard stats error:",
            error
        );

        studentCount.textContent = "0";
        appointmentCount.textContent = "0";
        sessionCount.textContent = "0";
        moodCount.textContent = "0";

    }

}


/* =========================================================
   NAVIGATION
========================================================= */

function openPage(page) {

    currentPage =
        page;


    navItems.forEach(item => {

        item.classList.toggle(
            "active",
            item.dataset.page === page
        );

    });


    if (page === "dashboard") {

        dashboardPage.classList.add(
            "active"
        );

        dataPage.classList.remove(
            "active"
        );

        pageTitle.textContent =
            "Dashboard";

        pageSubtitle.textContent =
            "Welcome to the REACH & TEACH administration portal.";

        loadDashboardStats();

        return;

    }


    dashboardPage.classList.remove(
        "active"
    );

    dataPage.classList.add(
        "active"
    );


    currentDataType =
        page;


    const config =
        pageConfig[page];


    dataTitle.textContent =
        config.title;

    dataDescription.textContent =
        config.description;

    pageTitle.textContent =
        config.title;

    pageSubtitle.textContent =
        config.description;


    searchInput.value = "";

    loadData(page);

}


navItems.forEach(item => {

    item.addEventListener(
        "click",
        () => {

            openPage(
                item.dataset.page
            );

        }
    );

});


quickActions.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            openPage(
                button.dataset.page
            );

        }
    );

});


/* =========================================================
   LOAD FRONTEND DATA
========================================================= */

async function loadData(type) {

    tableBody.innerHTML = "";
    tableHead.innerHTML = "";
    emptyState.style.display = "none";

    currentRecords = [];

    const endpoints = {
        students: "/api/admin/students",
        appointments: "/api/admin/appointments",
        sessions: "/api/admin/sessions",
        counselors: "/api/admin/counselors",
        moods: "/api/admin/moods",
        mood_records: "/api/admin/mood-records",
        feedback: "/api/admin/feedback",
        resources: "/api/admin/resources"
    };

    const endpoint = endpoints[type];

    if (!endpoint) {
        renderTable([]);
        return;
    }

    try {

        const response =
            await adminAPI(endpoint);

        currentRecords =
            normalizeRecords(
                type,
                response.data || []
            );

        dataStore[type] =
            currentRecords;

        renderTable(currentRecords);

    } catch (error) {

        console.error(
            `Unable to load ${type}:`,
            error
        );

        currentRecords = [];
        dataStore[type] = [];

        renderTable([]);

        showToast(
            error.message ||
            `Unable to load ${pageConfig[type]?.title || "records"}.`,
            "error"
        );

    }

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable(records) {

    const dataTable = document.querySelector(".data-table");

    if (dataTable) {
        dataTable.className = `data-table ${currentDataType || ""}`.trim();
    }

    const tableColumns =
        columns[currentDataType] || [];


    tableHead.innerHTML = `

        <tr>

            ${tableColumns
                .map(column => `
                    <th>
                        ${column[1]}
                    </th>
                `)
                .join("")}

            <th>
                Actions
            </th>

        </tr>

    `;


    const searchTerm =
        searchInput.value
            .trim()
            .toLowerCase();


    const filtered =
        records.filter(record => {

            if (!searchTerm) {
                return true;
            }


            return Object.values(record)
                .some(value =>
                    String(
                        value ?? ""
                    )
                    .toLowerCase()
                    .includes(searchTerm)
                );

        });


    if (filtered.length === 0) {

        tableBody.innerHTML = "";

        emptyState.style.display =
            "block";

        return;

    }


    emptyState.style.display =
        "none";


    tableBody.innerHTML =
        filtered
            .map(record => {

                const primaryKey =
                    getPrimaryKey(
                        currentDataType
                    );


                const id =
                    record[primaryKey];


                const cells =
                    tableColumns
                        .map(column => {

                            const value =
                                record[column[0]];


                            return `

                                <td>
                                    ${formatCell(
                                        value,
                                        column[0]
                                    )}
                                </td>

                            `;

                        })
                        .join("");


                return `

                    <tr>

                        ${cells}

                        <td>

                            ${currentDataType === "appointments" ? (
                                String(record.Status || "").toLowerCase() === "pending" ? `
                                    <button
                                        class="table-action accept"
                                        data-action="accept"
                                        data-id="${id}"
                                    >
                                        Accept
                                    </button>

                                    <button
                                        class="table-action decline"
                                        data-action="decline"
                                        data-id="${id}"
                                    >
                                        Decline
                                    </button>
                                ` : ""
                            ) : currentDataType === "students" ? `
                                <button
                                    class="table-action edit"
                                    data-action="edit"
                                    data-id="${id}"
                                >
                                    Edit
                                </button>
                            ` : `
                                <button
                                    class="table-action edit"
                                    data-action="edit"
                                    data-id="${id}"
                                >
                                    Edit
                                </button>

                                <button
                                    class="table-action delete"
                                    data-action="delete"
                                    data-id="${id}"
                                >
                                    Delete
                                </button>
                            `}

                        </td>

                    </tr>

                `;

            })
            .join("");


    tableBody
        .querySelectorAll(
            ".table-action"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const id =
                        button.dataset.id;


                    if (
                        button.dataset.action ===
                        "accept"
                    ) {

                        acceptAppointment(id);

                    } else if (
                        button.dataset.action ===
                        "decline"
                    ) {

                        declineAppointment(id);

                    } else if (
                        button.dataset.action ===
                        "edit"
                    ) {

                        editRecord(id);

                    } else {

                        deleteRecord(id);

                    }

                }
            );

        });

}


/* =========================================================
   ACCEPT APPOINTMENT
========================================================= */

async function acceptAppointment(id) {

    const confirmed =
        confirm(
            "Accept this appointment?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await adminAPI(
            `/api/admin/appointments/${encodeURIComponent(id)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    status: "Confirmed"
                })
            }
        );

        await loadData("appointments");
        await loadDashboardStats();

        showToast(
            "Appointment accepted successfully!",
            "success"
        );

    } catch (error) {

        console.error(
            "Accept appointment error:",
            error
        );

        showToast(
            error.message ||
            "Unable to accept appointment.",
            "error"
        );
    }
}


/* =========================================================
   DECLINE APPOINTMENT
========================================================= */

async function declineAppointment(id) {

    const confirmed =
        confirm(
            "Decline this appointment?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await adminAPI(
            `/api/admin/appointments/${encodeURIComponent(id)}`,
            {
                method: "PUT",
                body: JSON.stringify({
                    status: "Cancelled"
                })
            }
        );

        await loadData("appointments");
        await loadDashboardStats();

        showToast(
            "Appointment declined.",
            "The student will be notified that the appointment was declined.",
            "success"
        );

    } catch (error) {

        console.error(
            "Decline appointment error:",
            error
        );

        showToast(
            error.message ||
            "Unable to decline appointment.",
            "error"
        );
    }
}


/* =========================================================
   FORMAT CELL
========================================================= */

function formatCell(
    value,
    field
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return `
            <span style="color:#9aa69f;">
                —
            </span>
        `;

    }


    if (field === "Status") {

        const normalizedStatus =
            String(value).toLowerCase();

        const displayStatus =
            normalizedStatus === "confirmed"
                ? "Accepted"
                : normalizedStatus === "cancelled"
                    ? "Declined"
                    : String(value);

        return `

            <span
                style="
                    display:inline-block;
                    padding:5px 9px;
                    border-radius:999px;
                    background:#dcfce7;
                    color:#15803d;
                    font-size:11px;
                    font-weight:700;
                "
            >
                ${escapeHTML(displayStatus)}
            </span>

        `;

    }


    if (
        field === "SessionStatus" ||
        field === "MoodLevel"
    ) {

        return `

            <span
                style="
                    display:inline-block;
                    padding:5px 9px;
                    border-radius:999px;
                    background:#dcfce7;
                    color:#15803d;
                    font-size:11px;
                    font-weight:700;
                "
            >
                ${escapeHTML(
                    String(value)
                )}
            </span>

        `;

    }


    return escapeHTML(
        String(value)
    );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return value
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   PRIMARY KEYS
========================================================= */

function getPrimaryKey(type) {

    const keys = {

        students:
            "StudentID",

        appointments:
            "AppointmentID",

        sessions:
            "SessionID",

        counselors:
            "CounselorID",

        moods:
            "AssessmentID",

        mood_records:
            "MoodRecordID",

        feedback:
            "FeedbackID",

        resources:
            "ResourceID"

    };


    return keys[type];

}


/* =========================================================
   EDIT RECORD
========================================================= */

function editRecord(id) {

    const primaryKey =
        getPrimaryKey(
            currentDataType
        );


    const record =
        currentRecords.find(
            item =>
                String(
                    item[primaryKey]
                ) === String(id)
        );


    if (!record) {

        showToast(
            "Record not found.",
            "error"
        );

        return;

    }


    editingId =
        id;


    modalTitle.textContent =
        `Edit ${pageConfig[currentDataType].title} Record`;


    buildForm(record);


    recordModal.classList.add(
        "show"
    );

}


/* =========================================================
   FORM CONFIGURATION
========================================================= */

const fieldConfig = {

    students: [

        {
            name: "FirstName",
            label: "First Name",
            type: "text"
        },

        {
            name: "LastName",
            label: "Last Name",
            type: "text"
        },

        {
            name: "Email",
            label: "Email",
            type: "email"
        },

        {
            name: "ContactNumber",
            label: "Contact Number",
            type: "text"
        },

        {
            name: "GradeLevel",
            label: "Grade Level",
            type: "text"
        }

    ],


    appointments: [

        {
            name: "AppointmentDate",
            label: "Appointment Date",
            type: "date"
        },

        {
            name: "AppointmentTime",
            label: "Appointment Time",
            type: "time"
        },

        {
            name: "Reason",
            label: "Reason",
            type: "textarea"
        },

        {
            name: "Status",
            label: "Status",
            type: "select",
            options: [
                "Pending",
                "Confirmed",
                "Completed",
                "Cancelled"
            ]
        }

    ],


    sessions: [

        {
            name: "SessionDate",
            label: "Session Date",
            type: "date"
        },

        {
            name: "SessionTime",
            label: "Session Time",
            type: "time"
        },

        {
            name: "SessionType",
            label: "Session Type",
            type: "text"
        },

        {
            name: "SessionStatus",
            label: "Session Status",
            type: "select",
            options: [
                "Scheduled",
                "Ongoing",
                "Completed",
                "Cancelled"
            ]
        },

        {
            name: "Notes",
            label: "Notes",
            type: "textarea"
        }

    ],


    counselors: [

        {
            name: "CounselorName",
            label: "Counselor Name",
            type: "text"
        },

        {
            name: "Email",
            label: "Email",
            type: "email"
        },

        {
            name: "ContactNumber",
            label: "Contact Number",
            type: "text"
        }

    ],


    moods: [

        {
            name: "AssessmentDate",
            label: "Assessment Date",
            type: "date"
        },

        {
            name: "MoodScore",
            label: "Mood Score",
            type: "number"
        },

        {
            name: "MoodLevel",
            label: "Mood Level",
            type: "select",
            options: [
                "Very Happy",
                "Happy",
                "Neutral",
                "Sad",
                "Very Sad",
                "Stressed",
                "Anxious"
            ]
        },

        {
            name: "Remarks",
            label: "Remarks",
            type: "textarea"
        }

    ],


    mood_records: [

        {
            name: "RecordedDate",
            label: "Recorded Date",
            type: "date"
        },

        {
            name: "MoodStatus",
            label: "Mood Status",
            type: "text"
        },

        {
            name: "Recommendation",
            label: "Recommendation",
            type: "textarea"
        }

    ],


    feedback: [

        {
            name: "Rating",
            label: "Rating",
            type: "number"
        },

        {
            name: "Comments",
            label: "Comments",
            type: "textarea"
        },

        {
            name: "FeedbackDate",
            label: "Feedback Date",
            type: "date"
        }

    ],


    resources: [

        {
            name: "ResourceTitle",
            label: "Resource Title",
            type: "text"
        },

        {
            name: "ResourceType",
            label: "Resource Type",
            type: "text"
        },

        {
            name: "Description",
            label: "Description",
            type: "textarea"
        },

        {
            name: "ResourceDate",
            label: "Resource Date",
            type: "date"
        }

    ]

};


/* =========================================================
   BUILD FORM
========================================================= */

function buildForm(record = null) {

    const fields =
        fieldConfig[currentDataType] || [];


    formFields.innerHTML = "";


    fields.forEach(field => {

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            "form-field";


        if (
            field.type === "textarea"
        ) {

            wrapper.classList.add(
                "full-width"
            );

        }


        const label =
            document.createElement(
                "label"
            );

        label.textContent =
            field.label;


        wrapper.appendChild(
            label
        );


        let input;


        if (
            field.type === "select"
        ) {

            input =
                document.createElement(
                    "select"
                );


            const blank =
                document.createElement(
                    "option"
                );

            blank.value = "";

            blank.textContent =
                "Select...";


            input.appendChild(
                blank
            );


            field.options.forEach(
                option => {

                    const optionElement =
                        document.createElement(
                            "option"
                        );

                    optionElement.value =
                        option;

                    optionElement.textContent =
                        option;

                    input.appendChild(
                        optionElement
                    );

                }
            );

        }


        else if (
            field.type === "textarea"
        ) {

            input =
                document.createElement(
                    "textarea"
                );

        }


        else {

            input =
                document.createElement(
                    "input"
                );

            input.type =
                field.type;

        }


        input.name =
            field.name;

        input.id =
            `field_${field.name}`;

        // Task 6: apply HTML5 constraints to editable Admin records.
        if (field.name !== "Status" && field.name !== "SessionStatus") {
            input.required = true;
        }

        if (field.type === "email") {
            input.setAttribute("autocomplete", "email");
        }

        if (field.name === "ContactNumber") {
            input.setAttribute("inputmode", "numeric");
            input.setAttribute("pattern", "[0-9]{7,15}");
            input.setAttribute("minlength", "7");
            input.setAttribute("maxlength", "15");
            input.setAttribute("title", "Enter 7 to 15 digits.");
        }

        if (field.name === "Email") {
            input.setAttribute("maxlength", "254");
        }

        if (field.name === "MoodScore") {
            input.setAttribute("min", "1");
            input.setAttribute("max", "5");
            input.setAttribute("step", "1");
        }

        if (field.name === "AppointmentDate" || field.name === "SessionDate" || field.name === "AssessmentDate") {
            input.setAttribute("min", new Date().toISOString().slice(0, 10));
        }

        if (record) {

            input.value =
                record[field.name] ?? "";

        }


        wrapper.appendChild(
            input
        );


        formFields.appendChild(
            wrapper
        );

    });

}


/* =========================================================
   SAVE EDITED RECORD
========================================================= */

recordForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        if (!editingId) {
            showToast(
                "Adding new records is not available yet.",
                "error"
            );
            return;
        }

        const primaryKey =
            getPrimaryKey(currentDataType);

        const record =
            currentRecords.find(
                item =>
                    String(item[primaryKey]) ===
                    String(editingId)
            );

        if (!record) {
            showToast(
                "Record not found.",
                "error"
            );
            return;
        }

        if (!recordForm.checkValidity()) {
            recordForm.reportValidity();
            showToast(
                "Invalid record",
                "Please correct the highlighted fields before saving.",
                "error"
            );
            return;
        }

        try {

            if (currentDataType === "students") {

                const payload = {
                    FirstName:
                        document.getElementById("field_FirstName")?.value.trim() || "",
                    LastName:
                        document.getElementById("field_LastName")?.value.trim() || "",
                    Email:
                        document.getElementById("field_Email")?.value.trim() || "",
                    ContactNumber:
                        document.getElementById("field_ContactNumber")?.value.trim() || "",
                    GradeLevel:
                        document.getElementById("field_GradeLevel")?.value.trim() || ""
                };

                await adminAPI(
                    `/api/admin/students/${encodeURIComponent(editingId)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(payload)
                    }
                );

            } else if (currentDataType === "appointments") {

                const status =
                    document.getElementById("field_Status")?.value || "";

                await adminAPI(
                    `/api/admin/appointments/${encodeURIComponent(editingId)}`,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            status
                        })
                    }
                );

            } else {

                showToast(
                    "Editing this record type is not connected yet.",
                    "error"
                );
                return;

            }

            closeRecordModal();

            await loadData(currentDataType);
            await loadDashboardStats();

            showToast(
                "Record updated successfully!",
                "success"
            );

        } catch (error) {

            console.error(
                "Record update error:",
                error
            );

            showToast(
                error.message ||
                "Unable to update record.",
                "error"
            );

        }

    }
);


/* =========================================================
   DELETE RECORD
========================================================= */

async function deleteRecord(id) {

    if (currentDataType !== "students") {
        showToast(
            "Delete is only available for student records.",
            "error"
        );
        return;
    }

    const confirmed =
        confirm(
            "Are you sure you want to delete this student?"
        );

    if (!confirmed) {
        return;
    }

    try {

        await adminAPI(
            `/api/admin/students/${encodeURIComponent(id)}`,
            {
                method: "DELETE"
            }
        );

        await loadData(currentDataType);
        await loadDashboardStats();

        showToast(
            "Student deleted successfully!",
            "success"
        );

    } catch (error) {

        console.error(
            "Student delete error:",
            error
        );

        showToast(
            error.message ||
            "Unable to delete student.",
            "error"
        );

    }

}


/* =========================================================
   SEARCH
========================================================= */

searchInput.addEventListener(
    "input",
    () => {

        renderTable(
            currentRecords
        );

    }
);


/* =========================================================
   REFRESH
========================================================= */

refreshButton.addEventListener(
    "click",
    () => {

        loadData(
            currentDataType
        );

        showToast(
            "Records refreshed.",
            "success"
        );

    }
);


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeRecordModal() {

    recordModal.classList.remove(
        "show"
    );

    recordForm.reset();

    formFields.innerHTML = "";

    editingId = null;

}


closeModal.addEventListener(
    "click",
    closeRecordModal
);


cancelButton.addEventListener(
    "click",
    closeRecordModal
);


recordModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            recordModal
        ) {

            closeRecordModal();

        }

    }
);


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(
    message,
    type = "success"
) {

    clearTimeout(
        toastTimer
    );


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            3000
        );

}


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
    "click",
    () => {

        const confirmed =
            confirm(
                "Are you sure you want to logout?"
            );


        if (!confirmed) {
            return;
        }


        sessionStorage.removeItem(
            "admin"
        );


        showLogin();

        loginForm.reset();

        loginMessage.textContent = "";

    }
);


/* =========================================================
   START
========================================================= */

const savedAdmin =
    sessionStorage.getItem("admin");


if (savedAdmin) {

    showDashboard();

    initializeAdminDashboard();

} else {

    showLogin();

}