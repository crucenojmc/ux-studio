# Publishing as a claude.ai Design System artifact

A design system lives as a private claude.ai artifact made from the **Design System** type, so it
is reusable from the user's Claude account (Design and Slides artifacts use the default one) and
from Claude Code later.

**The type's own instructions win.** The type ships its own `SKILL.md` and references. The facts
below were read on 2026-10-15; on any conflict follow the type. Always read the instructions the
create call returns, and the type's `artifact-type/reference/format.md`, `craft.md`, `cover.md`,
`from-code.md`, `from-design-tool.md` (Artifact `read` with `path` and, as `url`, the system's link
or, before one exists, the type's link from the types listing). This skill's own `from-code.md` does not depend on them: it extracts tokens from a local
checkout without GitHub or a published artifact.

## 1. Create (once)

1. Find the type: Artifact `{action:"list", scope:"types"}` → the entry titled "Design System".
   Never hardcode its URL.
2. ONE publish call: `{type_url:<that link>, title:"<System name>", auto_open:"after_first_write"}`,
   no files. Keep the returned `url`; every later call uses `url`, never `type_url` again (that
   would create a second system).

## 2. Write the tree locally

Write every file under one folder, `<dir>/project/…` (`<dir>` is the folder the parent session
gives, `design-system/<slug>/` in the working project by default; see SKILL.md, Output folder):

| Path under `project/` | Content |
| --- | --- |
| `design-system.json` | the index — written ONCE, in the LAST call |
| `tokens.json` | whole file, `tokens-contract.md` shape, `--check` exit 0 |
| `README.md` | MANDATORY brand book (`assets/readme-template.md`) |
| `components/<Comp>/README.md` | guidelines; first sentence = summary |
| `components/<Comp>/preview.html` | line 1 `<!-- @dsCard group="Actions" height=88 -->` |
| `components/Cover/preview.html` | the cover, written LAST, folder bare (no README) — see the type's `cover.md` |
| `fonts/<file>` | real font files only when not hosted on Google Fonts |
| `assets/<Group>/…` | images, SVG, video, PDF = uploads recorded in the index (below) |

Never write generated files: `tokens.css`, `manifest.json`, `api/…`.

Previews run inside the artifact with `tokens.css`, the fonts and `bundle.css` preloaded and
`<html data-theme="<first theme>">` set. Line 1 is the marker, then a small complete document
rendering ONE component in a few states; only `var(--token)` values; no iframes; CDN URLs pinned
to exact versions. Without a React bundle, previews are static HTML + CSS. Example:

```html
<!-- @dsCard group="Actions" height=88 -->
<!doctype html>
<html>
<head>
<meta charset="utf-8"><title>Button — preview</title>
<style>
  body { margin: 0; background: var(--surface-page); color: var(--text-primary); font-family: var(--font-sans); }
  .row { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-4); }
  .btn { background: var(--accent); color: var(--on-accent); border: 0; border-radius: var(--radius-md);
         padding: var(--space-2) var(--space-4); cursor: pointer; }
  .btn:hover { background: var(--accent-hover); }
  .btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
  .btn.secondary { background: var(--surface-raised); color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--border-strong); }
</style>
</head>
<body>
<div class="row">
  <button class="btn label">Confirmar</button>
  <button class="btn secondary label">Cancelar</button>
</div>
</body>
</html>
```

The page compiles its OWN `tokens.css` for previews, which differs from `tokens-to-css.mjs`
output: colors, shadows, spacing, radii and `--font-<key>` are custom properties, but each text
style is a CLASS named after the style (`class="label"`, `class="body"`), and there are no
`--text-*` or motion variables. In previews use those classes for type, and declare any
duration you animate with in the preview's own `:root`, copying the README "Motion" values.
Prototypes built later from `tokens-to-css.mjs` get `--text-*` and motion variables instead.

## 3. Upload assets

Each image/SVG/video/PDF under `assets/<Group>/`: Artifact `{action:"publish", url, file_path:"<full path>", asset:true}`
→ returns `/_blob/<id>`. Record it in the index:
`assetGroups.<Group> = {"name":"<Group>","tile":"l","order":["mark.svg"],"files":{"mark.svg":{"name":"mark.svg","blob":"<id>","size":<bytes>,"type":"image/svg+xml"}}}`
and add `<Group>` to `groups`. Add `assets/<Group>/README.md` (a file, not an upload) saying how to
use the group, including a single-ink mark's ink color.

## 4. Send the files

`{url, root:"<dir>", file_path:"<dir>/project/tokens.json" (full path), files:{"project/README.md":"project/README.md", "project/components/Button/preview.html":"project/components/Button/preview.html", …}}`

At most 255 paths per call; a bigger system takes several calls. The index goes ONCE, in the LAST
call. A new system's index:

```json
{"v":3,"layout":"files","createdOnFiles":{"v":1,"at":"<ISO now>"},"title":"<Name>","namespace":"<Name>",
 "libraries":[],"sections":{},"groups":[],"assetGroups":{},"blobs":{},
 "docs":{"readme":"project/README.md","sections":[]},
 "lastChange":{"by":"<person>","at":"<ISO now>","via":"Claude Code","note":"<what changed>"}}
```

`title` is the system's name; `by` is the person you work for (else "Claude").

## 5. Quality gate before the last call

- `tokens-to-css.mjs --check` exits 0; every warning fixed or justified in the README.
- Text 4.5:1 (3:1 at 24 px+, control borders, focus rings, icons) in EVERY theme and EVERY
  preview — render each preview with `data-theme="dark"` too.
- Colors that must be told apart differ in lightness, not hue alone (blue/orange over red/green).
- No AI tropes: blue-purple gradients, emoji cards, left-border accent cards.
- README names tokens in its usage rules; every token has a `usage`.

## 6. Hand-off

Give the link, what it was built from, what was assumed, what remains. Tell the user to mark it as
the **default** design system in claude.ai (only they can; Design and Slides use the default).

**Consumption from Claude Code later:** Artifact `{action:"read", url, path:"project/README.md"}`
and `{action:"read", url, path:"project/tokens.json"}` (each saves the file locally), then
`node ${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs <saved tokens.json> --out tokens.css` for
prototypes.

**No Artifact tool** (e.g. a sub-agent without it): leave `<dir>/project/` complete, with the
index last-written and `--check` passing, and return the path; the parent session runs steps 1, 3
and 4.

## Revising an existing system

Read the index and each file you will change right before editing (people edit live). Send ONE
call with only the changed `project/` paths (`tokens.json` always whole); in the last call, the
index re-read and updated (`lastChange` plus the keys you touched), every other key kept. Refused
because someone saved meanwhile: re-read, redo once; refused again → tell the user and stop.
