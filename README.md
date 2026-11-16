
# 🤖 OSAM AI

### Your AI Assistant — Built for Everyone.

OSAM AI is an AI-powered chat application with a modern, ChatGPT-inspired interface. It provides a clean, responsive, and user-friendly experience for interacting with artificial intelligence.

---

## ✨ Features

- Modern dark-mode user interface
- Custom OSAM AI branding and logo
- AI-powered chat system
- Streaming AI responses
- Chat history saved in the browser
- Create new conversations
- Open previous conversations
- Regenerate AI responses
- Copy AI responses
- Responsive design for desktop and mobile
- Firebase Authentication
- Email and password login
- Google Sign-In

---

## 📸 Project Preview

OSAM AI features a modern conversational interface with custom branding and a dark theme.

---

## 📁 Project Structure

```text
osam-ai/
│
├── app.py
├── index.html
├── README.md
├── requirements.txt
├── .env
│
└── static/
    ├── style.css
    ├── app.js
    └── osam-logo.png
```

*Note: Your actual project structure may vary depending on your backend setup.*

---

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive design |
| JavaScript | Frontend functionality |
| Firebase | User authentication |
| Python | Backend development |
| Flask | API and server |
| AI API | AI-generated responses |

---

## 🚀 Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
```

### 2. Open the Project Folder

```bash
cd osam-ai
```

### 3. Install Dependencies

If you are using Flask, install the required packages:

```bash
pip install -r requirements.txt
```

### 4. Configure Firebase Authentication

1. Open the Firebase Console.
2. Select your Firebase project.
3. Open Authentication.
4. Enable Email/Password sign-in.
5. Enable Google sign-in if required.
6. Configure Firebase settings in `index.html`.
7. Add your website domain under Authorized Domains.

### 5. Configure the AI Backend

Configure your AI API key on the backend using environment variables.

Example `.env` file:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=your_model_name
```

Keep your private API key secure. Never publish it in frontend files or GitHub.

Make sure your Flask backend provides the following endpoint:

```text
POST /api/chat
```

The endpoint should support streaming responses used by `static/app.js`.

### 6. Run OSAM AI

Start the Flask application:

```bash
python app.py
```

Open the local address in your browser:

```text
http://127.0.0.1:5000
```

---

## 🔐 Security

- Never expose private AI API keys in frontend code.
- Keep secret credentials inside environment variables.
- Configure Firebase Authentication correctly.
- Apply appropriate Firebase security rules.
- Validate requests on the backend.
- Do not upload `.env` files or secret credentials to GitHub.

---

## 🎨 Design

OSAM AI uses a modern dark interface inspired by conversational AI applications.

The application has its own identity, custom logo, responsive layout, and user-friendly chat experience.

---

## 📌 Project Status

**Development in Progress 🚧**

OSAM AI is actively being developed. More features, improvements, and integrations may be added in future updates.

---

## 👨‍💻 Developer

**OSAM AI Project**

---

© 2026 OSAM AI. All rights reserved.
