'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('local server protects signup data and manages one-time claims', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ambassador-server-'));
  const waitlistFile = path.join(dir, 'waitlist.jsonl');
  const billingFile = path.join(dir, 'billing.json');
  const claimsFile = path.join(dir, 'claims.json');
  const namesFile = path.join(dir, 'ambassadors.json');
  fs.writeFileSync(waitlistFile, [
    JSON.stringify({ email: 'person@example.com', name: 'Taylor Reed', ref: 'manya', paying: true, price: 14, at: '2026-01-02' }),
    JSON.stringify({ email: 'free@example.com', firstName: 'Free', ref: 'manya', paying: true, price: 10 })
  ].join('\n') + '\n');
  fs.writeFileSync(billingFile, JSON.stringify({ 'free@example.com': { status: 'free', price: 0 } }));
  fs.writeFileSync(namesFile, JSON.stringify({ manya: 'Manya' }));
  const { createServer } = await import('../scripts/ambassador-server.mjs');
  const server = createServer({ port: 0, root: path.resolve(__dirname, '..'), waitlistFile, billingFile, claimsFile, namesFile, adminToken: 'test-admin-token' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options) => fetch(base + url, options);
  const postJson = (url, body, token) => request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

  assert.equal((await request('/api/ambassador?code=bad')).status, 404);
  const viewResponse = await request('/api/ambassador?code=MANYA');
  assert.equal(viewResponse.status, 200);
  const viewText = await viewResponse.text();
  assert.doesNotMatch(viewText, /@/);
  const view = JSON.parse(viewText);
  assert.equal(view.totals.commissionEarned, 14);
  const signupId = view.signups.find((signup) => signup.firstName === 'Taylor').signupId;
  const claimResponse = await postJson('/api/ambassador/claims', { code: 'manya', signupIds: [signupId] });
  assert.equal(claimResponse.status, 201);
  const { claim } = await claimResponse.json();
  const secondClaim = await postJson('/api/ambassador/claims', { code: 'manya', signupIds: [signupId] });
  assert.equal(secondClaim.status, 400);
  assert.equal((await secondClaim.json()).error, 'already_claimed');

  assert.equal((await request('/api/admin')).status, 401);
  assert.equal((await request('/api/admin', { headers: { authorization: 'Bearer test-admin-token' } })).status, 200);
  const approved = await postJson(`/api/admin/claims/${claim.id}/approve`, {}, 'test-admin-token');
  assert.equal(approved.status, 200);
  const paid = await postJson(`/api/admin/claims/${claim.id}/paid`, {}, 'test-admin-token');
  assert.equal(paid.status, 200);
  const invalidTransition = await postJson(`/api/admin/claims/${claim.id}/approve`, {}, 'test-admin-token');
  assert.equal(invalidTransition.status, 409);
  assert.equal((await request('/data/ambassador-claims.json')).status, 404);
  assert.equal((await request('/waitlist.jsonl')).status, 404);
});
