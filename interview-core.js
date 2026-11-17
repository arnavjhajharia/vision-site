/* Vision waitlist interview: pure logic shared by the chat UI (index.html) and the tests (tests/).
   Branch picking mirrors personal-agent src/features/waitlist/interview.js (variantFor / resolveQuestion):
   the first variant whose "when" matches EARLIER answers rewords a question; option ids never change. */
(function (root) {
  'use strict';
  function list(v) { return v == null ? [] : [].concat(v); }

  function fill(tpl, vars) {
    return String(tpl == null ? '' : tpl).replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? String(vars[k]) : m; });
  }

  function variantFor(q, answers) {
    var vs = q.variants || [];
    for (var i = 0; i < vs.length; i++) {
      var w = vs[i].when || {}, keys = Object.keys(w), ok = keys.length > 0;
      for (var j = 0; ok && j < keys.length; j++) {
        var picked = list(answers && answers[keys[j]]);
        ok = picked.some(function (a) { return w[keys[j]].indexOf(a) >= 0; });
      }
      if (ok) return vs[i];
    }
    return null;
  }

  // The question as Vision asks it, given what was answered so far.
  function resolve(q, answers) {
    var v = variantFor(q, answers) || {}, react = {}, k;
    for (k in q.react || {}) react[k] = q.react[k];
    for (k in v.react || {}) react[k] = v.react[k];
    return {
      id: q.id, type: q.type, variant: v.id || null,
      text: v.text || q.text, hint: v.hint != null ? v.hint : (q.hint || ''),
      note: !!q.note, react: react, reactMany: v.reactMany || q.reactMany || '', reactNote: q.reactNote || '',
      options: (q.options || []).map(function (o) {
        return { id: o.id, label: (v.labels && v.labels[o.id]) || o.label, text: !!o.text, match: o.match || [], range: o.range || null };
      })
    };
  }

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Keyword hit at a word start; short keywords ("no", "yes") must be whole words. Returns the keyword length (0 = miss).
  function hit(text, kw) {
    kw = String(kw).toLowerCase();
    var re = new RegExp('(^|[^a-z0-9])' + esc(kw) + (kw.length <= 3 ? '($|[^a-z0-9])' : ''), 'i');
    return re.test(text) ? kw.length : 0;
  }

  // Typed text -> { ids: [optionIds], note } . ids is empty when nothing matched (UI then asks to tap a chip).
  function matchText(rq, raw) {
    var text = String(raw || '').toLowerCase().trim(), opts = rq.options;
    if (!text) return { ids: [], note: '' };
    var m = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
    if (m && rq.type !== 'multi') {
      var n = parseFloat(m[0]);
      for (var i = 0; i < opts.length; i++) {
        var r = opts[i].range;
        if (r && n >= r[0] && n <= r[1]) return { ids: [opts[i].id], note: String(raw).trim() };
      }
    }
    var scored = opts.map(function (o) {
      var best = 0;
      (o.match || []).forEach(function (kw) { best = Math.max(best, hit(text, kw)); });
      if (!best && hit(text, o.label) && o.label.length > 3) best = o.label.length;
      return { id: o.id, s: best };
    }).filter(function (x) { return x.s > 0; });
    var note = String(raw).trim();
    if (rq.type === 'multi') {
      if (scored.length) return { ids: scored.map(function (x) { return x.id; }), note: note };
    } else if (scored.length) {
      scored.sort(function (a, b) { return b.s - a.s; });
      return { ids: [scored[0].id], note: note };
    }
    var other = opts.filter(function (o) { return o.text; })[0];
    return { ids: other ? [other.id] : [], note: note };
  }

  // Vision's one-line reaction to an answer. rand() is injectable for tests.
  function reaction(rq, value, note, rand) {
    rand = rand || Math.random;
    var ids = list(value), pickOne = function (x) { x = list(x); return x.length ? x[Math.floor(rand() * x.length) % x.length] : ''; };
    var labels = ids.map(function (id) { var o = rq.options.filter(function (x) { return x.id === id; })[0]; return o ? o.label : id; });
    if (rq.type === 'multi' && ids.length > 1 && rq.reactMany) return fill(pickOne(rq.reactMany), { labels: joinAnd(labels), n: ids.length });
    var other = rq.options.filter(function (o) { return o.text && ids.indexOf(o.id) >= 0; })[0];
    if (other && note && rq.reactNote) return fill(pickOne(rq.reactNote), { note: note, label: labels[0] });
    return fill(pickOne(rq.react[ids[0]]), { label: labels[0] || '', note: note || '' });
  }

  function joinAnd(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }

  // Answers for questions that no longer exist are dropped; returns index of the first unanswered question.
  function firstOpen(questions, answers) {
    for (var i = 0; i < questions.length; i++) if (!list(answers[questions[i].id]).length) return i;
    return questions.length;
  }

  // Ambassador referral code: lowercase letters, digits, '-' or '_', 1-32 chars. Anything else becomes ''.
  function normalizeRef(s) {
    s = String(s == null ? '' : s).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(s) ? s : '';
  }

  // ---- Landing chat (before signup): quick-reply chips and typed questions -> short Vision replies.
  // Checked in this order: the first topic with any keyword hit wins, so specific topics beat the generic 'features'.
  var TOPICS = [
    { id: 'custom', label: 'Custom features', match: ['custom', 'bespoke', 'my own feature', 'build me', 'build for me', '100'] },
    { id: 'pricing', label: 'Pricing', match: ['price', 'pricing', 'cost', 'how much', 'pay', 'plans', 'cheap', 'free', '$'] },
    { id: 'coding', label: 'Coding', match: ['code', 'coding', 'pull request', 'claude', 'codex', 'cursor', 'repo', 'build', 'developer'] },
    { id: 'safety', label: 'Is it safe?', match: ['safe', 'privacy', 'private', 'secure', 'security', 'approve', 'trust', 'my data'] },
    { id: 'join', label: 'Join waitlist', match: ['join', 'waitlist', 'sign up', 'signup', 'sign me', 'early access', 'get access', 'yes', 'count me in'] },
    { id: 'features', label: 'What can it do?', match: ['what can', 'what does', 'feature', 'do for me', 'help', 'what is', 'about', 'how does', 'tell me', 'whatsapp', 'telegram', 'email', 'calendar', 'reminder', 'remind', 'memory'] }
  ];
  var CHIP_ORDER = ['features', 'pricing', 'custom', 'join'];

  // Whole-word (or whole-phrase) match, allowing a plural 's': 'free' hits "is it free" but not "freelancer".
  function word(text, kw) {
    return new RegExp('(^|[^a-z0-9])' + esc(String(kw).toLowerCase()) + 's?($|[^a-z0-9])', 'i').test(text);
  }

  function isEmail(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s == null ? '' : s).trim()); }

  // Typed landing text -> topic id ('email' when it looks like an email address), or '' when nothing matched.
  function landingTopic(raw) {
    var text = String(raw == null ? '' : raw).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (isEmail(text)) return 'email';
    for (var i = 0; i < TOPICS.length; i++) {
      var t = TOPICS[i];
      for (var j = 0; j < t.match.length; j++) {
        var kw = t.match[j];
        if (kw === '$' ? text.indexOf('$') >= 0 : word(text, kw)) return t.id;
      }
    }
    return '';
  }

  function topicLabel(id) { var t = TOPICS.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }

  // Chips to offer next: the default four first, then extras, minus topics already asked. "Join waitlist" always stays.
  function landingChips(seen) {
    seen = list(seen);
    var ids = CHIP_ORDER.concat(['coding', 'safety']).filter(function (id) { return id === 'join' || seen.indexOf(id) < 0; });
    ids = ids.filter(function (id) { return id !== 'join'; }).slice(0, 3).concat(['join']);
    return ids.map(function (id) { return { id: id, label: topicLabel(id) }; });
  }

  // Fallback when features.json can't be loaded.
  var FALLBACK = {
    categories: [
      { id: 'essential', name: 'Essential', essential: true },
      { id: 'productivity', name: 'Productivity' },
      { id: 'builder', name: 'Builder' }
    ],
    features: [
      { name: 'Long-term memory', category: 'essential', status: 'live' },
      { name: 'Email triage and drafts', category: 'essential', status: 'live' },
      { name: 'Reminders that ring', category: 'essential', status: 'live' },
      { name: 'Replies with voice', category: 'productivity', status: 'live' },
      { name: 'Tunnel Vision', category: 'productivity', status: 'live' },
      { name: 'Coding pipeline', category: 'builder', status: 'live' },
      { name: 'Background jobs', category: 'builder', status: 'live' }
    ]
  };
  var LEAD = { essential: 'Every plan', productivity: 'Add Productivity', builder: 'Add Builder' };
  // Features worth naming first in a chat reply; anything else live in the category fills the gaps.
  var PICKS = {
    essential: ['Long-term memory', 'Email triage and drafts', 'Reminders that ring', 'Calendar'],
    productivity: ['Replies with voice', 'Tunnel Vision', 'OTP and alert relay'],
    builder: ['Coding pipeline', 'Background jobs', 'Previews and prototypes']
  };

  // Lowercase a feature name's first letter for mid-sentence use, unless it is a proper name ('Tunnel Vision', 'OTP ...').
  function lc(s) { return /[A-Z]/.test(s.slice(1)) ? s : s.charAt(0).toLowerCase() + s.slice(1); }

  // Up to n live feature names for a category: PICKS first, then the rest in features.json order (removed ones skipped).
  function liveNames(data, cat, n) {
    var live = ((data && data.features) || []).filter(function (f) { return !f.removed && f.status === 'live' && f.category === cat; });
    var pick = PICKS[cat] || [], rank = function (f) { var k = pick.indexOf(f.name); return k < 0 ? pick.length + live.indexOf(f) : k; };
    return live.slice().sort(function (a, b) { return rank(a) - rank(b); }).slice(0, n).map(function (f) { return lc(f.name); });
  }

  // Vision's short reply bubbles for a topic. data = features.json (or null). Every line is 1-2 short sentences.
  function landingReply(topic, data) {
    var d = data && (data.features || []).length ? data : FALLBACK, cats = d.categories && d.categories.length ? d.categories : FALLBACK.categories;
    switch (topic) {
      case 'features': {
        var out = ['I take the busywork off your plate, right inside WhatsApp or Telegram.'];
        cats.forEach(function (c) {
          var names = liveNames(d, c.id, 3);
          if (names.length) out.push((LEAD[c.id] || c.name) + ': ' + names.join(', ') + '.');
        });
        return out;
      }
      case 'coding':
        return ['Describe a change in chat and I run Claude Code, Codex or Cursor on it, then open the PR.',
          'Long jobs run in the background and report back. I never merge without your yes.'];
      case 'pricing':
        return ['$1 to $20 a month, priced by how you use it.', 'Or $100/month for Custom, with features built just for you.'];
      case 'custom':
        return ['You describe a feature. Vision builds it for you.', 'Custom is $100/month: everything in Vision, plus bespoke features.'];
      case 'safety':
        return ['Messages, emails and invites stay drafts until you approve them.', "Secrets live in a vault I use but never show, and 'stop everything' halts all agents."];
      case 'join':
        return ["Great. What's your email?"];
      default:
        return ["I can't answer that one here yet. Tap a chip, or type your email to join."];
    }
  }

  // Line that steers back to signup after a topic reply; n = topics answered so far.
  function landingNudge(n) {
    var lines = ['Want early access? Type your email.', 'Your email gets you on the list, and I can quote you a price.', 'Ready when you are: just type your email.'];
    return lines[Math.max(0, (n || 1) - 1) % lines.length];
  }

  // "Who invited you?" answer -> referral code, or '' (skip). Only codes listed in ambassadors.json count: the typed
  // answer must be a known code ("manya", "@manya") or an ambassador's name ("Manya"). Negatives ("no one", "skip"),
  // free text ("a friend") and anything typed before ambassadors.json loaded (ambassadors null) give ''.
  var NO_REF = /^(no|nope|none|nobody|no one|noone|nah|n\/a|na|skip|nothing|-)$/;
  function refFromText(raw, ambassadors) {
    var s = String(raw == null ? '' : raw).trim().replace(/^@/, '').replace(/[.!]+$/, '').replace(/\s+/g, ' ').toLowerCase();
    if (!s || NO_REF.test(s) || !ambassadors) return '';
    var direct = normalizeRef(s);
    if (direct && Object.prototype.hasOwnProperty.call(ambassadors, direct)) return direct;
    for (var code in ambassadors) {
      if (Object.prototype.hasOwnProperty.call(ambassadors, code) && String(ambassadors[code]).trim().toLowerCase() === s) return normalizeRef(code);
    }
    return '';
  }

  var api = { fill: fill, variantFor: variantFor, resolve: resolve, matchText: matchText, reaction: reaction, firstOpen: firstOpen, joinAnd: joinAnd, normalizeRef: normalizeRef,
    isEmail: isEmail, landingTopic: landingTopic, landingChips: landingChips, landingReply: landingReply, landingNudge: landingNudge, refFromText: refFromText, TOPICS: TOPICS };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.VisionInterview = api;
})(typeof window !== 'undefined' ? window : this);
