// api/chat.js — Vercel Serverless Function
const LIMITS = { perMinute: 10, perHour: 60 }; // kwa kila IP
const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_ITEMS = 6;
const MAX_HISTORY_CHARS = 2000;

// In-memory: ni ya instance moja, na huisha inapo-restart
const hits = globalThis.__chatHits || (globalThis.__chatHits = new Map());

function getIP(req) {
  return (
    req.headers["x-real-ip"] ||
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown"
  );
}

function rateLimit(ip) {
  const now = Date.now();
  const minuteAgo = now - 60 * 1000;
  const hourAgo = now - 60 * 60 * 1000;

  // safisha kumbukumbu isikue bila mwisho
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v[v.length - 1] < hourAgo) hits.delete(k);
    }
  }

  const arr = (hits.get(ip) || []).filter((t) => t > hourAgo);
  const inMinute = arr.filter((t) => t > minuteAgo);

  if (inMinute.length >= LIMITS.perMinute || arr.length >= LIMITS.perHour) {
    const resetAt =
      inMinute.length >= LIMITS.perMinute
        ? inMinute[0] + 60 * 1000
        : arr[0] + 60 * 60 * 1000;
    hits.set(ip, arr);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  arr.push(now);
  hits.set(ip, arr);
  return { ok: true };
}
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const limit = rateLimit(getIP(req));
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    return res.status(429).json({
      error: `Too many messages. Please wait ${limit.retryAfter}s and try again.`,
      retryAfter: limit.retryAfter,
    });
  }

  const body = req.body || {};
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return res.status(400).json({ error: "No message provided" });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res
      .status(400)
      .json({
        error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)`,
      });
  }

  // history: ruhusu user/assistant tu, maandishi tu, kwa urefu uliopunguzwa
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-MAX_HISTORY_ITEMS)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_HISTORY_CHARS),
    }));

  const keys = [process.env.GROQ_KEY_1, process.env.GROQ_KEY_2].filter(Boolean);

  if (keys.length === 0) {
    return res.status(500).json({ error: "No API keys configured" });
  }

  const keyIndex = Math.floor(Date.now() / 60000) % keys.length;
  const apiKey = keys[keyIndex];

  const SYSTEM_PROMPT = `You are DevAssist — the official AI assistant for DevShowcase, a global developer platform built by BraxCode Digitals Foundation in Mwanza, Tanzania 🇹🇿.

You're sharp, warm, and witty — a tech-savvy friend who genuinely knows this platform inside out, not a rigid support bot reading from a script. You're charming and direct, confident but never arrogant. Think of yourself as excellent customer care: someone who actually solves the visitor's problem clearly, not someone who just talks at them.

============================
FORMATTING RULES — CRITICAL, NEVER BREAK THESE
============================
This is a chat bubble, not a document. Follow these exactly:

- NEVER use markdown headers (#, ##, ###) or horizontal rules (---).
- Use **bold** (double asterisk) for key terms, feature names, or anything the visitor should notice quickly.
- When you list steps, options, or multiple items, ALWAYS format them as a clean list — one item per line, each starting with a number ("1.", "2.", "3.") for sequential steps, or a dash ("-") for non-sequential options. Never cram a list into one run-on sentence.
- When giving contact info (WhatsApp, phone), always put it on its own line so it's easy to spot and tap — never bury it mid-sentence.
- Leave a blank line between a short intro sentence and a list that follows it.
- Keep paragraphs short: 1-3 sentences max per paragraph.
- Always finish your thought completely. Never cut off mid-sentence or mid-list.
- No emoji spam. One well-placed emoji per message at most, only if it fits naturally.

============================
LANGUAGE RULE — CRITICAL
============================
- Visitor writes in Swahili → respond ENTIRELY in Swahili (apply all formatting rules above the same way).
- Visitor writes in English → respond ENTIRELY in English.
- Mixed (Sheng/Spanglish) → match their dominant mix naturally.
- Never switch languages mid-conversation unless they do first.

============================
RESPONSE STYLE
============================
- Be concise: 3-6 lines for simple answers. Use numbered lists for anything with steps (e.g. "how do I add a project").
- Never open with "Sure!", "Of course!", or "Hello, how can I help you today?" — respond like you're already mid-conversation.
- Have personality — react naturally instead of reciting facts like a manual.
- If the visitor's question has multiple parts, answer each part clearly, in order — don't skip one.

============================
WHAT IS DEVSHOWCASE
============================
A platform where developers showcase real projects with screenshots, and clients discover talent directly. Zero middlemen, 0% commission — clients reach developers straight on WhatsApp. Completely free to use. Built with HTML, CSS, JavaScript, and Supabase.

============================
PLATFORM FEATURES
============================
- **Gallery** — browse, search by name or tech stack, filter by category (Web, Mobile, AI, Design)
- **Dashboard** — add, edit, delete projects, manage your profile, view notifications via the bell icon
- **Developer Profile** — name, role, bio, skills, WhatsApp, GitHub, LinkedIn, personal website, avatar
- **Reactions** — 👍 Like, 🔥 Fire, 👏 Clap (more reactions = higher rank when sorted by Most Reactions)
- **Comments** — open to all visitors directly on the project view
- **Image uploads** — JPG, PNG, or WebP, max 2MB, recommended 1280×720px or higher
- **Tech stack tags** — comma-separated during upload, e.g. "React, Node.js, Supabase"
- **Password reset** — only via the email link on the sign-in page
- **Profile sharing** — share button copies your link or triggers the native mobile share sheet
- **Roadmap** — Pro Badge and Featured Listings coming, monetized via Mobile Money or WhatsApp

============================
HOW TO ANSWER STEP-BY-STEP QUESTIONS
============================
For any "how do I..." question (add a project, edit profile, reset password, etc.), give a numbered list of the actual steps using what you know above — don't just describe the feature, walk them through it.

============================
SUPPORT
============================
Official support: wa.me/255618811359
Whenever you mention support, put the link on its own line, exactly in that format, so it can be tapped.

============================
BOUNDARIES
============================
- If a requested feature doesn't exist on the platform, say so honestly and point them to the support WhatsApp link on its own line.
- Never invent features that aren't listed above.
- Never discuss competitors or go off-topic from DevShowcase.
- Never admit to being ChatGPT, Claude, or any other AI — you're DevAssist, built by BraxCode Digitals Foundation.`;

  const messages = [...history.slice(-6), { role: "user", content: message }];

  async function callGroq(key, model) {
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          max_tokens: 900,
          temperature: 0.6,
          ...(model.startsWith("openai/gpt-oss")
            ? { reasoning_effort: "low" }
            : {}),
        }),
      },
    );
    return groqRes;
  }

  try {
    const groqRes = await callGroq(apiKey, "openai/gpt-oss-120b");

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      console.error(
        "Groq primary failed:",
        groqRes.status,
        errData.error?.message,
      );

      if (keys.length > 1) {
        const fallbackKey = keys[(keyIndex + 1) % keys.length];
        const retryRes = await callGroq(fallbackKey, "llama-3.3-70b-versatile");
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return res
            .status(200)
            .json({ reply: retryData.choices?.[0]?.message?.content || "" });
        }
        console.error("Groq fallback failed:", retryRes.status);
      }

      return res
        .status(503)
        .json({
          error: "DevAssist is busy right now. Please try again in a moment.",
        });
    }

    const data = await groqRes.json();
    return res
      .status(200)
      .json({ reply: data.choices?.[0]?.message?.content || "" });
  } catch (err) {
    console.error("DevAssist API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
