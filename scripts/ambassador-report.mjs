#!/usr/bin/env node
// Signups per ambassador code, read from the waitlist store (one JSON line per email).
// Usage: node scripts/ambassador-report.mjs [path/to/waitlist.jsonl]
// Default: ../personal-agent/data/waitlist.jsonl (or $WAITLIST_FILE). Prints counts only, never emails.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Core = require(path.join(ROOT, 'ambassador-core.js'));
const file = process.argv[2] || process.env.WAITLIST_FILE || path.join(ROOT, '..', 'personal-agent', 'data', 'waitlist.jsonl');
const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'ambassadors.json'), 'utf8'));

if (!fs.existsSync(file)) { console.error(`No waitlist file at ${file}`); process.exit(1); }

// Share email deduplication and first-ref behavior with the local dashboard.
const mergedSignups = Core.mergeSignups(fs.readFileSync(file, 'utf8'));

const counts = new Map(); // code -> { signups, interviewed }
for (const r of mergedSignups) {
  const code = String(r.ref || '').trim().toLowerCase();
  const c = counts.get(code) || { signups: 0, interviewed: 0 };
  c.signups++;
  if (r.interview) c.interviewed++;
  counts.set(code, c);
}

const rows = [...counts.entries()]
  .sort((a, b) => b[1].signups - a[1].signups || a[0].localeCompare(b[0]))
  .map(([code, c]) => {
    const label = !code ? '(no code)' : names[code] ? names[code] : `unknown: ${code}`;
    return { ambassador: label, code: code || '-', ...c };
  });

const total = mergedSignups.length;
const w = Math.max(10, ...rows.map((r) => r.ambassador.length));
console.log(`${'ambassador'.padEnd(w)}  code      signups  interviewed`);
for (const r of rows) console.log(`${r.ambassador.padEnd(w)}  ${r.code.padEnd(8)}  ${String(r.signups).padEnd(7)}  ${r.interviewed}`);
console.log(`${'total'.padEnd(w)}  ${''.padEnd(8)}  ${total}`);
