---
name: ux-env-setup
description: "Trigger: ux env setup, preflight, check environment, install dependencies, missing tool, doctor. Audits Claude Code, Node, FFmpeg, HyperFrames, Playwright and design skills per feature; installs missing items only after consent."
model: haiku
effort: low
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Run as a preflight before UX work (`ux-designer`, `video-producer`) or when the user asks to set up or diagnose the UX Studio environment. Ask which features are needed: prototypes and showcase, design system from a website, video only when a video was requested or accepted (plus voice and caption choice).

## Hard Rules

- The check scripts are read-only. Install only after the user approves each item, or says "install all listed".
- Large downloads (Chrome headless ~260 MB, Kokoro ~340 MB, Parakeet ~640 MB, whisper models 75 MB-3 GB) always need an explicit OK stating the size.
- Prefer user-scope installs. Never use `sudo` without saying so first.
- Never write, print or request API keys. Show how the user sets them (`references/install-<os>.md`).
- Never edit settings files. Artifacts is toggled by the user via `/config`.
- Commands marked (K) in references are unverified: tell the user to verify on their machine.

## Decision Gates

- Windows native: if video rendering fails, offer WSL 2 (`references/troubleshooting.md`).
- Linux: recommend nvm or fnm for Node 22; distro Node packages are unverified.
- Fedora: `ffmpeg-free` has reduced codecs; explain before installing.
- Item missing right after install: PATH problem, see troubleshooting; do not reinstall.
- Voice or captions: install only the engine the user chose (Kokoro, Parakeet or whisper.cpp).

## Execution Steps

1. Detect OS: Windows, macOS, Linux (Ubuntu/Debian, Fedora, Arch) or WSL.
2. Run `bash "${CLAUDE_SKILL_DIR}/assets/check-env.sh"` (macOS, Linux, WSL) or `powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_SKILL_DIR}/assets/check-env.ps1"` (Windows; use `pwsh` instead of `powershell` for PowerShell 7). Add `--json` / `-Json` for machine output. Exit code = number of missing/outdated required items; `64` (bash script only) means an unknown flag was passed.
3. Show a table by tier: required, per feature, optional. Include the "Features" readiness line.
4. For each gap in the requested features, look up the exact command in `references/install-<os>.md`, state size and scope, and ask.
5. Run approved commands one at a time. Plugin installs need `/reload-plugins` or a new session.
6. Re-run the check and report what changed. For video, finish with `npx hyperframes doctor --json` and gate on `.ok` (the command always exits 0).

## Output Contract

Return: OS, the tier table, features ready or not, commands run with results, items skipped by the user, and manual steps left (API keys, `/config`, `/login`, new terminal).

## References

- `${CLAUDE_SKILL_DIR}/references/dependencies.md`
- `${CLAUDE_SKILL_DIR}/references/install-windows.md`
- `${CLAUDE_SKILL_DIR}/references/install-macos.md`
- `${CLAUDE_SKILL_DIR}/references/install-linux.md`
- `${CLAUDE_SKILL_DIR}/references/troubleshooting.md`
