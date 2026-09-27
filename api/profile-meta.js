// api/profile-meta.js — injects real per-developer meta tags
// into devshowcase-profile-template.html before it reaches the visitor/Googlebot

const SUPABASE_URL = "https://embhkmxkuprdjkspsdii.supabase.co";
const SUPABASE_KEY = "sb_publishable_B9vhC35VSzJ3VskrtSETYw_ueSS6p1e";

export default async function handler(req, res) {
  const devId = req.query.dev || req.query.id;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  let html;
  try {
    const htmlRes = await fetch(`${proto}://${host}/devshowcase-profile-template.html`);
    html = await htmlRes.text();
  } catch (err) {
    console.error("profile-meta: failed to load template", err);
    return res.status(500).send("Internal error");
  }

  if (devId) {
    try {
      const q = await fetch(
        `${SUPABASE_URL}/rest/v1/showcase_projects?user_id=eq.${encodeURIComponent(devId)}&select=dev_name,dev_role,country,dev_avatar_url&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = await q.json();
      const dev = rows && rows[0];

      if (dev) {
        const name = dev.dev_name || "Developer";
        const role = dev.dev_role || "Developer";
        const location = dev.country || "";
        const title = `${name} — ${role} | DevShowcase`;
        const desc = `${name} is a ${role}${location ? " from " + location : ""}. View their projects on DevShowcase.`;
        const canonicalUrl = `https://devshowcase.braxcode.com/devshowcase-profile.html?dev=${devId}`;
        const image =
          dev.dev_avatar_url && dev.dev_avatar_url.startsWith("http")
            ? dev.dev_avatar_url
            : "https://devshowcase.braxcode.com/favicon.png";

        html = html
          .replace(/<title id="metaTitle">.*?<\/title>/, `<title id="metaTitle">${esc(title)}</title>`)
          .replace(/(<meta name="description" id="metaDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
          .replace(/(<meta name="keywords" id="metaKeywords" content=")(.*?)(")/, `$1${esc(name)}, ${esc(role)}, developer, portfolio, devshowcase$3`)
          .replace(/(<meta property="og:title" id="ogTitle" content=")(.*?)(")/, `$1${esc(name)} — DevShowcase$3`)
          .replace(/(<meta property="og:description" id="ogDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
          .replace(/(<meta property="og:image" id="ogImage" content=")(.*?)(")/, `$1${image}$3`)
          .replace(/(<meta name="twitter:title" id="twTitle" content=")(.*?)(")/, `$1${esc(name)} — DevShowcase$3`)
          .replace(/(<meta name="twitter:description" id="twDesc" content=")(.*?)(")/, `$1${esc(desc)}$3`)
          .replace(
            '<link rel="shortcut icon" href="favicon.png" type="image/x-icon" />',
            `<link rel="shortcut icon" href="favicon.png" type="image/x-icon" />\n  <link rel="canonical" href="${canonicalUrl}" />`
          );
      }
    } catch (err) {
      console.error("profile-meta: supabase lookup failed", err);
      // ikifail, tunaendelea kutoa page kama kawaida bila meta maalum
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return res.status(200).send(html);
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
