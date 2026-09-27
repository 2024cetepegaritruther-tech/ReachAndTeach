const loginForm =
    document.getElementById("loginForm");

const emailInput =
    document.getElementById("email");

const passwordInput =
    document.getElementById("password");

const passwordToggle =
    document.getElementById("passwordToggle");

const loginButton =
    document.getElementById("loginButton");

const loginMessage =
    document.getElementById("loginMessage");


/* =========================================================
   PASSWORD SHOW / HIDE
========================================================= */

passwordToggle.addEventListener(
    "click",
    () => {

        if (passwordInput.type === "password") {

            passwordInput.type = "text";

            passwordToggle.textContent = "🙈";

            passwordToggle.setAttribute(
                "aria-label",
                "Hide password"
            );

        } else {

            passwordInput.type = "password";

            passwordToggle.textContent = "👁";

            passwordToggle.setAttribute(
                "aria-label",
                "Show password"
            );

        }

    }
);


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const Email =
            emailInput.value.trim();

        const Password =
            passwordInput.value;


        loginMessage.textContent = "";

        loginMessage.className =
            "login-message";


        loginButton.disabled = true;

        loginButton.textContent =
            "LOGGING IN...";


        try {

            const response =
                await fetch(
                    "/api/admin/login",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body: JSON.stringify({

                            Email: Email,

                            Password: Password

                        })

                    }
                );


            const data =
                await response.json();


            if (
                !response.ok ||
                !data.success
            ) {

                loginMessage.textContent =
                    data.message ||
                    "Login failed.";

                loginMessage.classList.add(
                    "error"
                );

                return;

            }


            loginMessage.textContent =
                "Login successful!";


            loginMessage.classList.add(
                "success"
            );


            /* Save admin session */

            sessionStorage.setItem(

                "admin",

                JSON.stringify(
                    data.admin
                )

            );


            /* Redirect */

            setTimeout(
                () => {

                    window.location.href =
                        "dashboard.html";

                },

                700
            );


        } catch (error) {

            console.error(
                "Login error:",
                error
            );


            loginMessage.textContent =
                "Unable to connect to the server.";


            loginMessage.classList.add(
                "error"
            );


        } finally {

            loginButton.disabled = false;

            loginButton.textContent =
                "LOGIN";

        }

    }
);