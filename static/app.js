
const chat = document.getElementById("chatMessages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const send = document.getElementById("sendButton");
const welcome = document.getElementById("welcomeScreen");
const historyBox = document.getElementById("chatHistory");
const chatArea = document.getElementById("chatArea");
const sidebar = document.getElementById("sidebar");

let history = [];
let chats = [];
let currentChatId = Date.now();
let isGenerating = false;
let lastUserMessage = null;

// Keep the existing key to preserve old saved chats
try {
    chats = JSON.parse(
        localStorage.getItem("warrior-ai-chats") || "[]"
    );

    if (!Array.isArray(chats)) chats = [];
} catch {
    chats = [];
}

function saveChats() {
    localStorage.setItem(
        "warrior-ai-chats",
        JSON.stringify(chats)
    );
}

function saveCurrentChat() {
    if (!history.length) return;

    let current = chats.find(c => c.id === currentChatId);

    if (!current) {
        current = {
            id: currentChatId,
            title: history.find(m => m.role === "user")
                ?.content.slice(0, 35) || "New Chat",
            messages: [...history]
        };

        chats.unshift(current);
    } else {
        current.messages = [...history];
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

        button.style.cssText = `
            display:block;
            width:100%;
            text-align:left;
            padding:11px;
            margin-bottom:5px;
            border:0;
            border-radius:8px;
            background:transparent;
            color:#ccc;
            cursor:pointer;
            font-size:13px;
        `;

        button.onmouseenter = () => {
            button.style.background = "#303030";
        };

        button.onmouseleave = () => {
            button.style.background = "transparent";
        };

        button.onclick = () => loadChat(item.id);

        historyBox.appendChild(button);
    });
}

function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
}

function createActionButton(label, title, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);

    button.style.cssText = `
        background:transparent;
        color:#aaa;
        border:1px solid transparent;
        border-radius:7px;
        padding:5px 9px;
        font-size:12px;
        cursor:pointer;
        margin:5px 5px 0 0;
    `;

    button.onmouseenter = () => {
        button.style.background = "#383838";
        button.style.color = "#fff";
    };

    button.onmouseleave = () => {
        button.style.background = "transparent";
        button.style.color = "#aaa";
    };

    button.onclick = callback;

    return button;
}

async function copyText(text, button) {
    try {
        await navigator.clipboard.writeText(text);

        button.textContent = "Copied ✓";

        setTimeout(() => {
            button.textContent = "Copy";
        }, 1800);

    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();

        try {
            document.execCommand("copy");
            button.textContent = "Copied ✓";
        } catch {
            button.textContent = "Copy failed";
        }

        area.remove();

        setTimeout(() => {
            button.textContent = "Copy";
        }, 1800);
    }
}

function addMessage(role, text, options = {}) {
    welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message " + role;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    if (role === "assistant") {
        const logo = document.createElement("img");
        logo.src = "/static/osam-logo.png";
        logo.alt = "OSAM AI";

        logo.style.cssText = `
            width:100%;
            height:100%;
            object-fit:cover;
            border-radius:50%;
        `;

        avatar.appendChild(logo);
    } else {
        avatar.textContent = "Y";
    }

    const body = document.createElement("div");
    body.className = "message-content";

    const paragraph = document.createElement("p");
    paragraph.textContent = text;

    body.appendChild(paragraph);
    row.append(avatar, body);

    if (role === "assistant" && !options.pending) {
        const actions = document.createElement("div");
        actions.className = "message-actions";

        actions.appendChild(
            createActionButton("Copy", "Copy response", () => {
                copyText(text, copyButton);
            })
        );

        const copyButton = actions.lastChild;

        if (options.allowRegenerate) {
            actions.appendChild(
                createActionButton(
                    "↻ Regenerate",
                    "Generate another response",
                    regenerateLastResponse
                )
            );
        }

        body.appendChild(actions);
    }

    chat.appendChild(row);
    scrollToBottom();

    return row;
}

function showThinking() {
    welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message assistant thinking-message";

    row.innerHTML = `
        <div class="message-avatar">
            <img src="/static/osam-logo.png"
                 alt="OSAM AI"
                 style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
        </div>
        <div class="message-content">
            <div style="color:#aaa;font-size:13px;margin-bottom:8px;">
                OSAM AI is thinking
            </div>
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;

    chat.appendChild(row);
    scrollToBottom();

    return row;
}

function showWelcome() {
    chat.innerHTML = "";
    welcome.style.display = "block";
}

function loadChat(id) {
    if (isGenerating) return;

    const selected = chats.find(c => c.id === id);
    if (!selected) return;

    currentChatId = selected.id;
    history = [...selected.messages];

    chat.innerHTML = "";
    welcome.style.display = "none";

    history.forEach(item => {
        addMessage(item.role, item.content);
    });

    sidebar.classList.remove("open");
}

function resetChat() {
    if (isGenerating) return;

    saveCurrentChat();

    history = [];
    currentChatId = Date.now();
    lastUserMessage = null;

    showWelcome();
    input.value = "";
    input.style.height = "auto";

    sidebar.classList.remove("open");
}

document.getElementById("newChatBtn").onclick = resetChat;

document.getElementById("menuBtn").onclick = () => {
    sidebar.classList.toggle("open");
};

document.querySelectorAll(".suggestion").forEach(button => {
    button.onclick = () => {
        if (isGenerating) return;

        input.value = button.dataset.prompt || "";
        form.requestSubmit();
    };
});

input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height =
        Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

async function requestAI(message, previousHistory) {
    const pending = showThinking();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                history: previousHistory
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

        history.push({
            role: "assistant",
            content: data.reply
        });

        addMessage("assistant", data.reply, {
            allowRegenerate: true
        });

        saveCurrentChat();

    } catch (error) {
        pending.remove();

        addMessage(
            "assistant",
            "Sorry! Something went wrong: " + error.message
        );

        console.error(error);
    }
}

async function sendMessage(message) {
    if (!message || isGenerating) return;

    isGenerating = true;
    send.disabled = true;

    const previous = history.slice(-12);

    addMessage("user", message);

    history.push({
        role: "user",
        content: message
    });

    lastUserMessage = message;

    input.value = "";
    input.style.height = "auto";

    await requestAI(message, previous);

    isGenerating = false;
    send.disabled = false;
    input.focus();
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message || isGenerating) return;

    await sendMessage(message);
});

async function regenerateLastResponse() {
    if (isGenerating) return;

    if (!history.length) return;

    const lastIndex = history.length - 1;

    if (history[lastIndex].role !== "assistant") return;

    const previousUser = history[lastIndex - 1];

    if (!previousUser || previousUser.role !== "user") return;

    const message = previousUser.content;

    history.pop();

    const oldRows = chat.querySelectorAll(".message.assistant");
    if (oldRows.length) {
        oldRows[oldRows.length - 1].remove();
    }

    isGenerating = true;
    send.disabled = true;

    const previous = history.slice(0, -1).slice(-12);

    await requestAI(message, previous);

    isGenerating = false;
    send.disabled = false;
    input.focus();
}

renderHistory();

if (chats.length > 0) {
    loadChat(chats[0].id);
}
