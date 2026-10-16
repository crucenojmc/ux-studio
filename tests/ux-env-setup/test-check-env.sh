#!/usr/bin/env bash
# Tests for plugins/ux-studio/skills/ux-env-setup/assets/check-env.sh
# Runs the script against stub executables in a controlled PATH/HOME.
# Scratch lives under test-results/ (gitignored), never /tmp.
set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
SCRIPT="$ROOT/plugins/ux-studio/skills/ux-env-setup/assets/check-env.sh"
BASH_BIN="$(command -v bash)"
RUN="$ROOT/test-results/ux-env-setup/run-$$"
mkdir -p "$RUN"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ok   %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL %s\n' "$1"; [ -n "${2:-}" ] && printf '       %s\n' "$2"; }
assert_eq()  { if [ "$1" = "$2" ]; then ok "$3"; else bad "$3" "expected [$2] got [$1]"; fi; }
assert_has() { case "$1" in *"$2"*) ok "$3";; *) bad "$3" "missing [$2]";; esac; }
assert_not() { case "$1" in *"$2"*) bad "$3" "unexpected [$2]";; *) ok "$3";; esac; }

UTILS="uname grep sed awk head tail tr cat cut sort ls dirname basename wc date mkdir rm find id timeout"

mk_stub() { # dir name output
  printf '#!/bin/sh\ncat "${0%%/*}/.out_%s"\n' "$2" > "$1/$2"
  printf '%s\n' "$3" > "$1/.out_$2"; chmod +x "$1/$2"
}

new_env() { # name -> sets E, BIN, H
  E="$RUN/$1"; BIN="$E/bin"; H="$E/home"
  mkdir -p "$BIN" "$H/.claude" "$H/.cache"
  for u in $UTILS; do p="$(command -v "$u" 2>/dev/null)"; [ -n "$p" ] && ln -s "$p" "$BIN/$u"; done
  mk_stub "$BIN" claude "2.1.270 (Claude Code)"
  # claude plugin list reads .plugins
  cat > "$BIN/claude" <<'S'
#!/bin/sh
if [ "$1" = plugin ]; then cat "${0%/*}/.plugins" 2>/dev/null; exit 0; fi
cat "${0%/*}/.out_claude"
S
  : > "$BIN/.plugins"
  mk_stub "$BIN" node "v22.3.0"
  cat > "$BIN/npm" <<'S'
#!/bin/sh
if [ "$1" = root ]; then cat "${0%/*}/.npmroot" 2>/dev/null; exit 0; fi
echo 10.8.1
S
  chmod +x "$BIN/npm"; echo "$E/npmroot" > "$BIN/.npmroot"; mkdir -p "$E/npmroot"
  mk_stub "$BIN" npx "10.8.1"
  mk_stub "$BIN" ffmpeg "ffmpeg version 6.1.1 Copyright (c) 2000-2023"
  mk_stub "$BIN" ffprobe "ffprobe version 6.1.1 Copyright (c) 2007-2023"
  mk_stub "$BIN" git "git version 2.43.0"
  mk_stub "$BIN" git-lfs "git-lfs/3.4.1 (GitHub; linux amd64; go 1.21)"
  mk_stub "$BIN" espeak-ng "eSpeak NG text-to-speech: 1.51"
  mk_stub "$BIN" cmake "cmake version 3.28.3"
  mk_stub "$BIN" c++ "c++ (GCC) 13.2.0"
  mk_stub "$BIN" uv "uv 0.4.0"
  cat > "$BIN/python3" <<'S'
#!/bin/sh
case "$1" in
  --version) echo "Python 3.11.4";;
  -c) [ -f "${0%/*}/.kokoro" ] && exit 0; exit 1;;
