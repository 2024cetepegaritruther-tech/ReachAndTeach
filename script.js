// Seed Data matching existing dashboard records
let users = [
    { id: "U001", username: "sarah.g", department: "Guidance Office", role: "Guidance Counselor", status: "Active" },
    { id: "U002", username: "john.admin", department: "IT Department", role: "Administrator", status: "Active" },
    { id: "U003", username: "maria.staff", department: "Student Affairs", role: "Staff", status: "Inactive" }
];

let nextId = 4;
let pendingUser = null;

const pageTitles = {
    login: "System Login",
    form1: "Add User",
    form2: "Role & Access Assignment",
    dashboard: "User Access Dashboard"
};

const flowLabels = {
    login: "Step 1 of 3 — System Login",
    form1: "Step 2 of 3 — Add User",
    form2: "Step 3 of 3 — Role & Access Assignment",
    dashboard: "All steps complete — Admin Dashboard"
};

// Navigates between screens and updates layout headers
function goTo(pageId) {
    document.querySelectorAll(".form-page").forEach(p => p.classList.remove("active"));
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active");

    document.getElementById("pageTitle").textContent = pageTitles[pageId] || "User Access Dashboard";
    document.getElementById("flowLabel").textContent = flowLabels[pageId] || "";

    // Sync active state of sidebar navigation buttons
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.target === pageId);
    });

    // Update the progress bar sequence
    const order = ["login", "form1", "form2"];
    const currentIndex = order.indexOf(pageId);

    document.querySelectorAll(".progress-step").forEach(step => {
        const stepIndex = order.indexOf(step.dataset.step);
        step.classList.remove("active", "done");
        if (pageId === "dashboard") {
            step.classList.add("done");
        } else if (stepIndex === currentIndex) {
            step.classList.add("active");
        } else if (stepIndex < currentIndex) {
            step.classList.add("done");
        }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Calculate and refresh metrics at the top of the dashboard
function updateStats() {
    document.getElementById("statTotalUsers").textContent = users.length;
    document.getElementById("statActiveUsers").textContent = users.filter(u => u.status === "Active").length;
    document.getElementById("statAdmins").textContent = users.filter(u => u.role === "Administrator").length;
    document.getElementById("statPending").textContent = "0";
}

// Render the user table dynamically
function renderTable() {
    const tbody = document.getElementById("userTable");
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.department}</td>
            <td>${u.role}</td>
            <td><span class="badge ${u.status === "Active" ? "active" : "inactive"}">${u.status}</span></td>
            <td>
                <button class="edit-btn" data-id="${u.id}">Edit</button>
                <button class="delete-btn" data-id="${u.id}">Delete</button>
            </td>
        </tr>
    `).join("");

    document.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => editUser(btn.dataset.id));
    });
    document.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteUser(btn.dataset.id));
    });

    updateStats();
}

function editUser(id) {
    const user = users.find(u => u.id === id);
    if (!user) return;

    document.getElementById("username").value = user.username;
    document.getElementById("email").value = user.username + "@example.com";
    document.getElementById("department").value = user.department;
    document.getElementById("status").value = user.status;

    pendingUser = user;
    goTo("form1");
}

function deleteUser(id) {
    users = users.filter(u => u.id !== id);
    renderTable();
}

// 1. LOGIN SUBMIT -> GO TO ADD USER FORM
document.getElementById("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    goTo("form1");
});

// 2. ADD USER SUBMIT -> GO TO ROLE & ACCESS FORM
document.getElementById("addUserForm").addEventListener("submit", function (e) {
    e.preventDefault();

    pendingUser = {
        id: pendingUser?.id || ("U" + String(nextId).padStart(3, "0")),
        username: document.getElementById("username").value.trim(),
        email: document.getElementById("email").value.trim(),
        department: document.getElementById("department").value,
        status: document.getElementById("status").value
    };

    document.getElementById("userId").value = pendingUser.id + " — " + pendingUser.username;
    this.reset();
    goTo("form2");
});

// 3. SAVE ACCESS SUBMIT -> GO TO ADMIN DASHBOARD
document.getElementById("roleForm").addEventListener("submit", function (e) {
    e.preventDefault();

    const role = document.getElementById("role").value;
    const permissions = [...document.querySelectorAll('input[name="access"]:checked')].map(b => b.value);

    if (!role || permissions.length === 0) {
        alert("Please select a Role and at least one Access Right.");
        return;
    }

    const existingIndex = users.findIndex(u => u.id === pendingUser.id);
    const newUserRecord = {
        id: pendingUser.id,
        username: pendingUser.username,
        department: pendingUser.department,
        role: role,
        status: pendingUser.status
    };

    if (existingIndex > -1) {
        users[existingIndex] = newUserRecord;
    } else {
        users.push(newUserRecord);
        nextId++;
    }

    pendingUser = null;
    this.reset();
    renderTable();
    goTo("dashboard");
});

// Add User button on dashboard
document.getElementById("addAnotherBtn").addEventListener("click", function () {
    goTo("form1");
});

// Set default expiration date (+1 Year)
const expiration = document.getElementById("expirationDate");
if (expiration) {
    const today = new Date();
    today.setFullYear(today.getFullYear() + 1);
    expiration.value = today.toISOString().split("T")[0];
}

// Initialize on System Login Screen
renderTable();
goTo("login");