'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../ambassador-core.js');

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
  assert.match(script[1], /JSON\.stringify\(\{\s*code:\s*claimCode,\s*signupIds\s*\}\)/);
  assert.match(script[1], /apiUrl\.origin === window\.location\.origin \|\| localHost/);
});

test('ambassador view supplies the fields consumed by the page', () => {
  const names = { manya: 'Manya' };
  const signups = [{ email: 'taylor@example.test', name: 'Taylor Reed', ref: 'manya', paying: true, price: 12 }];
  const view = Core.ambassadorView('manya', names, signups, {}, []);

  assert.ok(Object.hasOwn(view.totals, 'claimable'));
  const signup = view.signups[0];
  for (const key of ['signupId', 'firstName', 'status', 'plan', 'price', 'commission', 'claimStatus']) {
    assert.ok(Object.hasOwn(signup, key), `signup includes ${key}`);
  }
  assert.equal(signup.firstName, 'Taylor');
  assert.equal(signup.claimStatus, null);

  const claim = Core.createClaim('manya', view, [], undefined, '2026-11-17T00:00:00.000Z', 'claim-test');
  const claimedView = Core.ambassadorView('manya', names, signups, {}, [claim]);
  assert.ok(Object.hasOwn(claimedView.totals, 'pending'));
  const historyClaim = claimedView.claims[0];
  for (const key of ['createdAt', 'amount', 'status', 'items']) {
    assert.ok(Object.hasOwn(historyClaim, key), `claim includes ${key}`);
  }
  assert.ok(Object.hasOwn(historyClaim.items[0], 'firstName'));
  assert.equal(historyClaim.items[0].firstName, 'Taylor');
});
