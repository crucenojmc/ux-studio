# Troubleshooting

- **Installed but still "missing"**: PATH was not refreshed. Open a new terminal (Windows: the registry PATH is checked, the report says so). macOS/Linux: `source ~/.zshrc` or `~/.bashrc`.
- **node "missing" but nvm/fnm is installed**: they add node to PATH only in interactive shells. The check script retries with `$SHELL -lic` and reports "login-shell" as the source. If it still fails, run `nvm use 22` / `fnm use 22` or set a default alias.
- **Fedora ffmpeg**: `ffmpeg-free` lacks some codecs. If rendering or encoding fails, offer full ffmpeg from RPM Fusion and explain the trade-off first.
- **whisper.cpp build fails**: needs git, cmake and a C++ compiler. Install them, then retry. Or choose Parakeet (no compiler). Override with `HYPERFRAMES_WHISPER_PATH`.
- **macOS dialog appears for git or compiler**: Command Line Tools are missing. Ask before `xcode-select --install`.
- **Windows rendering fails**: HyperFrames native Windows support is not officially stated. Move to WSL 2 (install Claude Code and the dependencies inside WSL, work under the Linux filesystem).
- **Artifacts off**: `enableArtifact=false` or `CLAUDE_CODE_DISABLE_ARTIFACT=1`. The user turns it on via `/config`; never edit settings files. Not available with API key, gateway, Bedrock, Vertex or Foundry sessions, in CMEK/HIPAA/ZDR orgs, or when a Team/Enterprise Owner disabled it.
- **Plugin installed but skills absent**: run `/reload-plugins` or restart the session; confirm with `claude plugin list`.
- **`npx hyperframes doctor` says OK but exit code 0 on failure**: it always exits 0; read `.ok` from `--json`.
- **Kokoro import fails with "externally managed environment"**: use a virtualenv or `pipx`; ask first.
- **Env var shows UNSET after setting it**: the terminal was open before; start a new one. Windows `setx` and `SetEnvironmentVariable` affect new processes only.