esac
S
  chmod +x "$BIN/python3"; : > "$BIN/.kokoro"
  mkdir -p "$H/.cache/hyperframes/chrome/x" "$H/.cache/hyperframes/whisper/m" \
           "$H/.cache/hyperframes/tts/k" "$H/.cache/hyperframes/models/parakeet"
  echo hyperframes@hyperframes > "$BIN/.plugins"
  mkdir -p "$H/.cache/ms-playwright/chromium-1194" "$E/npmroot/playwright-core"
  echo '{"enableArtifact": true}' > "$H/.claude/settings.json"
}

run_check() { # args... ; sets OUT, RC (stdout only), ERR
  OUT="$(cd "${RUN_CWD:-$E}" && env -i HOME="$H" PATH="$BIN" SHELL=/bin/false UX_ENV_NO_LOGIN_SHELL=1 \
         ${EXTRA_ENV:-} "$BASH_BIN" "$SCRIPT" "$@" 2>"$E/stderr")"; RC=$?
  ERR="$(cat "$E/stderr")"
}

jget() { printf '%s' "$OUT" | python3 -I -c "
import json,sys
d=json.load(sys.stdin)
exec(sys.argv[1])" "$1"; }
istatus() { jget "print(next((i['status'] for i in d['items'] if i['id']=='$1'),'ABSENT'))"; }

echo "# 1 all present"
new_env all; run_check --json
assert_eq "$RC" 0 "exit code 0 when required items present"
printf '%s' "$OUT" | python3 -m json.tool >/dev/null 2>&1 && ok "valid JSON" || bad "valid JSON" "$OUT"
for id in claude node npm npx ffmpeg ffprobe git git-lfs python3 kokoro-onnx espeak-ng cmake cxx uv \
          hyperframes-plugin hyperframes-chrome parakeet kokoro-cache whisper-cache playwright-core chromium; do
  assert_eq "$(istatus $id)" ok "$id ok"
done
assert_eq "$(jget "print(d['summary']['required_missing'])")" 0 "summary.required_missing 0"

echo "# 2 claude missing"
new_env noclaude; rm "$BIN/claude"; run_check --json
assert_eq "$RC" 1 "exit code 1 (one required missing)"
assert_eq "$(istatus claude)" missing "claude missing"

echo "# 3 claude too old"
new_env oldclaude; echo "2.1.100 (Claude Code)" > "$BIN/.out_claude"; run_check --json
assert_eq "$RC" 1 "exit code 1 for old claude"
assert_eq "$(istatus claude)" old "claude old"

echo "# 4 node too old / ffmpeg missing do not fail required"
new_env feat; echo "v20.11.0" > "$BIN/.out_node"; rm "$BIN/ffmpeg"; run_check --json
assert_eq "$RC" 0 "exit code 0"
assert_eq "$(istatus node)" old "node 20 old"
assert_eq "$(istatus ffmpeg)" missing "ffmpeg missing"

echo "# 5 kokoro_onnx not importable, python too old"
new_env py; rm "$BIN/.kokoro"; run_check --json
assert_eq "$(istatus kokoro-onnx)" missing "kokoro-onnx missing"
cat > "$BIN/python3" <<'S'
#!/bin/sh
case "$1" in --version) echo "Python 3.6.9";; -c) exit 0;; esac
S
run_check --json
assert_eq "$(istatus python3)" old "python 3.6 old"

echo "# 6 artifacts toggles"
new_env art; echo '{"enableArtifact": false}' > "$H/.claude/settings.json"; run_check --json
assert_eq "$(istatus artifacts-setting)" warn "enableArtifact=false warns"
new_env art2; EXTRA_ENV="CLAUDE_CODE_DISABLE_ARTIFACT=1" run_check --json
assert_eq "$(istatus artifacts-env)" warn "DISABLE env warns"
EXTRA_ENV=""

