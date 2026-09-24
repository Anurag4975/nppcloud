// Tests the Supabase migrations against an embedded Postgres (pglite).
// Run: node tests/migrations.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const db = new PGlite();
let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
}
async function expectRaise(code, fn) {
  try { await fn(); return null; }
  catch (e) { return e.message?.includes(code) ? code : `wrong: ${e.message}`; }
}

// --- Mock the Supabase auth schema (handle_new_user trigger fires on it) ---
await db.exec(`create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb
);
-- Supabase provides auth.uid(); mock it for policy creation (tests run as
-- superuser, which bypasses RLS, so the return value doesn't matter here).
create or replace function auth.uid() returns uuid language sql as $f$ select null::uuid $f$;
-- Supabase's standard roles, referenced by some RLS policies' "to authenticated".
do $r$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; end $r$;`);

for (const f of ["0001_init.sql", "0002_rpc.sql", "0003_rls.sql", "0004_seed.sql"]) {
  const sql = readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8");
  await db.exec(sql);
  console.log(`applied ${f}`);
}

// --- Seed: Free plan must exist ---
const free = await db.query(`select id, quota_bytes from public.plans where name='Free'`);
check("Free plan seeded", free.rows.length === 1);
const freeId = free.rows[0].id;

// --- 1. Signup trigger: profile + usage + Free sub created ---
const u = await db.query(`insert into auth.users (email, raw_user_meta_data) values ('a@x.com', '{"full_name":"A"}') returning id`);
const uid = u.rows[0].id;
const prof = await db.query(`select name, role from public.profiles where id=$1`, [uid]);
check("profile created by trigger", prof.rows.length === 1 && prof.rows[0].name === "A" && prof.rows[0].role === "user");
const usg = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
check("usage row created", usg.rows.length === 1 && usg.rows[0].stored_bytes === 0);
const sub = await db.query(`select status, plan_id from public.subscriptions where user_id=$1`, [uid]);
check("Free subscription created", sub.rows.length === 1 && sub.rows[0].status === "active" && sub.rows[0].plan_id === freeId);

// --- 2. reserve_upload: success, reserves space ---
const fid = crypto.randomUUID();
const key = `users/${uid}/objects/${fid}`;
const prov = await db.query(`select id from public.storage_providers where is_active`);
const provId = prov.rows[0].id;
const rv = await db.query(
  `select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
  [uid, "photo.jpg", 1024, "image/jpeg", null, key, provId, fid]
);
check("reserve_upload returns file", rv.rows.length === 1 && rv.rows[0].id === fid);
const usg2 = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
check("reserve_upload increments stored_bytes", usg2.rows[0].stored_bytes === 1024);
const frow = await db.query(`select status, size_bytes from public.files where id=$1`, [fid]);
check("file status=pending", frow.rows[0].status === "pending" && frow.rows[0].size_bytes === 1024);

// --- 3. complete-upload simulation: adjust stored by (real-reserved), increment uploaded ---
await db.query(`select public.increment_usage($1,$2,$3,$4)`, [uid, 0, 1024, 0]); // real=reserved => stored delta 0, uploaded +1024
await db.query(`update public.files set status='active' where id=$1`, [fid]);
const usg3 = await db.query(`select stored_bytes, uploaded_bytes from public.usage where user_id=$1`, [uid]);
check("after complete: stored=1024 uploaded=1024", usg3.rows[0].stored_bytes === 1024 && usg3.rows[0].uploaded_bytes === 1024);

// --- 4. reserve_download: within allowance (2x) ok; beyond raises ---
const dl = await db.query(`select * from public.reserve_download($1,$2)`, [uid, fid]);
check("reserve_download returns object_key", dl.rows.length === 1 && dl.rows[0].object_key === key);
// allowance = uploaded(1024) * 2 = 2048; first download used 1024, second uses 1024 -> exactly at limit
await db.query(`select * from public.reserve_download($1,$2)`, [uid, fid]);
const dl3 = await expectRaise("download_limit_exceeded", () => db.query(`select * from public.reserve_download($1,$2)`, [uid, fid]));
check("reserve_download enforces 2x allowance", dl3 === "download_limit_exceeded", `got ${dl3}`);

// --- 5. quota_exceeded: fill usage to near Free quota, then a small upload trips it
//     (a huge file trips file_too_large first — that's a separate, correct check)
await db.query(`update public.usage set stored_bytes = $1 where user_id=$2`, [(15n * 1024n * 1024n * 1024n - 1024n).toString(), uid]);
const bigFid = crypto.randomUUID();
const qe = await expectRaise("quota_exceeded", () =>
  db.query(`select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, "small.bin", 2048, null, null, `users/${uid}/objects/${bigFid}`, provId, bigFid]));
check("reserve_upload enforces quota", qe === "quota_exceeded", `got ${qe}`);
await db.query(`update public.usage set stored_bytes = 1024 where user_id=$1`, [uid]); // reset

// --- 6. invalid_parent: parent folder not owned ---
const badParent = await expectRaise("invalid_parent", () =>
  db.query(`select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, "x.txt", 10, null, crypto.randomUUID(), `users/${uid}/objects/${crypto.randomUUID()}`, provId, crypto.randomUUID()]));
check("reserve_upload rejects foreign parent", badParent === "invalid_parent", `got ${badParent}`);

// --- 7. file_too_large ---
const ftl = await expectRaise("file_too_large", () =>
  db.query(`select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
    [uid, "huge.bin", (2n * 1024n * 1024n * 1024n).toString(), null, null, `users/${uid}/objects/${crypto.randomUUID()}`, provId, crypto.randomUUID()]));
check("reserve_upload enforces max_file_size", ftl === "file_too_large", `got ${ftl}`);

