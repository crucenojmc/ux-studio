# Install on Windows (PowerShell 5.1+ / 7)

Ask before each command. Prefer user scope. Commands marked (K) are unverified.

## Claude Code
- PowerShell: `irm https://claude.ai/install.ps1 | iex`
- CMD: `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd`
- winget: `winget install Anthropic.ClaudeCode`
- Requires Windows 10 1809+. Git for Windows is recommended; if Git Bash is not found set `CLAUDE_CODE_GIT_BASH_PATH`. WSL 2 is an alternative. Then `claude --version`, `claude doctor`, and `/login`.
- Source: https://code.claude.com/docs/en/setup

## Plugin marketplace
`claude plugin marketplace add <owner/repo | git URL | ./path>`, `claude plugin install name@marketplace`, then `/reload-plugins` or a new session.

## Node.js 22+
Use the 22.x LTS installer from https://nodejs.org/en/download. `winget install OpenJS.NodeJS.LTS` no longer installs 22. fnm: `winget install Schniz.fnm` then `fnm install 22` (K). nvm-windows needs the exact version (K).

## FFmpeg
`winget install Gyan.FFmpeg` (K), or `choco install ffmpeg` (K), or `scoop install ffmpeg` (K). Open a new terminal afterwards.

## HyperFrames
```
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
npx hyperframes browser ensure        # ~260 MB, ask first
npx hyperframes doctor --json         # gate on .ok (exit code is always 0)
```
Git LFS (optional): `winget install GitHub.GitLFS` (K), then `git lfs install`. Native fixes shipped in HyperFrames 0.7.x without an official support statement: use WSL 2 if native rendering fails.

## Voice and captions
- Kokoro: Python 3.8+ then `pip install kokoro-onnx soundfile` (~311 MB model on first use). espeak-ng for non-English (K).
- Parakeet: `npx hyperframes models install parakeet` (~640 MB; Windows x64/ia32).
- whisper.cpp: built on first use; needs git, cmake and a C++ toolchain (Visual Studio Build Tools, K).

## Design system extraction
`npm i -g playwright-core` once, or `npm init -y && npm i -D playwright-core` in the git-ignored `tmp\` workspace; never in a product's package.json. Then `npx playwright install chromium` (K).

## API keys (user does this, never paste the value in chat)
`[Environment]::SetEnvironmentVariable('GEMINI_API_KEY','<value>','User')` or `setx GEMINI_API_KEY "<value>"`; open a new terminal.

## Artifacts
User runs `/config` and turns Artifacts on. Needs a `/login` session on Pro, Max, Team or Enterprise.
