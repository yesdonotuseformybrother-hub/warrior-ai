
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("OPENAI_MODEL", "gpt-5")

SYSTEM_PROMPT = """
You are WARRIOR AI, a smart and helpful AI assistant.

RULES:
1. Understand the user's question before answering.
2. Always reply in the same language as the user.
3. Speak natural Gujarati, Hindi and English.
4. Give clear, accurate and useful answers.
5. Never give random or unrelated answers.
6. Never invent facts.
7. If you don't know, say so honestly.
8. Remember the conversation using the provided history.
9. Stay friendly, intelligent and professional.
10. Keep answers simple and easy to understand.

Your name is WARRIOR AI.
"""

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():

    data = request.get_json(silent=True) or {}

    message = data.get("message", "").strip()
    history = data.get("history", [])

    if not message:
        return jsonify({"error": "Please enter a message."}), 400

    if not os.getenv("OPENAI_API_KEY"):
        return jsonify({
            "error": "OPENAI_API_KEY missing in .env file"
        }), 500

    messages = []

    if isinstance(history, list):
        for item in history[-12:]:

            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content", "")

            if role in ["user", "assistant"] and isinstance(content, str):
                if content.strip():
                    messages.append({
                        "role": role,
                        "content": content.strip()
                    })

    messages.append({
        "role": "user",
        "content": message
    })

    try:
        client = OpenAI()

        response = client.responses.create(
            model=MODEL,
            instructions=SYSTEM_PROMPT,
            input=messages,
            max_output_tokens=700
        )

        reply = response.output_text.strip()

        if not reply:
            return jsonify({
                "error": "AI returned an empty response"
            }), 500

        return jsonify({
            "reply": reply
        })

    except Exception as e:
        app.logger.exception("WARRIOR AI ERROR")

        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
