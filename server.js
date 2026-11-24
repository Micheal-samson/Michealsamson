require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}

const app = express();
// Number() so an empty/zero PORT from the host falls back instead of binding a random port.
const PORT = Number(process.env.PORT) || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'michael-samson-portfolio.html'));
});

const has = (v) => typeof v === 'string' && v.trim().length > 0;

// ─── Supabase (optional) ──────────────────────────────────────
let supabase = null;
if (has(process.env.SUPABASE_URL) && has(process.env.SUPABASE_ANON_KEY)) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Supabase disabled:', err.message);
  }
} else {
  console.warn('Supabase not configured — messages will be stored locally in messages.jsonl');
}

// ─── Nodemailer (optional) ────────────────────────────────────
const mailReady = has(process.env.EMAIL_USER) && has(process.env.EMAIL_PASS);
const transporter = mailReady
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    })
  : null;
if (!mailReady) {
  console.warn('Email not configured — contact messages will be saved locally only');
}

// ─── Local message log (used when Supabase/email are not configured) ──
const MESSAGES_FILE = path.join(__dirname, 'messages.jsonl');
function saveLocally(entry) {
  try {
    fs.appendFileSync(MESSAGES_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    console.error('Could not write messages.jsonl:', err.message);
  }
}

// ─── POST /api/contact ────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, projectType, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const entry = {
    name,
    email,
    project_type: projectType || null,
    message,
    created_at: new Date().toISOString(),
  };

  let stored = false;
  let notified = false;

  // 1. Supabase (if configured)
  if (supabase) {
    const { error: dbError } = await supabase.from('contact_messages').insert([entry]);
    if (dbError) console.error('Supabase error:', dbError.message);
    else stored = true;
  }

  // 2. Local copy so a message is never lost when nothing else is configured
  if (!stored) {
    saveLocally(entry);
    stored = true;
  }

  // 3. Emails (if configured)
  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_TO || process.env.EMAIL_USER,
        subject: `New enquiry from ${name} — Michael Samson Portfolio`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#F6F3EC;color:#17150F;padding:2rem;border:1px solid #DBD3C3;">
            <h2 style="color:#A4471F;font-family:Georgia,serif;margin-bottom:1.5rem;">New Portfolio Enquiry</h2>
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="padding:0.6rem 0;color:#A4471F;width:120px;font-size:0.85rem;">Name</td><td style="padding:0.6rem 0;">${name}</td></tr>
              <tr><td style="padding:0.6rem 0;color:#A4471F;font-size:0.85rem;">Email</td><td style="padding:0.6rem 0;"><a href="mailto:${email}" style="color:#17150F;">${email}</a></td></tr>
              <tr><td style="padding:0.6rem 0;color:#A4471F;font-size:0.85rem;">Project Type</td><td style="padding:0.6rem 0;">${projectType || '—'}</td></tr>
            </table>
            <div style="margin-top:1.5rem;padding:1rem;background:#EFEADF;border-left:2px solid #A4471F;">
              <p style="margin:0;font-size:0.9rem;line-height:1.7;">${String(message).replace(/\n/g, '<br>')}</p>
            </div>
          </div>
        `,
      });

      // Only true once the notification actually reached Michael's inbox.
      notified = true;

      await transporter.sendMail({
        from: `"Michael Samson" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Got your message, ${String(name).split(' ')[0]} — I'll be in touch`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#F6F3EC;color:#17150F;padding:2rem;border:1px solid #DBD3C3;">
            <h2 style="color:#A4471F;font-family:Georgia,serif;">Thanks for reaching out.</h2>
            <p style="line-height:1.8;">Hey ${String(name).split(' ')[0]},</p>
            <p style="line-height:1.8;">Your message came through. I'll review your enquiry and get back to you within 24–48 hours.</p>
            <p style="line-height:1.8;">In the meantime feel free to check out more of my work on the portfolio.</p>
            <p style="margin-top:2rem;color:#A4471F;font-family:Georgia,serif;">— Michael Samson</p>
          </div>
        `,
      });
    } catch (err) {
      // The message is already stored, so don't fail the request.
      console.error('Email error:', err.message);
    }
  }

  return res.json({
    success: true,
    message: 'Message sent successfully.',
    delivered: notified,
  });
});

// ─── POST /api/chat (streaming AI via Groq — free tier) ───────
const SYSTEM_PROMPT = `You are the AI assistant persona for Michael Samson's portfolio website. Michael Samson is a programmer and video editor based in Nigeria. He is skilled in JavaScript, TypeScript, Python, React, Next.js, Node.js, After Effects, Premiere Pro, DaVinci Resolve, motion graphics, color grading, and AI/LLM integration. He has 3+ years of experience, has shipped 20+ projects, and works across full-stack web development and cinematic video production. He is currently available for freelance projects, collaborations, and full-time roles. Speak as Michael's warm, confident, professional AI assistant — first person representing Michael. Keep responses concise (2-4 sentences). Be specific and helpful. If asked something you don't know exactly, suggest they reach out directly via the contact form. Never mention being an AI model — you are simply Michael's assistant.`;

// Offline answers, used when no GROQ_API_KEY is configured so the chat still works.
const FALLBACKS = [
  {
    match: /build|service|do you (do|make)|offer/i,
    reply:
      "I build fast, accessible websites and web apps — React, Next.js, Node and TypeScript — and I handle the visual side too: motion design, editing, color grading and product video. If you have a project in mind, the contact form is the quickest way to get a quote.",
  },
  {
    match: /hire|available|freelance|work with|rate|price|cost|budget/i,
    reply:
      "Yes — I'm open to freelance projects, collaborations and full-time roles right now. Send the scope through the contact form and I'll come back within 48 hours with an approach and a timeline.",
  },
  {
    match: /editing|edit|video|reel|after effects|premiere|resolve|grade/i,
    reply:
      "My editing work sits between cinematic and editorial: tight pacing, clean sound design, deliberate color grades and motion graphics that support the story rather than decorate it. There's a reel in the Work section if you want to see the rhythm.",
  },
  {
    match: /stack|tech|technolog|tool|language|framework/i,
    reply:
      "Day to day I work in JavaScript and TypeScript with React and Next.js on the front end, Node and Python on the back end, and Supabase or Postgres for data. For motion and video it's After Effects, Premiere Pro and DaVinci Resolve.",
  },
  {
    match: /experience|background|years|long|portfolio|project/i,
    reply:
      "I've been building for 3+ years and have shipped 20+ projects across full-stack web work and cinematic video production. Scroll through the Work section for the recent ones, or tell me what you're planning and I'll point you to the closest example.",
  },
  {
    match: /contact|email|reach|message|call/i,
    reply:
      "The contact form at the bottom of this page goes straight to my inbox — name, email and a line about the project is all I need. I reply within 24–48 hours.",
  },
];

function fallbackReply(text) {
  const hit = FALLBACKS.find((f) => f.match.test(text));
  return (
    hit?.reply ||
    "I can talk you through my web work, editing, the stack I use or availability — or send the details through the contact form below and I'll reply directly within 48 hours."
  );
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const prompt = lastUser?.content || '';

  // SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendDelta = (text) =>
    res.write(
      `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`
    );

  // No API key yet → answer locally instead of failing the chat.
  if (!process.env.GROQ_API_KEY) {
    const reply = fallbackReply(prompt);
    for (const chunk of reply.match(/.{1,14}/g) || [reply]) {
      sendDelta(chunk);
      await new Promise((r) => setTimeout(r, 18));
    }
    res.write('data: [DONE]\n\n');
    return res.end();
  }

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        stream: true,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-20)],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Groq error:', err);
      res.write(`data: ${JSON.stringify({ error: 'AI service error.' })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }
        try {
          const parsed = JSON.parse(data);
          const text = parsed.choices?.[0]?.delta?.content;
          if (text) sendDelta(text);
        } catch (_) {}
      }
    }

    res.end();
  } catch (err) {
    console.error('Chat error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'Connection error.' })}\n\n`);
    res.end();
  }
});

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (_, res) =>
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    ai: Boolean(process.env.GROQ_API_KEY),
    email: Boolean(transporter),
    database: Boolean(supabase),
  })
);

// Local development binds loopback only; hosted platforms (Render, Railway, Fly, Docker)
// need every interface or their health check and public URL never reach the app.
const HOSTED = Boolean(
  process.env.RENDER ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.FLY_APP_NAME ||
  process.env.NODE_ENV === 'production'
);
const HOST = process.env.HOST || (HOSTED ? '0.0.0.0' : '127.0.0.1');
app.listen(PORT, HOST, () =>
  console.log(`✦ Portfolio backend running on http://${HOST}:${PORT}`)
);
