// Shared CLI plumbing for the ux-flow-audit scripts: exit codes, output, text helpers.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** 0 ok · 1 runtime error · 2 missing dependency (playwright-core or browser) · 64 usage error (a11y-audit). */
export const EXIT = Object.freeze({ OK: 0, ERROR: 1, MISSING_DEPENDENCY: 2, USAGE: 64 });

export class MissingDependency extends Error {}

/** Wrong flags or values: the message is the usage text. */
export class UsageError extends Error {}

/** Write <name>.json and <name>.md into dir, or print one of them to stdout. */
export function emit(report, markdown, { out, format = 'json', name }) {
  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(path.join(out, `${name}.md`), markdown);
    process.stdout.write(`${path.join(out, `${name}.json`)}\n${path.join(out, `${name}.md`)}\n`);
    return;
  }
  process.stdout.write(format === 'md' ? markdown : `${JSON.stringify(report, null, 2)}\n`);
}

/** Run an async CLI main with uniform exit codes. */
export async function runCli(main) {
  try {
    process.exitCode = (await main()) ?? EXIT.OK;
  } catch (err) {
    if (err instanceof MissingDependency) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = EXIT.MISSING_DEPENDENCY;
    } else if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      process.exitCode = EXIT.USAGE;
    } else {
      process.stderr.write(`${err?.message ?? err}\n`);
      process.exitCode = EXIT.ERROR;
    }
  }
}

/** True when the module is the process entry point. */
export const isMain = (metaUrl) => process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === metaUrl;

/** Lowercase, strip accents and collapse spaces, for label matching. */
export function norm(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Escape a value for a Markdown table cell. */
export const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
