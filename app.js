
const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("message");
const send = document.getElementById("send");

const STORAGE_KEY = "warrior-ai-history";
let history = [];
let currentLanguage = "en";

const uiText = {
  en: {
    welcome: "Hello!",
    heading: "How can I help you today?",
    copy: "Ask me anything in your language.",
    suggestions: [
      "Explain something simply.",
      "Help me create a website.",
      "Give me some creative ideas."
    ],
    placeholder: "Message WARRIOR AI...",
    loading: "Preparing your answer...",
    empty: "Sorry, I couldn't get an answer.",
    emptyReply: "The AI returned an empty reply."
  },
  gu: {
    welcome: "નમસ્તે!",
    heading: "આજે હું તમને શું મદદ કરી શકું?",
    copy: "તમારી ભાષામાં કોઈપણ પ્રશ્ન પૂછો.",
    suggestions: [
      "મને સરળ રીતે સમજાવો.",
      "મારી માટે વેબસાઇટ બનાવો.",
      "મને નવા વિચારો આપો."
    ],
    placeholder: "WARRIOR AI ને મેસેજ લખો...",
    loading: "જવાબ તૈયાર થઈ રહ્યો છે...",
    empty: "માફ કરશો, અત્યારે જવાબ મેળવી શકાયો નથી.",
    emptyReply: "AI તરફથી ખાલી જવાબ મળ્યો."
  },
  hi: {
    welcome: "नमस्ते!",
    heading: "आज मैं आपकी क्या मदद कर सकता हूँ?",
    copy: "अपनी भाषा में कोई भी सवाल पूछें।",
    suggestions: [
      "मुझे आसान भाषा में समझाइए।",
      "मेरे लिए एक वेबसाइट बनाइए।",
      "मुझे नए विचार दीजिए।"
    ],
    placeholder: "WARRIOR AI को संदेश लिखें...",
    loading: "जवाब तैयार हो रहा है...",
    empty: "माफ़ कीजिए, अभी जवाब नहीं मिल पाया।",
    emptyReply: "AI से खाली जवाब मिला।"
  }
};

function detectLanguage(message) {
  if (/[\u0A80-\u0AFF]/.test(message)) return "gu";
  if (/[\u0900-\u097F]/.test(message)) return "hi";
  return "en";
}

function showWelcome() {
  const t = uiText[currentLanguage] || uiText.en;

  chat.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-symbol">✦</div>
      <p class="eyebrow">WELCOME TO WARRIOR AI</p>
      <h1>${t.welcome}<br><span>${t.heading}</span></h1>
      <p class="welcome-copy">${t.copy}</p>
      <div class="suggestions">
        ${t.suggestions.map(item => `<button type="button">${item}</button>`).join("")}
      </div>
    </div>`;

  attachSuggestionButtons();
}

function addMessage(role, text, extraClass = "") {
  document.getElementById("welcome")?.remove();

  const row = document.createElement("div");
  row.className = `message ${role} ${extraClass}`.trim();

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "W";

  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;

  row.append(avatar, body);
  chat.append(row);
  chat.scrollTop = chat.scrollHeight;

  return row;
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30)));
  } catch (error) {
    console.warn("Could not save chat history:", error);
  }
}

function renderHistory() {
  if (!history.length) {
    showWelcome();
    return;
  }

  history.forEach(item => addMessage(item.role, item.content));
}

function resetChat() {
  history = [];
  localStorage.removeItem(STORAGE_KEY);
  showWelcome();
  input.focus();
}

function attachSuggestionButtons() {
  document.querySelectorAll(".suggestions button").forEach(button => {
    button.addEventListener("click", () => {
      input.value = button.textContent.trim();
      form.requestSubmit();
    });
  });
}

document.getElementById("new").addEventListener("click", resetChat);
document.getElementById("clear").addEventListener("click", resetChat);
document.getElementById("mobileNew").addEventListener("click", resetChat);

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

renderHistory();

form.addEventListener("submit", async event => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message || send.disabled) return;

  currentLanguage = detectLanguage(message);

  const previous = history.slice(-12);

  if (document.getElementById("welcome")) {
    showWelcome();
  }

  addMessage("user", message);
  history.push({ role: "user", content: message });
  saveHistory();

  input.value = "";
  input.style.height = "auto";
  input.placeholder = (uiText[currentLanguage] || uiText.en).placeholder;
  send.disabled = true;

  const t = uiText[currentLanguage] || uiText.en;
  const pending = addMessage("assistant", t.loading);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: previous })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error(t.emptyReply);
    }

    pending.remove();
    history.push({ role: "assistant", content: data.reply });
    saveHistory();
    addMessage("assistant", data.reply);

  } catch (error) {
    pending.remove();
    history.pop();
    saveHistory();
    addMessage("assistant", t.empty + "\n" + error.message);
    console.error("WARRIOR AI request error:", error);

  } finally {
    send.disabled = false;
    input.focus();
  }
});