echo "# 7 env var values never printed"
new_env sec; EXTRA_ENV="GEMINI_API_KEY=SUPERSECRET123" run_check --json
assert_not "$OUT$ERR" SUPERSECRET123 "secret value absent (json)"
assert_eq "$(istatus env-GEMINI_API_KEY)" ok "GEMINI_API_KEY reported set"
assert_eq "$(istatus env-HEYGEN_API_KEY)" unset "HEYGEN_API_KEY unset"
EXTRA_ENV="GEMINI_API_KEY=SUPERSECRET123" run_check
assert_not "$OUT$ERR" SUPERSECRET123 "secret value absent (text)"
EXTRA_ENV=""

echo "# 8 hyperframes plugin fallbacks"
new_env hf; : > "$BIN/.plugins"; run_check --json
assert_eq "$(istatus hyperframes-plugin)" missing "plugin missing when absent"
mkdir -p "$H/.claude/plugins"; echo '{"plugins":{"hyperframes@hyperframes":[{}]}}' > "$H/.claude/plugins/installed_plugins.json"
rm "$BIN/claude"; run_check --json
assert_eq "$(istatus hyperframes-plugin)" ok "plugin found via installed_plugins.json"

echo "# 9 design skills"
new_env ds; mkdir -p "$H/.claude/skills/frontend-design"; run_check --json
assert_eq "$(istatus design-frontend-design)" ok "design skill dir detected"
assert_eq "$(istatus design-huashu-design)" missing "absent design skill missing"

echo "# 10 login-shell PATH fallback"
new_env login; mkdir -p "$E/nvmbin"; mv "$BIN/node" "$E/nvmbin/node"; mv "$BIN/.out_node" "$E/nvmbin/.out_node"
cat > "$E/fakeshell" <<S
#!/bin/sh
echo "noise from rc file"
echo "__UXPATH__$E/nvmbin:$BIN"
S
chmod +x "$E/fakeshell"
OUT="$(cd "${RUN_CWD:-$E}" && env -i HOME="$H" PATH="$BIN" SHELL="$E/fakeshell" "$BASH_BIN" "$SCRIPT" --json 2>/dev/null)"; RC=$?
assert_eq "$(istatus node)" ok "node found through login shell"
assert_has "$OUT" login-shell "reports login-shell as the path used"

echo "# 11 text output"
new_env txt; run_check
assert_has "$OUT" "REQUIRED" "required tier heading"
assert_has "$OUT" "Summary" "summary line"
assert_has "$OUT" "OPTIONAL" "optional tier heading"
run_check --json
case "$OUT" in "{"*) ok "--json stdout is pure JSON";; *) bad "--json stdout is pure JSON";; esac

echo "# 12 read-only"
new_env ro; before="$(find "$H" | sort | wc -l)"; run_check >/dev/null
after="$(find "$H" | sort | wc -l)"; assert_eq "$after" "$before" "HOME unchanged"

echo "# 13 no timeout/gtimeout available"
new_env nto; rm "$BIN/timeout"; mkdir -p "$E/nvmbin"; mv "$BIN/node" "$E/nvmbin/node"; mv "$BIN/.out_node" "$E/nvmbin/.out_node"
cat > "$E/fakeshell" <<S
#!/bin/sh
echo "__UXPATH__$E/nvmbin:$BIN"
S
chmod +x "$E/fakeshell"
OUT="$(cd "${RUN_CWD:-$E}" && env -i HOME="$H" PATH="$BIN" SHELL="$E/fakeshell" "$BASH_BIN" "$SCRIPT" --json 2>/dev/null)"; RC=$?
printf '%s' "$OUT" | python3 -m json.tool >/dev/null 2>&1 && ok "finishes with valid JSON without timeout" || bad "finishes with valid JSON without timeout" "$OUT"
assert_has "$(jget "print(d['path_used'])")" "path-only" "source reported as path-only"

