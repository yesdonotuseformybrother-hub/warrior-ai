
# OSAM AI 🤖

**Your AI Assistant — Built for Everyone.**

OSAM AI is an AI-powered chat application with a modern, ChatGPT-inspired interface. It provides a clean and responsive experience for interacting with AI.

## ✨ Features

- Modern dark-mode user interface
- OSAM AI custom branding and logo
- AI-powered chat system
- Streaming AI responses
- Chat history saved in browser
- Create new conversations
- Open previous conversations
- Regenerate AI responses
- Copy AI responses
- Responsive design for mobile and desktop
- Firebase Authentication
- Email and password login
- Google Sign-In

## 📁 Project Structure

```text
osam-ai/
│
├── index.html
├── README.md
│
├── static/
│   ├── style.css
│   ├── app.js
│   └── osam-logo.png
│
└── [Backend files]
```

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- Firebase Authentication
- Python / Flask (if used by the backend)
- AI API through the backend

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
```

### 2. Open Project Folder

```bash
cd osam-ai
```

### 3. Install Backend Dependencies

If your project uses Flask, install its dependencies:

```bash
pip install -r requirements.txt
```

### 4. Configure Firebase

1. Open the Firebase Console.
2. Select your Firebase project.
3. Enable Email/Password Authentication.
4. Enable Google Authentication if required.
5. Configure your Firebase settings in `index.html`.
6. Add your website domain to Firebase Authorized Domains.

### 5. Configure AI API

Configure your AI API key securely on the backend.

Do not expose private API keys in frontend JavaScript or HTML.

Make sure your backend provides the `/api/chat` endpoint used by `static/app.js`.

### 6. Run the Application

For a Flask application, run:

```bash
python app.py
```

Open the local URL shown in your terminal, usually:

```text
http://127.0.0.1:5000
```

## 🔐 Security

- Keep private API keys on the server.
- Configure Firebase security rules.
- Never publish passwords or secret credentials.
- Validate API requests on the backend.

## 🎨 Design

OSAM AI uses a modern dark interface inspired by conversational AI applications, with its own branding, logo, and visual identity.

## 📌 Project Status

**Development in Progress**

More features and improvements may be added in future updates.

## 👨‍💻 Developer

**OSAM AI Project**

---

© 2026 OSAM AI. All rights reserved.
