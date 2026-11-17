// Run: node --test tests/   (no deps). Uses the real config from ../personal-agent when it's checked out next to this repo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const VI = require('../interview-core.js');

const PA = path.join(__dirname, '..', '..', 'personal-agent');
const CFG = path.join(PA, 'src', 'features', 'waitlist', 'interview.default.json');
const have = fs.existsSync(CFG);
const cfg = have ? JSON.parse(fs.readFileSync(CFG, 'utf8')) : null;
const Q = (id) => cfg.questions.find((q) => q.id === id);
const opt = { skip: have ? false : 'personal-agent checkout not found next to vision-site' };

test('resolve: coding follow-ups talk about repos, others fall back', opt, () => {
  assert.equal(VI.resolve(Q('tools'), { focus: ['coding'] }).variant, 'coding');
  assert.match(VI.resolve(Q('tools'), { focus: ['coding'] }).text, /repos/i);
  assert.equal(VI.resolve(Q('tools'), { focus: ['calendar'] }).text, Q('tools').text);
  assert.equal(VI.resolve(Q('pay'), { hours: '10+' }).variant, 'heavy');
  assert.equal(VI.resolve(Q('custom'), { focus: ['coding'] }).options.find((o) => o.id === 'yes').label, 'Yes, build for me');
});

test('client branches match the server for every focus combination', opt, async () => {
  const wl = await import(path.join(PA, 'src', 'features', 'waitlist', 'interview.js'));
  const ids = Q('focus').options.map((o) => o.id);
  for (let mask = 1; mask < 1 << ids.length; mask++) for (const hours of ['0-2', '10+']) {
    const ans = { focus: ids.filter((_, k) => mask & (1 << k)), hours };
    for (const q of cfg.questions) {
      const s = wl.resolveQuestion(cfg, q.id, ans), c = VI.resolve(q, ans);
      assert.equal(c.variant, s.variant); assert.equal(c.text, s.text);
      assert.deepEqual(c.options.map((o) => o.label), s.options.map((o) => o.label));
    }
  }
});

test('typed answers map to chips via ranges and keywords', opt, () => {
  const r = (qid, t, a = {}) => VI.matchText(VI.resolve(Q(qid), a), t).ids;
  assert.deepEqual(r('hours', 'about 8 hours'), ['5-10']);
  assert.deepEqual(r('hours', 'honestly 15+'), ['10+']);
  assert.deepEqual(r('hours', 'barely any'), ['0-2']);
  assert.deepEqual(r('tools', 'maybe 4'), ['3-5']);
  assert.deepEqual(r('pay', '$12'), ['10-20']);
  assert.deepEqual(r('custom', 'not sure yet'), ['maybe']);
  assert.deepEqual(r('custom', 'no thanks'), ['no']);
  assert.deepEqual(r('custom', 'yeah!'), ['yes']);
  assert.deepEqual(r('focus', 'my gmail and github repos').sort(), ['coding', 'email']);
  assert.deepEqual(r('focus', 'groceries'), ['other']);   // falls back to the free-text option
  assert.deepEqual(r('hours', 'it depends'), []);         // no match -> UI asks for the closest chip
});

test('reactions come from the config, per answer and per branch', opt, () => {
  const tools = VI.resolve(Q('tools'), { focus: ['coding'] });
  assert.equal(VI.reaction(tools, '6+'), tools.react['6+']);
  assert.match(VI.reaction(tools, '6+'), /repo/);
  const focus = VI.resolve(Q('focus'), {});
  assert.equal(VI.reaction(focus, ['coding']), Q('focus').react.coding);
  assert.equal(VI.reaction(focus, ['email', 'coding', 'chat']), 'Email, Coding and WhatsApp / chat. Good mix, I can juggle that.');
  assert.match(VI.reaction(focus, ['other'], 'groceries'), /groceries/);
});

test('fixture: first matching variant wins, list reactions pick by rand, firstOpen resumes', () => {
  const q = { id: 'b', type: 'single', text: 'base', options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }],
    react: { x: ['one', 'two'] },
    variants: [{ id: 'v1', when: { a: ['1'], c: ['9'] }, text: 'both' }, { id: 'v2', when: { a: ['1', '2'] }, text: 'v2', react: { y: 'vy' } }] };
  assert.equal(VI.resolve(q, { a: '1' }).text, 'v2');
  assert.equal(VI.resolve(q, { a: '1', c: '9' }).text, 'both');
  assert.equal(VI.resolve(q, { a: ['3'] }).text, 'base');
  const rq = VI.resolve(q, { a: '2' });
  assert.equal(VI.reaction(rq, 'x', '', () => 0.99), 'two');
  assert.equal(VI.reaction(rq, 'y'), 'vy');
  assert.equal(VI.firstOpen([{ id: 'a' }, { id: 'b' }, { id: 'c' }], { a: '1', b: [] }), 1);
  assert.equal(VI.fill('{a} and {b}', { a: 1 }), '1 and {b}');
});
