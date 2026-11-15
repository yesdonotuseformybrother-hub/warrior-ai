
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

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

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return jsonify({
            "error": "GEMINI_API_KEY missing in environment variables."
        }), 500

    contents = []

    if isinstance(history, list):
        for item in history[-12:]:

            if not isinstance(item, dict):
                continue

            role = item.get("role")
            content = item.get("content", "")

            if role in ["user", "assistant"] and isinstance(content, str):
                if content.strip():
                    gemini_role = "model" if role == "assistant" else "user"

                    contents.append(
                        types.Content(
                            role=gemini_role,
                            parts=[types.Part.from_text(text=content.strip())]
                        )
                    )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        )
    )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=700,
                temperature=0.3
            )
        )

        reply = (response.text or "").strip()
        client.close()

        if not reply:
            return jsonify({
                "error": "AI returned an empty response."
            }), 500

        return jsonify({"reply": reply})

    except Exception as e:
        app.logger.exception("WARRIOR AI ERROR")

        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
