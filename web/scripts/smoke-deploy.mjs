#!/usr/bin/env node
const url = process.env.SMOKE_URL ?? 'https://psmith.dev/';

const response = await fetch(url, {
  method: 'HEAD',
  redirect: 'manual',
  headers: {
    'User-Agent': 'psmithdev-smoke-check/1.0 (+https://psmith.dev)',
  },
});

if (response.status !== 200) {
  console.error(`Smoke check failed: ${url} returned HTTP ${response.status}`);
  for (const header of ['server', 'cf-cache-status', 'x-vercel-id', 'x-vercel-mitigated']) {
    const value = response.headers.get(header);
    if (value) console.error(`  ${header}: ${value}`);
  }
  process.exit(1);
}

console.log(`Smoke check passed: ${url} returned HTTP 200`);
