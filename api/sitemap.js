const SUPABASE_URL = "https://embhkmxkuprdjkspsdii.supabase.co";
const SUPABASE_KEY = "sb_publishable_B9vhC35VSzJ3VskrtSETYw_ueSS6p1e";
const SITE = "https://devshowcase.braxcode.com";

export default async function handler(req, res) {
  let rows = [];
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/showcase_projects?select=user_id,created_at,updated_at&order=created_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (r.ok) rows = await r.json();
  } catch (e) {
    console.error("sitemap: supabase failed", e);
  }

  // newest activity per developer
  const devs = new Map();
  for (const p of rows) {
    if (!p.user_id) continue;
    const t = p.updated_at || p.created_at;
    if (!devs.has(p.user_id) || t > devs.get(p.user_id)) devs.set(p.user_id, t);
  }

  const pages = ["/", "/devshowcase-gallery.html", "/devshowcase-developers.html", "/devshowcase-help.html", "/devshowcase-legal.html"];

  const urls = [
    ...pages.map((p) => `<url><loc>${SITE}${p}</loc></url>`),
    ...[...devs].map(
      ([id, t]) =>
        `<url><loc>${SITE}/devshowcase-profile.html?dev=${encodeURIComponent(id)}</loc><lastmod>${new Date(t).toISOString()}</lastmod></url>`
    ),
  ];

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate");
  return res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`
  );
}