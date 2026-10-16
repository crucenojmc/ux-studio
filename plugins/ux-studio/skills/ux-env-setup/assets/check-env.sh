#!/usr/bin/env bash
# UX Studio environment check (macOS / Linux / WSL). READ-ONLY: installs and writes nothing.
# Usage: bash "${CLAUDE_SKILL_DIR}/assets/check-env.sh" [--json] [-h|--help]
# Exit code = number of missing/outdated REQUIRED items (capped at 255); 64 = invalid usage.
# Never prints secret values: environment variables are reported as SET/UNSET only.
# Env: UX_ENV_NO_LOGIN_SHELL=1 skips the login-shell PATH fallback.
#      UX_ENV_APPS_DIR overrides the macOS applications root (default /Applications).
set -u

USAGE='Usage: check-env.sh [--json] [-h|--help]
Exit code = number of missing/outdated REQUIRED items; 64 = invalid usage.'
JSON=0
for arg in "$@"; do
  case "$arg" in
    --json) JSON=1 ;;
    -h|--help) printf '%s\n' "$USAGE"; exit 0 ;;
    *) printf 'Unknown argument: %s\n%s\n' "$arg" "$USAGE" >&2; exit 64 ;;
  esac
done

SEP=$'\037'
RECORDS=""
LOGIN_PATH=""; LOGIN_TRIED=0; LOGIN_USED=0; LOGIN_SKIPPED=0
TMO_KIND=""; TMO_BIN=""; TMO_FG=""
HF="$HOME/.cache/hyperframes"

case "$(uname -s 2>/dev/null)" in
  Darwin) OS=macos ;;
  Linux) if grep -qi microsoft /proc/version 2>/dev/null; then OS=wsl; else OS=linux; fi ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) OS=unknown ;;
esac
[ "$OS" = windows ] && echo "Note: native Windows detected; prefer assets/check-env.ps1 in PowerShell." >&2

# ---------- helpers ----------
add() { # id tier feature label status version detail
  RECORDS="${RECORDS}$1${SEP}$2${SEP}$3${SEP}$4${SEP}$5${SEP}$6${SEP}$7
"
}

detect_timeout() { # once: gnu (timeout/gtimeout) | perl | none
  [ -n "$TMO_KIND" ] && return
  if command -v timeout >/dev/null 2>&1; then TMO_KIND=gnu; TMO_BIN=timeout
  elif command -v gtimeout >/dev/null 2>&1; then TMO_KIND=gnu; TMO_BIN=gtimeout
  elif command -v perl >/dev/null 2>&1; then TMO_KIND=perl
  else TMO_KIND=none; fi
  if [ "$TMO_KIND" = gnu ] && "$TMO_BIN" --foreground 1 true >/dev/null 2>&1; then TMO_FG=--foreground; fi
}

with_timeout() { # seconds cmd...
  detect_timeout
  case "$TMO_KIND" in
    gnu) if [ -n "$TMO_FG" ]; then "$TMO_BIN" "$TMO_FG" "$@"; else "$TMO_BIN" "$@"; fi ;;
    perl) perl -e 'alarm shift; exec @ARGV' "$@" ;;
    *) shift; "$@" ;;
  esac
}

get_login_path() {
  [ "$LOGIN_TRIED" = 1 ] && return
  LOGIN_TRIED=1
  [ "${UX_ENV_NO_LOGIN_SHELL:-}" = 1 ] && return
  local sh="${SHELL:-}" out
  [ -x "$sh" ] || return
  detect_timeout
  if [ "$TMO_KIND" = none ]; then LOGIN_SKIPPED=1; return; fi
  out="$(with_timeout 10 "$sh" -lic 'printf "__UXPATH__%s\n" "$PATH"' 2>/dev/null </dev/null)"
  LOGIN_PATH="$(printf '%s\n' "$out" | grep '^__UXPATH__' | tail -n 1 | sed 's/^__UXPATH__//')"
}

