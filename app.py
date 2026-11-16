
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import time

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()

SYSTEM_PROMPT = """
You are OSAM AI, an intelligent, accurate, thoughtful and helpful AI assistant.

IDENTITY:
- Your name is OSAM AI.
- Never claim to be ChatGPT.
- Be natural, respectful, friendly and professional.
- Prioritize correctness over speed.

LANGUAGE:
- Always reply in the same language as the user's latest message.
- Understand Gujarati, Hindi, English and mixed languages.
- If the user writes Gujarati, reply in natural Gujarati.
- If the user writes Hindi, reply in natural Hindi.
- If the user writes English, reply in natural English.
- Follow the user's language even when conversation history uses another language.
- Do not switch languages unnecessarily.
- Never translate unless requested.

ACCURACY AND HONESTY:
- Understand the complete question before answering.
- Think carefully and check your reasoning before responding.
- Give accurate, relevant and useful information.
- Never invent facts, sources, statistics, links or references.
- Never present guesses as confirmed facts.
- If you are unsure, clearly say that you are unsure.
- If information is missing, ask a clear follow-up question.
- Clearly distinguish facts, estimates and opinions.
- For calculations, carefully verify the result.
- Never pretend to have searched the internet or verified something when you have not.

ANSWER QUALITY:
- Give the most useful answer to the actual question.
- Simple questions should receive clear and concise answers.
- Difficult questions should receive detailed explanations.
- Explain complex topics step by step.
- For coding requests, provide complete and practical code when requested.
- Check code for logical errors before presenting it.
- Use headings, examples and lists when useful.
- Avoid unnecessary repetition and filler.
- Do not sacrifice accuracy just to respond quickly.

CURRENT INFORMATION:
- Do not claim outdated information is current.
- If you do not have access to live information, explain that limitation.
- Never invent current prices, news, schedules or recent events.

CONVERSATION:
- Use the provided conversation history to understand context.
- Understand follow-up questions correctly.
- Remember relevant details from earlier messages in the conversation.
- Do not ask the user to repeat information already provided.
- Be patient and helpful.

IMPORTANT:
A correct and honest answer is more important than a fast answer.
If you do not know something, say so instead of making it up.
"""

MAX_MESSAGE_CHARS = 12000
MAX_HISTORY_MESSAGES = 10
MAX_HISTORY_ITEM_CHARS = 3000
MAX_HISTORY_TOTAL_CHARS = 14000

MAX_RETRIES = 2


def is_temporary_error(error):
    error_text = f"{error.__class__.__name__} {error}".upper()

    return any(marker in error_text for marker in (
        "503", "UNAVAILABLE", "500", "INTERNAL",
        "TIMEOUT", "TIMED OUT", "CONNECTION RESET",
        "CONNECTION ABORTED"
    ))


def get_error_response(error):
    error_text = str(error).upper()

    app.logger.exception("OSAM AI API ERROR")

    if "429" in error_text or "RESOURCE_EXHAUSTED" in error_text:
        return jsonify({
            "error": "Gemini API limit reached. Please try again later."
        }), 429

    if "503" in error_text or "UNAVAILABLE" in error_text:
        return jsonify({
            "error": "Gemini is currently busy. Please try again shortly."
        }), 503

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
                api_version="v1beta",
                timeout=60000
            )
        )

        first_chunk = None
        iterator = None

        # Try the configured model first, then a lighter stable fallback.
        models_to_try = [MODEL]
        if FALLBACK_MODEL and FALLBACK_MODEL != MODEL:
            models_to_try.append(FALLBACK_MODEL)

        for model_index, selected_model in enumerate(models_to_try):
            attempts = MAX_RETRIES if model_index == 0 else 1

            for attempt in range(attempts):
                try:
                    app.logger.info(
                        "OSAM AI request model=%s attempt=%s/%s",
                        selected_model,
                        attempt + 1,
                        attempts
                    )

                    stream = client.models.generate_content_stream(
                        model=selected_model,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=SYSTEM_PROMPT,
                            max_output_tokens=2000,
                            temperature=0.3
                        )
                    )

                    iterator = iter(stream)

                    # Wait for the first chunk before sending HTTP response.
                    first_chunk = next(iterator, None)
                    if first_chunk is None:
                        raise RuntimeError("Gemini returned an empty response stream.")
                    break

                except Exception as error:
                    if not is_temporary_error(error):
                        raise

                    if attempt < attempts - 1:
                        wait_seconds = 2 ** (attempt + 1)
                        app.logger.warning(
                            "Gemini model %s temporarily unavailable. "
                            "Retrying in %s seconds.",
                            selected_model,
                            wait_seconds
                        )
                        time.sleep(wait_seconds)
                        continue

                    if model_index < len(models_to_try) - 1:
                        app.logger.warning(
                            "Primary Gemini model %s unavailable; switching to fallback %s.",
                            selected_model,
                            models_to_try[model_index + 1]
                        )
                        break

                    raise

            if iterator is not None and first_chunk is not None:
                break

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

            if iterator is not None:
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
