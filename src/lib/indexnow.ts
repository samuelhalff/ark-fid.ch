export async function submitToIndexNow(urls: string[]) {
  const key = process.env.INDEXNOW_KEY;
  const host = process.env.NEXT_PUBLIC_SITE_URL || 'https://ark-fid.ch';
  if (!key) throw new Error('INDEXNOW_KEY not configured');
  const endpoint = 'https://api.indexnow.org/indexnow';
  const payload = {
    host: new URL(host).host,
    key,
    keyLocation: `${host.replace(/\/$/, '')}/${key}.txt`,
    urlList: urls,
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // avoid caching
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IndexNow failed: ${res.status} ${text}`);
  }
  return true;
}
