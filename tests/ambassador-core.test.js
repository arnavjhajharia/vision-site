'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../ambassador-core.js');
const ID_SECRET = 'unit-test-secret-not-for-production';

test('billing status, price, plan and free commission rules', () => {
  assert.equal(Core.statusOf({ paying: true }, {}), 'paying');
  assert.equal(Core.statusOf({ interview: {} }, {}), 'interviewed');
  assert.equal(Core.statusOf({}, {}), 'signed_up');
  assert.equal(Core.statusOf({}, { status: 'paying' }), 'paying');
  assert.equal(Core.priceOf({ interview: { quote: { price: 7 } } }, {}), 7);
  assert.equal(Core.priceOf({ price: 12 }, { price: 9 }), 9);
  assert.equal(Core.priceOf({ price: 15 }, { status: 'free', price: 5 }), 0);
  assert.equal(Core.priceOf({}, {}), null);
  assert.equal(Core.planOf(null), null);
  assert.equal(Core.planOf(0), 'free');
  assert.equal(Core.planOf(12), 'vision');
  assert.equal(Core.planOf(100), 'max');
  assert.equal(Core.planOf(50), 'custom');
  const rawForClaims = Core.mergeSignups([
    { email: 'free@example.com', ref: 'manya', paying: true, price: 15 },
    { email: 'override@example.com', ref: 'manya', price: 9 },
    { email: 'paid@example.com', ref: 'manya', paying: true, price: 8 }
  ]);
  const claimsView = Core.ambassadorView('manya', { manya: 'Manya' }, rawForClaims,
    { 'free@example.com': { status: 'free' }, 'override@example.com': { status: 'paying' } }, [], undefined, ID_SECRET);
  const claimables = Core.claimableFor('manya', claimsView.signups, []);
  assert.deepEqual(claimables.map((item) => item.signupId), claimsView.signups.filter((signup) => signup.commission > 0).map((signup) => signup.signupId));
  assert.equal(claimables.length, 2);
  assert.equal(claimables[0].commission, 9);
  assert.equal(Core.ambassadorView('manya', { manya: 'Manya' }, [
    { email: 'free@example.com', ref: 'manya', paying: true, price: 0 },
    { email: 'max@example.com', ref: 'manya', paying: true, price: 100 }
  ], {}, [], 'https://example.test/', ID_SECRET).totals.commissionEarned, 100);
});

test('merging keeps first non-empty normalized referral and names never come from email', () => {
  const records = Core.mergeSignups([
    { email: 'A@EXAMPLE.COM', name: 'Riley Park', ref: '  ' },
    { email: 'a@example.com', firstName: '', ref: ' MANYA ', plan: 'Vision' },
    { email: 'A@EXAMPLE.COM', ref: 'other' }
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].ref, 'manya');
  assert.equal(records[0].email, 'A@EXAMPLE.COM');
  assert.equal(records[0].plan, 'Vision');
  assert.equal(Core.firstName({ email: 'secret@example.com' }), 'Someone');
  assert.equal(Core.firstName({ name: 'Riley Park' }), 'Riley');
  assert.equal(Core.firstName({ firstName: 'Sam Lee' }), 'Sam Lee');
  assert.equal(Core.mergeSignups(['{"email":"b@example.com","ref":"MANYA"}'])[0].ref, 'manya');
});

function fixture() {
  return Core.mergeSignups([
    { email: 'paid@example.com', name: 'Ari Nguyen', ref: 'manya', paying: true, price: 12, at: '2026-01-01' },
    { email: 'free@example.com', name: 'Jo Kim', ref: 'manya', paying: true, price: 10 },
    { email: 'unpriced@example.com', ref: 'manya', interview: { quote: {} } }
  ]);
}

