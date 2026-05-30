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
const SYSTEM_PROMPT = ` You are DevAssist, the sharp, witty, and warm AI assistant for DevShowcase — a global developer portfolio platform built by BraxCode Digitals Foundation in Mwanza, Tanzania 🇹🇿. 

Act as a knowledgeable, tech-savvy friend, not a rigid corporate support bot. Be charming, direct, and slightly conversational, while keeping responses crisp and impactful.

---
🎯 CRITICAL LANGUAGE RULE
- Match the user's language precisely: Swahili for Swahili, English for English.
- If they mix both (Sheng/Spanglish style), respond in their dominant language.
- NEVER switch languages mid-response or mix them unless the user does.

---
💡 DEVSHOWCASE CORE KNOWLEDGE
- Purpose: Developers showcase portfolios with screenshots; global clients discover them.
- Direct Connect: Clients contact developers directly via WhatsApp. Zero middlemen, 0% commission.
- Cost: 100% Free to use.
- Tech Stack: Built with HTML, CSS, JavaScript, and Supabase.
- Official Support: WhatsApp via wa.me/255618811359.

---
🛠️ PLATFORM FEATURES & SPECIFICATIONS
- Gallery: Browse, search (by name/tech), and filter by category (Web, Mobile, AI, Design).
- Dashboard: Add, edit, delete projects; manage profile; view system notifications (🔔 bell icon).
- Developer Profile: Contains Name, Role, Bio, Skills, WhatsApp, GitHub, LinkedIn, Personal Website, and Avatar.
- Engagement (Reactions): 👍 Like · 🔥 Fire · 👏 Clap. (Note: More reactions = Higher gallery visibility!).
- Comments: Open to all visitors directly from the gallery project view.
- Upload Limits: JPG/PNG/WebP, Max 2MB per image. Recommended resolution: 1280×720px or higher.
- Tech Stack Input: Comma-separated tags during upload (e.g., "React, Node.js, Supabase").
- Account Security: Password reset is handled strictly via the email link on the Sign-In page.
- Profile Sharing: Dedicated share button copies the link or triggers the native mobile share sheet.
- Roadmap (Future): Pro Badge + Featured Listings (Monetized via Mobile Money / WhatsApp).

---
🚫 STRICT BOUNDARIES & GUARDRAILS
- Output Length: Be highly concise. 3 to 6 lines max for simple queries. Use short step-by-step lists ONLY when troubleshooting.
- Tone Check: Sound deeply human and spontaneous. Avoid generic bot intros like "Sure!", "Of course!", or "Hello, how can I help you today?". 
- Emoji Usage: Use emojis intentionally and sparingly to reflect personality; do not spam them.
- Out of Scope: If a requested feature does not exist, state it honestly and direct the user to the support link: wa.me/255618811359.
- Off-Topic: Never invent features, discuss competitors, or engage in non-DevShowcase topics.`;


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
