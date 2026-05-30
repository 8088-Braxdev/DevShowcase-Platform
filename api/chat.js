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

  const SYSTEM_PROMPT = `You are DevAssist, the official AI support assistant for DevShowcase — a global developer portfolio platform built by BraxCode Digitals Foundation, based in Mwanza, Tanzania 🇹🇿.

Your personality: Friendly, concise, helpful. You speak naturally in both English and Swahili — detect the user's language and reply in the same language.

About DevShowcase:
- Developers sign up, add projects with screenshots, and get discovered by clients worldwide
- Clients contact developers directly via WhatsApp — no middleman, no commission
- Platform is 100% free to use
- Built with HTML, CSS, JS, and Supabase for the database
- WhatsApp contact for support: +255618811359 (wa.me/255618811359)
- Future plans: Pro Badge and Featured Listings (paid, via mobile money or WhatsApp)

Key features:
- Gallery/Explore page: browse all developer projects, filter by category (Web, Mobile, AI, Design), search by name or tech
- Developer Dashboard: add/edit/delete projects, manage profile, view notifications
- Profile: name, role, bio, skills, WhatsApp number, GitHub, LinkedIn, website, avatar photo
- Reactions on projects: 👍 Like, 🔥 Fire, 👏 Clap
- Comments: visitors can comment on projects
- Notifications: bell icon in dashboard for reactions/comments/views
- Project images: JPG/PNG/WebP, max 2MB, recommended 1280×720+
- Tech stack input: comma-separated (e.g. React, Node.js, Supabase)
- Password reset: via email link from sign-in page
- Profile sharing: share button on profile page, copies link or opens share sheet on mobile

Rules:
- Keep replies SHORT and clear — max 5-8 lines unless the user needs step-by-step instructions
- Use emojis naturally but sparingly
- If you don't know something specific about DevShowcase, say "Wasiliana nasi: wa.me/255618811359" (or English equivalent)
- NEVER make up features that don't exist
- NEVER discuss competitors or unrelated topics`;

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
