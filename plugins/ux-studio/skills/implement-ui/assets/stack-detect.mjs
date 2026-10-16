#!/usr/bin/env node
// Read-only stack detector for a product repository: UI framework, styling mechanism, test runner,
// lint/format commands and agent-config files, printed as one JSON report.
// Node built-ins only; it never writes, installs or runs anything in the repository.
// Exit codes: 0 ok, 1 runtime error, 64 bad usage or arguments.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const USAGE = `Usage:
  node stack-detect.mjs <repo-path>
  node stack-detect.mjs --help

Reads the manifests (package.json, pubspec.yaml) and a bounded walk of the source tree at
<repo-path> and prints one JSON report to stdout:
  root           absolute path inspected
  packageManager npm | yarn | pnpm | bun | pub | null
  ui             [{name, version, major, source}]  angular, ionic, react, vue, svelte, flutter, html
  styling        [{name, version?, evidence, variables?}]  tailwind, scss, css-modules,
                 styled-components, angular-material, fuse, mui, css-custom-properties,
                 flutter-material
  tests          {runners: [{name, version, source}], commands: [{name, command, source}]}
  lintFormat     {commands: [{name, command, source}], configs: [file]}
  agentConfig    {files: [CLAUDE.md | AGENTS.md | .claude/CLAUDE.md], skills: [.claude/skills/* names]}
  warnings       [text]

Pass the folder that holds the app's manifest (in a monorepo, the app's own folder).
Read-only: nothing is written, installed or executed.

Exit codes: 0 ok, 1 error, 64 bad usage or arguments.
`;

class UsageError extends Error {}

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage', 'www', 'platforms', 'plugins', 'vendor',
  'android', 'ios', 'linux', 'macos', 'windows', 'web-build',
]);
const MAX_DEPTH = 8;
const MAX_ENTRIES = 5000;
const MAX_STYLE_BYTES = 256 * 1024;
const MAX_EVIDENCE = 5;

const UI_PACKAGES = [
  ['angular', '@angular/core'],
  ['ionic', '@ionic/angular', '@ionic/react', '@ionic/vue'],
  ['react', 'react'],
  ['vue', 'vue'],
  ['svelte', 'svelte'],
];
const RUNNER_PACKAGES = [
  ['karma', 'karma'],
  ['jasmine', 'jasmine-core', 'jasmine'],
  ['jest', 'jest'],
  ['vitest', 'vitest'],
  ['playwright', '@playwright/test', 'playwright'],
  ['cypress', 'cypress'],
];
const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];
const LINT_CONFIG = /^(\.eslintrc(\.(js|cjs|json|ya?ml))?|eslint\.config\.(js|cjs|mjs|ts)|tslint\.json|\.prettierrc(\.(json|js|cjs|mjs|ya?ml|toml))?|prettier\.config\.(js|cjs|mjs)|\.stylelintrc(\.(json|js|cjs|ya?ml))?|stylelint\.config\.(js|cjs|mjs)|biome\.jsonc?|analysis_options\.yaml)$/;
const TEST_SCRIPT_NAME = /^(test|e2e)([:-]|$)|spec/i;
const TEST_SCRIPT_COMMAND = /\b(ng (test|e2e)|jest|vitest|karma|playwright test|cypress (run|open)|flutter test)\b/;
const LINT_SCRIPT_NAME = /(^|:)(lint|format|fmt|prettier|eslint|stylelint|analy[sz]e)([:-]|$)/i;
const LINT_SCRIPT_COMMAND = /\b(eslint|tslint|prettier|stylelint|biome|ng lint|dart format|dart analyze|flutter analyze)\b/;

/* ------------------------------------------------------------------ helpers */

/** First integer of a version range ("~16.2.0" → 16, ">=3.10.0" → 3), or null. */
export function majorOf(range) {
  const m = String(range ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');
const sample = (list) => [...list].sort().slice(0, MAX_EVIDENCE);

/** Strip a YAML comment that is not inside quotes. */
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

const unquote = (v) => v.replace(/^(['"])(.*)\1$/, '$2');

/**
 * Minimal pubspec reader: top-level keys, their children and grandchildren.
 * Returns {key: scalar | {child: scalar | {grandchild: scalar}}}. Enough for environment,
 * dependencies, dev_dependencies, scripts and flutter; not a general YAML parser.
 */
export function parsePubspec(text) {
  const out = {};
  let top = null;
  let child = null;
  let childIndent = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = stripComment(raw).replace(/\s+$/, '');
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)([^\s:][^:]*?):(?:\s+(.*))?$/);
    if (!m) continue;
    const indent = m[1].length;
    const key = unquote(m[2].trim());
    const value = m[3] === undefined ? null : unquote(m[3].trim());
    if (indent === 0) {
      top = key;
      child = null;
      childIndent = null;
      out[key] = value ?? {};
    } else if (top && typeof out[top] === 'object') {
      if (childIndent === null || indent <= childIndent) {
        childIndent = indent;
        child = key;
        out[top][key] = value ?? {};
      } else if (child && typeof out[top][child] === 'object') {
        out[top][child][key] = value ?? '';
      }
    }
  }
  return out;
}

/** Bounded walk: files and directory paths, skipping dot-folders and build output. */
function walk(root) {
  const files = [];
  const dirs = [];
  let seen = 0;
  let truncated = false;
  const visit = (dir, depth) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (seen >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
      seen += 1;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        dirs.push(p);
        if (depth < MAX_DEPTH) visit(p, depth + 1);
      } else if (entry.isFile()) {
        files.push(p);
      }
    }
  };
  visit(root, 0);
  return { files, dirs, truncated };
}

/* ------------------------------------------------------------------ detection */

function readPackageJson(root, warnings) {
  const file = path.join(root, 'package.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    warnings.push(`package.json could not be parsed (${err.message}); its dependencies and scripts were skipped.`);
    return null;
  }
}

function readPubspec(root, warnings) {
  const file = path.join(root, 'pubspec.yaml');
  if (!existsSync(file)) return null;
  const text = readText(file);
  if (text === null) {
    warnings.push('pubspec.yaml could not be read; Flutter detection was skipped.');
    return null;
  }
  return parsePubspec(text);
}

function detectPackageManager(root, pkg, pubspec) {
  const declared = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : null;
  if (declared) return declared;
  for (const [file, manager] of LOCKFILES) if (existsSync(path.join(root, file))) return manager;
  if (pubspec) return 'pub';
  return null;
}

function scriptCommands(scripts, source, nameRe, commandRe) {
  return Object.entries(scripts ?? {})
    .filter(([name, command]) => typeof command === 'string' && (nameRe.test(name) || commandRe.test(command)))
    .map(([name, command]) => ({ name, command, source }));
}

const objectOr = (value) => (value && typeof value === 'object' ? value : {});

function detectUi(ctx, warnings) {
  const ui = [];
  for (const [name, ...packages] of UI_PACKAGES) {
    const found = ctx.dep(...packages);
    if (found) ui.push({ name, version: ctx.deps[found], major: majorOf(ctx.deps[found]), source: 'package.json' });
  }
  if (ctx.flutter) {
    const env = objectOr(ctx.pubspec.environment);
    const version = typeof env.flutter === 'string' ? env.flutter : null;
    const sdk = typeof env.sdk === 'string' ? env.sdk : null;
    ui.push({ name: 'flutter', version, major: majorOf(version), sdk, source: 'pubspec.yaml' });
  }
  if (!ui.length) {
    const page = ['index.html', 'src/index.html', 'public/index.html'].find((f) => existsSync(path.join(ctx.root, f)));
    if (page) ui.push({ name: 'html', source: page });
  }
  if (!ui.length) warnings.push('No UI stack detected: no UI framework in the manifests and no index.html.');
  return ui;
}

function detectStyling(ctx) {
  const { root, deps, dep, files, dirs, styleText } = ctx;
  const paths = (list) => sample(list.map((f) => rel(root, f)));
  const styleFiles = files.filter((f) => /\.(css|scss|sass|less)$/.test(f));
  const styling = [];

  const tailwindDep = dep('tailwindcss');
  const tailwindConfigs = ctx.rootEntries.filter((n) => /^tailwind\.config\.(js|cjs|mjs|ts)$/.test(n));
  if (tailwindDep || tailwindConfigs.length) {
    const evidence = tailwindConfigs.length
      ? tailwindConfigs.sort()
      : paths(styleFiles.filter((f) => /@import\s+["']tailwindcss["']|@tailwind\s/.test(styleText(f))));
    styling.push({ name: 'tailwind', ...(tailwindDep && { version: deps[tailwindDep] }), evidence });
  }

  const scssFiles = styleFiles.filter((f) => /\.s[ac]ss$/.test(f));
  const sassDep = dep('sass', 'node-sass');
  if (sassDep || scssFiles.length) {
    styling.push({
      name: 'scss',
      ...(sassDep && { version: deps[sassDep] }),
      evidence: paths(scssFiles),
      variables: scssFiles.some((f) => /^\s*\$[\w-]+\s*:/m.test(styleText(f))),
    });
  }

  const modules = files.filter((f) => /\.module\.(css|scss|sass|less)$/.test(f));
  if (modules.length) styling.push({ name: 'css-modules', evidence: paths(modules) });

  const fromPackage = (name, pkgName) => {
    if (dep(pkgName)) styling.push({ name, version: deps[pkgName], evidence: ['package.json'] });
  };
  fromPackage('styled-components', 'styled-components');
  fromPackage('angular-material', '@angular/material');
  const fuseDirs = dirs.filter((d) => path.basename(d) === '@fuse');
  if (fuseDirs.length) styling.push({ name: 'fuse', evidence: paths(fuseDirs) });
  fromPackage('mui', '@mui/material');

  const customProps = styleFiles.filter((f) => /^\s*--[\w-]+\s*:/m.test(styleText(f)));
  if (customProps.length) styling.push({ name: 'css-custom-properties', evidence: paths(customProps) });

  if (ctx.flutter && objectOr(ctx.pubspec.flutter)['uses-material-design'] === 'true') {
    styling.push({ name: 'flutter-material', evidence: ['pubspec.yaml#flutter.uses-material-design'] });
  }
  return styling;
}

function detectTests(ctx) {
  const runners = [];
  for (const [name, ...packages] of RUNNER_PACKAGES) {
    const found = ctx.dep(...packages);
    if (found) runners.push({ name, version: ctx.deps[found], source: 'package.json' });
  }
  const commands = [
    ...scriptCommands(ctx.pkg?.scripts, 'package.json#scripts', TEST_SCRIPT_NAME, TEST_SCRIPT_COMMAND),
    ...scriptCommands(ctx.pubScripts, 'pubspec.yaml#scripts', TEST_SCRIPT_NAME, TEST_SCRIPT_COMMAND),
  ];
  if (ctx.flutter && typeof objectOr(ctx.pubspec.dev_dependencies).flutter_test === 'object') {
    const source = 'pubspec.yaml#dev_dependencies';
    runners.push({ name: 'flutter-test', version: null, source });
    if (!commands.some((c) => /\bflutter test\b/.test(c.command))) {
      commands.push({ name: 'flutter test', command: 'flutter test', source });
    }
  }
  return { runners, commands };
}

function detectLintFormat(ctx) {
  const commands = [
    ...scriptCommands(ctx.pkg?.scripts, 'package.json#scripts', LINT_SCRIPT_NAME, LINT_SCRIPT_COMMAND),
    ...scriptCommands(ctx.pubScripts, 'pubspec.yaml#scripts', LINT_SCRIPT_NAME, LINT_SCRIPT_COMMAND),
  ];
  if (ctx.flutter) {
    // The Flutter SDK ships both; offered only when no script already runs them.
    if (!commands.some((c) => /\b(flutter|dart) analyze\b/.test(c.command))) {
      commands.push({ name: 'analyze', command: 'flutter analyze', source: 'flutter sdk' });
    }
    if (!commands.some((c) => /\bdart format\b/.test(c.command))) {
      commands.push({ name: 'format', command: 'dart format .', source: 'flutter sdk' });
    }
  }
  const configs = ctx.rootEntries.filter((name) => LINT_CONFIG.test(name)).sort();
  return { commands, configs };
}

function detectAgentConfig(root) {
  const files = ['CLAUDE.md', 'AGENTS.md', '.claude/CLAUDE.md'].filter((f) => existsSync(path.join(root, f)));
  const skillsDir = path.join(root, '.claude', 'skills');
  // A skill is a folder holding SKILL.md; archives and notes beside them are not.
  const skills = isDir(skillsDir)
    ? readdirSync(skillsDir).filter((name) => existsSync(path.join(skillsDir, name, 'SKILL.md'))).sort()
    : [];
  return { files, skills };
}

/** Build the report for one repository root. Never writes. */
export function detectStack(rootArg) {
  const root = path.resolve(rootArg);
  const warnings = [];
  const pkg = readPackageJson(root, warnings);
  const pubspec = readPubspec(root, warnings);
  const deps = { ...objectOr(pkg?.dependencies), ...objectOr(pkg?.devDependencies) };
  const { files, dirs, truncated } = walk(root);
  if (truncated) warnings.push(`Source walk stopped after ${MAX_ENTRIES} entries; evidence may be incomplete.`);
  const texts = new Map();
  const ctx = {
    root,
    pkg,
    pubspec,
    deps,
    dep: (...names) => names.find((n) => typeof deps[n] === 'string'),
    files,
    dirs,
    rootEntries: (() => {
      try {
        return readdirSync(root);
      } catch {
        return [];
      }
    })(),
    flutter: objectOr(objectOr(pubspec?.dependencies).flutter).sdk === 'flutter',
    pubScripts: objectOr(pubspec?.scripts),
    /** Cached text of a style file; oversized or unreadable files read as empty. */
    styleText: (f) => {
      if (!texts.has(f)) {
        let size = Infinity;
        try {
          size = statSync(f).size;
        } catch {
          // vanished between the walk and the read
        }
        texts.set(f, size <= MAX_STYLE_BYTES ? readText(f) ?? '' : '');
      }
      return texts.get(f);
    },
  };

  return {
    root,
    packageManager: detectPackageManager(root, pkg, pubspec),
    ui: detectUi(ctx, warnings),
    styling: detectStyling(ctx),
    tests: detectTests(ctx),
    lintFormat: detectLintFormat(ctx),
    agentConfig: detectAgentConfig(root),
    warnings,
  };
}

/* ------------------------------------------------------------------ CLI */

function parseCli(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true };
  const unknown = argv.find((a) => a.startsWith('-'));
  if (unknown) throw new UsageError(`unknown option ${unknown}`);
  if (argv.length === 0) throw new UsageError('missing the repo path argument');
  if (argv.length > 1) throw new UsageError(`expected one <repo-path>, got ${argv.length}`);
  if (!isDir(argv[0])) throw new UsageError(`not a directory: ${argv[0]}`);
  return { root: argv[0] };
}

function main() {
  try {
    const args = parseCli(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(USAGE);
      return 0;
    }
    process.stdout.write(`${JSON.stringify(detectStack(args.root), null, 2)}\n`);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`stack-detect: ${err.message}\nRun with --help for usage.\n`);
      return 64;
    }
    process.stderr.write(`stack-detect: ${err?.message ?? err}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