echo "# 14 Chrome as macOS app"
new_env app; rm -rf "$H/.cache/ms-playwright" "$H/.cache/hyperframes/chrome"
mkdir -p "$E/apps/Google Chrome.app/Contents/MacOS"
printf '#!/bin/sh\n' > "$E/apps/Google Chrome.app/Contents/MacOS/Google Chrome"; chmod +x "$E/apps/Google Chrome.app/Contents/MacOS/Google Chrome"
EXTRA_ENV="" run_check --json
assert_eq "$(istatus chromium)" missing "chromium missing without app"
EXTRA_ENV="UX_ENV_APPS_DIR=$E/apps" run_check --json
assert_eq "$(istatus chromium)" ok "chromium found as app under UX_ENV_APPS_DIR"
EXTRA_ENV=""

echo "# 15 invalid UTF-8 in a value"
if command -v iconv >/dev/null 2>&1; then
  new_env utf; ln -s "$(command -v iconv)" "$BIN/iconv"
  mkdir -p "$H/.cache/ms-playwright/chromium-$(printf 'x\377y')"
  rm -rf "$H/.cache/ms-playwright/chromium-1194"
  run_check --json
  printf '%s' "$OUT" | python3 -m json.tool >/dev/null 2>&1 && ok "valid JSON with invalid byte in path" || bad "valid JSON with invalid byte in path"
else
  echo "  skipped (iconv missing)"
fi

echo "# 16 arguments"
new_env args; run_check --bogus
assert_eq "$RC" 64 "unknown flag exits 64"
assert_has "$ERR" "Usage" "usage on stderr"
run_check --help
assert_eq "$RC" 0 "--help exits 0"
assert_has "$OUT" "Usage" "--help prints usage"

echo "# 16b axe-core is an optional ux-audit row"
itier() { jget "print(next((i['tier']+'/'+i['feature'] for i in d['items'] if i['id']=='$1'),'ABSENT'))"; }
new_env axe; run_check --json
assert_eq "$(istatus axe-core)" missing "axe-core missing when not installed"
assert_eq "$(itier axe-core)" optional/ux-audit "axe-core is OPTIONAL for ux-audit"
assert_eq "$(jget "print(d['features'].get('ux-audit','ABSENT'))")" ready "ux-audit stays ready without axe-core"
assert_eq "$RC" 0 "exit code 0 without axe-core"
mkdir -p "$E/npmroot/axe-core"; echo '{"name":"axe-core"}' > "$E/npmroot/axe-core/package.json"; run_check --json
assert_eq "$(istatus axe-core)" ok "axe-core found in the global npm root"
assert_has "$(jget "print(next(i['detail'] for i in d['items'] if i['id']=='axe-core'))")" "axe-core" "axe-core detail reports where it was found"
new_env axe2; mkdir -p "$E/proj/node_modules/axe-core"; echo '{"name":"axe-core"}' > "$E/proj/node_modules/axe-core/package.json"
RUN_CWD="$E/proj" run_check --json
assert_eq "$(istatus axe-core)" ok "axe-core found in ./node_modules like playwright-core"
run_check
assert_has "$OUT" "OPTIONAL" "text report has an OPTIONAL section"

