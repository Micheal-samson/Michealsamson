# Michael Samson — Portfolio Backend

Express + Nodemailer + Supabase backend for the contact form.

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
Then fill in `.env`:

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

**Recommended: [Railway](https://railway.app)** (free tier, easy Node.js deploys)

1. Push this folder to a GitHub repo
2. Connect repo to Railway → it auto-detects Node and runs `npm start`
3. Add your `.env` variables in Railway's environment settings
4. Copy the Railway URL and update `BACKEND_URL` in your portfolio HTML

Other options: Render, Fly.io, Heroku, or a VPS.

---

## Portfolio HTML
In `michael-samson-portfolio.html`, update this line to your deployed backend URL:
```js
const BACKEND_URL = 'http://localhost:3001'; // ← change this
```
