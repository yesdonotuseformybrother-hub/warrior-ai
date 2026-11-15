MY AI WEBSITE — SETUP IN VISUAL STUDIO CODE

1. Extract this ZIP file.
2. Open the extracted folder in Visual Studio Code.
3. Open Terminal > New Terminal.
4. Install the required packages:
   pip install -r requirements.txt
5. Copy .env.example and rename the copy to .env.
6. Open .env and replace PASTE_YOUR_SECRET_KEY_HERE with your own OpenAI API key.
7. Run the website:
   python app.py
8. Open this address in your browser:
   http://127.0.0.1:5000

IMPORTANT:
- An OpenAI API account, API key, and available API billing/credits are required.
- ChatGPT subscriptions and API billing are separate.
- API usage may cost money. Set usage limits in your API account.
- If you are under 18, ask a parent or guardian to help with account and billing setup.
- Never share your API key or put it in HTML/JavaScript files.
- This is a local starter project. Before public deployment, add authentication, rate limiting, HTTPS, and security review.
- If the selected model is not available to your API account, set OPENAI_MODEL in .env to a model your account can use.
