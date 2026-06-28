# 📚 Studify

**Your AI-powered study companion.** Upload your notes, slides, and PDFs, then chat with them, get instant summaries, generate quizzes, and track your progress — all grounded in **your own material**.

Studify is a full-stack **MERN** app. The AI runs on **Groq** (Llama 3.3 / 3.1), and "chat with your notes" is powered by a built-in **RAG** pipeline using **local neural embeddings** — no extra AI service, no extra API keys.

> 🌐 **Live demo:** [studify-six.vercel.app](https://studify-six.vercel.app)

---

## ✨ Features

- **🔐 Secure accounts** — email **OTP** sign-up, JWT login, password change, **forgot/reset password**, "sign out everywhere," and account deletion.
- **📁 Notes** — upload **PDF, PowerPoint (.pptx), Word (.docx), and text** files (up to 15 MB each, 100 MB per user). Text is extracted automatically.
- **💬 AI Chat (RAG)** — ask questions and get answers grounded in your uploaded notes, with the **source notes cited** under each reply. Streaming responses, multiple models.
- **📝 Summaries** — one-click summaries of any document. Long files are summarized in full (map-reduce), then downloadable as **PDF or CSV**.
- **🧠 Quiz generator** — auto-generate multiple-choice quizzes from any note and take them with instant scoring, feedback, and explanations.
- **📊 Analytics** — activity charts, quiz output, a study streak, and an **AI "study coach"** that reads your stats and gives recommendations.
- **🎨 Polished UI** — animated dashboard, light/dark theme, responsive design.
- **🛡️ Production-ready** — rate limiting on auth & AI endpoints, per-user storage limits, and strict data isolation (every record is scoped to its owner).

---

## 🧠 How "chat with your notes" works (RAG)

```
Upload  →  extract text  →  split into chunks  →  embed each chunk  →  store        (indexing)
Question →  embed query  →  cosine top-k chunks  →  add as context  →  LLM answers   (retrieval + generation)
```

1. When you upload a file, its text is split into overlapping passages and each is turned into a **384-dimension vector** by a local sentence-transformer (`all-MiniLM-L6-v2` via Transformers.js).
2. When you chat, your question is embedded too, and the most **semantically similar** passages are found via **cosine similarity**.
3. Those passages are fed to the LLM as context, so the answer comes from your material — and the source notes are shown as chips under the reply.

> Runs entirely in Node — no embeddings API or vector database required. (At large scale you'd swap the in-memory search for a dedicated vector DB.)

---

## 🛠️ Tech stack

| Layer | Tech |
|------|------|
| **Frontend** | React 19, Vite, React Router, lucide-react |
| **Backend** | Node.js, Express 5, Mongoose |
| **Database** | MongoDB |
| **Auth** | JWT, bcrypt, email OTP (Brevo) |
| **LLM** | Groq — Llama 3.3 70B & Llama 3.1 8B |
| **Embeddings / RAG** | `@xenova/transformers` (all-MiniLM-L6-v2), in-memory cosine search |
| **File handling** | multer, pdf-parse (PDF), adm-zip (PPTX/DOCX) |
| **Hardening** | express-rate-limit, locked CORS |
| **Hosting** | Vercel (frontend) · Railway (backend) · MongoDB Atlas (database) |

---

## 📂 Project structure

```
Studify/
├── client/    React + Vite frontend (the UI)
└── server/    Node/Express API — auth, notes, AI chat, summaries, quizzes, analytics, RAG
```

---

## 🚀 Getting started

### Prerequisites

- **Node.js 18+**
- **MongoDB** — a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or a local install
- A **Groq API key** — free at [console.groq.com/keys](https://console.groq.com/keys)
- A **Brevo account** for sending OTP emails — free at [brevo.com](https://www.brevo.com) (300 emails/day, no domain needed — just verify your sender email)

### 1. Clone & install

```bash
git clone https://github.com/TahaSohail-Goat/Studyify.git
cd Studyify

cd server && npm install
cd ../client && npm install
```

### 2. Configure the backend

Create `server/.env` (copy from `server/.env.example`) and fill in your values:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/studify
JWT_SECRET=replace-with-a-long-random-string
EMAIL_USER=you@gmail.com
BREVO_API_KEY=xkeysib-your-brevo-api-key
GROQ_API_KEY=your-groq-api-key
# Only needed in production — your deployed frontend URL (for CORS)
CLIENT_ORIGIN=https://your-app.vercel.app
```

The frontend reads the backend URL from `VITE_API_URL` (see `client/.env.example`). Leave it unset locally — it defaults to `http://localhost:5000`.

### 3. Run it (two terminals)

```bash
# Terminal 1 — backend (http://localhost:5000)
cd server
npm run dev
```

```bash
# Terminal 2 — frontend (http://localhost:5173)
cd client
npm run dev
```

Open **http://localhost:5173** and create an account.

> **First run:** the backend downloads the embedding model (~30 MB) once and caches it. Watch for `🧠 Embedding model ready — RAG search is live.` in the server console.

---

## ⚙️ Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | no | Backend port (default `5000`) |
| `MONGODB_URI` | **yes** | MongoDB connection string |
| `JWT_SECRET` | **yes** | Secret used to sign login tokens |
| `EMAIL_USER` | **yes** | Verified Brevo sender address (the email OTPs are sent from) |
| `BREVO_API_KEY` | **yes** | Brevo API key for sending OTP emails |
| `GROQ_API_KEY` | **yes** | Groq key for chat, summaries, and quizzes |
| `CLIENT_ORIGIN` | prod only | Deployed frontend URL, used to lock CORS |

---

## 📜 Scripts

**server/**
- `npm run dev` — start with auto-reload (nodemon)
- `npm start` — start in production mode

**client/**
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build

---

## ☁️ Deployment

Studify is deployed across three free tiers:

| Piece | Host | Notes |
|-------|------|-------|
| **Frontend** | [Vercel](https://vercel.com) | Root dir `client`. Set `VITE_API_URL` to the backend URL. A `vercel.json` rewrite serves the SPA so React Router routes work on refresh. |
| **Backend** | [Railway](https://railway.app) | Root dir `server`, start command `npm start`. Set all backend env vars (including `CLIENT_ORIGIN` = your Vercel URL). |
| **Database** | [MongoDB Atlas](https://www.mongodb.com/atlas) | Allow access from anywhere (`0.0.0.0/0`) so the host can connect. |
| **Email** | [Brevo](https://www.brevo.com) | HTTP API — works on hosts that block outbound SMTP. |

> **Heads-up:** some cloud hosts block outbound SMTP/IPv6, so OTP email uses Brevo's **HTTP API** instead of a direct SMTP connection.

---

## 🔒 Notes on privacy & security

- Your `.env`, uploaded files (`server/uploads/`), and `node_modules/` are git-ignored and never committed.
- Every note, chat, summary, and quiz is scoped to its owner — users can only see their own data.
- Auth and AI endpoints are rate-limited; passwords are hashed with bcrypt; OTP emails never reveal whether an account exists.

---

## 🗺️ Status

All core phases are complete and the app is **live in production**: **Auth → Notes → AI Chat (RAG) → Summaries → Quizzes → Analytics**, plus password reset and production hardening.

**Possible next steps:** OCR for scanned/image-only documents and a shared/collaborative study mode.

---

<sub>Built with the MERN stack and Groq. 🤎</sub>
