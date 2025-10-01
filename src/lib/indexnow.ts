export async function submitToIndexNow(urls: string[]) {
  const hostDomain = 'ark-fid.ch';
  const sitemapUrl = `https://${hostDomain}/sitemap.xml`;
  
  console.log('[Search Indexing] Notifying search engines about', urls.length, 'updated URLs');
  console.log('[Search Indexing] Using sitemap ping method');
  
  // Ping multiple search engines with sitemap updates
  const searchEngines = [
    {
      name: 'Google',
      url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    },
    {
      name: 'Bing',
      url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    },
  ];
  
  const results = await Promise.allSettled(
    searchEngines.map(async (engine) => {
      try {
        const res = await fetch(engine.url, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(10000), // 10s timeout
        });
        
        if (res.ok || res.status === 200) {
          console.log(`[Search Indexing] ✓ ${engine.name} pinged successfully`);
          return { engine: engine.name, success: true };
        } else {
          console.warn(`[Search Indexing] ⚠ ${engine.name} returned ${res.status}`);
          return { engine: engine.name, success: false, status: res.status };
        }
      } catch (error) {
        console.warn(`[Search Indexing] ⚠ ${engine.name} ping failed:`, error);
        return { engine: engine.name, success: false, error };
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  console.log(`[Search Indexing] ✓ Completed: ${successful}/${searchEngines.length} search engines notified`);
  
  // Return true if at least one succeeded
  return successful > 0;
}
