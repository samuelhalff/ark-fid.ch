export async function submitToIndexNow(urls: string[]) {
  const hostDomain = "ark-fid.ch";
  const sitemapUrl = `https://${hostDomain}/sitemap.xml`;
  const indexNowKey = "ebd95385d7154f45ba37d076b4efd008"; // Hosted at https://ark-fid.ch/ebd95385d7154f45ba37d076b4efd008.txt

  console.log(
    "[Search Indexing] Notifying search engines about",
    urls.length,
    "updated URLs"
  );

  // Use IndexNow for Yandex, sitemap ping for Bing (since IndexNow 403s for Bing)
  const searchEngines = [
    {
      name: "Bing",
      method: "sitemap",
      url: `https://www.bing.com/webmaster/ping.aspx?sitemap=${encodeURIComponent(
        sitemapUrl
      )}`,
    },
    {
      name: "Yandex",
      method: "indexnow",
      url: "https://yandex.com/indexnow",
    },
  ];

  const results = await Promise.allSettled(
    searchEngines.map(async (engine) => {
      try {
        let response: Response;
        if (engine.method === "sitemap") {
          response = await fetch(engine.url, {
            method: "GET",
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
        } else if (engine.method === "indexnow") {
          response = await fetch(engine.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              host: hostDomain,
              key: indexNowKey,
              urlList: urls,
            }),
            signal: AbortSignal.timeout(10000),
          });
        } else {
          throw new Error(`Unknown method: ${engine.method}`);
        }

        if (
          response.ok ||
          response.status === 202 ||
          (engine.name === "Bing" && response.status === 410)
        ) {
          console.log(
            `[Search Indexing] ✓ ${engine.name} notified successfully`
          );
          return { engine: engine.name, success: true };
        } else {
          console.warn(
            `[Search Indexing] ⚠ ${engine.name} returned ${response.status}`
          );
          return {
            engine: engine.name,
            success: false,
            status: response.status,
          };
        }
      } catch (error) {
        console.warn(
          `[Search Indexing] ⚠ ${engine.name} notification failed:`,
          error
        );
        return { engine: engine.name, success: false, error };
      }
    })
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;
  console.log(
    `[Search Indexing] ✓ Completed: ${successful}/${searchEngines.length} search engines notified`
  );

  // Return true if at least one succeeded
  return successful > 0;
}
