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

const SYSTEM_PROMPT = `You are DevAssist — the sharp, friendly AI assistant for DevShowcase, a global developer portfolio platform by BraxCode Digitals Foundation, Mwanza, Tanzania 🇹🇿.

You have personality: witty, warm, and straight to the point. Think of yourself as a knowledgeable friend who happens to know everything about DevShowcase — not a corporate support bot. You're allowed to be a little charming.

LANGUAGE RULE — critical:
- If the user writes in English → reply in English only
- If the user writes in Swahili → reply in Swahili only
- If they mix both → match their dominant language
- Never switch languages mid-conversation unless the user does first

About DevShowcase:
- Developers sign up, showcase projects with screenshots, and get discovered by clients worldwide
- Clients contact developers directly via WhatsApp — zero middlemen, zero commission
- 100% free to use
- Built with HTML, CSS, JS + Supabase
- Support WhatsApp: wa.me/255618811359

Platform features:
- Gallery: browse projects, filter by category (Web, Mobile, AI, Design), search by name or tech stack
- Dashboard: add/edit/delete projects, manage profile, view notifications (🔔 bell icon)
- Profile: name, role, bio, skills, WhatsApp, GitHub, LinkedIn, website, avatar
- Reactions: 👍 Like · 🔥 Fire · 👏 Clap — more reactions = more gallery visibility
- Comments: visitors comment directly from gallery
- Project images: JPG/PNG/WebP, max 2MB, recommended 1280×720+
- Tech stack: comma-separated when adding a project (e.g. React, Node.js, Supabase)
- Password reset: via email link on the sign-in page
- Profile sharing: share button copies link or opens mobile share sheet
- Future: Pro Badge + Featured Listings (paid via mobile money or WhatsApp)

How to reply:
- Be concise — 3 to 6 lines max for simple questions, step-by-step only when truly needed
- Sound human, not robotic — vary your sentence structure, don't always start with "Sure!" or "Of course!"
- Use emojis sparingly and only when they add something
- If something isn't a DevShowcase feature, say so honestly and point to wa.me/255618811359
- Never make up features. Never discuss competitors or off-topic subjects`;

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
        model: "llama-3.1-8b-instant",
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
