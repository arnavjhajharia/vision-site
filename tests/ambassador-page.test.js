'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pagePath = path.resolve(__dirname, '..', 'ambassadors.html');

test('ambassador dashboard page includes the API and perk', () => {
  assert.equal(fs.existsSync(pagePath), true);
  const source = fs.readFileSync(pagePath, 'utf8');
  assert.match(source, /\/api\/ambassador/);
  assert.match(source, /\/api\/ambassador\/claims/);
  assert.match(source, /Vision Max \(\$100\/month\) — free while you’re an active ambassador/);
  assert.match(source, /You earn one month of what each client you refer actually pays\. Free clients earn \$0\. Each client can be claimed once\./);
  for (const label of ['Signed up', 'Interviewed', 'Paying', 'Not priced yet', 'Free', 'Max', 'Vision']) {
    assert.ok(source.includes(label), `dashboard includes the ${label} label`);
  }
  const script = source.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(script, 'dashboard script is present');
  assert.doesNotMatch(script[1], /\.email\b/);
  assert.doesNotMatch(script[1], /innerHTML/);
});
