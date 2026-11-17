// Run: node --test tests/   (no deps)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const VI = require('../interview-core.js');

test('normalizeRef: accepts short codes, lowercases, rejects junk', () => {
  assert.equal(VI.normalizeRef('manya'), 'manya');
  assert.equal(VI.normalizeRef('  Manya '), 'manya');
  assert.equal(VI.normalizeRef('ambassador_2-x'), 'ambassador_2-x');
  assert.equal(VI.normalizeRef(''), '');
  assert.equal(VI.normalizeRef(null), '');
  assert.equal(VI.normalizeRef('<script>'), '');
  assert.equal(VI.normalizeRef('-lead'), '');
  assert.equal(VI.normalizeRef('a'.repeat(33)), '');
});

test('ambassador-report: counts signups per code, keeps first referral, skips emails', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amb-'));
  const file = path.join(dir, 'waitlist.jsonl');
  fs.writeFileSync(file, [
    { email: 'a@x.io', at: '2026-11-17T00:00:00Z', ref: 'manya' },
    { email: 'b@x.io', at: '2026-11-17T00:00:00Z', ref: 'MANYA', interview: { answers: {} } },
    { email: 'a@x.io', at: '2026-11-17T01:00:00Z', ref: 'other' },
    { email: 'A@x.io', at: '2026-11-17T02:00:00Z', ref: 'ghost' },
    { email: 'c@x.io', at: '2026-11-17T00:00:00Z' },
    { email: 'd@x.io', at: '2026-11-17T00:00:00Z', ref: 'ghost' },
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'ambassador-report.mjs'), file], { encoding: 'utf8' });
  assert.match(out, /Manya\s+manya\s+2\s+1/);
  assert.match(out, /\(no code\)\s+-\s+1/);
  assert.match(out, /unknown: ghost\s+ghost\s+1/);
  assert.match(out, /total\s+4/);
  assert.doesNotMatch(out, /@/);
});
