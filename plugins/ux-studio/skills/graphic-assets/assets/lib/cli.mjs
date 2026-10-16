// Shared CLI plumbing for the graphic-assets scripts: arguments, exit codes, the output folder
// (resolution and the git-ignored guard) and provenance (manifest.json plus a comment per file).
// No npm dependencies.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 0 ok · 1 invalid input or runtime error · 2 missing dependency or browser · 64 bad usage. */
export const EXIT = Object.freeze({ OK: 0, ERROR: 1, MISSING_DEPENDENCY: 2, USAGE: 64 });

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Collected validation errors; runCli prints one `error:` line each and exits 1. */
export class ValidationError extends Error {
  constructor(errors) {
    super(errors.join('\n'));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/** `--key value` and boolean `--flag` arguments; `-h` is --help. */
export function parseArgs(argv, booleanFlags) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') {
      args.help = true;
      continue;
    }
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (booleanFlags.has(key) || next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

/** Throws a UsageError for any option or positional argument the script does not know. */
export function assertKnownOptions(args, known) {
  if (args._.length) throw new UsageError(`unexpected argument ${args._[0]}`);
  for (const key of Object.keys(args)) {
    if (key !== '_' && !known.includes(key)) throw new UsageError(`unknown option --${key}`);
  }
}

/** The value of a flag that needs one (`--spec x`), or a UsageError. */
export function requireValue(args, key, what) {
  const v = args[key];
  if (v === undefined || v === true) throw new UsageError(`missing ${what} (--${key})`);
  return v;
}

/** True when the module is the process entry point. */
export const isMain = (metaUrl) => Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === metaUrl;

/** Runs a CLI main: one line per error, a usage hint for exit 64, the stack only with --debug. */
export async function runCli(script, main, argv = process.argv.slice(2)) {
  try {
    await main();
  } catch (err) {
    if (err instanceof ValidationError) {
      for (const e of err.errors) process.stderr.write(`error: ${e}\n`);
      process.exit(EXIT.ERROR);
    }
    const usage = err instanceof UsageError;
    process.stderr.write(`error: ${String(err?.message ?? err).split('\n')[0]}\n`);
    if (usage) process.stderr.write(`Run \`node ${script} --help\` for the usage.\n`);
    if (argv.includes('--debug')) process.stderr.write(`${err?.stack || err}\n`);
    process.exit(usage ? EXIT.USAGE : EXIT.ERROR);
  }
}

/* ------------------------------------------------------------------ output folder */

function git(cwd, args) {
  const res = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return res.error ? null : res;
}

/** The git work-tree root that contains dir, or null (no git, or not inside a work tree). */
function gitRoot(dir) {
  let existing = path.resolve(dir);
  while (!fs.existsSync(existing)) existing = path.dirname(existing);
  const res = git(existing, ['rev-parse', '--show-toplevel']);
  return res && res.status === 0 ? res.stdout.trim() : null;
}

/**
 * The output folder: --out as given, or tmp/<topic>/graphics/ at the git root of the cwd (the cwd
 * itself outside git). Inside a git work tree the folder must be git-ignored: outputs never enter a
 * product repository. Callers running in parallel pass a distinct --out per run.
 */
export function resolveOutDir(args) {
  let out;
  if (args.out !== undefined) out = path.resolve(requireValue(args, 'out', 'output folder'));
  else if (args.topic !== undefined) {
    const topic = requireValue(args, 'topic', 'topic name');
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(topic)) throw new UsageError(`--topic must be a lowercase slug (got "${topic}")`);
    out = path.join(gitRoot(process.cwd()) ?? process.cwd(), 'tmp', topic, 'graphics');
  } else throw new UsageError('missing output folder (--out <dir>, or --topic <name> for tmp/<topic>/graphics/)');

  const root = gitRoot(out);
  if (root) {
    const rel = path.relative(root, out).split(path.sep).join('/');
    const res = git(root, ['check-ignore', '-q', '--no-index', '--', `${rel || '.'}/`]);
    if (!res || res.status !== 0)
      throw new UsageError(
        `refusing to write into ${out}: it is inside a git work tree and not git-ignored. ` +
          'Use a git-ignored folder such as tmp/<topic>/graphics/; delivering assets into a product is ui-developer\'s job'
      );
  }
  return out;
}

/* ------------------------------------------------------------------ provenance */

export const sha256File = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** The source of an output, as a POSIX path relative to the output folder, with its SHA-256. */
export function sourceRecord(sourceFile, outDir) {
  const abs = path.resolve(sourceFile);
  return { source: path.relative(outDir, abs).split(path.sep).join('/'), sourceSha256: sha256File(abs) };
}

/** One-line provenance comment for SVG and HTML outputs. */
export const provenanceComment = (tool, sourceFile, sha) =>
  `<!-- graphic-assets: ${tool} from ${path.basename(sourceFile)} sha256:${sha.slice(0, 12)} -->`;

/** Write a file atomically (temp file + rename), creating its folder. */
export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

/**
 * Merge entries into <outDir>/manifest.json by file name. With `replaceTool`, the previous entries
 * of that tool are dropped first and returned, so the caller can delete stale files.
 */
export function writeManifest(outDir, entries, { replaceTool } = {}) {
  const file = path.join(outDir, 'manifest.json');
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync(file, 'utf8')).outputs ?? [];
  } catch {
    // first run in this folder
  }
  const dropped = replaceTool ? previous.filter((o) => o.tool === replaceTool) : [];
  const fresh = new Set(entries.map((e) => e.file));
  const kept = previous.filter((o) => !fresh.has(o.file) && !(replaceTool && o.tool === replaceTool));
  const outputs = [...kept, ...entries].sort((a, b) => a.file.localeCompare(b.file));
  writeFileAtomic(file, `${JSON.stringify({ generator: 'ux-studio graphic-assets', outputs }, null, 2)}\n`);
  return dropped.filter((o) => !fresh.has(o.file));
}
