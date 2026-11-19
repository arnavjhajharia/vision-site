// Run: node --test tests/   (no deps)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function readCssVar(html, name) {
  const re = new RegExp(`${name}\\s*:\\s*([^;\\s}]+)`);
  const m = html.match(re);
  assert.ok(m, `missing CSS var ${name}`);
  return m[1];
}

test('lucy.html: page, copy, links, theme, and index nav', () => {
  const lucyPath = path.join(root, 'lucy.html');
  assert.ok(fs.existsSync(lucyPath), 'lucy.html must exist');
  const lucy = fs.readFileSync(lucyPath, 'utf8');
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const features = JSON.parse(fs.readFileSync(path.join(root, 'features.json'), 'utf8'));

  assert.match(lucy, /<title>Lucy<\/title>/);

  const lower = lucy.toLowerCase();
  for (const word of ['whatsapp', 'reminders', 'email', 'calendar', 'research']) {
    assert.ok(lower.includes(word), `lucy.html should mention ${word}`);
  }

  assert.match(lucy, /href="index\.html"/);
  assert.match(lucy, /https:\/\/withlucy\.com/);

  // Redesign: index.html is now the one Lucy page (paper and ink, no nav tabs). lucy.html is kept but no longer
  // linked from it or themed to match, until it is retired or redirected.
  for (const v of ['--bg', '--ink']) readCssVar(index, v);
  assert.doesNotMatch(index, /href="lucy\.html"/);

  // (Removed: features.json must not mention Lucy. That rule predates the rebrand; every feature is Lucy's now.)
  assert.ok(features.features.length > 0);

  assert.doesNotMatch(lucy, /#i-wa/);
});

test('index.html: redesign keeps the waitlist hooks and the design rules', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['wl', 'wl-email', 'wl-btn', 'wl-ref', 'wl-ref-h', 'wl-msg', 'wl-iv', 'feat-list', 'pricing']) {
    assert.match(index, new RegExp(`id="${id}"`), `index.html needs #${id}`);
  }
  assert.equal((index.match(/<h1[\s>]/g) || []).length, 1, 'one h1');
  assert.equal((index.match(/<form[\s>]/g) || []).length, 1, 'one form: one action on the page');
  assert.doesNotMatch(index, /gradient\(|<canvas|Pixel Square/i, 'no gradients, canvas smoke or pixel font');
  assert.match(index, /Lucy is free\./);
  assert.match(index, /Lucy Max is \$100 a month\./);
  assert.doesNotMatch(index, /\bVision\b/, 'no old product name in the page');
});
