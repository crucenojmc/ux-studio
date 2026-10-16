# Publishing as a claude.ai artifact

## Preflight (before building anything)

The Artifact tool exists only when the session is logged in with `/login` to a Pro, Max, Team or Enterprise claude.ai account **and** Artifacts are on (`/config` → Artifacts). Either `"enableArtifact": false` in settings or the environment variable `CLAUDE_CODE_DISABLE_ARTIFACT=1` turns it off.

Check that the `Artifact` tool is in your tool list **before** building. A past attempt lost hours building in other media because the tool was off. If it is missing:

- In the main session: stop and tell the user exactly what to enable (`/login`, `/config` → Artifacts, remove the setting or variable above). Do not build an alternative medium on your own.
- As a sub-agent without the tool: build the file, verify it, and return its path; the parent session publishes it.

When the session lists the `artifact-design` skill, the host expects it to be loaded before an artifact page is written. The template already satisfies its page contract; load it anyway and keep the template's choices unless the skill says otherwise.

## The page is a FRAGMENT

The host wraps the file in its own document and injects base styles (for example a white `body` background). Therefore:

- No `<!doctype>`, `<html>`, `<head>` or `<body>` tags.
- Give the page a `<title>` of 2 to 4 words (a name, not a sentence).
- Keep `<meta name="viewport" content="width=device-width, initial-scale=1">` after the title: a preview opened without it renders at 980 px in mobile emulation. `preview.mjs` moves it into `<head>`.
- Set an explicit `body` background and text color from the tokens.
- Define colors as tokens on `:root`, with the dark theme under `[data-theme="dark"]` **and** `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`.
- External scripts only from `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm` or `unpkg.com`, each with an exact version. Stylesheets only from Google Fonts. Everything else inline. The template needs no scripts at all.
- No external images. Logos as inline SVG; avoid large base64 images.
- Must work at phone width with 16 px gutters and no horizontal scroll.

Preview locally with the host emulated:

```bash
node ${CLAUDE_SKILL_DIR}/assets/preview.mjs design/showcase/page.html tmp/showcase/preview.html [--lang=es]
```

`preview.mjs` refuses a full document, hoists `<title>` into `<head>` and adds the host's white-body base style, so a page that forgets its own background looks wrong locally too.

## Size and sharing

- Hard limit 16 MB; keep the page lean. A complete showcase fits in a few hundred KB.
- Artifacts are private by default. Republishing the **same file path** updates the **same URL**; a new path creates a new artifact.
- claude.ai may refuse public sharing of some pages for undocumented reasons (a 743 KB single-file showcase was shareable, so size alone is not the rule). If sharing is refused, report it to the user. Do not split the page into iframes or several files to work around it.

## Publish

1. Final checks from the blueprint checklist (1440 and 390 px, both themes, zero console errors).
2. Publish with the `Artifact` tool: `file_path` = the showcase file, a one-word `icon` (for example `layout`), a one-sentence `description`.
3. Give the user the URL. For a reference showcase that lives on claude.ai, read it with the `Artifact` tool (`action: "read"`), never with a web fetch.