# find_cmd name -> FOUND (absolute path), VIA, RUNPATH
find_cmd() {
  local saved="$PATH" f
  FOUND="$(command -v "$1" 2>/dev/null)"; VIA="PATH"; RUNPATH="$PATH"
  case "$FOUND" in /*) return 0 ;; esac
  FOUND=""
  get_login_path
  if [ -n "$LOGIN_PATH" ]; then
    PATH="$LOGIN_PATH"; f="$(command -v "$1" 2>/dev/null)"; PATH="$saved"
    case "$f" in /*) FOUND="$f"; VIA="login-shell"; RUNPATH="$LOGIN_PATH"; LOGIN_USED=$((LOGIN_USED+1)); return 0 ;; esac
  fi
  return 1
}

run_ver() { # uses RUNPATH
  local saved="$PATH" out
  PATH="$RUNPATH"; out="$(with_timeout 20 "$@" 2>&1 </dev/null | head -n 3)"; PATH="$saved"
  printf '%s' "$out"
}

extract_ver() { printf '%s' "$1" | grep -Eo '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n 1; }

ver_ge() { # have want
  awk -v a="$1" -v b="$2" 'BEGIN{split(a,x,".");split(b,y,".");for(i=1;i<=3;i++){p=x[i]+0;q=y[i]+0;if(p>q)exit 0;if(p<q)exit 1}exit 0}'
}

mac_shim_unusable() { # macOS /usr/bin shims pop up a dialog without Command Line Tools
  [ "$OS" = macos ] || return 1
  case "$1" in /usr/bin/*) xcode-select -p >/dev/null 2>&1 && return 1 || return 0 ;; esac
  return 1
}

nonempty_dir() { [ -d "$1" ] && [ -n "$(ls -A "$1" 2>/dev/null)" ]; }

# check_tool id tier feature label cmd min versionargs...
check_tool() {
  local id=$1 tier=$2 feat=$3 label=$4 cmd=$5 min=$6 raw v
  shift 6
  if ! find_cmd "$cmd"; then add "$id" "$tier" "$feat" "$label" missing "" "not found on PATH"; return; fi
  if mac_shim_unusable "$FOUND"; then
    add "$id" "$tier" "$feat" "$label" missing "" "macOS shim without Command Line Tools"; return
  fi
  raw="$(run_ver "$FOUND" "$@")"; v="$(extract_ver "$raw")"
  if [ -n "$min" ] && { [ -z "$v" ] || ! ver_ge "$v" "$min"; }; then
    add "$id" "$tier" "$feat" "$label" old "$v" "need >= $min; via $VIA ($FOUND)"
  else
    add "$id" "$tier" "$feat" "$label" ok "$v" "via $VIA ($FOUND)"
  fi
}

# ---------- REQUIRED ----------
check_tool claude required all "Claude Code" claude 2.1.265 --version

# ---------- PER FEATURE ----------
# prototypes & showcase
S="$HOME/.claude/settings.json"; ea=""
[ -f "$S" ] && ea="$(grep -o '"enableArtifact"[[:space:]]*:[[:space:]]*[a-z]*' "$S" 2>/dev/null | head -n 1 | sed 's/.*://; s/[[:space:]]//g')"
case "$ea" in
  false) add artifacts-setting feature prototypes "Artifacts setting" warn "" "enableArtifact=false; turn on with /config -> Artifacts" ;;
  true)  add artifacts-setting feature prototypes "Artifacts setting" ok "" "enableArtifact=true" ;;
  *)     add artifacts-setting feature prototypes "Artifacts setting" ok "" "enableArtifact not set (default)" ;;
esac
if [ "${CLAUDE_CODE_DISABLE_ARTIFACT:-}" = 1 ]; then
  add artifacts-env feature prototypes "CLAUDE_CODE_DISABLE_ARTIFACT" warn "" "set to 1; Artifacts disabled for this shell"
else
  add artifacts-env feature prototypes "CLAUDE_CODE_DISABLE_ARTIFACT" ok "" "not set"
fi

# node / npm / npx
check_tool node feature "design-system,video,fidelity,ux-audit" "Node.js" node 22 --version
check_tool npm feature "design-system,video" "npm" npm "" --version
check_tool npx feature "design-system,video" "npx" npx "" --version

# npm packages, looked up like the scripts do: ./node_modules and every parent directory,
# NODE_PATH, then the global npm root (UX_STUDIO_GLOBAL_NODE_MODULES, else `npm root -g`,
# else derived from the node binary). Read-only: nothing is installed or created.
GROOT=""; GROOT_TRIED=0
global_root() { # sets GROOT once
  [ "$GROOT_TRIED" = 1 ] && return 0
  GROOT_TRIED=1
  if [ -n "${UX_STUDIO_GLOBAL_NODE_MODULES:-}" ]; then GROOT="$UX_STUDIO_GLOBAL_NODE_MODULES"; return 0; fi
  if find_cmd npm; then GROOT="$(PATH="$RUNPATH" "$FOUND" root -g 2>/dev/null </dev/null | head -n 1)"; fi
  if [ -z "$GROOT" ] && find_cmd node; then
    local nb="${FOUND%/*}"; GROOT="${nb%/*}/lib/node_modules"
  fi
}
npm_pkg() { # id feature name [tier=feature] -> record
  local tier="${4:-feature}" p="" src="" dir="$PWD" e g
  while :; do
    if [ -d "${dir%/}/node_modules/$3" ]; then p="${dir%/}/node_modules/$3"; src="project tree"; break; fi
    [ -z "${dir%/}" ] && break
    dir="${dir%/*}"
  done
  if [ -z "$p" ] && [ -n "${NODE_PATH:-}" ]; then
    local OLDIFS="$IFS"; IFS=:
    set -f
    for e in $NODE_PATH; do
      if [ -n "$e" ] && [ -d "$e/$3" ]; then p="$e/$3"; src="NODE_PATH"; break; fi
    done
    set +f
    IFS="$OLDIFS"
  fi
  if [ -z "$p" ]; then
    global_root; g="$GROOT"
    if [ -n "$g" ] && [ -d "$g/$3" ]; then p="$g/$3"; src="global"; fi
  fi
  if [ -n "$p" ]; then add "$1" "$tier" "$2" "$3" ok "" "$p ($src)"
  else add "$1" "$tier" "$2" "$3" missing "" "not in ./node_modules (or a parent), NODE_PATH nor the global npm root"; fi
}
npm_pkg playwright-core "design-system,fidelity,ux-audit" playwright-core
npm_pkg pixelmatch fidelity pixelmatch
npm_pkg pngjs fidelity pngjs
npm_pkg axe-core ux-audit axe-core optional  # optional: a11y-audit merges its results when present

# chromium binary (Playwright cache, HyperFrames, macOS .app bundles, system commands)
cr="$(ls -d "$HOME"/.cache/ms-playwright/chromium* "$HOME"/Library/Caches/ms-playwright/chromium* 2>/dev/null | head -n 1)"
if [ -z "$cr" ] && nonempty_dir "$HF/chrome"; then cr="$HF/chrome"; fi
if [ -z "$cr" ]; then
  APPS="${UX_ENV_APPS_DIR:-/Applications}"
  for c in "$APPS/Google Chrome.app/Contents/MacOS/Google Chrome" "$APPS/Chromium.app/Contents/MacOS/Chromium" \
           "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$HOME/Applications/Chromium.app/Contents/MacOS/Chromium"; do
    if [ -x "$c" ]; then cr="$c"; break; fi
  done
fi
if [ -z "$cr" ]; then
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    if find_cmd "$c"; then cr="$FOUND"; break; fi
  done
fi
if [ -n "$cr" ]; then add chromium feature "design-system,fidelity,ux-audit" "Chromium binary" ok "" "$cr"
else add chromium feature "design-system,fidelity,ux-audit" "Chromium binary" missing "" "no Playwright, HyperFrames or system Chrome found"; fi

# video
check_tool ffmpeg feature video "FFmpeg" ffmpeg "" -version
check_tool ffprobe feature video "FFprobe" ffprobe "" -version
check_tool git feature "video,captions-whisper" "git" git "" --version

PLUGIN_LIST=""
if find_cmd claude; then PLUGIN_LIST="$(run_ver "$FOUND" plugin list)"; fi
[ -f "$HOME/.claude/plugins/installed_plugins.json" ] && PLUGIN_LIST="$PLUGIN_LIST $(cat "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null)"
plugin_present() { printf '%s' "$PLUGIN_LIST" | grep -qi -- "$1"; }

if plugin_present hyperframes; then add hyperframes-plugin feature video "HyperFrames plugin" ok "" "installed"
else add hyperframes-plugin feature video "HyperFrames plugin" missing "" "claude plugin install hyperframes@hyperframes"; fi

if nonempty_dir "$HF/chrome"; then add hyperframes-chrome feature video "Chrome headless (HyperFrames)" ok "" "$HF/chrome"
else add hyperframes-chrome feature video "Chrome headless (HyperFrames)" missing "" "run: npx hyperframes browser ensure (~260 MB)"; fi

# voice: Kokoro
check_tool python3 feature voice-kokoro "Python 3" python3 3.8 --version
if find_cmd python3 && PATH="$RUNPATH" "$FOUND" -c 'import kokoro_onnx' >/dev/null 2>&1 </dev/null; then
  add kokoro-onnx feature voice-kokoro "kokoro-onnx (Python)" ok "" "importable"
else
  add kokoro-onnx feature voice-kokoro "kokoro-onnx (Python)" missing "" "pip install kokoro-onnx soundfile"
fi
check_tool espeak-ng feature voice-kokoro "espeak-ng" espeak-ng "" --version
if nonempty_dir "$HF/tts"; then add kokoro-cache feature voice-kokoro "Kokoro model cache" ok "" "$HF/tts"
else add kokoro-cache feature voice-kokoro "Kokoro model cache" missing "" "downloaded on first use (~340 MB)"; fi

# captions: Parakeet
pk="$(find "$HF" -maxdepth 4 -iname '*parakeet*' 2>/dev/null | head -n 1)"
if [ -n "$pk" ]; then add parakeet feature captions-parakeet "Parakeet model" ok "" "$pk (heuristic)"
else add parakeet feature captions-parakeet "Parakeet model" missing "" "run: npx hyperframes models install parakeet (~640 MB)"; fi

# captions: whisper.cpp
check_tool cmake feature captions-whisper "CMake" cmake "" --version
cxx=""
if mac_shim_unusable /usr/bin/c++; then cxx=""; else
  for c in c++ g++ clang++; do
    if find_cmd "$c" && ! mac_shim_unusable "$FOUND"; then cxx="$FOUND"; break; fi
  done
fi
if [ -n "$cxx" ]; then add cxx feature captions-whisper "C++ compiler" ok "" "$cxx"
else add cxx feature captions-whisper "C++ compiler" missing "" "needed to build whisper.cpp"; fi
wb=""
for c in whisper-cli whisper-cpp; do if find_cmd "$c"; then wb="$FOUND"; break; fi; done
[ -z "$wb" ] && [ -n "${HYPERFRAMES_WHISPER_PATH:-}" ] && [ -e "$HYPERFRAMES_WHISPER_PATH" ] && wb="(HYPERFRAMES_WHISPER_PATH)"
if [ -n "$wb" ]; then add whisper-cpp feature captions-whisper "whisper.cpp binary" ok "" "$wb"
else add whisper-cpp feature captions-whisper "whisper.cpp binary" missing "" "built from source on first use (git + cmake + C++)"; fi
if nonempty_dir "$HF/whisper"; then add whisper-cache feature captions-whisper "whisper models" ok "" "$HF/whisper"
else add whisper-cache feature captions-whisper "whisper models" missing "" "downloaded on first use (75 MB - 3 GB)"; fi

# ---------- OPTIONAL ----------
check_tool git-lfs optional video "Git LFS" git-lfs "" --version
check_tool uv optional browser-use "uv" uv "" --version

skill_present() {
  [ -d "$HOME/.claude/skills/$1" ] || [ -d "$HOME/.agents/skills/$1" ] || plugin_present "$1"
}
for n in frontend-design web-design-guidelines huashu-design ui-ux-pro-max impeccable emil-design-eng \
         review-animations animation-vocabulary animate improve-animations prototype break-ui \
         apple-design pick-ui-library mobile-native; do
  if skill_present "$n"; then add "design-$n" optional design-skills "$n" ok "" "present"
  else add "design-$n" optional design-skills "$n" missing "" "not installed"; fi
done

for n in GEMINI_API_KEY ELEVENLABS_API_KEY HEYGEN_API_KEY; do
  eval "val=\${$n:-}"
  if [ -n "$val" ]; then add "env-$n" optional api-keys "$n" ok "" "SET"
  else add "env-$n" optional api-keys "$n" unset "" "UNSET"; fi
done
val=""

# ---------- summary ----------
cnt() { printf '%s' "$RECORDS" | awk -F"$SEP" -v f="$1" -v t="$2" '(f==""||$5==f)&&(t==""||$2==t){n++} END{print n+0}'; }
N_OK=$(cnt ok ""); N_MISS=$(cnt missing ""); N_OLD=$(cnt old ""); N_WARN=$(cnt warn "")
REQ_BAD=$(( $(cnt missing required) + $(cnt old required) ))
PATH_NOTE="current PATH"
[ "$LOGIN_SKIPPED" = 1 ] && PATH_NOTE="current PATH (path-only: no timeout/gtimeout/perl, login-shell fallback skipped)"
[ "$LOGIN_USED" -gt 0 ] && PATH_NOTE="current PATH + login-shell PATH ($LOGIN_USED item(s) found only there)"

readiness_lines() { # prints "feature=ready|NOT-ready" per line
  printf '%s' "$RECORDS" | awk -F"$SEP" '
    $2=="feature"{ n=split($3,a,","); for(i=1;i<=n;i++){ seen[a[i]]=1; if($5!="ok") bad[a[i]]=1 } }
    END{ for(k in seen) printf "%s=%s\n", k, (bad[k]?"NOT-ready":"ready") }' | sort
}
readiness() { readiness_lines | tr '\n' ' '; }
features_json() { readiness_lines | awk -F= 'BEGIN{printf "{"} {printf "%s\"%s\":\"%s\"", (NR>1?",":""), $1, $2} END{printf "}"}'; }

json_esc() {
  if command -v iconv >/dev/null 2>&1; then printf '%s' "$1" | iconv -c -f UTF-8 -t UTF-8 2>/dev/null; else printf '%s' "$1"; fi | tr -d '\000-\037' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

if [ "$JSON" = 1 ]; then
  printf '{"os":"%s","path_used":"%s","summary":{"ok":%s,"missing":%s,"old":%s,"warn":%s,"required_missing":%s},"items":[' \
    "$OS" "$(json_esc "$PATH_NOTE")" "$N_OK" "$N_MISS" "$N_OLD" "$N_WARN" "$REQ_BAD"
  first=1
  while IFS="$SEP" read -r id tier feat label status ver detail; do
    [ -z "$id" ] && continue
    [ $first = 1 ] && first=0 || printf ','
    printf '{"id":"%s","tier":"%s","feature":"%s","label":"%s","status":"%s","version":"%s","detail":"%s"}' \
      "$(json_esc "$id")" "$tier" "$(json_esc "$feat")" "$(json_esc "$label")" "$status" "$(json_esc "$ver")" "$(json_esc "$detail")"
  done <<EOF2
$RECORDS
EOF2
  printf '],"features":%s}\n' "$(features_json)"
else
  echo "UX Studio environment check  (OS: $OS)"
  echo "PATH used: $PATH_NOTE"
  for tier in required feature optional; do
    case $tier in required) h="REQUIRED";; feature) h="PER FEATURE";; optional) h="OPTIONAL";; esac
    echo; echo "== $h =="
    while IFS="$SEP" read -r id t feat label status ver detail; do
      [ "$t" = "$tier" ] || continue
      up="$(printf '%s' "$status" | tr 'a-z' 'A-Z')"
      printf '  %-8s %-32s %-9s %s\n' "$up" "$label" "$ver" "[$feat] $detail"
    done <<EOF3
$RECORDS
EOF3
  done
  echo
  echo "Summary: $N_OK ok, $N_MISS missing, $N_OLD outdated, $N_WARN warnings | required problems: $REQ_BAD"
  echo "Features: $(readiness)"
fi
[ "$REQ_BAD" -gt 255 ] && REQ_BAD=255
exit "$REQ_BAD"
