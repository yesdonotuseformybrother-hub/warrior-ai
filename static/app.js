
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
            display:block;width:100%;text-align:left;
            padding:11px;margin-bottom:5px;
            border:0;border-radius:8px;
            background:transparent;color:#ccc;
            cursor:pointer;font-size:13px;
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

function makeButton(label, title, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.title = title;

    button.style.cssText = `
        background:transparent;color:#aaa;
        border:0;border-radius:7px;
        padding:6px 9px;font-size:12px;
        cursor:pointer;margin:5px 5px 0 0;
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
    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
        button.textContent = "Copied ✓";
    }

    setTimeout(() => {
        button.textContent = "Copy";
    }, 1800);
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
        logo.style.cssText =
            "width:100%;height:100%;object-fit:cover;border-radius:50%;";
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

        const copyButton = makeButton("Copy", "Copy response", () => {
            copyText(paragraph.textContent, copyButton);
        });

        actions.appendChild(copyButton);

        if (options.allowRegenerate) {
            actions.appendChild(
                makeButton("↻ Regenerate", "Generate another response", () => {
                    regenerateLastResponse();
                })
            );
        }

        body.appendChild(actions);
    }

    chat.appendChild(row);
    scrollToBottom();

    return { row, paragraph };
}

function showThinking() {
    welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message assistant";

    row.innerHTML = `
        <div class="message-avatar">
            <img src="/static/osam-logo.png"
                 alt="OSAM AI"
                 style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
        </div>
        <div class="message-content">
            <div style="color:#aaa;font-size:13px;margin-bottom:8px;">
                OSAM AI is thinking...
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

async function streamAI(message, previousHistory) {
    const pending = showThinking();

    let assistantMessage = "";
    let messageUI = null;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message,
                history: previousHistory
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Request failed.");
        }

        if (!response.body) {
            throw new Error("Streaming is not supported by this browser.");
        }

        pending.remove();

        messageUI = addMessage("assistant", "", {
            pending: true
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();

            if (done) break;

            assistantMessage += decoder.decode(value, {
                stream: true
            });

            messageUI.paragraph.textContent = assistantMessage;
            scrollToBottom();
        }

        assistantMessage += decoder.decode();

        if (!assistantMessage.trim()) {
            throw new Error("AI returned an empty response.");
        }

        history.push({
            role: "assistant",
            content: assistantMessage
        });

        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copyButton = makeButton("Copy", "Copy response", () => {
            copyText(assistantMessage, copyButton);
        });

        actions.appendChild(copyButton);

        actions.appendChild(
            makeButton("↻ Regenerate", "Generate another response", () => {
                regenerateLastResponse();
            })
        );

        messageUI.row.querySelector(".message-content")
            .appendChild(actions);

        saveCurrentChat();

    } catch (error) {
        pending.remove();

        if (messageUI) {
            messageUI.row.remove();
        }

        addMessage("assistant", "Error: " + error.message);
        history.pop();

        console.error("OSAM AI ERROR:", error);
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

    input.value = "";
    input.style.height = "auto";

    await streamAI(message, previous);

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
    if (isGenerating || history.length < 2) return;

    const lastIndex = history.length - 1;

    if (history[lastIndex].role !== "assistant") return;

    const previousUser = history[lastIndex - 1];

    if (!previousUser || previousUser.role !== "user") return;

    const message = previousUser.content;

    history.pop();

    const assistantRows = chat.querySelectorAll(".message.assistant");

    if (assistantRows.length) {
        assistantRows[assistantRows.length - 1].remove();
    }

    isGenerating = true;
    send.disabled = true;

    const previous = history.slice(0, -1).slice(-12);

    await streamAI(message, previous);

    isGenerating = false;
    send.disabled = false;
    input.focus();
}

renderHistory();

if (chats.length > 0) {
    loadChat(chats[0].id);
}
