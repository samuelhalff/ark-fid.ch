export async function submitToIndexNow(urls: string[]) {
  // Hardcoded for simplicity - this is public info anyway
  const key = 'ebd95385d7154f45ba37d076b4efd008';
  const hostDomain = 'ark-fid.ch'; // Just domain, no protocol
  
  // Try Bing's endpoint first (more lenient), fallback to main API
  const endpoint = 'https://www.bing.com/indexnow';
  const keyLocation = `https://${hostDomain}/${key}.txt`;
  
  const payload = {
    host: hostDomain,
    key,
    keyLocation,
    urlList: urls,
  };
  
  // Debug logging
  console.log('[IndexNow] Submitting', urls.length, 'URLs to IndexNow (via Bing)');
  console.log('[IndexNow] Host:', hostDomain);
  console.log('[IndexNow] Key location:', keyLocation);
  console.log('[IndexNow] Sample URLs:', urls.slice(0, 3));
  
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'ark-fid.ch IndexNow Submitter',
    },
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
