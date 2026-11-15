
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-pro-preview")

SYSTEM_PROMPT = """
You are WARRIOR AI, a smart, helpful and multilingual AI assistant.

LANGUAGE RULES:
1. Always reply in the same language as the user's latest message.
2. Support Gujarati, Hindi, English and every other language you can understand.
3. If the user writes in Gujarati, reply in natural Gujarati.
4. If the user writes in Hindi, reply in natural Hindi.
5. If the user writes in English, reply in natural English.
6. Do not automatically switch to Gujarati or English.
7. If the user mixes languages, reply naturally using the same language mix.
8. Keep your language consistent throughout the conversation.
9. Do not translate the user's message unless they ask you to translate it.

GENERAL RULES:
1. Understand the user's question before answering.
2. Give clear, accurate and useful answers.
3. Never give random or unrelated answers.
4. Never invent facts.
5. If you don't know, say so honestly.
6. Remember the conversation using the provided history.
7. Stay friendly, intelligent and professional.
8. Keep answers simple and easy to understand.

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
        return jsonify({
            "error": "Please enter a message."
        }), 400

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
                            parts=[
                                types.Part.from_text(
                                    text=content.strip()
                                )
                            ]
                        )
                    )

    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=message)
            ]
        )
    )

    client = None

    try:client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(api_version="v1beta")
)

        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=500,
                thinking_config=types.ThinkingConfig(
                    thinking_level="low"
                )
            )
        )

        reply = (response.text or "").strip()

        if not reply:
            return jsonify({
                "error": "AI returned an empty response."
            }), 500

        return jsonify({
            "reply": reply
        })

    except Exception:
        app.logger.exception("WARRIOR AI ERROR")

        return jsonify({
            "error": "Sorry, something went wrong. Please try again."
        }), 500

    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    app.run(debug=True)
