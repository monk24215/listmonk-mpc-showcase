#!/usr/bin/env node
// Verifies Listmonk URL, API credentials, and the role's permissions before
// the MCP is registered with a client. Run: npm run selftest
// Reads LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN from the environment
// (or from a .env file in the project root).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const base = (process.env.LISTMONK_URL ?? "").replace(/\/+$/, "");
const user = process.env.LISTMONK_API_USER ?? "";
const token = process.env.LISTMONK_API_TOKEN ?? "";
const readOnly = /^(1|true|yes|on)$/i.test(process.env.LISTMONK_MCP_READONLY ?? "");

let failures = 0;
const ok = (msg) => console.log(`  PASS  ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  FAIL  ${msg}`);
};

async function call(path, init = {}) {
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(`${user}:${token}`).toString("base64"),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

console.log(`listmonk-mcp selftest → ${base || "(LISTMONK_URL not set)"}`);

if (!base || !user || !token) {
  fail("LISTMONK_URL, LISTMONK_API_USER and LISTMONK_API_TOKEN must all be set");
  process.exit(1);
}

try {
  const h = await call("/health");
  h.status === 200 ? ok("Listmonk reachable (/api/health)") : fail(`/api/health returned ${h.status}`);
} catch (e) {
  fail(`cannot reach Listmonk: ${e.message}`);
  process.exit(1);
}

const lists = await call("/lists?per_page=1");
if (lists.status === 200) {
  ok("API credentials accepted (GET /api/lists)");
} else if (lists.status === 401 || lists.status === 403) {
  fail(`credentials rejected (${lists.status}). Check the API user, token, and that the user is enabled.`);
} else {
  fail(`GET /api/lists returned ${lists.status}`);
}

const cfg = await call("/config");
cfg.status === 200 ? ok("server config readable (GET /api/config)") : fail(`/api/config returned ${cfg.status}`);

if (!readOnly) {
  // Write probe: a create-then-delete of a throwaway private list. Skipped when read-only.
  const name = `mcp-selftest-${Date.now()}`;
  const created = await call("/lists", {
    method: "POST",
    body: JSON.stringify({ name, type: "private", optin: "single", tags: [], description: "selftest" }),
  });
  if (created.status === 200 && created.json?.data?.id) {
    ok("write permission confirmed (created and will delete a test list)");
    const del = await call(`/lists/${created.json.data.id}`, { method: "DELETE" });
    del.status === 200 ? ok("delete permission confirmed (test list removed)") : fail(`cleanup delete returned ${del.status} — remove list "${name}" manually`);
  } else if (created.status === 401 || created.status === 403) {
    fail(`API user lacks lists:manage_all (${created.status}). Use read-only mode or grant the permission.`);
  } else {
    fail(`create list probe returned ${created.status}`);
  }
} else {
  ok("LISTMONK_MCP_READONLY=true — write probe skipped");
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);