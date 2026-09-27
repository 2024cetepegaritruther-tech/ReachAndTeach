/* =========================================================
   REACH & TEACH — ADMIN DASHBOARD
========================================================= */


/* =========================================================
   ADMIN SESSION
========================================================= */

const adminData =
    sessionStorage.getItem("admin");


if (!adminData) {

    window.location.href =
        "login.html";

    throw new Error(
        "No admin session found."
    );

}


const admin =
    JSON.parse(adminData);


/* =========================================================
   ELEMENTS
========================================================= */

const navItems =
    document.querySelectorAll(".nav-item");

const quickActions =
    document.querySelectorAll(".quick-action");

const dashboardPage =
    document.getElementById(
        "dashboardPage"
    );

const dataPage =
    document.getElementById(
        "dataPage"
    );

const pageTitle =
    document.getElementById(
        "pageTitle"
    );

const pageSubtitle =
    document.getElementById(
        "pageSubtitle"
    );

const dataTitle =
    document.getElementById(
        "dataTitle"
    );

const dataDescription =
    document.getElementById(
        "dataDescription"
    );

const adminName =
    document.getElementById(
        "adminName"
    );

const adminRole =
    document.getElementById(
        "adminRole"
    );

const studentCount =
    document.getElementById(
        "studentCount"
    );

const appointmentCount =
    document.getElementById(
        "appointmentCount"
    );

const sessionCount =
    document.getElementById(
        "sessionCount"
    );

const moodCount =
    document.getElementById(
        "moodCount"
    );

const addButton =
    document.getElementById(
        "addButton"
    );

const refreshButton =
    document.getElementById(
        "refreshButton"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

const tableHead =
    document.getElementById(
        "tableHead"
    );

const tableBody =
    document.getElementById(
        "tableBody"
    );

const emptyState =
    document.getElementById(
        "emptyState"
    );

const recordModal =
    document.getElementById(
        "recordModal"
    );

const closeModal =
    document.getElementById(
        "closeModal"
    );

const cancelButton =
    document.getElementById(
        "cancelButton"
    );

const recordForm =
    document.getElementById(
        "recordForm"
    );

const formFields =
    document.getElementById(
        "formFields"
    );

const modalTitle =
    document.getElementById(
        "modalTitle"
    );

const toast =
    document.getElementById(
        "toast"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


/* =========================================================
   ADMIN PROFILE
========================================================= */

adminName.textContent =
    admin.FullName || "Admin";


adminRole.textContent =
    admin.Role || "Administrator";


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
   FIELD CONFIGURATION
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
            name: "StudentID",
            label: "Student ID",
            type: "number"
        },

        {
            name: "CounselorID",
            label: "Counselor ID",
            type: "number"
        },

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
                "Approved",
                "Completed",
                "Cancelled"

            ]

        }

    ],


    sessions: [

        {
            name: "StudentID",
            label: "Student ID",
            type: "number"
        },

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
            name: "SessionID",
            label: "Session ID",
            type: "number"
        },

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
            name: "AssessmentID",
            label: "Assessment ID",
            type: "number"
        },

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
            name: "SessionID",
            label: "Session ID",
            type: "number"
        },

        {
            name: "CounselorID",
            label: "Counselor ID",
            type: "number"
        },

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
            name: "FeedbackID",
            label: "Feedback ID",
            type: "number"
        },

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
   NAVIGATION
========================================================= */

function openPage(page) {

    currentPage = page;


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
   LOAD DASHBOARD STATISTICS
========================================================= */

async function loadDashboardStats() {

    try {

        const response =
            await fetch(
                "/api/dashboard/stats"
            );


        const data =
            await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.message ||
                "Unable to load dashboard statistics."
            );

        }


        studentCount.textContent =
            data.stats.students;


        appointmentCount.textContent =
            data.stats.appointments;


        sessionCount.textContent =
            data.stats.sessions;


        moodCount.textContent =
            data.stats.moodAssessments;


    } catch (error) {

        console.error(error);

        showToast(
            "Unable to load dashboard statistics.",
            "error"
        );

    }

}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData(type) {

    try {

        tableBody.innerHTML = "";

        tableHead.innerHTML = "";

        emptyState.style.display =
            "none";


        const response =
            await fetch(
                `/api/admin/${type}`
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Unable to load records."
            );

        }


        currentRecords =
            result.data || [];


        renderTable(
            currentRecords
        );


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to load records.",
            "error"
        );

    }

}