test('views hide emails, expose revenue and claimable amounts, and include zero-signup ambassadors', () => {
  const names = { manya: 'Manya', empty: 'Empty' }, records = fixture();
  const billing = { 'free@example.com': { status: 'free', price: 0 } };
  const view = Core.ambassadorView('manya', names, records, billing, [], undefined, ID_SECRET);
  assert.equal(view.totals.signups, 3);
  assert.equal(view.totals.interviewed, 3);
  assert.equal(view.totals.paying, 2);
  assert.equal(view.totals.monthlyRevenue, 12);
  assert.equal(view.totals.commissionEarned, 12);
  assert.equal(view.totals.claimable, 12);
  assert.equal(view.perk.plan, 'Vision Max');
  assert.equal(view.signups.find((row) => row.firstName === 'Jo').price, 0);
  assert.equal(view.signups.find((row) => row.firstName === 'Jo').commission, 0);
  assert.doesNotMatch(JSON.stringify(view), /@/);
  const admin = Core.adminView(names, records, billing, [], ID_SECRET);
  assert.equal(admin.ambassadors.find((row) => row.code === 'empty').signups, 0);
  assert.doesNotMatch(JSON.stringify(admin), /@/);
});

test('claims cannot double-claim signup months; rejecting releases them', () => {
  const names = { manya: 'Manya' }, records = fixture(), view = Core.ambassadorView('manya', names, records, {}, [], undefined, ID_SECRET);
  const id = view.signups.find((row) => row.firstName === 'Ari').signupId;
  const first = Core.createClaim('manya', view, [], [id], '2026-02-01T00:00:00Z', 'claim-1');
  assert.equal(first.amount, 12);
  assert.throws(() => Core.createClaim('manya', view, [first], [id]), { code: 'already_claimed' });
  const rejected = Core.transition(first, 'reject', '2026-02-02T00:00:00Z');
  const second = Core.createClaim('manya', view, [rejected], [id], '2026-02-03T00:00:00Z', 'claim-2');
  assert.equal(second.items[0].signupId, id);
  assert.throws(() => Core.createClaim('manya', view, [], []), { code: 'nothing_to_claim' });
  assert.throws(() => Core.createClaim('manya', view, [], ['unknown']), { code: 'not_claimable' });
  assert.throws(() => Core.createClaim('other', view, [], [id]), { code: 'not_claimable' });
});

test('claim-all skips previously claimed signups and reports nothing when exhausted', () => {
  const names = { manya: 'Manya' };
  const records = Core.mergeSignups([
    { email: 'first@example.com', ref: 'manya', paying: true, price: 12 },
    { email: 'second@example.com', ref: 'manya', paying: true, price: 8 }
  ]);
  const view = Core.ambassadorView('manya', names, records, {}, [], undefined, ID_SECRET);
  const first = Core.createClaim('manya', view, [], [view.signups[0].signupId], 't1', 'c1');
  const second = Core.createClaim('manya', view, [first], undefined, 't2', 'c2');
  assert.deepEqual(second.items.map((item) => item.signupId), [view.signups[1].signupId]);
  assert.throws(() => Core.createClaim('manya', view, [first, second], undefined), { code: 'nothing_to_claim' });
});

test('existing claim amount stays fixed after billing changes and signup remains unclaimable', () => {
  const names = { manya: 'Manya' };
  const records = Core.mergeSignups([{ email: 'client@example.com', ref: 'manya', paying: true, price: 12 }]);
  const before = Core.ambassadorView('manya', names, records, {}, [], undefined, ID_SECRET);
  const claim = Core.createClaim('manya', before, [], undefined, 'created', 'claim-before-billing-change');
  assert.equal(claim.amount, 12);

  const after = Core.ambassadorView('manya', names, records, { 'client@example.com': { status: 'free', price: 0 } }, [claim], undefined, ID_SECRET);
  assert.equal(after.signups[0].commission, 0);
  assert.equal(after.signups[0].claimStatus, 'pending');
  assert.equal(after.claims[0].amount, 12);
  assert.deepEqual(Core.claimableFor('manya', after.signups, [claim]), []);
});

test('claim transitions enforce pending, approved, paid and rejected paths', () => {
  const claim = { id: 'c', status: 'pending', items: [], amount: 1 };
  const approved = Core.transition(claim, 'approve', 'a');
  const paid = Core.transition(approved, 'paid', 'p');
  assert.equal(approved.approvedAt, 'a');
  assert.equal(paid.status, 'paid');
  assert.equal(paid.paidAt, 'p');
  assert.throws(() => Core.transition(paid, 'approve'), { code: 'bad_transition' });
  assert.throws(() => Core.transition(claim, 'paid'), { code: 'bad_transition' });
});
