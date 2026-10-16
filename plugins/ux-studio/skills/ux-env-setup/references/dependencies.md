# Dependencies by tier

Verified 2026-10-15 unless marked (K) = verify on the machine. Run the check script first; this table explains what each row is for.

## Required

| Dependency | Needed for | Windows | macOS | Linux | Verify | Source | Licence note |
|---|---|---|---|---|---|---|---|
| Claude Code >= 2.1.265 (`/design`, `/slides`; `/artifacts` needs 2.1.208+) | everything | `irm https://claude.ai/install.ps1 \| iex` (PowerShell), `winget install Anthropic.ClaudeCode` | `curl -fsSL https://claude.ai/install.sh \| bash` or `brew install --cask claude-code` | `curl -fsSL https://claude.ai/install.sh \| bash` | `claude --version`, `claude doctor` | https://code.claude.com/docs/en/setup | Anthropic terms; plan Pro, Max, Team, Enterprise or Console login (`/login`) |

## Per feature

| Dependency | Needed for | Windows | macOS | Linux | Verify | Source | Licence note |
|---|---|---|---|---|---|---|---|
| Artifacts enabled | prototypes and showcase | `/config` -> Artifacts | same | same | `/artifacts`; check script reads `enableArtifact` | https://code.claude.com/docs/en/artifacts | Needs `/login` session (not API key, gateway, Bedrock, Vertex, Foundry); not CMEK/HIPAA/ZDR orgs; Team/Enterprise Owners can disable |
| Node.js >= 22 (npm, npx) | design system, video, fidelity, ux-audit | nodejs.org 22.x LTS installer; fnm (K) | nodejs.org installer; `brew install node@22` (keg-only, K) | nvm or fnm (K) | `node --version` | https://nodejs.org/en/download | MIT |
| playwright-core | design system from a website, fidelity, ux-audit | git-ignored workspace (`npm init -y && npm i -D playwright-core` inside `tmp/`) or once globally (`npm i -g playwright-core`); never in a product's package.json | same | same | `npm ls playwright-core` | https://playwright.dev | Apache-2.0 |
| Chromium binary | design system, fidelity, ux-audit | `npx playwright install chromium` (K) | same (K) | same; `--with-deps` on Linux (K) | folder `ms-playwright/chromium-*` | https://playwright.dev | Browser download, hundreds of MB |
| pixelmatch | fidelity | measurement workspace (`npm init -y && npm i -D playwright-core pixelmatch pngjs`) or once globally (`npm i -g playwright-core pixelmatch pngjs`); never in a product's package.json | same | same | `npm ls pixelmatch` | https://github.com/mapbox/pixelmatch | ISC (K) |
| pngjs | fidelity | same install as pixelmatch | same | same | `npm ls pngjs` | https://github.com/pngjs/pngjs | MIT (K) |
| axe-core (optional) | ux-audit accessibility variant: `a11y-audit.mjs` merges its results when it resolves; without it the audit says «axe no disponible» and continues | same install as playwright-core (`npm i -D axe-core` in `tmp/` or `npm i -g axe-core`); never in a product's package.json | same | same | `npm ls axe-core` | https://github.com/dequelabs/axe-core | MPL-2.0 |
| FFmpeg + FFprobe | video | `winget install Gyan.FFmpeg` (K) | `brew install ffmpeg` | apt `ffmpeg`, dnf `ffmpeg-free`, pacman `ffmpeg` | `ffmpeg -version` | https://ffmpeg.org/download.html | LGPL/GPL by build; override with `HYPERFRAMES_FFMPEG_PATH` / `HYPERFRAMES_FFPROBE_PATH` |
| git | video, whisper build | Git for Windows | Xcode CLT or brew | distro package | `git --version` | https://git-scm.com | GPL-2.0 |
| HyperFrames plugin | video | `claude plugin marketplace add heygen-com/hyperframes` then `claude plugin install hyperframes@hyperframes` | same | same | `claude plugin list` | https://github.com/heygen-com/hyperframes | Apache-2.0 |
| Chrome headless (HyperFrames) | video | `npx hyperframes browser ensure` | same | same | `npx hyperframes browser path` | same | ~260 MB, cached in `~/.cache/hyperframes/chrome/` |
| Python >= 3.8 + `kokoro-onnx` | voice: Kokoro | `pip install kokoro-onnx soundfile` | same | same | `python3 -c "import kokoro_onnx"` | HyperFrames docs | Model ~311 MB + 27 MB voices in `~/.cache/hyperframes/tts/` |
| espeak-ng | Kokoro, non-English | (K) | `brew install espeak-ng` (K) | apt/dnf/pacman `espeak-ng` (K) | `espeak-ng --version` | https://github.com/espeak-ng/espeak-ng | GPL-3.0 |
| Parakeet model | captions (incl. Spanish) | `npx hyperframes models install parakeet` | same | same (glibc >= 2.32) | `npx hyperframes doctor` | HyperFrames docs | ~640 MB, sherpa-onnx |
| whisper.cpp + models | captions alternative | built on first use | brew or built | built on first use | `npx hyperframes doctor` | HyperFrames docs | Needs git + cmake + C++ compiler; models 75 MB-3.1 GB; `HYPERFRAMES_WHISPER_PATH` override |

