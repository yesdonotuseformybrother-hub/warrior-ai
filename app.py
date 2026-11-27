
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from google import genai
from google.genai import types
from dotenv import load_dotenv
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo
import base64
from io import BytesIO
from docx import Document

load_dotenv()

app = Flask(__name__)

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash").strip()
SEARCH_MODEL = os.getenv("GEMINI_SEARCH_MODEL", "gemini-2.5-flash").strip()

SYSTEM_PROMPT = """
You are OSAM AI, an intelligent, accurate, thoughtful and helpful AI assistant.

IDENTITY:
- Your name is OSAM AI.
- Your creator and developer is Adit Dineshbhai Chauhan.
- If asked who created, made, built, founded or developed OSAM AI, answer clearly: "OSAM AI was created and developed by Adit Dineshbhai Chauhan."
- If asked in Gujarati, answer naturally: "OSAM AI ના નિર્માતા Adit Dineshbhai Chauhan છે."
- If asked in Hindi, answer naturally in Hindi and include the exact name "Adit Dineshbhai Chauhan".
- Do not attribute OSAM AI to anyone else. Do not claim this makes the creator the developer of other AI systems.
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


def is_quota_error(error):
    error_text = f"{error.__class__.__name__} {error}".upper()
    return "429" in error_text or "RESOURCE_EXHAUSTED" in error_text


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


@app.route("/robots.txt")
def robots_txt():
    return Response(
        "User-agent: *\nAllow: /\nSitemap: https://warrior-ai.onrender.com/sitemap.xml\n",
        mimetype="text/plain"
    )


@app.route("/sitemap.xml")
def sitemap_xml():
    return Response(
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        '<url><loc>https://warrior-ai.onrender.com/</loc></url>'
        '</urlset>',
        mimetype="application/xml"
    )


@app.route("/google049e1da4d4f9abc3.html")
def google_site_verification():
    return Response(
        "google-site-verification: google049e1da4d4f9abc3.html",
        mimetype="text/html"
    )


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():

    data = request.get_json(silent=True) or {}

    message = data.get("message", "")
    history = data.get("history", [])
    search_web = data.get("search_web") is True
    response_language = data.get("response_language", "auto")
    language_instructions = {"gu": "Reply only in Gujarati.", "en": "Reply only in English.", "hi": "Reply only in Hindi."}
    selected_language_instruction = language_instructions.get(response_language, "")
    current_ist = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%A, %d %B %Y, %I:%M:%S %p IST")
    live_time_instruction = "\n\nLIVE CURRENT DATE AND TIME: " + current_ist + ". Use this as current India time when asked about date or time."

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

    user_parts = [types.Part.from_text(text=message)]
    image = data.get("image")
    if image is not None:
        if not isinstance(image, dict):
            return jsonify({"error": "Invalid image attachment."}), 400
        mime_type = image.get("mime_type", "")
        encoded_image = image.get("data", "")
        if mime_type not in ("image/jpeg", "image/png", "image/webp"):
            return jsonify({"error": "Please attach a JPG, PNG, or WEBP image."}), 400
        if not isinstance(encoded_image, str) or len(encoded_image) > 7_000_000:
            return jsonify({"error": "Image is too large. Maximum size is 5 MB."}), 413
        try:
            image_bytes = base64.b64decode(encoded_image, validate=True)
        except Exception:
            return jsonify({"error": "The image could not be read."}), 400
        if not image_bytes or len(image_bytes) > 5 * 1024 * 1024:
            return jsonify({"error": "Image is too large. Maximum size is 5 MB."}), 413
        user_parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    attachment = data.get("attachment")
    if attachment is not None:
        if not isinstance(attachment, dict):
            return jsonify({"error": "Invalid document attachment."}), 400
        mime_type = attachment.get("mime_type", "")
        encoded_file = attachment.get("data", "")
        file_name = str(attachment.get("name", "attached document"))[:160]
        docx_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if mime_type not in ("application/pdf", docx_type):
            return jsonify({"error": "Only PDF and DOCX documents are supported here."}), 400
        if not isinstance(encoded_file, str) or len(encoded_file) > 7_000_000:
            return jsonify({"error": "Document is too large. Maximum size is 5 MB."}), 413
        try:
            file_bytes = base64.b64decode(encoded_file, validate=True)
        except Exception:
            return jsonify({"error": "The document could not be read."}), 400
        if not file_bytes or len(file_bytes) > 5 * 1024 * 1024:
            return jsonify({"error": "Document is too large. Maximum size is 5 MB."}), 413
        if mime_type == "application/pdf":
            user_parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime_type))
        else:
            try:
                doc = Document(BytesIO(file_bytes))
                extracted = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                for table in doc.tables:
                    for row in table.rows:
                        extracted += "\n" + " | ".join(cell.text for cell in row.cells)
                if not extracted.strip():
                    extracted = "The Word document contains no extractable text."
                user_parts.append(types.Part.from_text(
                    text=f"Contents of attached Word document ({file_name}):\n{extracted[:100000]}"
                ))
            except Exception:
                return jsonify({"error": "The Word document could not be opened. Please upload a valid DOCX file."}), 400

    contents.append(types.Content(role="user", parts=user_parts))

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
        models_to_try = [SEARCH_MODEL] if search_web else [MODEL]
        if search_web:
            # If search grounding is quota-limited on its model, try the
            # primary chat model with the same Google Search tool.
            if MODEL and MODEL != SEARCH_MODEL:
                models_to_try.append(MODEL)
        elif FALLBACK_MODEL and FALLBACK_MODEL != MODEL:
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

                    config_options = {
                        "system_instruction": SYSTEM_PROMPT + live_time_instruction + ("\n\nUSER SELECTED LANGUAGE: " + selected_language_instruction if selected_language_instruction else ""),
                        "max_output_tokens": 2000,
                        "temperature": 0.3
                    }
                    if search_web:
                        config_options["tools"] = [
                            types.Tool(google_search=types.GoogleSearch())
                        ]
                    stream = client.models.generate_content_stream(
                        model=selected_model,
                        contents=contents,
                        config=types.GenerateContentConfig(**config_options)
                    )

                    iterator = iter(stream)

                    # Wait for the first chunk before sending HTTP response.
                    first_chunk = next(iterator, None)
                    if first_chunk is None:
                        raise RuntimeError("Gemini returned an empty response stream.")
                    break

                except Exception as error:
                    temporary = is_temporary_error(error)
                    quota_limited = is_quota_error(error)

                    if temporary and attempt < attempts - 1:
                        wait_seconds = 2 ** (attempt + 1)
                        app.logger.warning(
                            "Gemini model %s temporarily unavailable. "
                            "Retrying in %s seconds.",
                            selected_model,
                            wait_seconds
                        )
                        time.sleep(wait_seconds)
                        continue

                    if model_index < len(models_to_try) - 1 and (temporary or quota_limited):
                        app.logger.warning(
                            "Gemini model %s unavailable or quota-limited; "
                            "switching to fallback %s.",
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

        sources = {}

        def collect_sources(chunk):
            if not search_web or chunk is None:
                return
            for candidate in getattr(chunk, "candidates", None) or []:
                metadata = getattr(candidate, "grounding_metadata", None)
                for item in getattr(metadata, "grounding_chunks", None) or []:
                    web_source = getattr(item, "web", None)
                    uri = getattr(web_source, "uri", None)
                    title = getattr(web_source, "title", None) or uri
                    if uri and uri.startswith(("https://", "http://")):
                        sources[uri] = title

        try:
            collect_sources(first_chunk)
            if first_chunk and first_chunk.text:
                yield first_chunk.text
            if iterator is not None:
                for chunk in iterator:
                    collect_sources(chunk)
                    if chunk.text:
                        yield chunk.text
            if sources:
                yield "\n\nSources:\n" + "\n".join(
                    f"- {title}: {uri}" for uri, title in sources.items()
                )

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


@app.route("/api/image", methods=["POST"])
def generate_or_edit_image():
    data = request.get_json(silent=True) or {}
    prompt = data.get("prompt", "")
    image = data.get("image")
    response_language = data.get("response_language", "auto")
    language_names = {"gu": "Gujarati", "en": "English", "hi": "Hindi"}
    selected_language = language_names.get(response_language)
    if selected_language:
        prompt = f"{prompt.strip()}\\n\\nRespond to the user in {selected_language}. If the generated image contains any text, write that text in {selected_language}. Keep all explanations and labels in {selected_language}."
    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify({"error": "ફોટો બનાવવા માટે સૂચના લખો."}), 400
    if len(prompt) > 4000:
        return jsonify({"error": "સૂચના 4000 અક્ષરથી નાની રાખો."}), 413
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "GEMINI_API_KEY Render માં સેટ નથી."}), 500
    parts = [types.Part.from_text(text=prompt.strip())]
    if image is not None:
        if not isinstance(image, dict):
            return jsonify({"error": "ફોટો યોગ્ય રીતે અપલોડ થયો નથી."}), 400
        mime_type = image.get("mime_type", "")
        encoded = image.get("data", "")
        if mime_type not in ("image/jpeg", "image/png", "image/webp") or not isinstance(encoded, str):
            return jsonify({"error": "JPG, PNG અથવા WEBP ફોટો પસંદ કરો."}), 400
        try:
            raw = base64.b64decode(encoded, validate=True)
        except Exception:
            return jsonify({"error": "ફોટો વાંચી શકાયો નથી."}), 400
        if not raw or len(raw) > 5 * 1024 * 1024:
            return jsonify({"error": "ફોટો 5 MBથી નાનો હોવો જોઈએ."}), 413
        parts.append(types.Part.from_bytes(data=raw, mime_type=mime_type))
    client = None
    try:
        client = genai.Client(api_key=api_key, http_options=types.HttpOptions(api_version="v1beta", timeout=180000))
        model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image").strip()
        response = client.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=parts)],
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"])
        )
        for candidate in (getattr(response, "candidates", None) or []):
            for part in (getattr(getattr(candidate, "content", None), "parts", None) or []):
                inline = getattr(part, "inline_data", None)
                if inline and getattr(inline, "data", None):
                    return jsonify({"image": base64.b64encode(inline.data).decode("ascii"), "mime_type": getattr(inline, "mime_type", None) or "image/png", "text": getattr(part, "text", None) or "તમારો ફોટો તૈયાર છે."})
        return jsonify({"error": "AI એ ફોટો આપ્યો નથી. બીજી સૂચના સાથે પ્રયાસ કરો."}), 502
    except Exception as error:
        app.logger.exception("OSAM AI IMAGE GENERATION ERROR")
        message = str(error).upper()
        if "429" in message or "RESOURCE_EXHAUSTED" in message:
            return jsonify({
                "error": "ફ્રી Gemini image quota પૂરો થયો છે. થોડા સમય પછી ફરી પ્રયાસ કરો."
            }), 429
        if "404" in message or "NOT_FOUND" in message:
            return jsonify({"error": "Image model ઉપલબ્ધ નથી. GEMINI_IMAGE_MODEL setting તપાસો."}), 404
        if "403" in message or "401" in message or "PERMISSION_DENIED" in message:
            return jsonify({"error": "આ API key પાસે image generation ની પરવાનગી નથી."}), 401
        return jsonify({"error": "ફોટો બની શક્યો નથી: " + str(error)[:250]}), 502
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=False,
        threaded=True
    )
