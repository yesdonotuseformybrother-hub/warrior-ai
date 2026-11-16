
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

SYSTEM_PROMPT = """
You are OSAM AI, a smart, fast, friendly and helpful AI assistant.

IDENTITY:
- Your name is OSAM AI.
- Never claim to be ChatGPT.
- Be intelligent, natural and respectful.

LANGUAGE:
- Reply in the same language as the user's latest message.
- Understand Gujarati, Hindi, English and mixed languages.
- Use natural Gujarati when the user speaks Gujarati.
- Never translate unless requested.

ANSWER QUALITY:
- Understand the user's complete question.
- Give accurate, useful and direct answers.
- Keep simple answers short and clear.
- Explain difficult topics step by step.
- For coding requests, provide working code.
- Use headings and lists when useful.
- Never invent facts.
- Admit honestly when you do not know something.

CONVERSATION:
- Remember the conversation using the provided history.
- Understand follow-up questions using previous messages.
- Do not repeat unnecessary information.
- Be friendly and helpful.
"""

MAX_MESSAGE_CHARS = 12000
MAX_HISTORY_MESSAGES = 10
MAX_HISTORY_ITEM_CHARS = 3000
MAX_HISTORY_TOTAL_CHARS = 14000


def get_error_response(error):
    error_text = str(error).upper()

    app.logger.exception("OSAM AI API ERROR")

    if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
        return jsonify({
            "error": "Gemini API free limit reached. Please try again later."
        }), 429

    if "404" in error_text or "NOT_FOUND" in error_text:
        return jsonify({
            "error": "Gemini model not found. Check your GEMINI_MODEL setting."
        }), 404

    if (
        "API_KEY" in error_text
        or "403" in error_text
        or "401" in error_text
        or "PERMISSION_DENIED" in error_text
    ):
        return jsonify({
            "error": "Gemini API key or permission error. Check your API key."
        }), 401

    return jsonify({
        "error": "OSAM AI could not connect to Gemini. Please try again."
    }), 502


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():

    data = request.get_json(silent=True) or {}

    message = data.get("message", "")
    history = data.get("history", [])

    if not isinstance(message, str):
        return jsonify({
            "error": "Invalid message format."
        }), 400

    message = message.strip()

    if not message:
        return jsonify({
            "error": "Please enter a message."
        }), 400

    if len(message) > MAX_MESSAGE_CHARS:
        return jsonify({
            "error": "Message is too long."
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

    for item in history[-MAX_HISTORY_MESSAGES:]:

        if not isinstance(item, dict):
            continue

        role = item.get("role")
        content = item.get("content", "")

        if role not in ["user", "assistant"]:
            continue

        if not isinstance(content, str):
            continue

        content = content.strip()

        if not content or (role == "user" and content == message):
            continue

        content = content[-MAX_HISTORY_ITEM_CHARS:]

        if total_history_chars + len(content) > MAX_HISTORY_TOTAL_CHARS:
            break

        total_history_chars += len(content)

        contents.append(
            types.Content(
                role="model" if role == "assistant" else "user",
                parts=[
                    types.Part.from_text(text=content)
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
                max_output_tokens=800,
                temperature=0.7
            )
        )

        iterator = iter(stream)

        # Get the first chunk before starting the HTTP response.
        # This allows initial API errors to return proper HTTP status codes.
        first_chunk = next(iterator, None)

    except Exception as error:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass

        return get_error_response(error)

    def generate():

        try:
            if first_chunk and first_chunk.text:
                yield first_chunk.text

            for chunk in iterator:
                if chunk.text:
                    yield chunk.text

        except Exception:
            app.logger.exception("OSAM AI STREAM ERROR")

            yield (
                "\n\nOSAM AI: The connection was interrupted. "
                "Please try again."
            )

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
        debug=False,
        threaded=True
    )
