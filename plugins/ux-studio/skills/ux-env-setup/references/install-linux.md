# Install on Linux (Ubuntu 20.04+/Debian 10+, Fedora, Arch) and WSL

Ask before each command. Say so before any `sudo`. Prefer user scope. (K) = unverified.

## Claude Code
`curl -fsSL https://claude.ai/install.sh | bash`, then `claude --version`, `claude doctor`, `/login`. Source: https://code.claude.com/docs/en/setup

## Node.js 22+ (recommended: nvm or fnm, user scope)
- nvm: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash`, new shell, `nvm install 22` (K)
- fnm: `curl -fsSL https://fnm.vercel.app/install | bash`, new shell, `fnm install 22` (K)
- Distro packages / NodeSource for apt, dnf and pacman: UNVERIFIED, do not propose them as the default.

## FFmpeg (sudo)
| Distro | Command |
|---|---|
| Ubuntu/Debian | `sudo apt install ffmpeg` |
| Fedora | `sudo dnf install ffmpeg-free` (reduced codecs; full build via RPM Fusion) |
| Arch | `sudo pacman -S ffmpeg` |

## Build tools and espeak-ng (sudo, K)
| Distro | git / cmake / C++ / espeak-ng |
|---|---|
| Ubuntu/Debian | `sudo apt install git cmake build-essential espeak-ng` |
| Fedora | `sudo dnf install git cmake gcc-c++ espeak-ng` |
| Arch | `sudo pacman -S git cmake base-devel espeak-ng` |

## HyperFrames
```
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
npx hyperframes browser ensure        # ~260 MB, ask first
npx hyperframes doctor --json         # gate on .ok
```
Git LFS (optional): distro package `git-lfs`, then `git lfs install`.

## Voice and captions
- Kokoro: `pip install --user kokoro-onnx soundfile` (~311 MB model on first use). Some distros require a venv (PEP 668).
- Parakeet: `npx hyperframes models install parakeet` (~640 MB; glibc >= 2.32).
- whisper.cpp: built on first use (git + cmake + C++); models 75 MB-3.1 GB.

## Design system extraction
`npm i -g playwright-core` once, or `npm init -y && npm i -D playwright-core` in the git-ignored `tmp/` workspace; never in a product's package.json. Then `npx playwright install chromium` (add `--with-deps` on Linux, uses sudo, K).

## API keys (user does this)
Add `export GEMINI_API_KEY="<value>"` to `~/.bashrc` or `~/.zshrc`, then reload the shell. Never paste the value in chat; never commit it.

## Artifacts
User runs `/config` and turns Artifacts on. Needs a `/login` session on Pro, Max, Team or Enterprise.
