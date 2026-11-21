
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
let lastUploadedImage = null;
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

// Render chat history with an individual delete action
function renderHistory() {
    if (!historyBox) return;

    historyBox.innerHTML = "";

    if (!chats.length) {
        const empty = document.createElement("p");
        empty.className = "empty-text";
        empty.textContent = "Your recent chats will appear here";
        historyBox.appendChild(empty);
        return;
    }

    chats.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-row";
        row.style.cssText = "display:flex;align-items:center;gap:4px;width:100%;margin-bottom:5px;";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "history-item";
        button.textContent = item.title || "New Chat";
        button.title = item.title || "New Chat";
        button.style.cssText = "display:block;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;padding:10px 8px;margin:0;border:0;border-radius:8px;background:transparent;color:#ccc;cursor:pointer;font-size:13px;";
        button.onmouseenter = () => { button.style.background = "#303030"; };
        button.onmouseleave = () => { button.style.background = "transparent"; };
        button.onclick = () => loadChat(item.id);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "history-delete-btn";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete chat";
        deleteButton.setAttribute("aria-label", "Delete chat: " + (item.title || "New Chat"));
        deleteButton.style.cssText = "flex:0 0 32px;width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:#999;font-size:20px;cursor:pointer;opacity:.75;";
        deleteButton.onmouseenter = () => { deleteButton.style.background = "#3a2020"; deleteButton.style.color = "#ff7777"; };
        deleteButton.onmouseleave = () => { deleteButton.style.background = "transparent"; deleteButton.style.color = "#999"; };
        deleteButton.onclick = (event) => {
            event.stopPropagation();
            const title = item.title || "New Chat";
            if (!window.confirm('Delete "' + title + '"? This cannot be undone.')) return;

            chats = chats.filter(chatItem => chatItem.id !== item.id);
            saveChats();

            if (currentChatId === item.id) {
                history = [];
                currentChatId = Date.now();
                lastUploadedImage = null;
                showWelcome();
            }
            renderHistory();
        };

        row.append(button, deleteButton);
        historyBox.appendChild(row);
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
    if (options.image && options.image.data && options.image.mime_type) {
        const preview = document.createElement("img");
        preview.src = "data:" + options.image.mime_type + ";base64," + options.image.data;
        preview.alt = "Uploaded photo";
        preview.loading = "lazy";
        preview.style.cssText = "display:block;max-width:min(260px,100%);max-height:260px;object-fit:contain;border-radius:14px;margin-top:10px;border:1px solid rgba(255,255,255,.12);";
        body.appendChild(preview);
    }
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
    lastUploadedImage = null;

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

    // Route direct photo-edit requests to the image model, not the text-only chat model.
    const editIntent = /\b(add|insert|put|place|remove|erase|replace|change|edit|modify)\b|monkey|object|background|ફોટો|ચિત્ર|ઉમેર|મૂક|કાઢ|બદલ/i.test(message);
    const sourceImage = image || lastUploadedImage;
    if (editIntent && sourceImage) {
        try {
            const editResponse = await fetch("/api/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: message, image: sourceImage }),
                signal: controller.signal
            });
            const editData = await editResponse.json().catch(() => ({}));
            if (!editResponse.ok) throw new Error(editData.error || "ફોટો એડિટ થઈ શક્યો નથી.");
            if (!editData.image || !editData.mime_type) throw new Error("AI એ એડિટ કરેલો ફોટો આપ્યો નથી.");
            pending.remove();
            assistantMessage = editData.text || "તમારો એડિટ કરેલો ફોટો તૈયાર છે.";
            messageUI = addMessage("assistant", assistantMessage, {
                image: { data: editData.image, mime_type: editData.mime_type }
            });
            history.push({ role: "assistant", content: assistantMessage });
            addAssistantActions(messageUI, assistantMessage);
            const imagePreview = messageUI.row.querySelector(".message-content img");
            if (imagePreview) {
                imagePreview.style.maxWidth = "min(520px, 100%)";
                imagePreview.style.maxHeight = "520px";
                imagePreview.style.cursor = "pointer";
                imagePreview.title = "Tap to open the edited image";
                imagePreview.addEventListener("click", () => window.open(imagePreview.src, "_blank", "noopener"));
                const download = makeButton("Download edited photo", "Download edited photo", () => {
                    const link = document.createElement("a");
                    link.href = imagePreview.src;
                    link.download = "osam-ai-edited-photo.png";
                    link.click();
                });
                messageUI.row.querySelector(".message-content").appendChild(download);
            }
            saveCurrentChat();
            return;
        } catch (error) {
            pending.remove();
            if (error.name !== "AbortError") {
                const errorMessage = error.message || "ફોટો એડિટ થઈ શક્યો નથી. ફરી પ્રયાસ કરો.";
                const errorUI = addMessage("assistant", "ફોટો એડિટ કરવામાં સમસ્યા આવી: " + errorMessage);
                history.push({ role: "assistant", content: "ફોટો એડિટ કરવામાં સમસ્યા આવી: " + errorMessage });
                saveCurrentChat();
            }
        } finally {
            if (activeAbortController === controller) activeAbortController = null;
        }
        return;
    }

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
    if (image) lastUploadedImage = image;

    isGenerating = true;

    updateComposerState();

    const previous = history.slice(-12);

    addMessage("user", message, { image });

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
        micButton.title = "Voice input";
        micButton.addEventListener("click", () => {
            if (window.OsamAndroid && typeof window.OsamAndroid.startVoiceInput === "function") window.OsamAndroid.startVoiceInput();
            else alert("Voice input is not available in this browser. Please open OSAM AI in Chrome and allow microphone access.");
        });
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
            else if (window.OsamAndroid && typeof window.OsamAndroid.startVoiceInput === "function") window.OsamAndroid.startVoiceInput();
            else {
                const lang = localStorage.getItem("osam-setting-voice-language");
                recognition.lang = lang === "en" ? "en-IN" : lang === "hi" ? "hi-IN" : "gu-IN";
                try { recognition.start(); } catch (error) { console.warn("Voice input:", error); }
            }
        });
    }
}

