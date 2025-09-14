#!/usr/bin/env node
'use strict';

/**
 * Probe the Azure Agent endpoint to discover if it accepts our request shape.
 * Usage: AZURE_AGENT_ENDPOINT=... AZURE_AGENT_API_KEY=... AZURE_AGENT_ID=... node scripts/probe-azure-agent.js
 */

const fetch = global.fetch || ((...args) => import('node-fetch').then(m => m.default(...args)));

async function probe() {
  const endpoint = process.env.AZURE_AGENT_ENDPOINT;
  const apiKey = process.env.AZURE_AGENT_API_KEY;
  const agentId = process.env.AZURE_AGENT_ID;
  const chatUrl = process.env.AZURE_AGENT_CHAT_URL;
  if (!endpoint || !apiKey || (!agentId && !chatUrl)) {
    console.error('Missing env. Need AZURE_AGENT_ENDPOINT, AZURE_AGENT_API_KEY, and AZURE_AGENT_ID (or AZURE_AGENT_CHAT_URL).');
    process.exit(2);
  }

  const urlCandidates = [];
  if (chatUrl) urlCandidates.push(chatUrl);
  else {
    urlCandidates.push(
      endpoint.replace(/\/?$/, '/') + `agents/${agentId}:chat`,
      endpoint.replace(/\/?$/, '/') + `assistants/${agentId}:chat`,
      endpoint.replace(/\/?$/, '/') + `agents/${agentId}/chat`,
      endpoint
    );
  }

  const headers = { 'Content-Type': 'application/json', 'api-key': apiKey };
  const sample = 'Return this exact JSON: {"ok":true,"provider":"azure-agent"}';
  const bodies = [
    { messages: [{ role: 'user', content: sample }], agentId },
    { input: sample, agentId },
    { input_text: sample, agent_id: agentId },
  ];

  let lastErr;
  for (const u of urlCandidates) {
    for (const body of bodies) {
      try {
        const res = await fetch(u, { method: 'POST', headers, body: JSON.stringify(body) });
        const text = await res.text();
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status} at ${u}: ${text.slice(0,300)}`);
          continue;
        }
        try {
          const json = JSON.parse(text);
          console.log('Success (parsed):', u, json);
          return;
        } catch {
          console.log('Success (raw):', u, text.slice(0, 200));
          return;
        }
      } catch (e) {
        lastErr = e;
      }
    }
  }
  if (lastErr) {
    console.error('Probe failed:', lastErr.message || lastErr);
    process.exit(1);
  }
}

probe();