## Optional

| Dependency | Needed for | Install | Verify | Source / licence |
|---|---|---|---|---|
| Git LFS | HyperFrames README recommends | `winget install GitHub.GitLFS` (K), brew, apt; then `git lfs install` | `git lfs version` | MIT |
| uv | browser-use plugin | https://docs.astral.sh/uv | `uv --version` | Apache-2.0/MIT |
| heygen CLI >= 0.3.0 | HeyGen avatars | https://developers.heygen.com/cli ; `heygen auth login --oauth` | `npx hyperframes auth status` | https://github.com/heygen-com/heygen-cli |
| Chrome DevTools MCP | visual verification | `claude plugin install chrome-devtools-mcp@claude-plugins-official` | `claude mcp list` | official marketplace |
| Playwright MCP | visual verification | `claude mcp add playwright npx @playwright/mcp@latest` | `claude mcp list` | Apache-2.0 |
| `frontend-design` | design quality | `claude plugin install frontend-design@claude-plugins-official` | `claude plugin list` | anthropics/claude-plugins-official |
| `web-design-guidelines` | UI review | `npx skills add vercel-labs/agent-skills --skill web-design-guidelines -g -a claude-code -y` | folder under `~/.claude/skills` | vercel-labs/skills CLI |
| `huashu-design` | HTML prototypes | `npx skills add alchaincyf/huashu-design`; fallback `git clone` into `~/.claude/skills/huashu-design` | same | MIT |
| `ui-ux-pro-max` | UI/UX rules | `claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` + `claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill` | `claude plugin list` | needs Python 3; verify on install |
| `impeccable` | design polish | `claude plugin marketplace add pbakaus/impeccable` or `npx impeccable install` | `claude plugin list` | Apache-2.0 |
| Emil Kowalski skills | motion and UI polish | `npx skills add emilkowalski/skills` | folders `emil-design-eng`, `review-animations`, `animation-vocabulary` | emilkowalski/skills |
| `animate`, `improve-animations`, `prototype`, `break-ui`, `apple-design`, `pick-ui-library`, `mobile-native` | motion/UX | Origin unknown: DETECT only, never invent an install source | folder under `~/.claude/skills` or plugin list | n/a |

## API keys (names only)

`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `HEYGEN_API_KEY` (confirm names with `npx hyperframes doctor`). Windows: `[Environment]::SetEnvironmentVariable('NAME','value','User')` or `setx NAME "value"`, then a new terminal. macOS: `~/.zshrc`. Linux: `~/.bashrc` or `~/.zshrc`. Never commit keys; never paste them into the chat.