echo "# 17 feature gates fidelity / ux-audit"
fkey() { jget "print(d['features'].get('$1','ABSENT'))"; }
pkg_stub() { mkdir -p "$1/$2"; echo "{\"name\":\"$2\"}" > "$1/$2/package.json"; }
new_env fid; run_check --json
assert_eq "$(fkey ux-audit)" ready "ux-audit ready with node, chromium, playwright-core"
assert_eq "$(fkey fidelity)" NOT-ready "fidelity not ready without pixelmatch/pngjs"
assert_eq "$(istatus pixelmatch)" missing "pixelmatch missing"
assert_eq "$(istatus pngjs)" missing "pngjs missing"
pkg_stub "$E/npmroot" pixelmatch; run_check --json
assert_eq "$(fkey fidelity)" NOT-ready "fidelity not ready with only pixelmatch"
pkg_stub "$E/node_modules" pngjs; run_check --json
assert_eq "$(istatus pngjs)" ok "pngjs found in cwd node_modules"
assert_eq "$(istatus pixelmatch)" ok "pixelmatch found in global npm root"
assert_eq "$(fkey fidelity)" ready "fidelity ready (cwd + global mix)"
run_check
assert_has "$OUT" "fidelity=ready" "text Features line shows fidelity=ready"
assert_has "$OUT" "ux-audit=ready" "text Features line shows ux-audit=ready"
assert_eq "$RC" 0 "exit code stays 0"
new_env fid2; echo "v20.11.0" > "$BIN/.out_node"; run_check --json
assert_eq "$(fkey ux-audit)" NOT-ready "ux-audit not ready with old node"
assert_eq "$(fkey fidelity)" NOT-ready "fidelity not ready with old node"
new_env fid3; rm -rf "$H/.cache/ms-playwright" "$H/.cache/hyperframes/chrome"; run_check --json
assert_eq "$(fkey ux-audit)" NOT-ready "ux-audit not ready without chromium"
new_env fid4; rm -rf "$E/npmroot/playwright-core"; pkg_stub "$E/npmroot" pixelmatch; pkg_stub "$E/npmroot" pngjs; run_check --json
assert_eq "$(fkey ux-audit)" NOT-ready "ux-audit not ready without playwright-core"
assert_eq "$(fkey fidelity)" NOT-ready "fidelity not ready without playwright-core"
assert_eq "$(fkey design-system)" NOT-ready "design-system also not ready without playwright-core"
new_env fid5; run_check --json
assert_eq "$(istatus ajv)" ABSENT "ajv is not required"

echo "# 18 npm package lookup order: cwd and parents, NODE_PATH, global root"
idetail() { jget "print(next((i['detail'] for i in d['items'] if i['id']=='$1'),'ABSENT'))"; }
new_env par; mkdir -p "$E/proj/sub"; pkg_stub "$E/proj/node_modules" pixelmatch
RUN_CWD="$E/proj/sub"; run_check --json; RUN_CWD=""
assert_eq "$(istatus pixelmatch)" ok "pixelmatch found in a parent directory of cwd"
assert_has "$(idetail pixelmatch)" "$E/proj/node_modules/pixelmatch" "parent hit reports where it was found"
new_env np; mkdir -p "$E/np"; pkg_stub "$E/np" pngjs
EXTRA_ENV="NODE_PATH=$E/np" run_check --json
assert_eq "$(istatus pngjs)" ok "pngjs found through NODE_PATH"
assert_has "$(idetail pngjs)" "$E/np/pngjs" "NODE_PATH hit reports where it was found"
new_env ov; mkdir -p "$E/gl"; pkg_stub "$E/gl" pngjs
EXTRA_ENV="UX_STUDIO_GLOBAL_NODE_MODULES=$E/gl" run_check --json
assert_eq "$(istatus pngjs)" ok "pngjs found only via UX_STUDIO_GLOBAL_NODE_MODULES"
assert_has "$(idetail pngjs)" "$E/gl/pngjs" "override hit reports where it was found"
assert_eq "$(istatus playwright-core)" missing "override replaces npm root -g (playwright-core only in the stub root)"
new_env nw; run_check --json
assert_eq "$(istatus pngjs)" missing "package found nowhere is missing"
assert_has "$(idetail pngjs)" "global" "missing detail mentions the global root"

echo "# PowerShell"
if command -v pwsh >/dev/null 2>&1; then
  PS1="$ROOT/plugins/ux-studio/skills/ux-env-setup/assets/check-env.ps1"
  pwsh -NoProfile -File "$PS1" -Json | python3 -m json.tool >/dev/null 2>&1 && ok "ps1 emits valid JSON" || bad "ps1 emits valid JSON"
else
  echo "  untested on Windows (pwsh not installed on this machine)"
fi

rm -rf "$RUN"
echo "passed=$PASS failed=$FAIL"
[ "$FAIL" -eq 0 ]
