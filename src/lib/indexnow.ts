export async function submitToIndexNow(urls: string[]) {
  // Hardcoded for simplicity - this is public info anyway
  const key = 'ebd95385d7154f45ba37d076b4efd008';
  const host = 'https://ark-fid.ch';
  
  const endpoint = 'https://api.indexnow.org/indexnow';
  const hostDomain = 'ark-fid.ch';
  const keyLocation = `${host}/${key}.txt`;
  
  const payload = {
    host: hostDomain,
    key,
    keyLocation,
    urlList: urls,
  };
  
  // Debug logging
  console.log('[IndexNow] Submitting', urls.length, 'URLs to IndexNow');
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[IndexNow] Failed:', res.status, text);
    throw new Error(`IndexNow failed: ${res.status} ${text}`);
  }
  
  console.log('[IndexNow] ✓ Success:', urls.length, 'URLs submitted');
  return true;
}
