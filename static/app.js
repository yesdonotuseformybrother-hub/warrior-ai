
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
let activeAbortController = null;

function updateComposerState() {
    if (send) send.hidden = isGenerating;
    if (stop) stop.hidden = !isGenerating;
    if (send) send.disabled = isGenerating;
}

const stop = document.getElementById("stopButton");

const STORAGE_KEY = "osam-ai-chats";
const OLD_STORAGE_KEY = "warrior-ai-chats";

// Load saved chats
try {
    const saved =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(OLD_STORAGE_KEY) ||
        "[]";

    chats = JSON.parse(saved);

    if (!Array.isArray(chats)) {
        chats = [];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
} catch (error) {
    console.error("Chat history loading error:", error);
    chats = [];
}

// Save chats
function saveChats() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(chats)
        );
    } catch (error) {
        console.error("Chat saving error:", error);
    }
}

// Save current chat
function saveCurrentChat() {
    if (!history.length) return;

    let current = chats.find(
        item => item.id === currentChatId
    );

    if (!current) {
        const firstUserMessage = history.find(
            item => item.role === "user"
        );

        current = {
            id: currentChatId,
            title: firstUserMessage
                ? firstUserMessage.content.slice(0, 35)
                : "New Chat",
            messages: [...history]
        };

        chats.unshift(current);
    } else {
        current.messages = [...history];
    }

    saveChats();
    renderHistory();
}

