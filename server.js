require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// ─── Supabase ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Nodemailer transporter ───────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',                       // change to 'hotmail', 'yahoo', etc. if needed
  auth: {
    user: process.env.EMAIL_USER,         // your Gmail address
    pass: process.env.EMAIL_PASS,         // Gmail App Password (not your real password)
  },
});

// ─── POST /api/contact ────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  const { name, email, projectType, message } = req.body;

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    // 1. Save to Supabase
    const { error: dbError } = await supabase.from('contact_messages').insert([
      {
        name,
        email,
        project_type: projectType || null,
        message,
        created_at: new Date().toISOString(),
      },
    ]);

    if (dbError) {
      console.error('Supabase error:', dbError.message);
      // Don't block the email if DB fails — just log it
    }

    // 2. Send notification email to Michael
    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.EMAIL_USER,
      subject: `New enquiry from ${name} — Michael Samson Portfolio`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#C8D8E8;padding:2rem;border:1px solid #1A1F35;">
          <h2 style="color:#7EB8F7;font-family:Georgia,serif;margin-bottom:1.5rem;">New Portfolio Enquiry</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:0.6rem 0;color:#7EB8F7;width:120px;font-size:0.85rem;">Name</td><td style="padding:0.6rem 0;">${name}</td></tr>
            <tr><td style="padding:0.6rem 0;color:#7EB8F7;font-size:0.85rem;">Email</td><td style="padding:0.6rem 0;"><a href="mailto:${email}" style="color:#A8C8E8;">${email}</a></td></tr>
            <tr><td style="padding:0.6rem 0;color:#7EB8F7;font-size:0.85rem;">Project Type</td><td style="padding:0.6rem 0;">${projectType || '—'}</td></tr>
          </table>
          <div style="margin-top:1.5rem;padding:1rem;background:#0D0F1A;border-left:2px solid #7EB8F7;">
            <p style="margin:0;font-size:0.9rem;line-height:1.7;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          <p style="margin-top:1.5rem;font-size:0.75rem;color:#4A6080;">Sent from michaelsamson.dev portfolio contact form</p>
        </div>
      `,
    });

    // 3. Send confirmation email to sender
    await transporter.sendMail({
      from: `"Michael Samson" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Got your message, ${name.split(' ')[0]} — I'll be in touch`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#050508;color:#C8D8E8;padding:2rem;border:1px solid #1A1F35;">
          <h2 style="color:#7EB8F7;font-family:Georgia,serif;">Thanks for reaching out.</h2>
          <p style="line-height:1.8;color:#A8C8E8;">Hey ${name.split(' ')[0]},</p>
          <p style="line-height:1.8;color:#A8C8E8;">Your message came through. I'll review your enquiry and get back to you within 24–48 hours.</p>
          <p style="line-height:1.8;color:#A8C8E8;">In the meantime feel free to check out more of my work on the portfolio.</p>
          <p style="margin-top:2rem;color:#7EB8F7;font-family:Georgia,serif;">— Michael Samson</p>
          <p style="font-size:0.7rem;color:#2A3550;margin-top:2rem;">You're receiving this because you submitted a message through michaelsamson.dev</p>
        </div>
      `,
    });

    return res.json({ success: true, message: 'Message sent successfully.' });

  } catch (err) {
    console.error('Contact error:', err.message);
    return res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// ─── POST /api/chat (streaming AI via Groq — free tier) ───────
const SYSTEM_PROMPT = `You are the AI assistant persona for Michael Samson's portfolio website. Michael Samson is a programmer and video editor based in Nigeria. He is skilled in JavaScript, TypeScript, Python, React, Next.js, Node.js, After Effects, Premiere Pro, DaVinci Resolve, motion graphics, color grading, and AI/LLM integration. He has 3+ years of experience, has shipped 20+ projects, and works across full-stack web development and cinematic video production. He is currently available for freelance projects, collaborations, and full-time roles. Speak as Michael's warm, confident, professional AI assistant — first person representing Michael. Keep responses concise (2-4 sentences). Be specific and helpful. If asked something you don't know exactly, suggest they reach out directly via the contact form. Never mention being an AI model — you are simply Michael's assistant.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required.' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI service not configured.' });
  }

  // SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',  // free, fast, very capable
        max_tokens: 1000,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-20),
        ],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error('Groq error:', err);
      res.write(`data: ${JSON.stringify({ error: 'AI service error.' })}\n\n`);
      return res.end();
    }

    // Groq uses OpenAI-compatible SSE — parse and re-emit for the frontend
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
          if (text) {
            // Re-emit in the same format the frontend expects
            res.write(`data: ${JSON.stringify({
              type: 'content_block_delta',
              delta: { type: 'text_delta', text }
            })}\n\n`);
          }
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
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✦ Portfolio backend running on port ${PORT}`));