// --- 8. trash / restore / purge ---
await db.query(`select public.trash_file($1,$2)`, [uid, fid]);
const t = await db.query(`select status from public.files where id=$1`, [fid]);
check("trash_file sets status=trashed", t.rows[0].status === "trashed");
const usgTrash = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
check("trash does NOT reclaim quota (counts toward storage)", usgTrash.rows[0].stored_bytes === 1024);
await db.query(`select public.restore_file($1,$2)`, [uid, fid]);
const rt = await db.query(`select status from public.files where id=$1`, [fid]);
check("restore_file sets status=active", rt.rows[0].status === "active");
await db.query(`select public.trash_file($1,$2)`, [uid, fid]);
const purgedKey = await db.query(`select public.purge_file_permanent($1,$2) as k`, [uid, fid]);
check("purge returns object_key", purgedKey.rows[0].k === key);
const afterPurge = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
check("purge reclaims quota", afterPurge.rows[0].stored_bytes === 0);
const gone = await db.query(`select 1 from public.files where id=$1`, [fid]);
check("purge deletes row", gone.rows.length === 0);

// --- 9. folder recursive trash ---
const folder = await db.query(`insert into public.folders (user_id, name) values ($1,'Docs') returning id`, [uid]);
const fid2 = folder.rows[0].id;
const subf = await db.query(`insert into public.folders (user_id, name, parent_id) values ($1,'Sub',$2) returning id`, [uid, fid2]);
const nfid = crypto.randomUUID();
await db.query(`insert into public.files (id, user_id, name, size_bytes, parent_id, object_key, status) values ($1,$2,'a.pdf',5,$3,$4,'active')`,
  [nfid, uid, subf.rows[0].id, `users/${uid}/objects/${nfid}`]);
await db.query(`select public.trash_folder_recursive($1,$2)`, [uid, fid2]);
const fcount = await db.query(`select count(*)::int c from public.files where user_id=$1 and status='trashed'`, [uid]);
check("recursive trash trashes nested files", fcount.rows[0].c === 1);
const foldCount = await db.query(`select count(*)::int c from public.folders where user_id=$1 and status='trashed'`, [uid]);
check("recursive trash trashes folder tree", foldCount.rows[0].c === 2);

// --- 10. share link redemption ---
// re-upload a file to share
const sfid = crypto.randomUUID();
await db.query(`select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
  [uid, "share.txt", 100, "text/plain", null, `users/${uid}/objects/${sfid}`, provId, sfid]);
await db.query(`update public.files set status='active' where id=$1`, [sfid]);
const link = await db.query(`insert into public.share_links (file_id, created_by, max_downloads, max_bytes_served) values ($1,$2,1,1000) returning id`, [sfid, uid]);
const linkId = link.rows[0].id;
const red = await db.query(`select * from public.redeem_share_link($1)`, [linkId]);
check("redeem_share_link returns file", red.rows.length === 1 && red.rows[0].name === "share.txt");
const red2 = await expectRaise("link_download_limit_reached", () => db.query(`select * from public.redeem_share_link($1)`, [linkId]));
check("redeem enforces max_downloads", red2 === "link_download_limit_reached", `got ${red2}`);
// revoked
const link2 = await db.query(`insert into public.share_links (file_id, created_by, revoked) values ($1,$2,true) returning id`, [sfid, uid]);
const rev = await expectRaise("link_revoked", () => db.query(`select * from public.redeem_share_link($1)`, [link2.rows[0].id]));
check("redeem rejects revoked", rev === "link_revoked", `got ${rev}`);

// --- 11. change_plan: upgrade immediate, downgrade scheduled ---
const pro = await db.query(`select id, price_npr from public.plans where name='Pro'`);
const proId = pro.rows[0].id;
await db.query(`select public.change_plan($1,$2,false)`, [uid, proId]);
const afterUp = await db.query(`select plan_id, cancel_at_period_end, scheduled_plan_id from public.subscriptions where user_id=$1`, [uid]);
check("upgrade applies immediately", afterUp.rows[0].plan_id === proId && afterUp.rows[0].cancel_at_period_end === false);
// downgrade back to Free -> scheduled
await db.query(`select public.change_plan($1,$2,false)`, [uid, freeId]);
const afterDown = await db.query(`select plan_id, scheduled_plan_id, cancel_at_period_end from public.subscriptions where user_id=$1`, [uid]);
check("downgrade scheduled for period end", afterDown.rows[0].plan_id === proId && afterDown.rows[0].scheduled_plan_id === freeId && afterDown.rows[0].cancel_at_period_end === true);
// p_immediate (system forced) applies now
await db.query(`select public.change_plan($1,$2,true)`, [uid, freeId]);
const afterImm = await db.query(`select plan_id, scheduled_plan_id from public.subscriptions where user_id=$1`, [uid]);
check("p_immediate downgrade applies now", afterImm.rows[0].plan_id === freeId && afterImm.rows[0].scheduled_plan_id === null);

// --- 12. purge_abandoned_pending reclaims reserved space ---
const pfid = crypto.randomUUID();
await db.query(`select * from public.reserve_upload($1,$2,$3,$4,$5,$6,$7,$8)`,
  [uid, "abandoned.bin", 777, null, null, `users/${uid}/objects/${pfid}`, provId, pfid]);
await db.query(`update public.files set created_at = now() - interval '48 hours' where id=$1`, [pfid]);
const before = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
await db.query(`select public.purge_abandoned_pending(24)`);
const after = await db.query(`select stored_bytes from public.usage where user_id=$1`, [uid]);
check("purge_abandoned_pending reclaims reserved bytes", before.rows[0].stored_bytes - after.rows[0].stored_bytes === 777);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
