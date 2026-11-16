
const chat = document.getElementById("chatMessages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const send = document.getElementById("sendButton");
const welcome = document.getElementById("welcomeScreen");
const historyBox = document.getElementById("chatHistory");
const chatArea = document.getElementById("chatArea");
const sidebar = document.getElementById("sidebar");

const STORAGE_KEY = "osam-ai-chats";
const OLD_STORAGE_KEY = "warrior-ai-chats";

const MAX_MESSAGE_LENGTH = 12000;
const MAX_HISTORY = 10;

let history = [];
let chats = [];
let currentChatId = Date.now();
let isGenerating = false;

try {
    chats = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(OLD_STORAGE_KEY) ||
        "[]"
    );

    if (!Array.isArray(chats)) chats = [];
} catch (error) {
    console.error(error);
    chats = [];
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
        console.error("Save error:", error);
    }
}

function saveCurrentChat() {
    if (!history.length) return;

    let current = chats.find(c => c.id === currentChatId);

    if (!current) {
        const first = history.find(m => m.role === "user");

        current = {
            id: currentChatId,
            title: first ? first.content.slice(0, 35) : "New Chat",
            messages: []
        };

        chats.unshift(current);
    }

    current.messages = [...history];
    saveChats();
    renderHistory();
}

function renderHistory() {
    if (!historyBox) return;

    historyBox.innerHTML = "";

    chats.forEach(item => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "history-item";
        button.textContent = item.title || "New Chat";

        button.addEventListener("click", () => loadChat(item.id));

        historyBox.appendChild(button);
    });
}

function scrollToBottom() {
    if (chatArea) {
        chatArea.scrollTop = chatArea.scrollHeight;
    }
}

function makeButton(label, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.className = "message-action-btn";
    button.addEventListener("click", callback);

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

    setTimeout(() => button.textContent = "Copy", 1500);
}

function addMessage(role, text, options = {}) {
    if (welcome) welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message " + role;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    if (role === "assistant") {
        const logo = document.createElement("img");
        logo.src = "/static/osam-logo.png";
        logo.alt = "OSAM AI";
        logo.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";
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

        const copy = makeButton("Copy", () => copyText(paragraph.textContent, copy));
        actions.appendChild(copy);

        body.appendChild(actions);
    }

    chat?.appendChild(row);
    scrollToBottom();

    return { row, paragraph };
}

function showThinking() {
    if (welcome) welcome.style.display = "none";

    const row = document.createElement("div");
    row.className = "message assistant";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

    const logo = document.createElement("img");
    logo.src = "/static/osam-logo.png";
    logo.alt = "OSAM AI";
    logo.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:50%;";

    avatar.appendChild(logo);

    const body = document.createElement("div");
    body.className = "message-content";
    body.textContent = "OSAM AI is thinking...";

    row.append(avatar, body);
    chat?.appendChild(row);
    scrollToBottom();

    return row;
}

function showWelcome() {
    if (chat) chat.innerHTML = "";
    if (welcome) welcome.style.display = "block";
}

function loadChat(id) {
    if (isGenerating) return;

    const selected = chats.find(c => c.id === id);
    if (!selected) return;

    currentChatId = selected.id;
    history = Array.isArray(selected.messages) ? [...selected.messages] : [];

    if (chat) chat.innerHTML = "";
    if (welcome) welcome.style.display = "none";

    history.forEach(item => addMessage(item.role, item.content));

    sidebar?.classList.remove("open");
}

function resetChat() {
    if (isGenerating) return;

    saveCurrentChat();

    history = [];
    currentChatId = Date.now();

    showWelcome();

    if (input) {
        input.value = "";
        input.style.height = "auto";
        input.focus();
    }

    sidebar?.classList.remove("open");
}

document.getElementById("newChatBtn")?.addEventListener("click", resetChat);

document.getElementById("menuBtn")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
});

document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        if (!input || isGenerating) return;

        input.value = button.dataset.prompt || "";
        form?.requestSubmit();
    });
});

input?.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
    }
});

