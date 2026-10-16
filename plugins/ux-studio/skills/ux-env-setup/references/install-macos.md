# Install on macOS (13+)

Ask before each command. Prefer user scope. (K) = unverified.

## Claude Code
`curl -fsSL https://claude.ai/install.sh | bash` or `brew install --cask claude-code`. Then `claude --version`, `claude doctor`, `/login`. Source: https://code.claude.com/docs/en/setup

## Command Line Tools
`git` and `c++` under `/usr/bin` are shims: without Command Line Tools they pop up an install dialog. Ask before running `xcode-select --install`.

## Node.js 22+
Official installer from https://nodejs.org/en/download (22.x LTS). Or `brew install node@22` (keg-only: add its `bin` to PATH, K). Or nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash` then `nvm install 22` (K). fnm: `curl -fsSL https://fnm.vercel.app/install | bash` then `fnm install 22` (K).

## FFmpeg
`brew install ffmpeg`

## HyperFrames
```
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
npx hyperframes browser ensure        # ~260 MB, ask first
npx hyperframes doctor --json         # gate on .ok
```
Git LFS (optional): `brew install git-lfs && git lfs install`.

## Voice and captions
- Kokoro: `pip install kokoro-onnx soundfile` (~311 MB model); `brew install espeak-ng` for non-English (K).
- Parakeet: `npx hyperframes models install parakeet` (~640 MB; arm64 and x64).
- whisper.cpp: Homebrew copy is used if present, else built from source (git + cmake + compiler): `brew install cmake` (K).

## Design system extraction
`npm i -g playwright-core` once, or `npm init -y && npm i -D playwright-core` in the git-ignored `tmp/` workspace; never in a product's package.json. Then `npx playwright install chromium` (K).

## API keys (user does this)
Add `export GEMINI_API_KEY="<value>"` to `~/.zshrc`, then `source ~/.zshrc`. Never paste the value in chat; never commit it.

## Artifacts
User runs `/config` and turns Artifacts on. Needs a `/login` session on Pro, Max, Team or Enterprise.
