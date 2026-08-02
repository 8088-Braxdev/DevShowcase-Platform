export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const query = `${SUPABASE_URL}/rest/v1/profiles?select=id,updated_at&full_name=not.is.null&order=updated_at.desc`;

  const response = await fetch(query, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) {
    res.status(500).send('Error generating sitemap');
    return;
  }

  const profiles = await response.json();

  const staticUrls = [
    { loc: 'https://devshowcase.braxcode.com/', priority: '1.00' },
    { loc: 'https://devshowcase.braxcode.com/devshowcase-help.html', priority: '0.80' },
    { loc: 'https://devshowcase.braxcode.com/devshowcase-gallery.html', priority: '0.64' },
    { loc: 'https://devshowcase.braxcode.com/devshowcase-legal.html', priority: '0.30' },
  ];

  const staticXml = staticUrls.map(u => `
<url>
  <loc>${u.loc}</loc>
  <priority>${u.priority}</priority>
</url>`).join('');

  const profileXml = profiles.map(p => `
<url>
  <loc>https://devshowcase.braxcode.com/devshowcase-profile.html?dev=${p.id}</loc>
  <lastmod>${new Date(p.updated_at).toISOString()}</lastmod>
  <priority>0.50</priority>
</url>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticXml}${profileXml}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).send(xml);
}
