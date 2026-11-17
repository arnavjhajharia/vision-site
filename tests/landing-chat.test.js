// Run: node --test tests/   (no deps). Landing chat: chips / typed questions -> short Vision replies, email + referral.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const VI = require('../interview-core.js');
const FEATURES = require('../features.json');
const AMB = require('../ambassadors.json');

const sentences = (s) => (s.match(/[.!?](\s|$)/g) || []).length;

test('existing exports are still there', () => {
  for (const k of ['fill', 'variantFor', 'resolve', 'matchText', 'reaction', 'firstOpen', 'joinAnd', 'normalizeRef']) {
    assert.equal(typeof VI[k], 'function', k);
  }
});

test('landingTopic: typed questions map to topics, specific beats generic', () => {
  const cases = {
    'What can you do?': 'features',
    'tell me about it': 'features',
    'does it work in whatsapp': 'features',
    'how much is it': 'pricing',
    'what does it cost?': 'pricing',
    '$20?': 'pricing',
    'can you build me a custom feature': 'custom',
    'what about the $100 plan': 'custom',
    'does it write code with claude': 'coding',
    'is my data private?': 'safety',
    'sign me up': 'join',
    'Join waitlist': 'join',
    'me@example.com': 'email',
    '  Me@Example.COM ': 'email',
    'asdfgh': '',
    '': '',
  };
  for (const [text, want] of Object.entries(cases)) assert.equal(VI.landingTopic(text), want, text);
});

test('landingTopic: every chip label maps back to its own topic', () => {
  for (const t of VI.TOPICS) assert.equal(VI.landingTopic(t.label), t.id, t.label);
});

test('landingChips: starts with the four main chips, drops seen topics, keeps Join last', () => {
  assert.deepEqual(VI.landingChips([]).map((c) => c.label), ['What can it do?', 'Pricing', 'Custom features', 'Join waitlist']);
  const after = VI.landingChips(['features', 'pricing']).map((c) => c.id);
  assert.ok(!after.includes('features') && !after.includes('pricing'));
  assert.equal(after[after.length - 1], 'join');
  assert.ok(after.length >= 2 && after.length <= 4);
  assert.deepEqual(VI.landingChips(['features', 'pricing', 'custom', 'coding', 'safety', 'join']).map((c) => c.id), ['join']);
});

test('landingReply: features come from features.json, live only, grouped by category', () => {
  const out = VI.landingReply('features', FEATURES);
  assert.ok(out.length >= 2 && out.length <= 5);
  const live = FEATURES.features.filter((f) => f.status === 'live' && !f.removed).map((f) => f.name.toLowerCase());
  const named = out.slice(1).flatMap((l) => l.replace(/^[^:]+:\s*/, '').replace(/\.$/, '').split(', '));
  assert.ok(named.length >= 3);
  for (const n of named) assert.ok(live.includes(n.toLowerCase()), n);
  assert.match(out.join(' '), /Every plan/);
});

test('landingReply: pricing and custom include the Custom tier', () => {
  const p = VI.landingReply('pricing', FEATURES).join(' ');
  assert.match(p, /\$1 to \$20 a month/);
  assert.match(p, /\$100\/month/);
  const c = VI.landingReply('custom', FEATURES).join(' ');
  assert.match(c, /You describe a feature\. Vision builds it for you\./);
  assert.match(c, /\$100\/month/);
});

test('landingReply: every bubble is short (1-2 sentences), even without features.json', () => {
  for (const data of [FEATURES, null, { features: [] }]) {
    for (const t of VI.TOPICS.map((x) => x.id).concat([''])) {
      const out = VI.landingReply(t, data);
      assert.ok(out.length >= 1, t);
      for (const line of out) {
        assert.ok(line.length <= 120, `${t}: ${line}`);
        assert.ok(sentences(line) <= 2, `${t}: ${line}`);
      }
    }
  }
  assert.ok(VI.landingReply('features', null).length >= 2);
});

test('landingNudge: steers back to signup by asking for the email', () => {
  for (let n = 1; n <= 5; n++) assert.match(VI.landingNudge(n), /email/i);
});

test('isEmail', () => {
  assert.ok(VI.isEmail('a@b.co'));
  assert.ok(!VI.isEmail('a@b'));
  assert.ok(!VI.isEmail('hi there'));
  assert.ok(!VI.isEmail(null));
});

test('landingTopic: keywords match whole words only', () => {
  assert.equal(VI.landingTopic("I'm a freelancer"), '');
  assert.equal(VI.landingTopic('I am building a startup'), '');
  assert.equal(VI.landingTopic('that was helpful'), '');
  assert.equal(VI.landingTopic('is it free?'), 'pricing');
  assert.equal(VI.landingTopic('what are the prices'), 'pricing');
  assert.equal(VI.landingTopic('list the features'), 'features');
  assert.equal(VI.landingTopic('can it build apps'), 'coding');
  assert.equal(VI.landingTopic('does it do reminders'), 'features');
});

test('refFromText: known codes, @codes and ambassador names become codes', () => {
  assert.equal(VI.refFromText('manya', AMB), 'manya');
  assert.equal(VI.refFromText('@Manya', AMB), 'manya');
  assert.equal(VI.refFromText(' MANYA. ', AMB), 'manya');
  assert.equal(VI.refFromText('Rahul Shah', { rs1: 'Rahul Shah' }), 'rs1');
  assert.equal(VI.refFromText('rahul  shah', { rs1: 'Rahul Shah' }), 'rs1');
});

test('refFromText: negatives, free text and unknown codes give no referral', () => {
  for (const t of ['no', 'No.', 'nope', 'none', 'nobody', 'no one', 'No One!', 'skip', 'n/a', 'a friend', 'John Doe', 'ghost', '<script>', '', 'x'.repeat(40)]) {
    assert.equal(VI.refFromText(t, AMB), '', t);
  }
  assert.equal(VI.refFromText('constructor', AMB), '');
  assert.equal(VI.refFromText('toString', AMB), '');
});

test('refFromText: nothing is accepted before ambassadors.json loads', () => {
  assert.equal(VI.refFromText('manya', null), '');
  assert.equal(VI.refFromText('manya'), '');
});

test('extractEmail: pulls the address out of a sentence, normalized', () => {
  assert.equal(VI.extractEmail('my email is Me@X.com'), 'me@x.com');
  assert.equal(VI.extractEmail('sign me up: me@x.com.'), 'me@x.com');
  assert.equal(VI.extractEmail('  John.Doe+vision@Mail.Example.io  '), 'john.doe+vision@mail.example.io');
  assert.equal(VI.extractEmail('(you@y.io), thanks!'), 'you@y.io');
  assert.equal(VI.extractEmail('john gmail.com'), '');
  assert.equal(VI.extractEmail('a@b'), '');
  assert.equal(VI.extractEmail(null), '');
});

test('landingTopic: an email inside a sentence wins over the email/join keywords', () => {
  assert.equal(VI.landingTopic('my email is me@x.com'), 'email');
  assert.equal(VI.landingTopic('sign me up: me@x.com'), 'email');
  assert.equal(VI.landingTopic('does it handle my email?'), 'features');
});
