const chat = document.getElementById("chat");
const form = document.getElementById("form");
const input = document.getElementById("message");
const send = document.getElementById("send");

let history = [];
try { history = JSON.parse(localStorage.getItem("my-ai-history") || "[]"); }
catch { history = []; }

function addMessage(role, text) {
  document.getElementById("welcome")?.remove();
  const row = document.createElement("div");
  row.className = "message";
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";
  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;
  row.append(avatar, body);
  chat.append(row);
  chat.scrollTop = chat.scrollHeight;
  return row;
}

history.forEach(item => addMessage(item.role, item.content));

function resetChat() {
  history = [];
  localStorage.removeItem("my-ai-history");
  chat.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="star">✦</div>
      <h1>How can I help you today?</h1>
      <p>Ask a question, learn something new, or get help with code.</p>
      <div class="examples">
        <button>Explain Python in simple words.</button>
        <button>Help me understand a math problem.</button>
        <button>Write a simple HTML website for me.</button>
      </div>
    </div>`;
  attachExampleButtons();
}

function attachExampleButtons() {
  document.querySelectorAll(".examples button").forEach(button => {
    button.onclick = () => {
      input.value = button.textContent;
      form.requestSubmit();
    };
  });
}

document.getElementById("new").onclick = resetChat;
document.getElementById("clear").onclick = resetChat;
attachExampleButtons();

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});


form.addEventListener("submit", async event => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message || send.disabled) return;

  addMessage("user", message);

  const previous = history.slice(-12);
  history.push({ role: "user", content: message });

  input.value = "";
  input.style.height = "auto";
  send.disabled = true;

  const pending = addMessage("assistant", "Thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: previous
      })
    });

    const data = await response.json();
    console.log(data);

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    pending.remove();

    // Backend returns "reply", not "answer"
    addMessage("assistant", data.reply);

    history.push({
      role: "assistant",
      content: data.reply
    });

    localStorage.setItem(
      "my-ai-history",
      JSON.stringify(history.slice(-30))
    );

  } catch (error) {
    pending.remove();

    addMessage(
      "assistant",
      "Error: " + error.message
    );

    history.pop();
    console.error(error);

  } finally {
    send.disabled = false;
    input.focus();
  }
});
