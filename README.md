# Michael Samson — Portfolio Backend

Express + Nodemailer + Supabase backend for the contact form.

**Live:** https://michealsamson.onrender.com — the page and the API are served together by this Express app.

---

## Stack
- **Express** — HTTP server
- **Nodemailer** — sends emails via Gmail
- **Supabase** — stores contact messages in a database
- **CORS + dotenv** — security & config

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Every key is optional — the server always boots:

- **No `GROQ_API_KEY`** → `/api/chat` answers from a built-in set of portfolio answers instead of failing.
- **No email / Supabase keys** → contact messages are appended to `messages.jsonl` in this folder so nothing is lost.

Fill in `.env` when you want live AI and real delivery:

| Variable | Where to get it |
|---|---|
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password — [generate here](https://myaccount.google.com/apppasswords) (needs 2FA enabled) |
| `EMAIL_TO` | Where notifications land (your email) |
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon public key |

### 3. Create Supabase table
Go to your Supabase project → **SQL Editor** and paste + run the contents of `supabase-setup.sql`.

### 4. Run locally
```bash
npm start
# or for auto-reload during development:
npm run dev
```
Server starts on `http://localhost:3001`

---

## API

### `POST /api/contact`
Send a contact form message.

**Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "projectType": "Web App",
  "message": "Hi Michael, I'd love to work with you."
}
```

**Response:**
```json
{ "success": true, "message": "Message sent successfully." }
```

### `GET /api/health`
Returns `{ "status": "ok" }` — useful for uptime monitoring.

---

## Deploying to production

### Render (current host)
The page and the API are served by the same Express process at https://michealsamson.onrender.com,
so the chat and contact form work with no extra config — the browser calls `/api/*` on its own origin.

1. Render → **New → Web Service**, connect the GitHub repo (or deploy the folder as a Docker service;
   the `Dockerfile` is included).
2. Settings: **Build** `npm ci --omit=dev`, **Start** `npm start`, **Health check path** `/api/health`.
3. Add the environment variables below in Render → **Environment**.
4. The server binds `0.0.0.0` automatically on Render (`RENDER=true` is set by the platform) and
   listens on the `PORT` Render assigns.

Deploy the **whole folder** — `shots/*.jpg`, `about-portrait.png`, `taish-poster.jpg` and
`taish-web.mp4` are referenced by the page. A repo without them shows broken cards.

Render's disk is ephemeral: `messages.jsonl` survives only until the next deploy/restart. Set the
Supabase keys so messages are actually stored, or they disappear with the container.

Other options: Railway, Fly.io, or a VPS — any of them work as long as the process listens on
`0.0.0.0:$PORT`.

---

## Portfolio HTML
When the page is served by `server.js`, `/api/chat` and `/api/contact` resolve against the same origin and no change is needed.

If you host the HTML somewhere else (GitHub Pages, Netlify), point it at the deployed backend before the main `<script>` runs:
```html
<script>window.PORTFOLIO_BACKEND = 'https://michealsamson.onrender.com';</script>
```
