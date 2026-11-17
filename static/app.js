
const chat = document.getElementById("chatMessages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const send = document.getElementById("sendButton");
const welcome = document.getElementById("welcomeScreen");
const historyBox = document.getElementById("chatHistory");
const chatArea = document.getElementById("chatArea");
const sidebar = document.getElementById("sidebar");
const imagePicker = document.getElementById("imagePicker");
const filePicker = document.getElementById("filePicker");
const cameraPicker = document.getElementById("cameraPicker");
const documentPicker = document.getElementById("documentPicker");
let pendingImage = null;
let pendingDocument = null;
let webSearchEnabled = false;

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
        addAssistantActions({ row, paragraph }, text, options.allowRegenerate !== false);
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
async function streamAI(message, previousHistory, image = null, attachment = null, searchWeb = false) {
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
                history: previousHistory,
                image,
                attachment,
                search_web: searchWeb
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

function speakResponse(text) {
    if (!("speechSynthesis" in window)) { alert("Voice playback is not supported in this browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "gu-IN";
    window.speechSynthesis.speak(utterance);
}

function getResponseSources(text) {
    const match = String(text || "").match(/(?:^|\n)Sources:\s*([\s\S]*)$/i);
    if (!match) return [];
    const urls = match[1].match(/https?:\/\/[^\s<>"')]+/g) || [];
    return [...new Set(urls)].map(url => {
        const cleanUrl = url.replace(/[.,;]+$/, "");
        const line = match[1].split(cleanUrl)[0].split("\n").pop().replace(/^\s*[-*]\s*/, "").replace(/:\s*$/, "").trim();
        return { url: cleanUrl, title: line || new URL(cleanUrl).hostname };
    });
}
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function downloadResponsePdf(text) {
    const popup = window.open("", "_blank", "width=850,height=700");
    if (!popup) { alert("Please allow pop-ups to save this response as PDF."); return; }
    popup.onload = () => { popup.focus(); popup.print(); };
    popup.document.write("<!doctype html><html><head><meta charset='utf-8'><title>OSAM AI response</title><style>body{font:15px/1.7 Arial,sans-serif;color:#222;max-width:760px;margin:40px auto;padding:0 28px}h1{font-size:22px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}footer{margin-top:35px;color:#777;font-size:11px}@media print{body{margin:15mm auto}}</style></head><body><h1>OSAM AI</h1><pre>" + escapeHtml(text) + "</pre><footer>Generated with OSAM AI</footer></body></html>");
    popup.document.close();
}
function addAssistantActions(messageUI, assistantMessage, allowRegenerate = true) {
    const body = messageUI.row.querySelector(".message-content");
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copyButton = makeButton("Copy", "Copy response", () => copyText(assistantMessage, copyButton));
    actions.appendChild(copyButton);
    let feedback = "";
    const likeButton = makeButton("👍", "Like", () => {
        feedback = feedback === "like" ? "" : "like";
        likeButton.classList.toggle("selected", feedback === "like");
        dislikeButton.classList.toggle("selected", feedback === "dislike");
        likeButton.setAttribute("aria-pressed", String(feedback === "like"));
        dislikeButton.setAttribute("aria-pressed", String(feedback === "dislike"));
    });
    const dislikeButton = makeButton("👎", "Dislike", () => {
        feedback = feedback === "dislike" ? "" : "dislike";
        dislikeButton.classList.toggle("selected", feedback === "dislike");
        likeButton.classList.toggle("selected", feedback === "like");
        dislikeButton.setAttribute("aria-pressed", String(feedback === "dislike"));
        likeButton.setAttribute("aria-pressed", String(feedback === "like"));
    });
    actions.append(likeButton, dislikeButton);
    const shareButton = makeButton("Share", "Share response", async () => {
        try {
            if (navigator.share) await navigator.share({ title: "OSAM AI", text: assistantMessage });
            else await copyText(assistantMessage, shareButton);
        } catch (error) {
            if (error.name !== "AbortError") await copyText(assistantMessage, shareButton);
        }
    });
    actions.appendChild(shareButton);
    const sources = getResponseSources(assistantMessage);
    const sourcePanel = document.createElement("div");
    sourcePanel.className = "message-sources";
    sourcePanel.hidden = true;
    if (sources.length) {
        sources.forEach(source => {
            const link = document.createElement("a");
            link.href = source.url; link.target = "_blank"; link.rel = "noopener noreferrer";
            link.textContent = source.title + " — " + source.url;
            sourcePanel.appendChild(link);
        });
    } else {
        const empty = document.createElement("span");
        empty.textContent = "No web sources were attached to this response.";
        sourcePanel.appendChild(empty);
    }
    actions.appendChild(makeButton("Sources" + (sources.length ? " (" + sources.length + ")" : ""), "View sources", () => {
        sourcePanel.hidden = !sourcePanel.hidden;
    }));
    actions.appendChild(makeButton("PDF", "Save response as PDF", () => downloadResponsePdf(assistantMessage)));
    actions.appendChild(makeButton("🔊 Read aloud", "Read response aloud", () => speakResponse(assistantMessage)));
    if (allowRegenerate) actions.appendChild(makeButton("↻ Regenerate", "Generate another response", regenerateLastResponse));
    body.append(actions, sourcePanel);
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
async function sendMessage(message, image = null, attachment = null) {
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
        await streamAI(message, previous, image, attachment, webSearchEnabled);
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

    if ((!message && !pendingImage && !pendingDocument) || isGenerating) return;
    const image = pendingImage;
    const attachment = pendingDocument;
    pendingImage = null;
    pendingDocument = null;
    await sendMessage(message || (image ? "Please describe this image." : "Please read the attached document."), image, attachment);
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


// Free browser voice dictation (availability depends on the browser).
const micButton = document.getElementById("micBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (micButton) {
    if (!SpeechRecognition) {
        micButton.title = "Voice input is not supported in this browser";
        micButton.addEventListener("click", () => alert("Voice input is not supported in this browser. Try Chrome or Edge."));
    } else {
        const recognition = new SpeechRecognition();
        recognition.lang = "gu-IN";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        let listening = false;
        recognition.onstart = () => { listening = true; micButton.textContent = "●"; micButton.title = "Listening..."; };
        recognition.onend = () => { listening = false; micButton.textContent = "♩"; micButton.title = "Voice input"; };
        recognition.onerror = () => { listening = false; micButton.textContent = "♩"; };
        recognition.onresult = event => {
            const spoken = event.results?.[0]?.[0]?.transcript || "";
            if (input) { input.value = (input.value ? input.value + " " : "") + spoken; input.dispatchEvent(new Event("input")); input.focus(); }
        };
        micButton.addEventListener("click", () => {
            if (listening) recognition.stop();
            else { recognition.lang = "gu-IN"; recognition.start(); }
        });
    }
}

// Optional web search toggle.
const webSearchButton = document.getElementById("webSearchBtn");
function setWebSearchEnabled(enabled) {
    webSearchEnabled = Boolean(enabled);
    webSearchButton?.classList.toggle("active", webSearchEnabled);
    webSearchButton?.setAttribute("aria-pressed", String(webSearchEnabled));
    webSearchButton.title = webSearchEnabled ? "Web search is on" : "Turn on web search";
    const menuSearch = document.getElementById("webSearchMenuBtn");
    menuSearch?.classList.toggle("selected", webSearchEnabled);
    menuSearch?.setAttribute("aria-pressed", String(webSearchEnabled));
    if (menuSearch) menuSearch.querySelector("span").textContent = webSearchEnabled ? "Search the web · On" : "Search the web";
}
webSearchButton?.addEventListener("click", () => setWebSearchEnabled(!webSearchEnabled));
document.getElementById("webSearchMenuBtn")?.addEventListener("click", () => {
    setWebSearchEnabled(!webSearchEnabled);
    if (attachMenu) attachMenu.hidden = true;
});
const thinkButton = document.getElementById("thinkBtn");
const thinkingMenuButton = document.getElementById("thinkingMenuBtn");
function setThinkingPreference(enabled) {
    [thinkButton, thinkingMenuButton].forEach(button => {
        if (!button) return;
        button.classList.toggle("active", Boolean(enabled));
        button.setAttribute("aria-pressed", String(Boolean(enabled)));
    });
}
thinkButton?.addEventListener("click", () => setThinkingPreference(!thinkButton.classList.contains("active")));
thinkingMenuButton?.addEventListener("click", () => {
    setThinkingPreference(!thinkButton?.classList.contains("active"));
    if (attachMenu) attachMenu.hidden = true;
});
document.getElementById("libraryMenuBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    alert("OSAM AI Library is not connected yet. Your saved chats remain available in Recents.");
});
document.getElementById("createImageMenuBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    if (input) { input.value = "Create an image: "; input.dispatchEvent(new Event("input")); input.focus(); }
});
document.getElementById("deepResearchMenuBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    setWebSearchEnabled(true);
    if (input) { input.value = "Research this topic in depth and prepare a detailed report: "; input.dispatchEvent(new Event("input")); input.focus(); }
});
document.getElementById("sketchMenuBtn")?.addEventListener("click", () => {
    if (attachMenu) attachMenu.hidden = true;
    if (input) { input.value = "Help me plan and describe a sketch of: "; input.dispatchEvent(new Event("input")); input.focus(); }
});
document.getElementById("voiceModeBtn")?.addEventListener("click", () => {
    alert("Live voice conversations are not connected in OSAM AI yet. Use the microphone button for voice dictation.");
});

// Attachment menu and image selection.
const attachMenu = document.getElementById("attachMenu");
document.getElementById("addBtn")?.addEventListener("click", () => { if (attachMenu) attachMenu.hidden = !attachMenu.hidden; });
document.getElementById("imageUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; filePicker?.click(); });
document.getElementById("cameraUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; cameraPicker?.click(); });
document.getElementById("fileUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; filePicker?.click(); });
document.getElementById("documentUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; documentPicker?.click(); });
async function acceptImage(file) {
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { alert("Please choose a JPG, PNG, or WEBP image."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be 5 MB or smaller."); return; }
    const data = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    pendingImage = { mime_type: file.type, data };
    if (input && !input.value.trim()) { input.value = "Please describe this image."; input.placeholder = "Image attached — ask OSAM AI about it..."; input.dispatchEvent(new Event("input")); }
    if (input) input.focus();
}
imagePicker?.addEventListener("change", () => { acceptImage(imagePicker.files?.[0]); imagePicker.value = ""; });
cameraPicker?.addEventListener("change", () => { acceptImage(cameraPicker.files?.[0]); cameraPicker.value = ""; });
filePicker?.addEventListener("change", async () => {
    const file = filePicker.files?.[0]; filePicker.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) { await acceptImage(file); return; }
    if (/\.pdf$/i.test(file.name) || /\.docx$/i.test(file.name)) { await acceptDocument(file); return; }
    if (file.size > 100000) { alert("For now, text files must be under 100 KB."); return; }
    if (!file.type.startsWith("text/") && !/\.(txt|md|csv)$/i.test(file.name)) {
        alert("Free file reading supports text, Markdown, and CSV files. Use Add document for PDF or DOCX.");
        return;
    }
    const text = await file.text();
    if (input) {
        input.value += (input.value ? "\n\n" : "") + "Please read this file (" + file.name + "):\n" + text;
        input.dispatchEvent(new Event("input"));
        input.focus();
    }
});
async function acceptDocument(file) {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isDocx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name);
    if (!isPdf && !isDocx) { alert("Choose a PDF or DOCX document."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Documents must be 5 MB or smaller."); return; }
    const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
    pendingDocument = {
        mime_type: isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name: file.name,
        data
    };
    if (input && !input.value.trim()) {
        input.value = "Please read this document.";
        input.placeholder = "Document attached — ask OSAM AI about it...";
        input.dispatchEvent(new Event("input"));
    }
    if (input) input.focus();
}
documentPicker?.addEventListener("change", async () => {
    const file = documentPicker.files?.[0]; documentPicker.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) { await acceptImage(file); return; }
    if (/\.pdf$/i.test(file.name) || /\.docx$/i.test(file.name)) {
        await acceptDocument(file);
        return;
    }
    if (file.size > 100000) { alert("Text documents must be under 100 KB."); return; }
    if (!file.type.startsWith("text/") && !/\.(txt|md|csv)$/i.test(file.name)) {
        alert("Choose a PDF, DOCX, TXT, MD, or CSV document.");
        return;
    }
    const text = await file.text();
    if (input) {
        input.value += (input.value ? "\n\n" : "") + "Please read this document (" + file.name + "):\n" + text;
        input.dispatchEvent(new Event("input"));
        input.focus();
    }
});

// Export browser-stored conversations as a backup file.
document.getElementById("libraryBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(chats, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "osam-ai-chats-backup.json"; a.click();
    URL.revokeObjectURL(url);
});

let isPublicSharedView = false;
function encodeShareData(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = "";
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodeShareData(value) {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
}
async function createPublicChatLink(button) {
    if (!history.length) { alert("Start a chat first, then create its public link."); return; }
    const shared = {
        title: (history.find(item => item.role === "user")?.content || "OSAM AI chat").slice(0, 80),
        messages: history.map(item => ({ role: item.role, content: String(item.content || "") }))
    };
    const url = new URL(window.location.href);
    url.hash = "share=" + encodeShareData(shared);
    try {
        await navigator.clipboard.writeText(url.toString());
        const oldLabel = button.textContent; button.textContent = "Link copied ✓";
        setTimeout(() => button.textContent = oldLabel, 2200);
    } catch { window.prompt("Copy this public chat link:", url.toString()); }
}
function openPublicSharedChat() {
    const match = window.location.hash.match(/^#share=([A-Za-z0-9_-]+)$/);
    if (!match) return false;
    try {
        const shared = decodeShareData(match[1]);
        if (!shared || !Array.isArray(shared.messages) || shared.messages.length > 200) return false;
        if (!shared.messages.every(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")) return false;
        isPublicSharedView = true; history = shared.messages;
        if (chat) chat.innerHTML = "";
        if (welcome) welcome.style.display = "none";
        history.forEach(item => addMessage(item.role, item.content, { allowRegenerate: false }));
        const composer = document.querySelector(".composer-dock"); if (composer) composer.hidden = true;
        const newChat = document.getElementById("newChatBtn"); if (newChat) newChat.disabled = true;
        const shareButton = document.getElementById("publicShareBtn");
        if (shareButton) { shareButton.textContent = "Public chat"; shareButton.disabled = true; }
        document.title = (shared.title || "Shared chat") + " — OSAM AI";
        scrollToBottom(); return true;
    } catch (error) { console.error("Invalid shared chat link", error); return false; }
}
document.getElementById("publicShareBtn")?.addEventListener("click", event => {
    if (!isPublicSharedView) createPublicChatLink(event.currentTarget);
});
// Initial setup
// Start with a clean chat screen. Saved conversations remain in the sidebar
// and open only when the user selects one; old prompts are never replayed.
renderHistory();
showWelcome();
updateComposerState();
openPublicSharedChat();


