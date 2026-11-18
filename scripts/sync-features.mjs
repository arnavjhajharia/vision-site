#!/usr/bin/env node
// Regenerate features.json from Public Lucy module manifests (public-vision repo).
//
//   node scripts/sync-features.mjs [--repo ../public-vision] [--ref <git ref>] [--dry]
//
// Source: <repo>/modules/*/manifest.json on disk, or, with --ref, read straight from that git ref
// (e.g. --ref origin/main) without checking it out.
//
// Rules:
//  - One entry per module, id "module:<id>", source "module". Name and description are refreshed
//    from the manifest on every run.
//  - category is one of the ids in the top-level "categories" block (essential / productivity / builder).
//    An existing valid category is NEVER overwritten: regroup by hand in features.json. New modules take the
//    manifest's "category" if it is a valid id, else --category <id> (default: productivity).
//  - The "categories" block and other top-level keys are preserved as-is.
//  - status is NEVER overwritten once set: edit it by hand in features.json (live/building/planned).
//    New modules start as "building".
//  - "source": "manual" entries are never touched. Modules that disappear from the manifests are kept
//    (marked "removed": true) so you can decide what to do with them.
//  - Only public fields are read (id, name, description). Config, permissions and tools are ignored.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const repo = resolve(site, opt('--repo', '../public-vision'));
const ref = opt('--ref', null);
const dry = args.includes('--dry');
const defaultCat = opt('--category', 'productivity');
const STATUSES = new Set(['live', 'building', 'planned']);

function readManifests() {
  const out = [];
  if (ref) {
    const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
    const files = git('ls-tree', '-r', '--name-only', ref, 'modules/')
      .split('\n').filter(f => /^modules\/[^/]+\/manifest\.json$/.test(f));
    for (const f of files) out.push(JSON.parse(git('show', `${ref}:${f}`)));
  } else {
    const dir = join(repo, 'modules');
    if (!existsSync(dir)) return out;
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name, 'manifest.json');
      if (d.isDirectory() && existsSync(p)) out.push(JSON.parse(readFileSync(p, 'utf8')));
    }
  }
  return out.filter(m => m && m.id && m.name);
}

const path = join(site, 'features.json');
const data = JSON.parse(readFileSync(path, 'utf8'));
const manifests = readManifests();
if (!manifests.length) {
  console.error(`No module manifests found in ${repo}${ref ? ` @ ${ref}` : ''}. Nothing changed.`);
  process.exit(1);
}

const CATS = new Set((data.categories || []).map(c => c.id));
if (!CATS.size) { console.error('features.json has no "categories" block. Nothing changed.'); process.exit(1); }
if (!CATS.has(defaultCat)) { console.error(`--category ${defaultCat} is not one of: ${[...CATS].join(', ')}`); process.exit(1); }
const byId = new Map(data.features.map(f => [f.id, f]));
const seen = new Set();
let added = 0, updated = 0;
for (const m of manifests) {
  const id = `module:${m.id}`;
  seen.add(id);
  const prev = byId.get(id);
  const next = {
    id,
    name: m.name,
    category: prev && CATS.has(prev.category) ? prev.category : (CATS.has(m.category) ? m.category : defaultCat),
    status: prev && STATUSES.has(prev.status) ? prev.status : 'building',
    source: 'module',
    description: String(m.description || '').trim(),
  };
  if (!prev) { data.features.push({ ...next, area: 'Modules' }); byId.set(id, next); added++; continue; }
  const merged = { ...prev, ...next };
  delete merged.removed;
  if (JSON.stringify(merged) !== JSON.stringify(prev)) updated++;
  Object.keys(prev).forEach(k => delete prev[k]);
  Object.assign(prev, merged);
}
let removed = 0;
for (const f of data.features) {
  if (f.source === 'module' && !seen.has(f.id) && !f.removed) { f.removed = true; removed++; }
}
data.updated = new Date().toISOString().slice(0, 10);

const counts = { live: 0, building: 0, planned: 0 };
for (const f of data.features) if (!f.removed && counts[f.status] !== undefined) counts[f.status]++;
console.log(`${manifests.length} manifests: +${added} new, ${updated} updated, ${removed} marked removed.`);
const perCat = {}; for (const f of data.features) if (!f.removed) perCat[f.category] = (perCat[f.category] || 0) + 1;
const stray = data.features.filter(f => !f.removed && !CATS.has(f.category)).map(f => f.id);
if (stray.length) console.warn(`Warning: unknown category on ${stray.join(', ')}`);
console.log(`Categories: ${Object.entries(perCat).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`Totals: ${data.features.filter(f => !f.removed).length} features, live ${counts.live}, building ${counts.building}, planned ${counts.planned}`);
if (!dry) writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
