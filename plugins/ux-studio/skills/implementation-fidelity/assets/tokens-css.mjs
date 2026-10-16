// Read the custom properties a design system declares (tokens.css, as written by the
// design-system-builder's tokens-to-css.mjs or by hand) and resolve them for one theme.
//
//   parseTokensCss(css)                       -> rules [{ media, selector, decls: [[--name, value]] }]
//   resolveTokens(rules, theme, themes)       -> Map('--name' -> literal value, var() aliases followed)
//
// A rule applies to a theme when one of its selectors (comma separated) names no theme at all (the
// base, `:root`) or names that theme: `[data-theme="dark"]`, `.dark`, or an enclosing
// `@media (prefers-color-scheme: dark)`. `:not(...)` groups are ignored, so
// `:root:not([data-theme="light"])` inside the dark media query is a dark rule. Rules are applied in
// source order, later ones winning. Pure functions, no dependencies.

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Index of the `}` matching the `{` at `open`, ignoring braces inside quotes and url(). */
function closingBrace(text, open) {
  let depth = 0;
  let quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return text.length;
}

/** Split declarations on `;` outside parentheses and quotes. */
function splitDeclarations(body) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) {
      out.push(body.slice(start, i));
      start = i + 1;
    }
  }
  out.push(body.slice(start));
  return out;
}

export function parseTokensCss(css) {
  const rules = [];
  const walk = (text, media) => {
    let i = 0;
    while (i < text.length) {
      const brace = text.indexOf('{', i);
      const semi = text.indexOf(';', i);
      if (brace === -1) break;
      if (semi !== -1 && semi < brace && text.slice(i, semi).trim().startsWith('@')) {
        i = semi + 1; // @import, @charset...
        continue;
      }
      const prelude = text.slice(i, brace).trim();
      const end = closingBrace(text, brace);
      const body = text.slice(brace + 1, end);
      if (prelude.startsWith('@')) {
        if (/^@(media|supports|layer|container)\b/i.test(prelude)) walk(body, `${media} ${prelude}`.trim());
      } else {
        const decls = [];
        for (const d of splitDeclarations(body)) {
          const colon = d.indexOf(':');
          const name = colon === -1 ? '' : d.slice(0, colon).trim();
          if (name.startsWith('--')) decls.push([name, d.slice(colon + 1).trim().replace(/\s*!important$/i, '')]);
        }
        if (decls.length) rules.push({ media, selector: prelude, decls });
      }
      i = end + 1;
    }
  };
  walk(stripComments(css), '');
  return rules;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Themes named (positively) by a selector or media prelude. */
function themesNamed(text, themes) {
  const plain = text.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '');
  return new Set(
    themes.filter((t) => {
      const n = escapeRe(t);
      return (
        new RegExp(`data-theme\\s*[~|^$*]?=\\s*["']?${n}["']?`, 'i').test(plain) ||
        new RegExp(`\\.${n}(?![\\w-])`, 'i').test(plain) ||
        new RegExp(`prefers-color-scheme\\s*:\\s*${n}\\b`, 'i').test(plain)
      );
    })
  );
}

function appliesTo(rule, theme, themes) {
  const fromMedia = themesNamed(rule.media, themes);
  return rule.selector.split(',').some((compound) => {
    const named = new Set([...fromMedia, ...themesNamed(compound, themes)]);
    return named.size === 0 || named.has(theme);
  });
}

const VAR_RE = /var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g;

export function resolveTokens(rules, theme, themes) {
  const raw = new Map();
  for (const rule of rules) {
    if (!appliesTo(rule, theme, themes)) continue;
    for (const [name, value] of rule.decls) raw.set(name, value);
  }
  const resolve = (value, depth) => {
    if (depth > 16) return value;
    return value.replace(VAR_RE, (whole, name, fallback) => {
      if (raw.has(name)) return resolve(raw.get(name), depth + 1);
      return fallback !== undefined ? resolve(fallback.trim(), depth + 1) : whole;
    });
  };
  return new Map([...raw].map(([name, value]) => [name, resolve(value, 0)]));
}
