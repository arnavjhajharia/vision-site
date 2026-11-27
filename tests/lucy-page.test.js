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

test('index.html: Lucy for Claude Code users, $100 once or $5/month, and the design rules', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const id of ['setup', 'pricing', 'checkout-lifetime', 'checkout-monthly', 'feat-list', 'feat-upd']) {
    assert.match(index, new RegExp(`id="${id}"`), `index.html needs #${id}`);
  }
  assert.equal((index.match(/<h1[\s>]/g) || []).length, 1, 'one h1');
  assert.equal((index.match(/<form[\s>]/g) || []).length, 0, 'no waitlist form: Lucy is bought, not waitlisted');
  assert.doesNotMatch(index, /gradient\(|<canvas|Pixel Square/i, 'no gradients, canvas smoke or pixel font');
  assert.match(index, /Claude Code/);
  assert.match(index, /Get Lucy &mdash; \$100 once/);
  assert.match(index, /\$5\/month/);
  assert.match(index, /Lucy is a Terraform Labs product/);
  assert.match(index, /TODO: wire real checkout/);
  assert.doesNotMatch(index, /Vision Max|Join the waitlist|convince|\$0|\$20|Telegram|Lucy sets your price/);
  assert.doesNotMatch(index, /\bVision\b/, 'no old product name in the page');
  assert.doesNotMatch(index, /stripe|checkout\.js|paypal/i, 'no real payment integration yet');
});