// Optional web search toggle.
const webSearchButton = document.getElementById("webSearchBtn");
webSearchButton?.addEventListener("click", () => {
    webSearchEnabled = !webSearchEnabled;
    webSearchButton.classList.toggle("active", webSearchEnabled);
    webSearchButton.setAttribute("aria-pressed", String(webSearchEnabled));
    webSearchButton.title = webSearchEnabled ? "Web search is on" : "Turn on web search";
});

// Attachment menu and image selection.
const attachMenu = document.getElementById("attachMenu");
document.getElementById("addBtn")?.addEventListener("click", () => { if (attachMenu) attachMenu.hidden = !attachMenu.hidden; });
document.getElementById("imageUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; imagePicker?.click(); });
document.getElementById("cameraUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; cameraPicker?.click(); });
document.getElementById("fileUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; filePicker?.click(); });
document.getElementById("documentUploadBtn")?.addEventListener("click", () => { attachMenu.hidden = true; documentPicker?.click(); });

// Make the three home shortcuts perform useful actions on touch screens too.
document.querySelectorAll("[data-shortcut]").forEach(button => {
    button.addEventListener("click", () => {
        if (!input || !form || isGenerating) return;
        const action = button.dataset.shortcut;
        if (action === "image") {
            openImageStudio();
            return;
        } else if (action === "write") {
            input.value = "Help me write or edit something. Ask me to paste the text or describe what I need, then improve it.";
        } else if (action === "search") {
            webSearchEnabled = true;
            webSearchButton?.classList.add("active");
            webSearchButton?.setAttribute("aria-pressed", "true");
            if (webSearchButton) webSearchButton.title = "Web search is on";
            input.value = "Search the web for: ";
        }
        input.focus();
        input.dispatchEvent(new Event("input"));
        input.setSelectionRange(input.value.length, input.value.length);
    });
});

// Android native speech recognition sends recognized words back here.
window.osamInsertVoiceText = function(spoken) {
    if (!input || !spoken) return;
    input.value = (input.value ? input.value + " " : "") + spoken;
    input.dispatchEvent(new Event("input"));
    input.focus();
};


function openImageStudio() {
    if (document.getElementById("osamImageStudio")) return;
    const modal = document.createElement("div");
    modal.id = "osamImageStudio";
    modal.style.cssText = "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto;";
    modal.innerHTML = '<section style="width:min(620px,100%);max-height:94vh;overflow:auto;background:#202127;color:#fff;border:1px solid #444;border-radius:18px;padding:16px;font:14px system-ui"><header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><strong style="font-size:19px">OSAM AI Image Studio</strong><button id="osamStudioClose" type="button" style="background:#383a43;color:white;border:0;border-radius:9px;padding:9px 13px">✕</button></header><p style="color:#bbb;margin:0 0 12px">નવો ફોટો બનાવો અથવા તમારો ફોટો અપલોડ કરીને AI પાસે એડિટ કરાવો.</p><textarea id="osamImagePrompt" rows="4" placeholder="કેવું ચિત્ર બનાવવું છે અથવા ફોટામાં શું બદલવું છે? ઉદાહરણ: આ ફોટાનું બેકગ્રાઉન્ડ પેરિસ શહેરમાં બદલો..." style="box-sizing:border-box;width:100%;resize:vertical;background:#111318;color:#fff;border:1px solid #555;border-radius:12px;padding:12px;font:15px system-ui"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button id="osamStudioUpload" type="button" style="background:#383a43;color:white;border:0;border-radius:9px;padding:10px 13px">＋ ફોટો અપલોડ કરો</button><button id="osamStudioRemove" type="button" style="background:#383a43;color:white;border:0;border-radius:9px;padding:10px 13px">ફોટો દૂર કરો</button><span id="osamStudioPhotoStatus" style="color:#aaa;align-self:center;font-size:12px"></span></div><div id="osamStudioResult" style="display:none;margin:12px 0"><img id="osamStudioResultImage" alt="OSAM AI generated image" style="display:block;width:100%;max-height:48vh;object-fit:contain;border-radius:12px;background:#111"><button id="osamStudioDownload" type="button" style="width:100%;margin-top:10px;background:#fff;color:#111;border:0;border-radius:10px;padding:12px;font-weight:700">ફોટો ડાઉનલોડ કરો</button></div><p id="osamStudioStatus" role="status" style="color:#bbb;min-height:20px"></p><button id="osamStudioGenerate" type="button" style="width:100%;background:#fff;color:#111;border:0;border-radius:11px;padding:13px;font-weight:700;font-size:15px">✦ ફોટો બનાવો / એડિટ કરો</button><p style="color:#888;font-size:11px;line-height:1.5;margin:12px 0 0">AI ફોટો બનાવવા માટે Gemini image model અને API quota જરૂરી છે.</p></section>';
    document.body.appendChild(modal);
    const prompt = modal.querySelector("#osamImagePrompt");
    const status = modal.querySelector("#osamStudioStatus");
    const generate = modal.querySelector("#osamStudioGenerate");
    const resultBox = modal.querySelector("#osamStudioResult");
    const resultImage = modal.querySelector("#osamStudioResultImage");
    let resultDataUrl = "";
    const refreshPhotoStatus = () => {
        modal.querySelector("#osamStudioPhotoStatus").textContent = pendingImage ? "ફોટો જોડાયેલો છે" : "કોઈ ફોટો જોડ્યો નથી";
    };
    refreshPhotoStatus();
    modal.querySelector("#osamStudioClose").onclick = () => modal.remove();
    modal.querySelector("#osamStudioUpload").onclick = () => imagePicker?.click();
    modal.querySelector("#osamStudioRemove").onclick = () => { pendingImage = null; refreshPhotoStatus(); };
    generate.onclick = async () => {
        const instruction = prompt.value.trim();
        if (!instruction) { status.textContent = "પહેલાં ફોટા વિશે સૂચના લખો."; prompt.focus(); return; }
        generate.disabled = true;
        generate.textContent = "ફોટો બનાવાઈ રહ્યો છે…";
        status.textContent = "AI ફોટો તૈયાર કરી રહ્યું છે. થોડી રાહ જુઓ…";
        resultBox.style.display = "none";
        try {
            const response = await fetch("/api/image", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({prompt: instruction, image: pendingImage})
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || "ફોટો બની શક્યો નથી.");
            if (!data.image) throw new Error("AI તરફથી ફોટો મળ્યો નથી.");
            resultDataUrl = "data:" + (data.mime_type || "image/png") + ";base64," + data.image;
            resultImage.src = resultDataUrl;
            resultBox.style.display = "block";
            status.textContent = data.text || "ફોટો તૈયાર છે!";
            modal.querySelector("#osamStudioDownload").onclick = () => {
                const link = document.createElement("a");
                link.href = resultDataUrl;
                link.download = "OSAM-AI-image." + ((data.mime_type || "").includes("jpeg") ? "jpg" : "png");
                document.body.appendChild(link); link.click(); link.remove();
            };
        } catch (error) {
            status.textContent = error.message || "ફોટો બની શક્યો નથી.";
        } finally {
            generate.disabled = false;
            generate.textContent = "✦ ફરી ફોટો બનાવો / એડિટ કરો";
        }
    };
    modal.addEventListener("click", event => { if (event.target === modal) modal.remove(); });
    prompt.focus();
}

function openFreePhotoEditor(dataUrl) {
    const old = document.getElementById("osamPhotoEditor");
    old?.remove();

    const modal = document.createElement("div");
    modal.id = "osamPhotoEditor";
    modal.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:14px;overflow:auto;";
    modal.innerHTML = '<section style="width:min(560px,100%);max-height:94vh;overflow:auto;background:#202127;color:#fff;border:1px solid #444;border-radius:16px;padding:16px;font:14px system-ui"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><strong style="font-size:18px">OSAM AI Photo Editor</strong><button id="osamEditClose" type="button" style="background:#383a43;color:white;border:0;border-radius:8px;padding:8px 12px">✕</button></div><canvas id="osamEditCanvas" style="width:100%;max-height:48vh;object-fit:contain;background:#111;border-radius:10px"></canvas><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0"><label>Brightness <input id="osamBrightness" type="range" min="50" max="150" value="100" style="width:100%"></label><label>Contrast <input id="osamContrast" type="range" min="50" max="150" value="100" style="width:100%"></label><label>Saturation <input id="osamSaturation" type="range" min="0" max="200" value="100" style="width:100%"></label><label>Grayscale <input id="osamGray" type="range" min="0" max="100" value="0" style="width:100%"></label></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"><button id="osamRotate" type="button" style="padding:9px 12px;border:0;border-radius:8px">↻ Rotate 90°</button><button id="osamReset" type="button" style="padding:9px 12px;border:0;border-radius:8px">Reset</button></div><p style="color:#bbb;font-size:12px">આ મફત એડિટર તમારા ફોનમાં જ કામ કરે છે. Brightness, contrast, રંગ અને rotation બદલી શકો છો.</p><button id="osamApplyEdit" type="button" style="width:100%;padding:12px;background:#fff;color:#111;border:0;border-radius:10px;font-weight:700">ફેરફાર લાગુ કરો</button></section>';
    document.body.appendChild(modal);

    const canvas = modal.querySelector("#osamEditCanvas");
    const ctx = canvas.getContext("2d");
    const image = new Image();
    let rotation = 0;
    image.onload = () => {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        render();
    };
    image.src = dataUrl;

    function render() {
        const angle = ((rotation % 360) + 360) % 360;
        const sideways = angle === 90 || angle === 270;
        canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
        canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(angle * Math.PI / 180);
        ctx.filter = "brightness(" + modal.querySelector("#osamBrightness").value + "%) contrast(" + modal.querySelector("#osamContrast").value + "%) saturate(" + modal.querySelector("#osamSaturation").value + "%) grayscale(" + modal.querySelector("#osamGray").value + "%)";
        ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
        ctx.restore();
    }

    ["osamBrightness","osamContrast","osamSaturation","osamGray"].forEach(id => modal.querySelector("#"+id).addEventListener("input", render));
    modal.querySelector("#osamRotate").addEventListener("click", () => { rotation = (rotation + 90) % 360; render(); });
    modal.querySelector("#osamReset").addEventListener("click", () => {
        rotation = 0;
        modal.querySelector("#osamBrightness").value = 100;
        modal.querySelector("#osamContrast").value = 100;
        modal.querySelector("#osamSaturation").value = 100;
        modal.querySelector("#osamGray").value = 0;
        render();
    });
    modal.querySelector("#osamEditClose").addEventListener("click", () => modal.remove());
    modal.querySelector("#osamApplyEdit").addEventListener("click", async () => {
        const button = modal.querySelector("#osamApplyEdit");
        button.disabled = true;
        button.textContent = "ફોટો તૈયાર થઈ રહ્યો છે…";
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
            if (!blob) throw new Error("ફોટો સેવ થઈ શક્યો નથી.");
            if (blob.size > 5 * 1024 * 1024) throw new Error("એડિટ કરેલો ફોટો 5 MBથી મોટો છે. ગુણવત્તા ઓછી કરો.");
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
                reader.onerror = () => reject(new Error("ફોટો વાંચી શકાયો નથી."));
                reader.readAsDataURL(blob);
            });
            pendingImage = { mime_type: "image/jpeg", data };
            if (input) {
                input.value = "Please describe this edited photo or tell OSAM AI what else you want to do.";
                input.placeholder = "Edited photo ready — write your request...";
                input.dispatchEvent(new Event("input"));
                input.focus();
            }
            modal.remove();
        } catch (error) {
            alert(error.message || "ફોટો સેવ થઈ શક્યો નથી.");
            button.disabled = false;
            button.textContent = "ફેરફાર લાગુ કરો";
        }
    });
}

