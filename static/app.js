
const chat = document.getElementById("chatMessages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const send = document.getElementById("sendButton");
const welcome = document.getElementById("welcomeScreen");
const historyBox = document.getElementById("chatHistory");

let history = [];
let chats = [];
let currentChatId = Date.now();

try {
    chats = JSON.parse(localStorage.getItem("warrior-ai-chats") || "[]");
    if (!Array.isArray(chats)) chats = [];
} catch {
    chats = [];
}

function saveChats() {
    localStorage.setItem("warrior-ai-chats", JSON.stringify(chats));
}

function saveCurrentChat() {
    const messages = history.slice();

    if (!messages.length) return;

    let current = chats.find(c => c.id === currentChatId);

    if (!current) {
        current = {
            id: currentChatId,
            title: messages[0].content.slice(0, 35),
            messages: messages
        };
        chats.unshift(current);
    } else {
        current.messages = messages;
    }

    saveChats();
    renderHistory();
}

function renderHistory() {
    historyBox.innerHTML = "";

    chats.forEach(item => {
        const button = document.createElement("button");
        button.className = "history-item";
        button.textContent = item.title || "New Chat";

        button.style.cssText =
            "display:block;width:100%;text-align:left;padding:11px;" +
            "margin-bottom:5px;border:0;border-radius:8px;" +
            "background:transparent;color:#ccc;cursor:pointer;";

        button.onmouseenter = () => button.style.background = "#303030";
        button.onmouseleave = () => button.style.background = "transparent";

        button.onclick = () => loadChat(item.id);

        historyBox.appendChild(button);
    });
}

function addMessage(role, text) {
    welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message " + role;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = role === "user" ? "Y" : "W";

    const body = document.createElement("div");
    body.className = "message-content";

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    body.appendChild(paragraph);
    row.append(avatar, body);
    chat.appendChild(row);

    document.getElementById("chatArea").scrollTop =
        document.getElementById("chatArea").scrollHeight;

    return row;
}

function showWelcome() {
    chat.innerHTML = "";
    welcome.style.display = "block";
}

function loadChat(id) {
    const selected = chats.find(c => c.id === id);
    if (!selected) return;

    currentChatId = selected.id;
    history = [...selected.messages];

    chat.innerHTML = "";
    welcome.style.display = "none";

    history.forEach(item => addMessage(item.role, item.content));

    document.getElementById("sidebar").classList.remove("open");
}

function resetChat() {
    saveCurrentChat();

    history = [];
    currentChatId = Date.now();

    showWelcome();
    input.value = "";

    document.getElementById("sidebar").classList.remove("open");
}

document.getElementById("newChatBtn").onclick = resetChat;

document.getElementById("menuBtn").onclick = () => {
    document.getElementById("sidebar").classList.toggle("open");
};

document.querySelectorAll(".suggestion").forEach(button => {
    button.onclick = () => {
        input.value = button.dataset.prompt || "";
        form.requestSubmit();
    };
});

input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

form.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();
    if (!message || send.disabled) return;

    const previous = history.slice(-12);

    addMessage("user", message);
    history.push({ role: "user", content: message });

    input.value = "";
    input.style.height = "auto";
    send.disabled = true;

    const pending = addMessage("assistant", "Thinking...");

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                history: previous
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }

        if (!data.reply) {
            throw new Error("AI returned an empty response.");
        }

        pending.remove();

        addMessage("assistant", data.reply);

        history.push({
            role: "assistant",
            content: data.reply
        });

        saveCurrentChat();

    } catch (error) {
        pending.remove();

        addMessage("assistant", "Error: " + error.message);

        history.pop();
        console.error(error);

    } finally {
        send.disabled = false;
        input.focus();
    }
});

renderHistory();

if (chats.length > 0) {
    loadChat(chats[0].id);
}
