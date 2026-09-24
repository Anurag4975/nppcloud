// Static consistency + security checks on the migrations and code.
// Run: node tests/consistency.test.mjs
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
};

const rpc = readFileSync(new URL("../supabase/migrations/0002_rpc.sql", import.meta.url), "utf8");
const constants = readFileSync(new URL("../lib/constants.ts", import.meta.url), "utf8");

// 1. Every SECURITY DEFINER function must set search_path = public (fixed bug #1)
const definerFuncs = [...rpc.matchAll(/create or replace function[\s\S]*?language plpgsql security definer([\s\S]*?)\$\$/g)];
let missingSearchPath = [];
for (const m of rpc.matchAll(/create or replace function public\.(\w+)\([\s\S]*?\$\$/g)) {
  const block = m[0];
  if (block.includes("security definer") && !block.includes("set search_path = public")) {
    missingSearchPath.push(m[1]);
  }
}
check("all SECURITY DEFINER functions set search_path = public", missingSearchPath.length === 0, missingSearchPath.join(","));

// 2. change_plan must match status in ('active','past_due') (fixed bug #2)
check("change_plan matches ('active','past_due')", rpc.includes("status in ('active','past_due')"));

// 3. Every RAISE EXCEPTION code must have an entry in RPC_ERROR_STATUS (sanitized HTTP mapping)
const raiseCodes = new Set([...rpc.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]));
const mappedCodes = new Set([...constants.matchAll(/^\s{2}([a-z_]+):/gm)].map((m) => m[1]));
const unmapped = [...raiseCodes].filter((c) => !mappedCodes.has(c));
check("all RPC exception codes mapped to HTTP status", unmapped.length === 0, `unmapped: ${unmapped.join(", ")}`);

// 4. Every mutating API route (POST/PATCH/DELETE) must call csrfGuard
import { glob } from "node:fs/promises";
const routeFiles = [];
const walk = async (dir) => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const files = [];
  const scan = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) scan(p); else if (f === "route.ts") files.push(p); } };
  scan(dir);
  return files;
};
const files = await walk(new URL("../app/api", import.meta.url).pathname);
let noCsrf = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const hasMutation = /export async function (POST|PATCH|DELETE)/.test(src);
  if (hasMutation && !src.includes("csrfGuard")) noCsrf.push(f.split("/api/")[1]);
}
check("all mutating API routes use csrfGuard", noCsrf.length === 0, noCsrf.join(", "));

// 5. No raw DB error messages leaked to client (no `error.message` in Response.json)
let leaked = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  if (/Response\.json\([^)]*error\.message/.test(src)) leaked.push(f.split("/api/")[1]);
}
check("no raw DB error messages in responses", leaked.length === 0, leaked.join(", "));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
