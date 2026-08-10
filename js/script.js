// ==========================================
// REACH & TEACH
// JAVASCRIPT
// ==========================================


// ==========================================
// CHAT ELEMENTS
// ==========================================

const chatModal = document.getElementById("chatModal");

const closeChatButton =
    document.getElementById("closeChat");

const chatInput =
    document.getElementById("chatInput");

const sendMessageButton =
    document.getElementById("sendMessage");

const chatBody =
    document.getElementById("chatBody");


// ==========================================
// OPEN CHAT
// ==========================================

function openChat() {

    chatModal.classList.add("show");

    setTimeout(function () {

        chatInput.focus();

    }, 300);
}


// ==========================================
// CLOSE CHAT
// ==========================================

function closeChat() {

    chatModal.classList.remove("show");
}


closeChatButton.addEventListener(
    "click",
    closeChat
);


// ==========================================
// CLICK OUTSIDE CHAT TO CLOSE
// ==========================================

chatModal.addEventListener(
    "click",
    function (event) {

        if (event.target === chatModal) {

            closeChat();

        }

    }
);


// ==========================================
// ESC KEY CLOSES CHAT
// ==========================================

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape" &&
            chatModal.classList.contains("show")
        ) {

            closeChat();

        }

    }
);


// ==========================================
// RESERVE A CALL
// ==========================================

function reserveCall() {

    openChat();

    setTimeout(function () {

        addCounselorMessage(
            "Sure! I can help you with a counseling call. Please tell me your preferred schedule."
        );

    }, 500);
}


// ==========================================
// CALL COUNSELOR
// ==========================================

function callCounselor() {

    openChat();

}


// ==========================================
// MOOD SELECTION
// ==========================================

const moodButtons =
    document.querySelectorAll(".mood");

const moodMessage =
    document.getElementById("moodMessage");


moodButtons.forEach(function (button) {

    button.addEventListener(
        "click",
        function () {

            // Remove previous selection

            moodButtons.forEach(
                function (item) {

                    item.classList.remove(
                        "selected"
                    );

                }
            );


            // Select clicked emoji

            button.classList.add("selected");


            // Get mood

            const mood =
                button.getAttribute(
                    "data-mood"
                );


            // Update message

            moodMessage.textContent =
                "You selected: " + mood;

        }
    );

});


// ==========================================
// MOOD CHECK BUTTON
// ==========================================

function moodCheck() {

    const selectedMood =
        document.querySelector(
            ".mood.selected"
        );


    if (!selectedMood) {

        alert(
            "Please select an emoji first."
        );

        return;
    }


    const mood =
        selectedMood.getAttribute(
            "data-mood"
        );


    alert(
        "Mood Check-In\n\n" +
        "You selected: " +
        mood +
        "\n\nThank you for checking in with yourself."
    );

}


// ==========================================
// QUICK CHAT MESSAGE
// ==========================================

function sendQuickMessage(message) {

    addStudentMessage(message);


    setTimeout(function () {

        addCounselorMessage(
            "Thank you for sharing that with me. I'm here to listen and support you. 💙"
        );

    }, 700);

}


// ==========================================
// SEND CHAT MESSAGE
// ==========================================

function sendChatMessage() {

    const message =
        chatInput.value.trim();


    if (message === "") {

        return;

    }


    addStudentMessage(message);


    chatInput.value = "";


    setTimeout(function () {

        addCounselorMessage(
            "Thank you for sharing that with me. I'm here to listen. 💙"
        );

    }, 700);

}


// ==========================================
// ENTER KEY SEND
// ==========================================

chatInput.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Enter") {

            sendChatMessage();

        }

    }
);


sendMessageButton.addEventListener(
    "click",
    sendChatMessage
);


// ==========================================
// ADD STUDENT MESSAGE
// ==========================================

function addStudentMessage(message) {

    const messageContainer =
        document.createElement("div");

    messageContainer.className =
        "student-message";


    const messageText =
        document.createElement("p");

    messageText.textContent =
        message;


    messageContainer.appendChild(
        messageText
    );


    chatBody.appendChild(
        messageContainer
    );


    scrollChatToBottom();

}


// ==========================================
// ADD COUNSELOR MESSAGE
// ==========================================

function addCounselorMessage(message) {

    const messageContainer =
        document.createElement(
            "div"
        );

    messageContainer.className =
        "welcome-message";


    const avatar =
        document.createElement("div");

    avatar.className =
        "message-avatar";

    avatar.textContent = "SG";


    const messageBox =
        document.createElement("div");

    messageBox.className =
        "message";


    const counselorName =
        document.createElement("strong");

    counselorName.textContent =
        "Ma'am Sarah";


    const messageText =
        document.createElement("p");

    messageText.textContent =
        message;


    messageBox.appendChild(
        counselorName
    );

    messageBox.appendChild(
        messageText
    );


    messageContainer.appendChild(
        avatar
    );

    messageContainer.appendChild(
        messageBox
    );


    chatBody.appendChild(
        messageContainer
    );


    scrollChatToBottom();

}


// ==========================================
// SCROLL CHAT TO BOTTOM
// ==========================================

function scrollChatToBottom() {

    chatBody.scrollTop =
        chatBody.scrollHeight;

}


// ==========================================
// DARK / LIGHT MODE
// ==========================================

const themeToggle =
    document.getElementById(
        "themeToggle"
    );


themeToggle.addEventListener(
    "click",
    function () {

        document.body.classList.toggle(
            "dark"
        );


        if (
            document.body.classList.contains(
                "dark"
            )
        ) {

            themeToggle.textContent =
                "☀️";

            themeToggle.title =
                "Switch to light mode";

        } else {

            themeToggle.textContent =
                "🌙";

            themeToggle.title =
                "Switch to dark mode";

        }

    }
);