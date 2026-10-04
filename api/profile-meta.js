// api/profile-meta.js — injects real per-developer meta tags
// into devshowcase-profile-template.html before it reaches the visitor/Googlebot

const SUPABASE_URL = "https://embhkmxkuprdjkspsdii.supabase.co";
const SUPABASE_KEY = "sb_publishable_B9vhC35VSzJ3VskrtSETYw_ueSS6p1e";
const SITE = "https://devshowcase.braxcode.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  const devId = String(req.query.dev || req.query.id || "").trim();
  const proto = req.headers["x-forwarded-proto"] || "https";
  const base = `${proto}://${req.headers.host}`;

  // 1. No ID, or not a real ID shape -> 404 page
  if (!UUID.test(devId)) return send404(res, base);

  // 2. Load the template
  let html;
  try {
    const htmlRes = await fetch(`${base}/devshowcase-profile-template.html`);
    if (!htmlRes.ok) throw new Error("template status " + htmlRes.status);
    html = await htmlRes.text();
  } catch (err) {
    console.error("profile-meta: failed to load template", err);
    return res.status(500).send("Internal error");
  }

  // 3. Look up the developer
  try {
    const q = await fetch(
      `${SUPABASE_URL}/rest/v1/showcase_projects?user_id=eq.${encodeURIComponent(devId)}&select=dev_name,dev_role,country,dev_avatar_url&order=created_at.desc&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await q.json();

    // Supabase answered with a list, and the list is empty -> profile really doesn't exist
    if (Array.isArray(rows) && rows.length === 0) return send404(res, base);

    const dev = Array.isArray(rows) ? rows[0] : null;

    if (dev) {
      const name = dev.dev_name || "Developer";
      const role = dev.dev_role || "Developer";
      const location = dev.country || "";
      const title = `${name} — ${role} | DevShowcase`;
      const desc = `${name} is a ${role}${location ? " from " + location : ""}. View their projects on DevShowcase.`;
      const canonicalUrl = `${SITE}/devshowcase-profile.html?dev=${encodeURIComponent(devId)}`;
      const image =
        dev.dev_avatar_url && dev.dev_avatar_url.startsWith("http")
          ? dev.dev_avatar_url
          : `${SITE}/favicon.png`;

      html = html
        .replace(/<title id="metaTitle">.*?<\/title>/, `<title id="metaTitle">${esc(title)}</title>`)
        .replace(/(<meta name="description" id="metaDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
        .replace(/(<meta name="keywords" id="metaKeywords" content=")(.*?)(")/, `$1${esc(name)}, ${esc(role)}, developer, portfolio, devshowcase$3`)
        .replace(/(<meta property="og:title" id="ogTitle" content=")(.*?)(")/, `$1${esc(name)} — DevShowcase$3`)
        .replace(/(<meta property="og:description" id="ogDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
        .replace(/(<meta property="og:image" id="ogImage" content=")(.*?)(")/, `$1${esc(image)}$3`)
        .replace(/(<meta name="twitter:title" id="twTitle" content=")(.*?)(")/, `$1${esc(name)} — DevShowcase$3`)
        .replace(/(<meta name="twitter:description" id="twDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
        .replace(
          '<link rel="shortcut icon" href="favicon.png" type="image/x-icon" />',
          `<link rel="shortcut icon" href="favicon.png" type="image/x-icon" />\n  <link rel="canonical" href="${esc(canonicalUrl)}" />\n  <meta property="og:url" content="${esc(canonicalUrl)}" />`
        );
    }
  } catch (err) {
    // Supabase hiccup: serve the normal page, never 404 a real dev by mistake
    console.error("profile-meta: supabase lookup failed", err);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(html);
}

async function send404(res, base) {
  let page = "<h1>404 — Developer not found</h1>";
  try {
    const r = await fetch(`${base}/404.html`);
    if (r.ok) page = await r.text();
  } catch (err) {
    console.error("profile-meta: failed to load 404 page", err);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  return res.status(404).send(page);
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}