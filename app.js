const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("message");
const send = document.getElementById("send");

const STORAGE_KEY = "warrior-ai-history";
let history = [];
let currentLanguage = "en";

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  history = Array.isArray(saved) ? saved.filter(item =>
    item && ["user", "assistant"].includes(item.role) && typeof item.content === "string"
  ) : [];
} catch {
  history = [];
}

function showWelcome() {
  chat.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-symbol">✦</div>
      <p class="eyebrow">WELCOME TO WARRIOR AI</p>
      <h1>આજે હું તમને<br><span>શું મદદ કરી શકું?</span></h1>
      <p class="welcome-copy">પ્રશ્ન પૂછો, કંઈક નવું શીખો અથવા તમારા કામમાં મદદ મેળવો.</p>
      <div class="suggestions">
        <button type="button">ગુજરાતીમાં સરળ રીતે સમજાવો.</button>
        <button type="button">મારી માટે એક સુંદર વેબસાઇટ બનાવો.</button>
        <button type="button">મને YouTube માટે નવા વિચારો આપો.</button>
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

  const previous = history.slice(-12);
  addMessage("user", message);
  history.push({ role: "user", content: message });
  saveHistory();

  input.value = "";
  input.style.height = "auto";
  send.disabled = true;

  const pending = addMessage("assistant", "જવાબ તૈયાર થઈ રહ્યો છે...");

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
      throw new Error("AI તરફથી ખાલી જવાબ મળ્યો.");
    }

    pending.remove();
    history.push({ role: "assistant", content: data.reply });
    saveHistory();
    addMessage("assistant", data.reply);
  } catch (error) {
    pending.remove();
    history.pop();
    saveHistory();
    addMessage("assistant", "માફ કરશો, અત્યારે જવાબ મેળવી શકાયો નથી.\n" + error.message);
    console.error("WARRIOR AI request error:", error);
  } finally {
    send.disabled = false;
    input.focus();
  }
});
