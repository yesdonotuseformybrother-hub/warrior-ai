
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
            "error": "GEMINI_API_KEY is missing in Render environment variables."
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
                                types.Part.from_text(text=content.strip())
                            ]
                        )
                    )

    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        )
    )

    def generate():
        client = None

        try:
            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(api_version="v1beta")
            )

            stream = client.models.generate_content_stream(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    max_output_tokens=500
                )
            )

            for chunk in stream:
                text = chunk.text

                if text:
                    yield text

        except Exception:
            app.logger.exception("OSAM AI STREAM ERROR")
            yield "\n\nSorry, something went wrong. Please try again."

        finally:
            if client is not None:
                client.close()

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
    app.run(debug=False)