async function streamAI(message, previousHistory) {
    const pending = showThinking();
    let assistantMessage = "";
    let messageUI = null;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
            throw new Error("Streaming is not supported.");
        }

        pending.remove();

        messageUI = addMessage("assistant", "", { pending: true });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const result = await reader.read();

            if (result.done) break;

            assistantMessage += decoder.decode(result.value, { stream: true });

            messageUI.paragraph.textContent = assistantMessage;
            scrollToBottom();
        }

        assistantMessage += decoder.decode();

        if (!assistantMessage.trim()) {
            throw new Error("Empty AI response.");
        }

        history.push({
            role: "assistant",
            content: assistantMessage
        });

        const actions = document.createElement("div");
        actions.className = "message-actions";

        const copy = makeButton("Copy", () => copyText(assistantMessage, copy));
        actions.appendChild(copy);

        const regenerate = makeButton("↻ Regenerate", regenerateLastResponse);
        actions.appendChild(regenerate);

        messageUI.row.querySelector(".message-content").appendChild(actions);

        saveCurrentChat();

    } catch (error) {
        pending.remove();
        messageUI?.row.remove();

        console.error("OSAM AI ERROR:", error);

        addMessage("assistant", "Error: " + error.message);
        throw error;
    }
}

async function sendMessage(message) {
    if (!message || isGenerating) return;

    if (message.length > MAX_MESSAGE_LENGTH) {
        alert("Message too long. Please shorten your message.");
        return;
    }

    isGenerating = true;
    if (send) send.disabled = true;

    const previous = history.slice(-MAX_HISTORY);

    addMessage("user", message);

    history.push({
        role: "user",
        content: message
    });

    if (input) {
        input.value = "";
        input.style.height = "auto";
    }

    try {
        await streamAI(message, previous);
    } catch (error) {
        console.error(error);
    } finally {
        isGenerating = false;
        if (send) send.disabled = false;
        input?.focus();
    }
}

form?.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input?.value.trim();
    if (!message || isGenerating) return;

    await sendMessage(message);
});

async function regenerateLastResponse() {
    if (isGenerating || history.length < 2) return;

    const last = history[history.length - 1];

    if (last.role !== "assistant") return;

    const previousUser = history[history.length - 2];

    if (previousUser.role !== "user") return;

    const message = previousUser.content;

    history.pop();

    const assistantRows = chat?.querySelectorAll(".message.assistant");

    if (assistantRows?.length) {
        assistantRows[assistantRows.length - 1].remove();
    }

    isGenerating = true;
    if (send) send.disabled = true;

    const previous = history.slice(0, -1).slice(-MAX_HISTORY);

    try {
        await streamAI(message, previous);
    } catch (error) {
        console.error(error);
    } finally {
        isGenerating = false;
        if (send) send.disabled = false;
        saveCurrentChat();
        input?.focus();
    }
}

// Attachment menu
const addBtn = document.getElementById("addBtn");
const attachMenu = document.getElementById("attachMenu");

const imagePicker = document.getElementById("imagePicker");
const filePicker = document.getElementById("filePicker");
const cameraPicker = document.getElementById("cameraPicker");
const documentPicker = document.getElementById("documentPicker");

if (addBtn && attachMenu) {
    addBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        attachMenu.hidden = !attachMenu.hidden;
    });

    document.addEventListener("click", event => {
        if (!attachMenu.contains(event.target) && !addBtn.contains(event.target)) {
            attachMenu.hidden = true;
        }
    });

    attachMenu.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const action = button.dataset.action;
        attachMenu.hidden = true;

        const pickers = {
            image: imagePicker,
            file: filePicker,
            camera: cameraPicker,
            document: documentPicker,
            analysis: filePicker
        };

        if (pickers[action]) {
            pickers[action]?.click();
            return;
        }

        if (action === "code" && input) {
            input.value += "Help me write or explain code: ";
            input.focus();
        } else if (action === "voice") {
            document.getElementById("micBtn")?.click();
        } else {
            const messages = {
                web: "Web Search backend integration is not configured yet.",
                "create-image": "Image Generation backend integration is not configured yet.",
                research: "Deep Research backend integration is not configured yet."
            };

            if (messages[action]) alert(messages[action]);
        }
    });
}

// File picker currently adds filenames only.
// Actual file upload needs a separate backend endpoint.
[
    imagePicker,
    filePicker,
    cameraPicker,
    documentPicker
].forEach(picker => {
    picker?.addEventListener("change", () => {
        if (!picker.files?.length || !input) return;

        const names = Array.from(picker.files)
            .map(file => file.name)
            .join(", ");

        input.value += (input.value ? "\n" : "") +
            "[Selected files: " + names + "] ";

        input.focus();
    });
});

// Initial setup
renderHistory();

if (chats.length) {
    loadChat(chats[0].id);
} else {
    showWelcome();
}
