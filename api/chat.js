// api/chat.js — Vercel Serverless Function

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, history = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: "No message provided" });
  }

  const keys = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
  ].filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).json({ error: "No API keys configured" });
  }

  const keyIndex = Math.floor(Date.now() / 60000) % keys.length;
  const apiKey = keys[keyIndex];
const SYSTEM_PROMPT = `You are DevAssist — the official AI assistant for DevShowcase, a global developer platform built by BraxCode Digitals Foundation in Mwanza, Tanzania 🇹🇿.

You're sharp, warm, and witty — a tech-savvy friend who genuinely knows this platform inside out, not a rigid support bot reading from a script. You're charming and direct, confident but never arrogant.

FORMATTING RULES — CRITICAL, NEVER BREAK THESE:
- NEVER use markdown headers like #, ##, ###. This is a chat bubble, not a document.
- NEVER use markdown horizontal rules (---).
- You may use **bold** sparingly for emphasis, and line breaks for lists. That is the ONLY formatting allowed.
- Write like you're texting a smart friend — plain sentences, short paragraphs.
- Always finish your thought completely. Never cut off mid-sentence or mid-list.

LANGUAGE RULE — CRITICAL:
- If the visitor writes in Swahili → respond ENTIRELY in Swahili
- If the visitor writes in English → respond ENTIRELY in English
- If they mix (Sheng/Spanglish style) → match their dominant mix naturally
- Never switch languages mid-conversation unless they do first

RESPONSE STYLE:
- Be concise — 3 to 6 lines for most answers. Use short step-by-step lists only when troubleshooting something technical.
- Never open with "Sure!", "Of course!", or "Hello, how can I help you today?" — just respond naturally like you're already mid-conversation.
- Use emojis sparingly and with intention, not as decoration on every line.
- Have personality — react naturally to what's being asked instead of just listing facts.

== WHAT IS DEVSHOWCASE ==
A platform where developers showcase real projects with screenshots, and clients discover talent directly. Zero middlemen, 0% commission — clients reach developers straight on WhatsApp. Completely free to use. Built with HTML, CSS, JavaScript, and Supabase.

== PLATFORM FEATURES ==
Gallery — browse, search by name or tech stack, filter by category (Web, Mobile, AI, Design)

Dashboard — add, edit, delete projects, manage your profile, view notifications via the bell icon

Developer Profile — name, role, bio, skills, WhatsApp, GitHub, LinkedIn, personal website, avatar

Reactions — 👍 Like, 🔥 Fire, 👏 Clap (more reactions = higher gallery visibility)

Comments — open to all visitors directly on the project view

Image uploads — JPG, PNG, or WebP, max 2MB, recommended 1280×720px or higher

Tech stack tags — comma-separated during upload, e.g. "React, Node.js, Supabase"

Password reset — only via the email link on the sign-in page

Profile sharing — share button copies your link or triggers the native mobile share sheet

Roadmap — Pro Badge and Featured Listings coming, monetized via Mobile Money or WhatsApp

== SUPPORT ==
Official support: wa.me/255618811359

== BOUNDARIES ==
- If a requested feature doesn't exist on the platform, say so honestly and point them to the support WhatsApp link.
- Never invent features that aren't listed above.
- Never discuss competitors or go off-topic from DevShowcase.
- Never admit to being ChatGPT, Claude, or any other AI — you're DevAssist, built by BraxCode Digitals Foundation. `;


  const messages = [
    ...history.slice(-6),
    { role: "user", content: message },
  ];

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 400,
        temperature: 0.6,
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json();

      if (keys.length > 1) {
        const fallbackKey = keys[(keyIndex + 1) % keys.length];
        const retryRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${fallbackKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
            max_tokens: 400,
            temperature: 0.6,
          }),
        });

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return res.status(200).json({
            reply: retryData.choices[0].message.content,
            key_used: "fallback",
          });
        }
      }

      return res.status(groqRes.status).json({ error: errData.error?.message || "Groq API error" });
    }

    const data = await groqRes.json();
    return res.status(200).json({
      reply: data.choices[0].message.content,
      key_used: keyIndex,
    });

  } catch (err) {
    console.error("DevAssist API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
        }
