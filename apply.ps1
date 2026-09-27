$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$dash   = "app\(shell)\dashboard\DashboardClient.tsx"
$shell  = "components\dashboard\AppShell.tsx"
$usage  = "app\api\usage\route.ts"
$upload = "app\api\files\complete-upload\route.ts"

foreach ($f in @($dash, $shell, $usage, $upload)) {
  if (-not (Test-Path $f)) { throw "MISSING: $f" }
}

# ── 1. DashboardClient.tsx ──────────────────────────────────────────────
$t = Get-Content -Raw -LiteralPath $dash

$oldA = "    }`r`n    refresh();`r`n  }`r`n`r`n  async function handleDownload(id: string) {"
$newA = "    }`r`n    refresh();`r`n    window.dispatchEvent(new CustomEvent(`"nppcloud:usage-changed`"));`r`n  }`r`n`r`n  async function handleDownload(id: string) {"
if ($t.Contains($oldA)) {
  $t = $t.Replace($oldA, $newA)
  Write-Host "OK  DashboardClient 1a (usage-changed event)"
} else {
  Write-Host "SKIP DashboardClient 1a (already applied or anchor changed)"
}

$oldB = '<Button onClick={handleNewFolder}>'
$newB = '<Button onClick={handleNewFolder} disabled={creatingFolder} loading={creatingFolder}>'
if ($t.Contains($oldB)) {
  $t = $t.Replace($oldB, $newB)
  Write-Host "OK  DashboardClient 1b (button disabled/loading)"
} else {
  Write-Host "SKIP DashboardClient 1b (already applied)"
}

$oldC = 'onKeyDown={(e) => e.key === "Enter" && handleNewFolder()}'
$newC = 'onKeyDown={(e) => e.key === "Enter" && !creatingFolder && handleNewFolder()}'
if ($t.Contains($oldC)) {
  $t = $t.Replace($oldC, $newC)
  Write-Host "OK  DashboardClient 1c (input guard)"
} else {
  Write-Host "SKIP DashboardClient 1c (already applied)"
}

Set-Content -LiteralPath $dash -Value $t -NoNewline -Encoding UTF8

# ── 2. AppShell.tsx ─────────────────────────────────────────────────────
$t = Get-Content -Raw -LiteralPath $shell

# Match on the smaller unique anchor, not the whole useEffect block, to
# avoid whitespace differences. We only need to detect whether the fix has
# already been applied.
if ($t.Contains('nppcloud:usage-changed')) {
  Write-Host "SKIP AppShell (already patched)"
} else {
  $oldS = @"
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {});
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setProfile(j.profile))
      .catch(() => {});
  }, []);
"@

  $newS = @"
  useEffect(() => {
    const reloadUsage = () => {
      fetch("/api/usage")
        .then((r) => r.json())
        .then(setUsage)
        .catch(() => {});
    };
    reloadUsage();

    const onUsage = () => reloadUsage();
    const onVis = () => {
      if (!document.hidden) reloadUsage();
    };
    window.addEventListener("nppcloud:usage-changed", onUsage);
    document.addEventListener("visibilitychange", onVis);

    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setProfile(j.profile))
      .catch(() => {});

    return () => {
      window.removeEventListener("nppcloud:usage-changed", onUsage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
"@

  if (-not $t.Contains($oldS)) { throw "AppShell: anchor not found" }
  $t = $t.Replace($oldS, $newS)
  Set-Content -LiteralPath $shell -Value $t -NoNewline -Encoding UTF8
  Write-Host "OK  AppShell"
}

# ── 3. usage/route.ts ───────────────────────────────────────────────────
$t = Get-Content -Raw -LiteralPath $usage

$oldU = '.select("plan:plans(name, quota_bytes, download_multiplier)")'
$newU = '.select("plan:plans!subscriptions_plan_id_fkey(name, quota_bytes, download_multiplier)")'
if ($t.Contains($oldU)) {
  $t = $t.Replace($oldU, $newU)
  Set-Content -LiteralPath $usage -Value $t -NoNewline -Encoding UTF8
  Write-Host "OK  usage/route"
} else {
  Write-Host "SKIP usage/route (already patched)"
}

# ── 4. complete-upload/route.ts ─────────────────────────────────────────
# Only remove the single line `return internalError();` — do NOT try to
# match the surrounding comment block (contains an em-dash that may differ
# across encodings). Deleting this one line is the entire functional fix.
$t = Get-Content -Raw -LiteralPath $upload

if ($t.Contains("return internalError();")) {
  # Match the line and its preceding newline so we don't leave a blank line.
  $pattern = '(\r?\n)\s*return internalError\(\);(\r?\n)'
  $t = [regex]::Replace($t, $pattern, '$1', 1)
  Set-Content -LiteralPath $upload -Value $t -NoNewline -Encoding UTF8
  Write-Host "OK  complete-upload (removed return internalError)"
} else {
  Write-Host "SKIP complete-upload (already patched)"
}

Write-Host ""
Write-Host "Done. Run: git diff"