#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const SITE_URL = (process.env.SITE_URL || "https://ark-fid.ch").replace(
  /\/$/,
  ""
);
const LOCALE = process.env.LINKEDIN_LOCALE || "fr";
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const ORGANIZATION_ID = process.env.LINKEDIN_ORGANIZATION_ID;
const POST_MAX_LENGTH = Number.parseInt(
  process.env.LINKEDIN_POST_MAX_LENGTH || "1200",
  10
);

const LINKEDIN_API = "https://api.linkedin.com/v2";

function resolveOrgUrn(value) {
  if (!value) return "";
  if (value.startsWith("urn:li:organization:")) {
    return value;
  }
  return `urn:li:organization:${value}`;
}

function readRessources(locale) {
  const filePath = path.join(
    __dirname,
    "..",
    "src",
    "translations",
    locale,
    "ressources.json"
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ressources.json for locale "${locale}"`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseDate(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function pickLatestArticle(articles = []) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return null;
  }
  const ranked = articles.map((article, index) => ({
    article,
    index,
    date: parseDate(article.date),
  }));
  ranked.sort((a, b) => b.date - a.date || b.index - a.index);
  return ranked[0]?.article || null;
}

function truncate(text, maxLength) {
  if (typeof text !== "string") return "";
  if (!Number.isFinite(maxLength) || maxLength <= 0) {
    return text.trim();
  }
  const normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildPostText({ title, description, url }) {
  const summary = description ? description.trim() : "";
  const text = [
    `🆕 ${title}`,
    summary,
    `Lire l'article : ${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return truncate(text, POST_MAX_LENGTH || 1200);
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(
      `${label} failed (${response.status}): ${bodyText.slice(0, 500)}`
    );
  }
  return bodyText ? JSON.parse(bodyText) : {};
}

async function registerImageUpload({ token, owner }) {
  return fetchJson(
    `${LINKEDIN_API}/assets?action=registerUpload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          owner,
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
          supportedUploadMechanism: ["SYNCHRONOUS_UPLOAD"],
        },
      }),
    },
    "LinkedIn registerUpload"
  );
}

async function uploadImage({ uploadUrl, token, buffer }) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/png",
    },
    body: buffer,
  });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `LinkedIn image upload failed (${response.status}): ${bodyText.slice(
        0,
        500
      )}`
    );
  }
}

async function createUgcPost({ token, payload }) {
  return fetchJson(
    `${LINKEDIN_API}/ugcPosts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "LinkedIn ugcPosts"
  );
}

(async function main() {
  if (!LINKEDIN_TOKEN || !ORGANIZATION_ID) {
    console.log(
      "ℹ️ LinkedIn secrets missing. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_ORGANIZATION_ID to enable publishing."
    );
    return;
  }

  const ressources = readRessources(LOCALE);
  const latest = pickLatestArticle(ressources.Articles);

  if (!latest) {
    throw new Error(`No articles found in locale "${LOCALE}"`);
  }

  const title = latest.title || "Nouvel article Ark Fiduciaire";
  const description = latest.description || "";
  const slug = latest.slug;
  if (!slug) {
    throw new Error("Latest article is missing a slug.");
  }

  const articleUrl = `${SITE_URL}/${LOCALE}/ressources/articles/${slug}/`;
  const imageUrl =
    process.env.LINKEDIN_IMAGE_URL ||
    `${SITE_URL}/${LOCALE}/ressources/articles/${slug}/opengraph-image`;

  console.log(`Preparing LinkedIn post for: ${articleUrl}`);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(
      `Failed to download article image (${imageResponse.status}) from ${imageUrl}`
    );
  }
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  const owner = resolveOrgUrn(ORGANIZATION_ID);
  const registerData = await registerImageUpload({
    token: LINKEDIN_TOKEN,
    owner,
  });

  const uploadMechanism =
    registerData?.value?.uploadMechanism?.[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ];
  const uploadUrl = uploadMechanism?.uploadUrl;
  const asset = registerData?.value?.asset;

  if (!uploadUrl || !asset) {
    throw new Error(
      `LinkedIn registerUpload response missing uploadUrl/asset: ${JSON.stringify(
        registerData
      )}`
    );
  }

  await uploadImage({ uploadUrl, token: LINKEDIN_TOKEN, buffer: imageBuffer });

  const postText = buildPostText({
    title,
    description,
    url: articleUrl,
  });

  const ugcPayload = {
    author: owner,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: postText,
        },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            description: {
              text: truncate(description || title, 300),
            },
            media: asset,
            title: {
              text: truncate(title, 200),
            },
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const postResponse = await createUgcPost({
    token: LINKEDIN_TOKEN,
    payload: ugcPayload,
  });

  console.log("✅ LinkedIn post created.");
  if (postResponse && postResponse.id) {
    console.log(`Post ID: ${postResponse.id}`);
  }
})().catch((error) => {
  console.error("❌ LinkedIn publish failed:", error.message);
  process.exit(1);
});
