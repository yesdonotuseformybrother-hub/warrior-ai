
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

SYSTEM_PROMPT = """
You are OSAM AI, an intelligent, friendly and helpful AI assistant.

IDENTITY:
- Your name is OSAM AI.
- Be helpful, clear, intelligent and respectful.
- Never claim to be ChatGPT.

LANGUAGE:
- Reply in the same language as the latest user message.
- Understand Gujarati, Hindi, English and other languages.
- Support natural mixed-language conversations.
- Do not translate unless requested.

INTELLIGENCE:
- Understand the full question before answering.
- Think carefully and give accurate answers.
- Explain difficult topics in simple steps.
- Help with maths, science, coding, writing and general knowledge.

GENERAL RULES:
- Give clear and useful answers.
- Do not invent facts.
- If you do not know something, say so honestly.
- Remember the conversation using the provided chat history.
- Keep answers simple and easy to understand.
"""

# Message limits
MAX_MESSAGE_CHARS = 12000
MAX_HISTORY_MESSAGES = 10
MAX_HISTORY_ITEM_CHARS = 3000
MAX_HISTORY_TOTAL_CHARS = 14000


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():

    data = request.get_json(silent=True) or {}

    message = data.get("message", "")
    history = data.get("history", [])

    if not isinstance(message, str):
        return jsonify({"error": "Invalid message format."}), 400

    message = message.strip()

    if not message:
        return jsonify({"error": "Please enter a message."}), 400

    if len(message) > MAX_MESSAGE_CHARS:
        return jsonify({
            "error": (
                "Your message is too long. "
                "Please shorten it and try again."
            )
        }), 413

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        return jsonify({
            "error": "GEMINI_API_KEY is missing in environment variables."
        }), 500

    if not isinstance(history, list):
        history = []

    contents = []
    total_history_chars = 0

    # Keep only recent conversation messages
    recent_history = history[-MAX_HISTORY_MESSAGES:]

    for item in recent_history:

        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content", "")

        if role not in ["user", "assistant"]:
            continue

        if not isinstance(content, str):
            continue

        content = content.strip()

        if not content:
            continue

        # Avoid sending the current message twice
        if role == "user" and content == message:
            continue

        # Limit individual history message
        content = content[-MAX_HISTORY_ITEM_CHARS:]

        # Limit total history size
        if total_history_chars + len(content) > MAX_HISTORY_TOTAL_CHARS:
            break

        total_history_chars += len(content)

        gemini_role = "model" if role == "assistant" else "user"

        contents.append(
            types.Content(
                role=gemini_role,
                parts=[
                    types.Part.from_text(text=content)
                ]
            )
        )

    # Add latest user message
    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=message)
            ]
        )
    )

    def generate():

        client = None

        try:

            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    api_version="v1beta"
                )
            )

            stream = client.models.generate_content_stream(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=1000,
                    temperature=0.7
                )
            )

            for chunk in stream:

                text = chunk.text

                if text:
                    yield text

        except Exception as error:

            app.logger.exception("OSAM AI ERROR")

            error_text = str(error)

            if "429" in error_text:
                yield "\n\nOSAM AI: API limit reached. Please try again later."

            elif "404" in error_text:
                yield "\n\nOSAM AI: Model not found. Please check GEMINI_MODEL."

            elif "API_KEY" in error_text.upper() or "403" in error_text:
                yield "\n\nOSAM AI: API key error. Please check your API key."

            else:
                yield "\n\nOSAM AI: Something went wrong. Please try again."

        finally:

            if client is not None:
                try:
                    client.close()
                except Exception:
                    pass

    return Response(
        stream_with_context(generate()),
        mimetype="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False
    )
