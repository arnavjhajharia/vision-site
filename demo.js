/* Vision hero demo: a looping, WhatsApp-style chat. No dependencies.
   Renders into #vision-demo. Exposes window.VisionDemo = {pause, play}. */
(function () {
  'use strict';

  var TYPE_MS = 600;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }

  /* ---------- scene content builders ---------- */

  function triage() {
    var ul = el('ul', 'demo-list');
    [['Urgent', 't-urgent', 'Priya (Northwind VC)', 'follow-up on Thursday'],
     ['Sign', 't-reply', 'Lumen Studio', 'contract, due Fri'],
     ['Skip', 't-skip', '14 newsletters', 'archived']].forEach(function (r) {
      var li = el('li');
      add(li, el('span', 'demo-tag ' + r[1], r[0]), add(el('span'), el('b', null, r[2]), document.createTextNode(': ' + r[3])));
      ul.appendChild(li);
    });
    return [el('span', null, '3 things worth your time:'), ul];
  }

  function draft() {
    return [el('span', null, 'Drafted a reply to Priya. Send it?'),
      el('div', 'demo-quote', '\u201cHi Priya, Thursday 4pm works. Deck attached. Arnav\u201d')];
  }

  function plan(ctx) {
    var ol = el('ol', 'demo-steps');
    ['Add theme tokens', 'Settings toggle', 'Tests + screenshots'].forEach(function (s) { ol.appendChild(el('li', null, s)); });
    var box = el('div', 'demo-agents');
    ctx.agents = [['Claude Code', 'theme tokens'], ['Codex', 'settings toggle'], ['Cursor', 'tests']].map(function (a) {
      var row = el('div', 'demo-agent');
      var st = el('span', 'a-st', 'working');
      add(row, el('span', 'a-name', a[0]), el('span', 'a-task', a[1]), st);
      box.appendChild(row);
      return { row: row, st: st };
    });
    return [el('span', null, 'Plan:'), ol, el('span', null, 'Splitting across 3 agents\u2026'), box];
  }

  function agentDone(i) {
    return function (ctx) {
      var a = ctx.agents && ctx.agents[i];
      if (!a) return;
      a.row.className = 'demo-agent is-done';
      a.st.textContent = '\u2713 done';
    };
  }

  function pr(ctx) {
    var card = el('div', 'demo-pr');
    add(card, el('span', 'pr-n', 'PR #142'), el('span', null, 'Add dark mode '),
      el('span', 'demo-add', '+214'), document.createTextNode(' '), el('span', 'demo-del', '\u221238'));
    var chips = el('div', 'demo-chips');
    ctx.approve = el('span', 'demo-chip is-primary', 'Approve');
    ctx.notYet = el('span', 'demo-chip', 'Not yet');
    add(chips, ctx.approve, ctx.notYet);
    return [el('span', null, 'All 3 done. PR opened. Merge?'), card, chips];
  }

  function press(ctx) {
    if (ctx.approve) ctx.approve.className = 'demo-chip is-primary is-pressed';
    if (ctx.notYet) ctx.notYet.className = 'demo-chip is-off';
  }

  /* ---------- scenes ---------- */
  // Step kinds: me(text,time,wait) | v(content,time,wait) | them(from,cls,text,time,wait)
  //             sys(text,wait,strong) | fn(callback,wait)
  function me(text, time, wait) { return { k: 'me', text: text, time: time, wait: wait }; }
  function v(content, time, wait) { return { k: 'v', content: content, time: time, wait: wait }; }
  function them(from, cls, text, time, wait) { return { k: 'them', from: from, cls: cls, text: text, time: time, wait: wait }; }
  function sys(text, wait, strong) { return { k: 'sys', text: text, wait: wait, strong: strong }; }
  function fn(cb, wait) { return { k: 'fn', cb: cb, wait: wait }; }

  var VISION = { av: 'V', name: 'Vision', status: 'online', group: false };

  var SCENES = [
    { tab: 'Inbox', head: VISION, steps: [
      me('what\u2019s important in my email?', '9:41', 500),
      v(triage, '9:41', 1700),
      v(draft, '9:41', 1700),
      me('ok', '9:42', 350),
      v('Sent \u2713', '9:42', 1500)
    ] },
    { tab: 'Code', head: VISION, steps: [
      me('add dark mode to the app', '11:02', 450),
      v(plan, '11:02', 650),
      fn(agentDone(0), 450), fn(agentDone(2), 400), fn(agentDone(1), 250),
      v(pr, '11:09', 1100),
      fn(press, 500),
      v('Merged. Live on staging.', '11:09', 1500)
    ] },
    { tab: 'Reminders', head: VISION, steps: [
      v('\u23f0 Call mom: 6pm', '18:00', 900),
      v('Still on? (reminder 2)', '18:10', 750),
      v('Nudging once more: call mom. (reminder 3)', '18:20', 600),
      me('done', '18:21', 300),
      v('Marked done. I\u2019ll stop nagging.', '18:21', 1500)
    ] },
    { tab: 'Groups', head: { av: 'F', name: 'Founders \ud83d\ude80', status: 'Arnav, Maya, Dev, Vision', group: true }, steps: [
      sys('Vision is in this group \u00b7 only replies when tagged', 500),
      them('Maya', '', 'deck review at 3?', '14:20', 650),
      them('Dev', 'is-c2', 'works for me', '14:20', 650),
      them('Maya', '', 'Arnav, where were you last weekend? \ud83d\udc40', '14:21', 1400),
      them('Dev', 'is-c2', '@Vision what\u2019s the deck link?', '14:22', 300),
      v('vision.app/d/seed-v3', '14:22', 1100),
      sys('Private stays private.', 2000, true)
    ] }
  ];

  var SUMMARY = [
    'Inbox: asked what is important in email, Vision triages three messages, drafts a reply and sends it only after the user says ok.',
    'Code: asked to add dark mode, Vision plans, splits the work across three coding agents, opens a pull request and merges it only after approval.',
    'Reminders: Vision nags about a call until the user says done, then stops.',
    'Groups: in a founders group chat Vision stays silent on a personal question about Arnav and only answers when tagged, with the deck link.'
  ];

  /* ---------- engine ---------- */

  function init() {
    var root = document.getElementById('vision-demo');
    if (!root || root.getAttribute('data-ready')) return;
    root.setAttribute('data-ready', '1');
    if (!root.classList.contains('demo')) root.classList.add('demo');

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);

    // DOM skeleton
    var sr = el('div', 'demo-sr');
    sr.appendChild(el('p', null, 'Demo of Vision in four short chats:'));
    var srList = el('ul');
    SUMMARY.forEach(function (s) { srList.appendChild(el('li', null, s)); });
    sr.appendChild(srList);

    var phone = el('div', 'demo-phone');
    var head = el('div', 'demo-head');
    var av = el('div', 'demo-av');
    av.setAttribute('aria-hidden', 'true');
    var who = el('div', 'demo-who');
    var name = el('div', 'demo-name');
    var status = el('div', 'demo-status');
    add(who, name, status);
    add(head, av, who);
    var log = el('div', 'demo-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'off');
    log.setAttribute('aria-label', 'Example conversation');
    add(phone, head, log);

    var tabs = el('div', 'demo-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Demo scenes');
    var tabBtns = SCENES.map(function (s, i) {
      var b = el('button', 'demo-tab', s.tab);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { userPaused = false; start(i); });
      tabs.appendChild(b);
      return b;
    });

    while (root.firstChild) root.removeChild(root.firstChild);
    add(root, sr, phone, tabs);

    var cur = 0, step = 0, timer = null, typingNode = null, ctx = {};
    var visible = true, userPaused = false, running = false;

    function clear() { if (timer) { clearTimeout(timer); timer = null; } }
    function later(f, ms) { clear(); timer = setTimeout(function () { timer = null; f(); }, ms); }
    function scroll() { log.scrollTop = log.scrollHeight; }
    function canRun() { return !reduced && visible && !userPaused && !document.hidden; }

    function setHead(h) {
      av.textContent = h.av;
      av.className = 'demo-av' + (h.group ? ' is-group' : '');
      name.textContent = h.name;
      status.textContent = h.status;
      status.className = 'demo-status';
    }

    function dropTyping() {
      if (typingNode && typingNode.parentNode) typingNode.parentNode.removeChild(typingNode);
      typingNode = null;
      setHead(SCENES[cur].head);
    }

    function showTyping() {
      dropTyping();
      typingNode = el('div', 'demo-msg is-them demo-typing');
      typingNode.setAttribute('aria-hidden', 'true');
      add(typingNode, el('i'), el('i'), el('i'));
      log.appendChild(typingNode);
      status.textContent = SCENES[cur].head.group ? 'Vision is typing\u2026' : 'typing\u2026';
      status.className = 'demo-status is-typing';
      scroll();
    }

    function bubble(side, from, fromCls, time, ticks) {
      var m = el('div', 'demo-msg ' + side);
      if (from) m.appendChild(el('span', 'demo-from ' + (fromCls || ''), from));
      var body = el('div', 'demo-body');
      m.appendChild(body);
      var meta = el('span', 'demo-meta', time || '');
      if (ticks) meta.appendChild(el('span', 'demo-ticks', '\u2713\u2713'));
      m.appendChild(meta);
      return { m: m, body: body };
    }

    function post(node) { dropTyping(); log.appendChild(node); scroll(); }

    function run(s) {
      var b;
      if (s.k === 'me') {
        b = bubble('is-me', null, null, s.time, true);
        b.body.textContent = s.text;
        post(b.m);
      } else if (s.k === 'them') {
        b = bubble('is-them', s.from, s.cls, s.time, false);
        b.body.textContent = s.text;
        post(b.m);
      } else if (s.k === 'v') {
        b = bubble('is-them', SCENES[cur].head.group ? 'Vision' : null, 'is-vision', s.time, false);
        if (typeof s.content === 'function') b.m.className += ' is-wide';
        if (typeof s.content === 'function') {
          s.content(ctx).forEach(function (n) { b.body.appendChild(n); });
        } else b.body.textContent = s.content;
        post(b.m);
      } else if (s.k === 'sys') {
        post(el('div', 'demo-sys' + (s.strong ? ' is-strong' : ''), s.text));
      } else if (s.k === 'fn') {
        s.cb(ctx);
        scroll();
      }
    }

    // Each scene step may be preceded by a typing phase (Vision messages only).
    var typedFor = -1;
    function tick() {
      if (!canRun()) { running = false; return; }
      running = true;
      var steps = SCENES[cur].steps;
      if (step >= steps.length) {
        phone.classList.add('is-swap');
        later(function () { start((cur + 1) % SCENES.length); }, 300);
        return;
      }
      var s = steps[step];
      if (s.k === 'v' && typedFor !== step) {
        typedFor = step;
        showTyping();
        later(tick, TYPE_MS);
        return;
      }
      run(s);
      step++;
      later(tick, s.wait || 600);
    }

    function start(i) {
      clear();
      cur = i; step = 0; typedFor = -1; ctx = {}; typingNode = null;
      while (log.firstChild) log.removeChild(log.firstChild);
      phone.classList.remove('is-swap');
      setHead(SCENES[cur].head);
      tabBtns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === cur ? 'true' : 'false'); });
      if (reduced) {
        // Static: render the whole scene at once, no typing, no timers.
        SCENES[cur].steps.forEach(run);
        step = SCENES[cur].steps.length;
        scroll();
        return;
      }
      if (canRun()) { running = true; later(tick, 350); } else running = false;
    }

    function resume() {
      if (!running && canRun()) { running = true; later(tick, 400); }
    }
    function halt() { clear(); running = false; }
    function sync() { if (canRun()) resume(); else halt(); }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      }, { threshold: 0.15 }).observe(root);
    }
    document.addEventListener('visibilitychange', sync);
    if (mq) {
      var onMq = function () { reduced = mq.matches; start(cur); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }

    window.VisionDemo = {
      pause: function () { userPaused = true; halt(); },
      play: function () { userPaused = false; resume(); }
    };

    start(0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
