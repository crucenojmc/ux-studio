<#
UX Studio environment check for Windows (PowerShell 5.1+ and 7). READ-ONLY: installs and writes nothing.
Usage: powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_SKILL_DIR}/assets/check-env.ps1" [-Json]
       (pwsh -NoProfile -File "..." [-Json] on PowerShell 7)     Exit code = number of missing/outdated REQUIRED items.
Never prints secret values: environment variables are reported as SET/UNSET only.
If a tool is not on the session PATH, the Machine+User PATH from the registry is tried
(covers installs made after this terminal was opened).
#>
param([switch]$Json)
$ErrorActionPreference = 'SilentlyContinue'

$script:Records = New-Object System.Collections.ArrayList
$script:RegPathUsed = 0
$HF = Join-Path $env:USERPROFILE '.cache\hyperframes'
$RegPath = ([Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'))

function Add-Item($id, $tier, $feature, $label, $status, $version, $detail) {
  [void]$script:Records.Add([pscustomobject]@{
    id = $id; tier = $tier; feature = $feature; label = $label
    status = $status; version = "$version"; detail = $detail })
}

function Find-Cmd($name) {
  $c = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return @{ Path = $c.Source; Via = 'PATH' } }
  foreach ($dir in ($RegPath -split ';')) {
    if (-not $dir) { continue }
    foreach ($ext in '.exe', '.cmd', '.bat', '') {
      $p = Join-Path $dir ($name + $ext)
      if (Test-Path -LiteralPath $p -PathType Leaf) { $script:RegPathUsed++; return @{ Path = $p; Via = 'registry-PATH' } }
    }
  }
  return $null
}

function Get-Ver($text) {
  if ($text -match '(\d+\.\d+(\.\d+)?)') { return $Matches[1] }
  return ''
}

function Test-VerGe($have, $want) {
  try {
    $h = @($have.Split('.')) + @('0','0','0'); $w = @($want.Split('.')) + @('0','0','0')
    return ([version]("{0}.{1}.{2}" -f $h[0], $h[1], $h[2])) -ge ([version]("{0}.{1}.{2}" -f $w[0], $w[1], $w[2]))
  } catch { return $false }
}

function Check-Tool($id, $tier, $feature, $label, $cmd, $min, $verArgs) {
  $f = Find-Cmd $cmd
  if (-not $f) { Add-Item $id $tier $feature $label 'missing' '' 'not found on PATH'; return }
  $raw = (& $f.Path @verArgs 2>&1 | Select-Object -First 3) -join ' '
  $v = Get-Ver $raw
  if ($min -and (-not $v -or -not (Test-VerGe $v $min))) {
    Add-Item $id $tier $feature $label 'old' $v ("need >= $min; via " + $f.Via + ' (' + $f.Path + ')')
  } else {
    Add-Item $id $tier $feature $label 'ok' $v ('via ' + $f.Via + ' (' + $f.Path + ')')
  }
}

function Test-NonEmptyDir($p) { (Test-Path -LiteralPath $p -PathType Container) -and ($null -ne (Get-ChildItem -LiteralPath $p -Force | Select-Object -First 1)) }

# ---- REQUIRED ----
Check-Tool 'claude' 'required' 'all' 'Claude Code' 'claude' '2.1.265' @('--version')

# ---- PER FEATURE ----
$settings = Join-Path $env:USERPROFILE '.claude\settings.json'
$ea = ''
if (Test-Path $settings) {
  $m = [regex]::Match((Get-Content -Raw $settings), '"enableArtifact"\s*:\s*(true|false)')
  if ($m.Success) { $ea = $m.Groups[1].Value }
}
switch ($ea) {
  'false' { Add-Item 'artifacts-setting' 'feature' 'prototypes' 'Artifacts setting' 'warn' '' 'enableArtifact=false; turn on with /config -> Artifacts' }
  'true'  { Add-Item 'artifacts-setting' 'feature' 'prototypes' 'Artifacts setting' 'ok' '' 'enableArtifact=true' }
  default { Add-Item 'artifacts-setting' 'feature' 'prototypes' 'Artifacts setting' 'ok' '' 'enableArtifact not set (default)' }
}
if ($env:CLAUDE_CODE_DISABLE_ARTIFACT -eq '1') {
  Add-Item 'artifacts-env' 'feature' 'prototypes' 'CLAUDE_CODE_DISABLE_ARTIFACT' 'warn' '' 'set to 1; Artifacts disabled for this shell'
} else {
  Add-Item 'artifacts-env' 'feature' 'prototypes' 'CLAUDE_CODE_DISABLE_ARTIFACT' 'ok' '' 'not set'
}

Check-Tool 'node' 'feature' 'design-system,video,fidelity,ux-audit' 'Node.js' 'node' '22' @('--version')
Check-Tool 'npm'  'feature' 'design-system,video' 'npm' 'npm' '' @('--version')
Check-Tool 'npx'  'feature' 'design-system,video' 'npx' 'npx' '' @('--version')

# Lookup order matches the scripts: .\node_modules and every parent directory, NODE_PATH, then the
# global npm root (UX_STUDIO_GLOBAL_NODE_MODULES, else `npm root -g`, else %APPDATA%\npm\node_modules).
$script:GRoot = $null
function Get-GlobalRoot {
  if ($null -ne $script:GRoot) { return $script:GRoot }
  $g = ''
  if ($env:UX_STUDIO_GLOBAL_NODE_MODULES) { $g = $env:UX_STUDIO_GLOBAL_NODE_MODULES }
  else {
    $npm = Find-Cmd 'npm'
    if ($npm) { try { $g = ((& $npm.Path root -g 2>$null) | Select-Object -First 1) } catch { $g = '' } }
    if (-not $g -and $env:APPDATA) { $g = Join-Path $env:APPDATA 'npm\node_modules' }
  }
  $script:GRoot = "$g"
  return $script:GRoot
}
function Test-NpmPkg($id, $feat, $name, $tier = 'feature') {
  $p = ''; $src = ''
  $dir = (Get-Location).Path
  while ($dir) {
    $c = Join-Path (Join-Path $dir 'node_modules') $name
    if (Test-Path $c) { $p = $c; $src = 'project tree'; break }
    $parent = Split-Path -Parent $dir
    if (-not $parent -or $parent -eq $dir) { break }
    $dir = $parent
  }
  if (-not $p -and $env:NODE_PATH) {
    foreach ($e in ($env:NODE_PATH -split [IO.Path]::PathSeparator)) {
      if ($e -and (Test-Path (Join-Path $e $name))) { $p = Join-Path $e $name; $src = 'NODE_PATH'; break }
    }
  }
  if (-not $p) {
    $g = Get-GlobalRoot
    if ($g -and (Test-Path (Join-Path $g $name))) { $p = Join-Path $g $name; $src = 'global' }
  }
  if ($p) { Add-Item $id $tier $feat $name 'ok' '' "$p ($src)" }
  else { Add-Item $id $tier $feat $name 'missing' '' 'not in .\node_modules (or a parent), NODE_PATH nor the global npm root' }
}
Test-NpmPkg 'playwright-core' 'design-system,fidelity,ux-audit' 'playwright-core'
Test-NpmPkg 'pixelmatch' 'fidelity' 'pixelmatch'
Test-NpmPkg 'pngjs' 'fidelity' 'pngjs'
Test-NpmPkg 'axe-core' 'ux-audit' 'axe-core' 'optional'  # optional: a11y-audit merges its results when present

$cr = ''
$pwc = Join-Path $env:LOCALAPPDATA 'ms-playwright'
$hit = Get-ChildItem -Path $pwc -Filter 'chromium*' -Directory | Select-Object -First 1
if ($hit) { $cr = $hit.FullName }
elseif (Test-NonEmptyDir (Join-Path $HF 'chrome')) { $cr = Join-Path $HF 'chrome' }
else {
  foreach ($p in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")) {
    if ($p -and (Test-Path $p)) { $cr = $p; break }
  }
}
if ($cr) { Add-Item 'chromium' 'feature' 'design-system,fidelity,ux-audit' 'Chromium binary' 'ok' '' $cr }
else { Add-Item 'chromium' 'feature' 'design-system,fidelity,ux-audit' 'Chromium binary' 'missing' '' 'no Playwright, HyperFrames or system Chrome found' }

Check-Tool 'ffmpeg'  'feature' 'video' 'FFmpeg' 'ffmpeg' '' @('-version')
Check-Tool 'ffprobe' 'feature' 'video' 'FFprobe' 'ffprobe' '' @('-version')
Check-Tool 'git' 'feature' 'video,captions-whisper' 'git' 'git' '' @('--version')

$plugins = ''
$cl = Find-Cmd 'claude'
if ($cl) { $plugins = (& $cl.Path plugin list 2>&1) -join ' ' }
$ip = Join-Path $env:USERPROFILE '.claude\plugins\installed_plugins.json'
if (Test-Path $ip) { $plugins += ' ' + (Get-Content -Raw $ip) }
function Test-Plugin($n) { $plugins -match [regex]::Escape($n) }

if (Test-Plugin 'hyperframes') { Add-Item 'hyperframes-plugin' 'feature' 'video' 'HyperFrames plugin' 'ok' '' 'installed' }
else { Add-Item 'hyperframes-plugin' 'feature' 'video' 'HyperFrames plugin' 'missing' '' 'claude plugin install hyperframes@hyperframes' }

if (Test-NonEmptyDir (Join-Path $HF 'chrome')) { Add-Item 'hyperframes-chrome' 'feature' 'video' 'Chrome headless (HyperFrames)' 'ok' '' (Join-Path $HF 'chrome') }
else { Add-Item 'hyperframes-chrome' 'feature' 'video' 'Chrome headless (HyperFrames)' 'missing' '' 'run: npx hyperframes browser ensure (~260 MB)' }

# Python: python3 first, then the py launcher
$py = Find-Cmd 'python3'
$pyArgs = @()
if ($py -and $py.Path -like '*WindowsApps*') { $py = $null }   # Store alias stub
if (-not $py) { $py = Find-Cmd 'python' ; if ($py -and $py.Path -like '*WindowsApps*') { $py = $null } }
if (-not $py) { $py = Find-Cmd 'py'; $pyArgs = @('-3') }
if (-not $py) { Add-Item 'python3' 'feature' 'voice-kokoro' 'Python 3' 'missing' '' 'not found on PATH' }
else {
  $raw = (& $py.Path @pyArgs --version 2>&1 | Select-Object -First 1) -join ' '
  $v = Get-Ver $raw
  if (-not $v -or -not (Test-VerGe $v '3.8')) { Add-Item 'python3' 'feature' 'voice-kokoro' 'Python 3' 'old' $v ('need >= 3.8; ' + $py.Path) }
  else { Add-Item 'python3' 'feature' 'voice-kokoro' 'Python 3' 'ok' $v ('via ' + $py.Via + ' (' + $py.Path + ')') }
  & $py.Path @pyArgs -c 'import kokoro_onnx' *> $null
  if ($LASTEXITCODE -eq 0) { Add-Item 'kokoro-onnx' 'feature' 'voice-kokoro' 'kokoro-onnx (Python)' 'ok' '' 'importable' }
  else { Add-Item 'kokoro-onnx' 'feature' 'voice-kokoro' 'kokoro-onnx (Python)' 'missing' '' 'pip install kokoro-onnx soundfile' }
}
if (-not $py) { Add-Item 'kokoro-onnx' 'feature' 'voice-kokoro' 'kokoro-onnx (Python)' 'missing' '' 'needs Python 3.8+' }
Check-Tool 'espeak-ng' 'feature' 'voice-kokoro' 'espeak-ng' 'espeak-ng' '' @('--version')
if (Test-NonEmptyDir (Join-Path $HF 'tts')) { Add-Item 'kokoro-cache' 'feature' 'voice-kokoro' 'Kokoro model cache' 'ok' '' (Join-Path $HF 'tts') }
else { Add-Item 'kokoro-cache' 'feature' 'voice-kokoro' 'Kokoro model cache' 'missing' '' 'downloaded on first use (~340 MB)' }

$pk = Get-ChildItem -Path $HF -Recurse -Depth 3 -Filter '*parakeet*' | Select-Object -First 1
if ($pk) { Add-Item 'parakeet' 'feature' 'captions-parakeet' 'Parakeet model' 'ok' '' ($pk.FullName + ' (heuristic)') }
else { Add-Item 'parakeet' 'feature' 'captions-parakeet' 'Parakeet model' 'missing' '' 'run: npx hyperframes models install parakeet (~640 MB)' }

Check-Tool 'cmake' 'feature' 'captions-whisper' 'CMake' 'cmake' '' @('--version')
$cxx = ''
foreach ($c in 'g++', 'clang++', 'cl') { $f = Find-Cmd $c; if ($f) { $cxx = $f.Path; break } }
if (-not $cxx) {
  $vsw = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  if (Test-Path $vsw) {
    $inst = & $vsw -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($inst) { $cxx = "$inst (MSVC build tools)" }
  }
}
if ($cxx) { Add-Item 'cxx' 'feature' 'captions-whisper' 'C++ compiler' 'ok' '' $cxx }
else { Add-Item 'cxx' 'feature' 'captions-whisper' 'C++ compiler' 'missing' '' 'needed to build whisper.cpp' }
$wb = ''
foreach ($c in 'whisper-cli', 'whisper-cpp') { $f = Find-Cmd $c; if ($f) { $wb = $f.Path; break } }
if (-not $wb -and $env:HYPERFRAMES_WHISPER_PATH -and (Test-Path $env:HYPERFRAMES_WHISPER_PATH)) { $wb = '(HYPERFRAMES_WHISPER_PATH)' }
if ($wb) { Add-Item 'whisper-cpp' 'feature' 'captions-whisper' 'whisper.cpp binary' 'ok' '' $wb }
else { Add-Item 'whisper-cpp' 'feature' 'captions-whisper' 'whisper.cpp binary' 'missing' '' 'built from source on first use (git + cmake + C++)' }
if (Test-NonEmptyDir (Join-Path $HF 'whisper')) { Add-Item 'whisper-cache' 'feature' 'captions-whisper' 'whisper models' 'ok' '' (Join-Path $HF 'whisper') }
else { Add-Item 'whisper-cache' 'feature' 'captions-whisper' 'whisper models' 'missing' '' 'downloaded on first use (75 MB - 3 GB)' }

# ---- OPTIONAL ----
Check-Tool 'git-lfs' 'optional' 'video' 'Git LFS' 'git-lfs' '' @('--version')
Check-Tool 'uv' 'optional' 'browser-use' 'uv' 'uv' '' @('--version')

$names = 'frontend-design','web-design-guidelines','huashu-design','ui-ux-pro-max','impeccable','emil-design-eng',
         'review-animations','animation-vocabulary','animate','improve-animations','prototype','break-ui',
         'apple-design','pick-ui-library','mobile-native'
foreach ($n in $names) {
  $here = (Test-Path (Join-Path $env:USERPROFILE ".claude\skills\$n")) -or (Test-Path (Join-Path $env:USERPROFILE ".agents\skills\$n")) -or (Test-Plugin $n)
  if ($here) { Add-Item "design-$n" 'optional' 'design-skills' $n 'ok' '' 'present' }
  else { Add-Item "design-$n" 'optional' 'design-skills' $n 'missing' '' 'not installed' }
}
foreach ($n in 'GEMINI_API_KEY', 'ELEVENLABS_API_KEY', 'HEYGEN_API_KEY') {
  $val = [Environment]::GetEnvironmentVariable($n)
  if ($val) { Add-Item "env-$n" 'optional' 'api-keys' $n 'ok' '' 'SET' }
  else { Add-Item "env-$n" 'optional' 'api-keys' $n 'unset' '' 'UNSET' }
}
$val = $null

# ---- summary ----
function Count($status, $tier) { @($script:Records | Where-Object { (-not $status -or $_.status -eq $status) -and (-not $tier -or $_.tier -eq $tier) }).Count }
$reqBad = (Count 'missing' 'required') + (Count 'old' 'required')
$pathNote = 'current PATH'
if ($script:RegPathUsed -gt 0) { $pathNote = "current PATH + registry PATH ($($script:RegPathUsed) item(s) found only there; open a new terminal)" }
$summary = [ordered]@{ ok = (Count 'ok' ''); missing = (Count 'missing' ''); old = (Count 'old' ''); warn = (Count 'warn' ''); required_missing = $reqBad }

$feat = @{}
foreach ($r in ($script:Records | Where-Object { $_.tier -eq 'feature' })) {
  foreach ($f in ($r.feature -split ',')) { if (-not $feat.ContainsKey($f)) { $feat[$f] = $true }; if ($r.status -ne 'ok') { $feat[$f] = $false } }
}
$featuresObj = [ordered]@{}
foreach ($k in ($feat.Keys | Sort-Object)) { $featuresObj[$k] = $(if ($feat[$k]) { 'ready' } else { 'NOT-ready' }) }

if ($Json) {
  [pscustomobject]@{ os = 'windows'; path_used = $pathNote; summary = $summary; items = @($script:Records); features = $featuresObj } | ConvertTo-Json -Depth 5 -Compress
} else {
  Write-Host 'UX Studio environment check  (OS: windows)'
  Write-Host "PATH used: $pathNote"
  foreach ($t in 'required', 'feature', 'optional') {
    $h = @{ required = 'REQUIRED'; feature = 'PER FEATURE'; optional = 'OPTIONAL' }[$t]
    Write-Host ''; Write-Host "== $h =="
    foreach ($r in ($script:Records | Where-Object { $_.tier -eq $t })) {
      '  {0,-8} {1,-32} {2,-9} {3}' -f $r.status.ToUpper(), $r.label, $r.version, ('[' + $r.feature + '] ' + $r.detail) | Write-Host
    }
  }
  Write-Host ''
  Write-Host ("Summary: {0} ok, {1} missing, {2} outdated, {3} warnings | required problems: {4}" -f $summary.ok, $summary.missing, $summary.old, $summary.warn, $reqBad)
  Write-Host ('Features: ' + (($feat.Keys | Sort-Object | ForEach-Object { $_ + '=' + $(if ($feat[$_]) { 'ready' } else { 'NOT-ready' }) }) -join ' '))
}
exit ([Math]::Min($reqBad, 255))