// Render chat history
function renderHistory() {
    if (!historyBox) return;

    historyBox.innerHTML = "";

    chats.forEach(item => {
        const button = document.createElement("button");

        button.type = "button";
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

// Scroll chat to bottom
function scrollToBottom() {
    if (!chatArea) return;

    chatArea.scrollTop = chatArea.scrollHeight;
}

// Create action button
function makeButton(label, title, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.title = title;

    button.style.cssText = `
        background:transparent;
        color:#aaa;
        border:0;
        border-radius:7px;
        padding:6px 9px;
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

// Copy response
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

// Add message to chat
function addMessage(role, text, options = {}) {
    if (welcome) {
        welcome.style.display = "none";
    }

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

        const copyButton = makeButton(
            "Copy",
            "Copy response",
            () => copyText(paragraph.textContent, copyButton)
        );

        actions.appendChild(copyButton);

        if (options.allowRegenerate !== false) {
            actions.appendChild(
                makeButton(
                    "↻ Regenerate",
                    "Generate another response",
                    regenerateLastResponse
                )
            );
        }

        body.appendChild(actions);
    }

    if (chat) {
        chat.appendChild(row);
    }

    scrollToBottom();

    return { row, paragraph };
}

// Thinking animation
function showThinking() {
    if (welcome) {
        welcome.style.display = "none";
    }

    const row = document.createElement("div");
    row.className = "message assistant";

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";

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

    const body = document.createElement("div");
    body.className = "message-content";

    const label = document.createElement("div");
    label.textContent = "OSAM AI is thinking...";
    label.style.cssText = `
        color:#aaa;
        font-size:13px;
        margin-bottom:8px;
    `;

    const dots = document.createElement("div");
    dots.className = "thinking-dots";

    for (let i = 0; i < 3; i++) {
        dots.appendChild(document.createElement("span"));
    }

    body.append(label, dots);
    row.append(avatar, body);

    if (chat) {
        chat.appendChild(row);
    }

    scrollToBottom();

    return row;
}

// Show welcome screen
function showWelcome() {
    if (chat) {
        chat.innerHTML = "";
    }

    if (welcome) {
        welcome.style.display = "block";
    }
}

// Load previous chat
function loadChat(id) {
    if (isGenerating) return;

    const selected = chats.find(
        item => item.id === id
    );

    if (!selected) return;

    currentChatId = selected.id;
    history = [...selected.messages];

    if (chat) {
        chat.innerHTML = "";
    }

    if (welcome) {
        welcome.style.display = "none";
    }

    history.forEach(item => {
        addMessage(item.role, item.content);
    });

    if (sidebar) {
        sidebar.classList.remove("open");
    }
    scrollToBottom();
}

// Start new chat
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

    if (sidebar) {
        sidebar.classList.remove("open");
    }
}

// New chat button
document.getElementById("newChatBtn")?.addEventListener(
    "click",
    resetChat
);

// Mobile menu
document.getElementById("menuBtn")?.addEventListener(
    "click",
    () => {
        sidebar?.classList.toggle("open");
    }
);

// Suggestions
document.querySelectorAll(".suggestion").forEach(button => {
    button.addEventListener("click", () => {
        if (isGenerating || !input || !form) return;

        input.value = button.dataset.prompt || "";
        form.requestSubmit();
    });
});

// Auto resize input
input?.addEventListener("input", () => {
    input.style.height = "auto";

    input.style.height =
        Math.min(input.scrollHeight, 160) + "px";
});

// Enter to send, Shift + Enter for new line
input?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
    }
});

// Stream AI response
async function streamAI(message, previousHistory) {
    const controller = new AbortController();
    activeAbortController = controller;
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
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Request failed.");
        }

        if (!response.body) {
            throw new Error("Streaming is not supported by this browser.");
        }

        pending.remove();
        messageUI = addMessage("assistant", "", { pending: true });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            assistantMessage += decoder.decode(value, { stream: true });
            messageUI.paragraph.textContent = assistantMessage;
            scrollToBottom();
        }

        assistantMessage += decoder.decode();

        if (!assistantMessage.trim()) {
            throw new Error("AI returned an empty response.");
        }

        history.push({ role: "assistant", content: assistantMessage });
        addAssistantActions(messageUI, assistantMessage);
        saveCurrentChat();

    } catch (error) {
        pending.remove();

        if (controller.signal.aborted || error.name === "AbortError") {
            if (assistantMessage.trim()) {
                if (!messageUI) messageUI = addMessage("assistant", "", { pending: true });
                messageUI.paragraph.textContent = assistantMessage + "\n\n*Generation stopped.*";
                history.push({ role: "assistant", content: assistantMessage + "\n\nGeneration stopped." });
                addAssistantActions(messageUI, assistantMessage);
                saveCurrentChat();
            }
            return;
        }

        if (messageUI) messageUI.row.remove();

        console.error("OSAM AI ERROR:", error);
        const errorUI = addMessage(
            "assistant",
            "Sorry, something went wrong: " + error.message
        );
        const retryButton = makeButton(
            "↻ Retry",
            "Retry this message",
            retryLastUserMessage
        );
        errorUI.row.querySelector(".message-content").appendChild(retryButton);
        throw error;
    } finally {
        if (activeAbortController === controller) activeAbortController = null;
    }
}

function addAssistantActions(messageUI, assistantMessage) {
    const body = messageUI.row.querySelector(".message-content");
    const actions = document.createElement("div");
    actions.className = "message-actions";

    const copyButton = makeButton(
        "Copy",
        "Copy response",
        () => copyText(assistantMessage, copyButton)
    );
    actions.appendChild(copyButton);
    actions.appendChild(makeButton(
        "↻ Regenerate",
        "Generate another response",
        regenerateLastResponse
    ));
    body.appendChild(actions);
}

// Retry the most recent unanswered user message.
async function retryLastUserMessage() {
    if (isGenerating) return;

    let userIndex = -1;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].role === "user") {
            userIndex = i;
            break;
        }
    }

    if (userIndex < 0) return;

    const message = history[userIndex].content;
    const previous = history.slice(0, userIndex).slice(-12);

    isGenerating = true;
    updateComposerState();

    try {
        await streamAI(message, previous);
        sessionStorage.removeItem("osam-auto-retry-" + currentChatId);
    } catch (error) {
        console.error("OSAM AI retry failed:", error);
    } finally {
        isGenerating = false;
        updateComposerState();
        input?.focus();
    }
}

// Send message
async function sendMessage(message) {
    if (!message || isGenerating) return;

    isGenerating = true;

    updateComposerState();

    const previous = history.slice(-12);

    addMessage("user", message);

    history.push({
        role: "user",
        content: message
    });

    // Persist the user's prompt immediately so refreshes never erase it.
    saveCurrentChat();

    if (input) {
        input.value = "";
        input.style.height = "auto";
    }

    try {
        await streamAI(message, previous);
    } catch (error) {
        // Keep the user's message in history.
        console.error(error);
    } finally {
        isGenerating = false;

        updateComposerState();

        input?.focus();
    }
}

// Stop the current response immediately.
stop?.addEventListener("click", () => {
    if (activeAbortController) activeAbortController.abort();
});

// Form submit
form?.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input?.value.trim();

    if (!message || isGenerating) return;

    await sendMessage(message);
});

// Regenerate last AI response
async function regenerateLastResponse() {
    if (isGenerating || history.length < 2) return;

    const lastIndex = history.length - 1;

    if (history[lastIndex].role !== "assistant") {
        return;
    }

    const previousUser = history[lastIndex - 1];

    if (!previousUser || previousUser.role !== "user") {
        return;
    }

    const message = previousUser.content;

    // Remove only the old assistant response.
    history.pop();

    const assistantRows = chat
        ? chat.querySelectorAll(".message.assistant")
        : [];

    if (assistantRows.length) {
        assistantRows[assistantRows.length - 1].remove();
    }

    isGenerating = true;

    updateComposerState();

    const previous = history.slice(0, -1).slice(-12);

    try {
        await streamAI(message, previous);
    } catch (error) {
        console.error(error);
    } finally {
        isGenerating = false;

        updateComposerState();

        input?.focus();
        saveCurrentChat();
    }
}

// Initial setup
// Restore the previous conversation without automatically sending old prompts.
// The user can choose Retry manually if a response was interrupted.
renderHistory();

if (chats.length > 0) {
    loadChat(chats[0].id);
} else {
    showWelcome();
}
updateComposerState();