async function acceptImage(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
        alert("ફોટો પસંદ કરો (JPG, PNG અથવા WEBP).");
        return;
    }
    if (file.size > 20 * 1024 * 1024) {
        alert("ફોટો 20 MBથી નાનો હોવો જોઈએ.");
        return;
    }

    try {
        // Resize and compress large mobile camera photos before upload.
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch {
            throw new Error("આ ફોટો આ બ્રાઉઝરમાં ખૂલી શકતો નથી. Galleryમાંથી JPG અથવા PNG ફોટો પસંદ કરો.");
        }
        const maxSide = 2048;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("ફોટો તૈયાર કરી શકાયો નથી.");
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();

        let blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
        if (!blob) throw new Error("ફોટો તૈયાર કરી શકાયો નથી.");
        if (blob.size > 4.5 * 1024 * 1024) {
            blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
        }
        if (!blob || blob.size > 5 * 1024 * 1024) {
            throw new Error("ફોટો 5 MBથી નાનો કરી શકાયો નથી. નાનો ફોટો પસંદ કરો.");
        }

        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(new Error("ફોટો વાંચી શકાયો નથી."));
            reader.readAsDataURL(blob);
        });
        if (!data) throw new Error("ફોટો ખાલી છે અથવા વાંચી શકાયો નથી.");

        pendingImage = { mime_type: "image/jpeg", data };
        openFreePhotoEditor("data:image/jpeg;base64," + data);
        if (input && !input.value.trim()) {
            input.value = "Please describe this image.";
            input.placeholder = "Image attached — ask OSAM AI about it...";
            input.dispatchEvent(new Event("input"));
        }
        if (input) input.focus();
    } catch (error) {
        console.error("Photo upload error:", error);
        alert(error.message || "ફોટો અપલોડ થઈ શક્યો નથી. ફરી પ્રયાસ કરો.");
    }
}
imagePicker?.addEventListener("change", async () => { await acceptImage(imagePicker.files?.[0]); imagePicker.value = ""; });
cameraPicker?.addEventListener("change", async () => { await acceptImage(cameraPicker.files?.[0]); cameraPicker.value = ""; });
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


