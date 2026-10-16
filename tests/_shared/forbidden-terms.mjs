// Client-name guard that never spells the names it forbids: words are compared by
// the sha256 of their lowercase, accent-free form.
import { createHash } from 'node:crypto';

export const FORBIDDEN_TERM_HASHES = [
  '6d9918b9c891e8f03debb0c51c253f2b6c12ca5aac0ad2e12283c5982da137bc',
  '781ea90593200348d40ae4a622250f9372ce4bfd7de69aeb9850ddbd8cde2ac4',
  'ce635c4eabff5e4f56dba8fb1e39ca235530aa2b6b18533eef1af3862016c577',
];

const WORD = /\p{L}+/gu;
const HEADLESS_PREFIX = 'headless-';
// The one word that is also ordinary vocabulary when it names a browser build.
const EXEMPT_AFTER_HEADLESS = createHash('sha256').update('shell').digest('hex');

const normalize = (word) => word.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const sha256 = (word) => createHash('sha256').update(word).digest('hex');

export function findForbiddenTerms(text, hashes = FORBIDDEN_TERM_HASHES) {
  const wanted = new Set(hashes);
  const found = new Set();
  for (const match of text.matchAll(WORD)) {
    const hash = sha256(normalize(match[0]));
    if (!wanted.has(hash)) continue;
    const before = text.slice(Math.max(0, match.index - HEADLESS_PREFIX.length), match.index).toLowerCase();
    if (hash === EXEMPT_AFTER_HEADLESS && before === HEADLESS_PREFIX) continue;
    found.add(hash);
  }
  return [...found].sort();
}
