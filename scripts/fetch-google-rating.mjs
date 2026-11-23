#!/usr/bin/env node
// Refreshes src/data/google-rating.json from the Google Places API (New).
// Auth: service account (GSC_SA_JSON = JSON content, or GOOGLE_APPLICATION_CREDENTIALS = path),
// OAuth scope cloud-platform, billed to the SA's project. One call per run.
// On any failure the file is left untouched (last good value) and the script exits 1.
// fetchedAt is only bumped when the figures change or the stored value is older than
// REFRESH_DAYS, so an unchanged rating commits (and redeploys) at most monthly while the
// site's 60-day freshness guard never trips.
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/data/google-rating.json");
const PLACE_ID = "ChIJy4awWPdljEcR2RPH7GMUbc8"; // Ark Fiduciaire SA, Bd Georges-Favon 26
const CID = "14946625157719331801";
const PROFILE_URL = `https://maps.google.com/?cid=${CID}`;
const REFRESH_DAYS = 30;

function loadServiceAccount() {
  if (process.env.GSC_SA_JSON) return JSON.parse(process.env.GSC_SA_JSON);
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (p && existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  throw new Error("No service account: set GSC_SA_JSON or GOOGLE_APPLICATION_CREDENTIALS");
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: sa.token_uri || "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${claim}`);
  const jwt = `${head}.${claim}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`);
  return (await res.json()).access_token;
}

async function fetchPlace(sa, token) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Goog-User-Project": sa.project_id,
      "X-Goog-FieldMask": "id,displayName,rating,userRatingCount,googleMapsUri",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Places API HTTP ${res.status}: ${body?.error?.status || ""} ${body?.error?.message || ""}`.trim());
  return body;
}

function validate(place) {
  if (!String(place.googleMapsUri || "").includes(`cid=${CID}`)) {
    throw new Error(`Place ${place.id} does not resolve to CID ${CID}; refusing to store`);
  }
  const rating = Number(place.rating);
  const count = Number(place.userRatingCount);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new Error(`Invalid rating: ${place.rating}`);
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid review count: ${place.userRatingCount}`);
  return { rating: Math.round(rating * 10) / 10, count };
}

async function main() {
  const sa = loadServiceAccount();
  const place = await fetchPlace(sa, await accessToken(sa));
  const { rating, count } = validate(place);

  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const ageDays = prev?.fetchedAt ? (Date.now() - Date.parse(prev.fetchedAt)) / 86_400_000 : Infinity;
  const changed = !prev || prev.rating !== rating || prev.count !== count;
  if (!changed && ageDays < REFRESH_DAYS) {
    console.log(`Unchanged (${rating} / ${count} reviews), stored value is ${Math.floor(ageDays)} days old: no write.`);
    return;
  }
  const data = {
    rating,
    count,
    fetchedAt: new Date().toISOString(),
    placeId: PLACE_ID,
    url: PROFILE_URL,
    source: "Google Places API (New)",
  };
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${rating} / ${count} reviews (${changed ? "figures changed" : "freshness refresh"}).`);
}

main().catch((err) => {
  console.error(`google-rating: ${err.message}. Keeping the last good value.`);
  process.exit(1);
});
