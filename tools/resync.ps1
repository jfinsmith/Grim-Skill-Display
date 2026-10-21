<#
.SYNOPSIS
  Resync every bundled game-data file from XIVAPI v2. Windows PowerShell 5.1+, no Node needed.

.DESCRIPTION
  Rebuilds, in this order:
    resources/data/actions.json         full Action sheet  -> id:{n,i,cd,p,j,cat,lvl[,pos][,cb]}
    resources/data/items.json           Medicine items (pots / tinctures)
    resources/data/mounts.json          Mount sheet
    resources/data/generalactions.json  GeneralAction Name -> icon (Desynthesis, Repair, ...)
    resources/icons/*.png               any icon referenced above that isn't on disk yet
    resources/classjob/<ABBR>.png       one job icon per ClassJob row (adds new jobs automatically)
    resources/data/meta.json            {gameVersion, syncedAt} shown in the settings footer

  Positionals are derived from each action's own description ("... when executed from a
  target's rear/flank"), so a new job or a reworked skill needs no code change:
    pos = "rear" | "flank"     cb = 1 when the action is a combo follow-up (ActionCombo != 0)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/resync.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/resync.ps1 -SkipIcons
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/resync.ps1 -Only actions,icons,meta
#>
param(
  [switch]$SkipIcons,
  [string]$Only,   # comma-separated subset of: actions,items,mounts,general,icons,jobs,meta
  [string]$Root = (Split-Path -Parent $PSScriptRoot)
)
$OnlySet = @(); if ($Only) { $OnlySet = $Only.Split(',') | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ } }
function Phase([string]$name) { return ($OnlySet.Count -eq 0) -or ($OnlySet -contains $name) }

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$B = 'https://v2.xivapi.com/api'
$DataDir = Join-Path $Root 'resources\data'
$IconDir = Join-Path $Root 'resources\icons'
$JobDir  = Join-Path $Root 'resources\classjob'
New-Item -ItemType Directory -Force $DataDir, $IconDir, $JobDir | Out-Null
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Get-Json([string]$url, [int]$tries = 4) {
  for ($t = 1; $t -le $tries; $t++) {
    try { return Invoke-RestMethod -Uri $url -TimeoutSec 90 }
    catch { if ($t -eq $tries) { throw }; Start-Sleep -Milliseconds (700 * $t) }
  }
}

# Page a whole sheet (500 rows per request, cursor-based).
function Get-Rows([string]$sheet, [string]$fields, [string]$extra = '') {
  $all = New-Object 'System.Collections.Generic.List[object]'
  $after = $null
  while ($true) {
    $cursor = if ($null -eq $after) { '' } else { "&after=$after" }
    $d = Get-Json "$B/sheet/${sheet}?limit=500$cursor&fields=$([uri]::EscapeDataString($fields))$extra"
    $rows = @($d.rows)
    if ($rows.Count -eq 0) { break }
    foreach ($r in $rows) { $all.Add($r); $after = $r.row_id }
    Write-Host "  $sheet : $($all.Count) rows (cursor $after)"
  }
  return $all
}

function Icon-Num($icon) { if ($icon -and $icon.path -and $icon.path -match '(\d{6})\.tex$') { $Matches[1] } else { '' } }
function Esc([string]$s) { if ($null -eq $s) { return '' }; $s.Replace('\', '\\').Replace('"', '\"').Replace("`r", '').Replace("`n", '\n').Replace("`t", '\t') }
function Write-Text([string]$path, [string]$text) { [IO.File]::WriteAllText($path, $text, $Utf8) }

function Save-Png([string]$url, [string]$dest) {
  for ($t = 1; $t -le 3; $t++) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $dest -TimeoutSec 90
      if ((Get-Item $dest).Length -gt 100) { return $true }
      Remove-Item $dest -Force
    } catch { Start-Sleep -Milliseconds (500 * $t) }
  }
  return $false
}
function Save-Icon([string]$num, [string]$dest) {
  $folder = '{0:D6}' -f ([int]$num - ([int]$num % 1000))
  return Save-Png "$B/asset?path=ui/icon/$folder/${num}_hr1.tex&format=png" $dest
}

# ---------------------------------------------------------------- actions
$icons = New-Object 'System.Collections.Generic.HashSet[string]'
if (Phase 'actions') {
Write-Host "`n== Action sheet =="
$fields = 'Name,Icon,CooldownGroup,AdditionalCooldownGroup,IsPlayerAction,ClassJob.Abbreviation,ClassJobCategory.Name,ActionCategory@as(raw),ClassJobLevel,ActionCombo@as(raw),IsPvP'
$rows = Get-Rows 'Action' $fields '&transient=Description'

# descriptions: XIVAPI attaches them as row.transient when asked; fall back to paging ActionTransient
$descOf = @{}
if ($rows.Count -and -not ($rows[0].PSObject.Properties['transient'])) {
  Write-Host "  (no transient data inline; paging ActionTransient)"
  foreach ($r in (Get-Rows 'ActionTransient' 'Description')) { $descOf[[string]$r.row_id] = [string]$r.fields.Description }
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.Append('{')
$kept = 0; $players = 0
$positionals = New-Object 'System.Collections.Generic.List[string]'
foreach ($r in $rows) {
  $f = $r.fields
  $i = Icon-Num $f.Icon
  if (-not $f.Name -and -not $i) { continue }
  $p = if ($f.IsPlayerAction) { 1 } else { 0 }
  $j = if ($f.ClassJob -and $f.ClassJob.fields) { [string]$f.ClassJob.fields.Abbreviation } else { '' }
  # combo-replacement skills (Viper's Flanksting Strike, ...) have no ClassJob and aren't flagged
  # IsPlayerAction; their ClassJobCategory is still the single job, so use that.
  if (-not $j -and $f.ClassJobCategory -and $f.ClassJobCategory.fields -and ([string]$f.ClassJobCategory.fields.Name) -match '^[A-Z]{3}$') { $j = $Matches[0] }
  $cd0 = [int]$f.CooldownGroup; $cd1 = [int]$f.AdditionalCooldownGroup
  $cat = [int]$f.'ActionCategory@as(raw)'; $lvl = [int]$f.ClassJobLevel
  $extra = ''
  if ($p -eq 1) { $players++ }
  # positional / combo flags for every real battle skill (Spell 2, Weaponskill 3, Ability 4)
  if (-not $f.IsPvP -and $cat -ge 2 -and $cat -le 4 -and $i -and $i -ne '000405') {
    $desc = if ($r.PSObject.Properties['transient'] -and $r.transient) { [string]$r.transient.Description } else { $descOf[[string]$r.row_id] }
    if ($desc -and $desc -match "executed from a target's (rear|flank)") {
      $extra += ",`"pos`":`"$($Matches[1])`""
      $positionals.Add(("{0,-6} {1,-22} {2}" -f $j, $f.Name, $Matches[1]))
    }
    if ([int]$f.'ActionCombo@as(raw)' -ne 0) { $extra += ',"cb":1' }
  }
  [void]$sb.Append("`"$($r.row_id)`":{`"n`":`"$(Esc $f.Name)`",`"i`":`"$i`",`"cd`":[$cd0,$cd1],`"p`":$p,`"j`":`"$j`",`"cat`":$cat,`"lvl`":$lvl$extra},")
  if ($i) { [void]$icons.Add($i) }
  $kept++
}
if ($sb.Length -gt 1) { $sb.Length-- }
[void]$sb.Append('}')
Write-Text (Join-Path $DataDir 'actions.json') $sb.ToString()
Write-Host "actions kept: $kept  (player actions: $players)  unique icons: $($icons.Count)"
Write-Host "positional actions ($($positionals.Count)):"
$positionals | Sort-Object | ForEach-Object { Write-Host "   $_" }
}

# ---------------------------------------------------------------- items (Medicine)
if (Phase 'items') {
Write-Host "`n== Item sheet (Medicine only) =="
$sb = New-Object System.Text.StringBuilder; [void]$sb.Append('{'); $n = 0
foreach ($r in (Get-Rows 'Item' 'Name,Icon,ItemUICategory.Name')) {
  $f = $r.fields
  $cat = if ($f.ItemUICategory -and $f.ItemUICategory.fields) { [string]$f.ItemUICategory.fields.Name } else { '' }
  if ($cat -ne 'Medicine') { continue }
  $i = Icon-Num $f.Icon
  if (-not $f.Name -or -not $i) { continue }
  [void]$sb.Append("`"$($r.row_id)`":{`"n`":`"$(Esc $f.Name)`",`"i`":`"$i`"},"); [void]$icons.Add($i); $n++
}
if ($sb.Length -gt 1) { $sb.Length-- }; [void]$sb.Append('}')
Write-Text (Join-Path $DataDir 'items.json') $sb.ToString()
Write-Host "medicine items kept: $n"
}

# ---------------------------------------------------------------- mounts
if (Phase 'mounts') {
Write-Host "`n== Mount sheet =="
$ti = (Get-Culture).TextInfo
$sb = New-Object System.Text.StringBuilder; [void]$sb.Append('{'); $n = 0
foreach ($r in (Get-Rows 'Mount' 'Singular,Icon')) {
  $f = $r.fields
  $i = Icon-Num $f.Icon
  if (-not $f.Singular -or -not $i) { continue }
  [void]$sb.Append("`"$($r.row_id)`":{`"n`":`"$(Esc ($ti.ToTitleCase([string]$f.Singular)))`",`"i`":`"$i`"},"); [void]$icons.Add($i); $n++
}
if ($sb.Length -gt 1) { $sb.Length-- }; [void]$sb.Append('}')
Write-Text (Join-Path $DataDir 'mounts.json') $sb.ToString()
Write-Host "mounts kept: $n"
}

# ---------------------------------------------------------------- general actions
if (Phase 'general') {
Write-Host "`n== GeneralAction sheet =="
$sb = New-Object System.Text.StringBuilder; [void]$sb.Append('{'); $n = 0
foreach ($r in (Get-Rows 'GeneralAction' 'Name,Icon')) {
  $f = $r.fields
  $i = Icon-Num $f.Icon
  if (-not $f.Name -or -not $i -or $i -eq '000405' -or $i -eq '000000') { continue }
  [void]$sb.Append("`"$(Esc $f.Name)`":`"$i`","); [void]$icons.Add($i); $n++
}
if ($sb.Length -gt 1) { $sb.Length-- }; [void]$sb.Append('}')
Write-Text (Join-Path $DataDir 'generalactions.json') $sb.ToString()
Write-Host "general actions mapped: $n"
}

# ---------------------------------------------------------------- icons
# (icons referenced by any data file not rebuilt in this run are read back from disk)
if ((Phase 'icons') -and -not $SkipIcons) {
  Write-Host "`n== Icons =="
  if ($Only) {
    foreach ($file in 'actions.json', 'items.json', 'mounts.json') {
      $path = Join-Path $DataDir $file
      if (Test-Path $path) { foreach ($m in [regex]::Matches([IO.File]::ReadAllText($path), '"i":"(\d{6})"')) { [void]$icons.Add($m.Groups[1].Value) } }
    }
    $path = Join-Path $DataDir 'generalactions.json'
    if (Test-Path $path) { foreach ($m in [regex]::Matches([IO.File]::ReadAllText($path), ':"(\d{6})"')) { [void]$icons.Add($m.Groups[1].Value) } }
  }
  $have = @{}
  Get-ChildItem $IconDir -Filter *.png | ForEach-Object { $have[$_.BaseName] = 1 }
  $todo = @($icons | Where-Object { -not $have[$_] } | Sort-Object)
  Write-Host "referenced: $($icons.Count)  on disk: $($have.Count)  to download: $($todo.Count)"
  $ok = 0; $done = 0
  foreach ($num in $todo) {
    if (Save-Icon $num (Join-Path $IconDir "$num.png")) { $ok++ } else { Write-Warning "failed icon $num" }
    if ((++$done % 50) -eq 0) { Write-Host "  ...$done/$($todo.Count)" }
  }
  Write-Host "downloaded $ok/$($todo.Count)"
}

# ---------------------------------------------------------------- job icons
if (Phase 'jobs') {
Write-Host "`n== Job icons =="
$n = 0
foreach ($r in (Get-Rows 'ClassJob' 'Abbreviation')) {
  $abbr = [string]$r.fields.Abbreviation
  if (-not $abbr -and $r.row_id -ne 0) { continue }
  if (-not $abbr) { $abbr = 'ADV' }
  $dest = Join-Path $JobDir "$abbr.png"
  if (Test-Path $dest) { continue }
  $num = '{0:D6}' -f (62100 + [int]$r.row_id)   # ui/icon/062000/0621XX = framed job icons
  if (Save-Png "$B/asset?path=ui/icon/062000/${num}_hr1.tex&format=png" $dest) { $n++; Write-Host "  + $abbr" } else { Write-Warning "no icon for $abbr ($num)" }
}
Write-Host "new job icons: $n"
}

# ---------------------------------------------------------------- meta
if (Phase 'meta') {
$ver = '?'
try {
  $v = Get-Json "$B/version"
  $latest = $v.versions | Where-Object { $_.names -contains 'latest' } | Select-Object -First 1
  if ($latest) { $ver = ($latest.names | Where-Object { $_ -ne 'latest' } | Select-Object -First 1) }
} catch { Write-Warning "version lookup failed: $($_.Exception.Message)" }
Write-Text (Join-Path $DataDir 'meta.json') "{`"gameVersion`":`"$ver`",`"syncedAt`":`"$(Get-Date -Format yyyy-MM-dd)`"}"
Write-Host "`n==== DONE ====  game data $ver"
}
