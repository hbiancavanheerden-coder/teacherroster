// Per-page web app manifest so "Add to Home Screen" from a shared roster link opens that link
// (iPhone uses the manifest's start_url). GET /api/manifest?start=/r/<token>
export default async (req) => {
  const start = new URL(req.url).searchParams.get('start') || '/app';
  const safe = /^\/(app|r\/[A-Za-z0-9_-]{10,100})$/.test(start) ? start : '/app';
  const body = {
    name: safe.startsWith('/r/') ? 'Duty roster' : 'Staffboard',
    short_name: safe.startsWith('/r/') ? 'Duty roster' : 'Staffboard',
    start_url: safe,
    scope: '/',
    display: 'standalone',
    background_color: '#F5F7FB',
    theme_color: '#070B1A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=3600' } });
};
