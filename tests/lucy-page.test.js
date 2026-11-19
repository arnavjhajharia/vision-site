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

  for (const v of ['--bg', '--ink', '--glow']) {
    assert.equal(readCssVar(lucy, v), readCssVar(index, v), `${v} should match index.html`);
  }

  assert.match(index, /href="lucy\.html"/);

  const list = features.features || features;
  const feats = Array.isArray(list) ? list : [];
  for (const f of feats) {
    assert.doesNotMatch(String(f.id || ''), /lucy/i, 'features.json id should not mention lucy');
    assert.doesNotMatch(String(f.name || ''), /lucy/i, 'features.json name should not mention lucy');
  }

  assert.doesNotMatch(lucy, /#i-wa/);
});