/* =========================================================
   TABLE COLUMNS
========================================================= */

function getColumns(type) {

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

            ["FeedbackID", "Feedback"],

            ["ResourceTitle", "Title"],

            ["ResourceType", "Type"],

            ["Description", "Description"],

            ["ResourceDate", "Date"]

        ]

    };


    return columns[type] || [];

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable(records) {

    const columns =
        getColumns(
            currentDataType
        );


    /* HEADER */

    tableHead.innerHTML = `

        <tr>

            ${columns
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


    /* SEARCH */

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


    /* EMPTY */

    if (filtered.length === 0) {

        tableBody.innerHTML = "";

        emptyState.style.display =
            "block";

        return;

    }


    emptyState.style.display =
        "none";


    /* ROWS */

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
                    columns
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

                        </td>

                    </tr>

                `;

            })
            .join("");


    /* ACTION EVENTS */

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
   FORMAT TABLE CELL
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

        return `<span style="color:#9aa69f;">—</span>`;

    }


    if (
        field === "Status" ||
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

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


/* =========================================================
   PRIMARY KEY
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
            "AssessmentID",

        feedback:
            "FeedbackID",

        resources:
            "ResourceID"

    };


    return keys[type];

}


/* =========================================================
   ADD RECORD
========================================================= */

addButton.addEventListener(
    "click",
    () => {

        editingId = null;

        modalTitle.textContent =
            `Add ${pageConfig[currentDataType].title} Record`;

        buildForm();

        recordModal.classList.add(
            "show"
        );

    }
);


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
            field.type ===
                "textarea"
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


        /* SELECT */

        if (
            field.type ===
                "select"
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


        /* TEXTAREA */

        else if (
            field.type ===
                "textarea"
        ) {

            input =
                document.createElement(
                    "textarea"
                );

        }


        /* INPUT */

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


        if (record) {

            input.value =
                record[field.name] ??
                "";

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
   SAVE RECORD
========================================================= */

recordForm.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const fields =
            fieldConfig[currentDataType] ||
            [];


        const payload = {};


        fields.forEach(field => {

            const input =
                document.getElementById(
                    `field_${field.name}`
                );


            if (input) {

                payload[field.name] =
                    input.value;

            }

        });


        try {

            let response;


            if (editingId) {

                response =
                    await fetch(

                        `/api/admin/${currentDataType}/${editingId}`,

                        {

                            method: "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    payload
                                )

                        }

                    );

            } else {

                response =
                    await fetch(

                        `/api/admin/${currentDataType}`,

                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify(
                                    payload
                                )

                        }

                    );

            }


            const result =
                await response.json();


            if (
                !response.ok ||
                !result.success
            ) {

                throw new Error(
                    result.message ||
                    "Unable to save record."
                );

            }


            closeRecordModal();


            showToast(

                editingId
                    ? "Record updated successfully!"
                    : "Record added successfully!",

                "success"

            );


            await loadData(
                currentDataType
            );


            await loadDashboardStats();


        } catch (error) {

            console.error(error);

            showToast(
                error.message ||
                "Unable to save record.",
                "error"
            );

        }

    }
);


/* =========================================================
   DELETE RECORD
========================================================= */

async function deleteRecord(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this record?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(

                `/api/admin/${currentDataType}/${id}`,

                {

                    method: "DELETE"

                }

            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.message ||
                "Unable to delete record."
            );

        }


        showToast(
            "Record deleted successfully!",
            "success"
        );


        await loadData(
            currentDataType
        );


        await loadDashboardStats();


    } catch (error) {

        console.error(error);

        showToast(
            error.message ||
            "Unable to delete record.",
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
    async () => {

        await loadData(
            currentDataType
        );

        showToast(
            "Records refreshed.",
            "success"
        );

    }
);


/* =========================================================
   MODAL CLOSE
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


        window.location.href =
            "login.html";

    }
);


/* =========================================================
   INITIAL LOAD
========================================================= */

openPage(
    "dashboard"
);