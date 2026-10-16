// Unit tests for the shared forbidden-terms helper, using neutral words only.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { FORBIDDEN_TERM_HASHES, findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const sha = (w) => createHash('sha256').update(w).digest('hex');
const ACME = sha('acme');
const CAFE = sha('cafe');
const HOLDING = sha('shell');

describe('findForbiddenTerms', () => {
  test('exports three sha256 hex hashes', () => {
    assert.equal(FORBIDDEN_TERM_HASHES.length, 3);
    for (const h of FORBIDDEN_TERM_HASHES) assert.match(h, /^[0-9a-f]{64}$/);
  });

  test('detects a word case-insensitively', () => {
    assert.deepEqual(findForbiddenTerms('Hello ACME team', [ACME]), [ACME]);
  });

  test('strips diacritics before hashing', () => {
    assert.deepEqual(findForbiddenTerms('un café y un CAFÉ', [CAFE]), [CAFE]);
  });

  test('matches whole words only', () => {
    assert.deepEqual(findForbiddenTerms('acmeology and macme', [ACME]), []);
  });

  test('skips the word shell right after headless-', () => {
    assert.deepEqual(findForbiddenTerms('chrome-headless-shell is fine', [HOLDING]), []);
    assert.deepEqual(findForbiddenTerms('chrome-headless-shell and shell', [HOLDING]), [HOLDING]);
  });

  test('returns a sorted unique list', () => {
    const out = findForbiddenTerms('cafe acme cafe acme', [CAFE, ACME]);
    assert.deepEqual(out, [CAFE, ACME].sort());
  });

  test('returns an empty list for clean text', () => {
    assert.deepEqual(findForbiddenTerms('nothing to see here'), []);
  });
});
