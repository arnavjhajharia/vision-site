/* Pure ambassador accounting and view logic. CommonJS in Node, global in browsers. */
(function (root) {
  'use strict';

  function normalizeCode(code) { return String(code == null ? '' : code).trim().toLowerCase(); }

  function mergeSignups(input) {
    var source = typeof input === 'string' ? input.split(/\r?\n/) : (input || []);
    var records = source.map(function (entry) {
      if (typeof entry !== 'string') return entry;
      var line = entry;
      try { return JSON.parse(line); } catch (_) { return null; }
    }).filter(Boolean);
    var byEmail = new Map();
    records.forEach(function (record) {
      if (!record || !record.email) return;
      var email = String(record.email);
      var key = email.trim().toLowerCase();
      if (!key) return;
      var previous = byEmail.get(key) || {};
      var firstRef = normalizeCode(previous.ref) || normalizeCode(record.ref);
      byEmail.set(key, Object.assign({}, previous, record, { email: previous.email || email, ref: firstRef }));
    });
    return Array.from(byEmail.values());
  }

  function signupId(email, secret) {
    if (typeof require !== 'function') throw new Error('signupId is available on the server only');
    if (!secret) throw new Error('A server-side signup ID secret is required');
    return require('node:crypto').createHmac('sha256', String(secret)).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 12);
  }

  function firstName(record) {
    if (record && typeof record.firstName === 'string' && record.firstName.trim()) return record.firstName.trim();
    if (record && typeof record.name === 'string' && record.name.trim()) return record.name.trim().split(/\s+/)[0];
    return 'Someone';
  }

  function statusOf(record, billing) {
    billing = billing || {};
    if (billing.status === 'paying' || record.paying === true || record.status === 'paying') return 'paying';
    if (record.interview) return 'interviewed';
    return 'signed_up';
  }

  function numberOrNull(value) {
    if (value === '' || value == null || typeof value === 'boolean') return null;
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function priceOf(record, billing) {
    billing = billing || {};
    if (billing.status === 'free') return 0;
    var quote = record.interview && record.interview.quote;
    var candidates = [billing.price, record.price, quote && quote.price, record.quote && record.quote.price,
      typeof quote === 'number' || typeof quote === 'string' ? quote : null,
      typeof record.quote === 'number' || typeof record.quote === 'string' ? record.quote : null];
    for (var i = 0; i < candidates.length; i++) {
      var price = numberOrNull(candidates[i]);
      if (price !== null) return price;
    }
    return null;
  }

  function planOf(price) {
    if (price == null) return null;
    if (price === 0) return 'free';
    if (price === 100) return 'max';
    if (price >= 1 && price <= 20) return 'vision';
    return 'custom';
  }

  function revenue(status, price) { return status === 'paying' ? (price || 0) : 0; }
  function cents(value) { return Math.round((Number(value) || 0) * 100) / 100; }

  function allSignupViews(code, signups, billing, claims, idSecret) {
    var activeClaims = (claims || []).filter(function (claim) { return claim.status !== 'rejected'; });
    var claimedById = new Map();
    activeClaims.forEach(function (claim) { (claim.items || []).forEach(function (item) { claimedById.set(item.signupId, claim); }); });
    return (signups || []).filter(function (record) { return normalizeCode(record.ref) === code; }).map(function (record) {
      var id = signupId(record.email, idSecret), details = billing && (billing[record.email] || billing[String(record.email).trim().toLowerCase()]) || {};
      var status = statusOf(record, details), price = priceOf(record, details), month = revenue(status, price), claim = claimedById.get(id);
      return { signupId: id, firstName: firstName(record), status: status, plan: planOf(price), price: price,
        monthlyRevenue: cents(month), commission: cents(month), claimStatus: claim ? claim.status : null, joinedAt: record.at || null };
    });
  }

  function claimableFor(code, signups, claims, billing, idSecret) {
    var normalized = normalizeCode(code), claimed = new Set();
    (claims || []).filter(function (claim) { return claim.status !== 'rejected'; }).forEach(function (claim) {
      (claim.items || []).forEach(function (item) { claimed.add(item.signupId); });
    });
    return (signups || []).filter(function (record) { return normalizeCode(record.ref || record.code) === normalized; }).map(function (record) {
      var details = billing && (billing[record.email] || billing[String(record.email || '').trim().toLowerCase()]) || {};
      var id = record.signupId || signupId(record.email, idSecret);
      var commission = record.commission != null ? Number(record.commission) : revenue(statusOf(record, details), priceOf(record, details));
      return { signupId: id, record: record, commission: commission };
    }).filter(function (entry) { return entry.commission > 0 && !claimed.has(entry.signupId); });
  }

  function createClaim(code, view, claims, signupIds, now, id) {
    var normalized = normalizeCode(code);
    if (!view || normalizeCode(view.code) !== normalized) throw codedError('not_claimable');
    var claimed = new Set();
    (claims || []).filter(function (claim) { return claim.status !== 'rejected'; }).forEach(function (claim) {
      (claim.items || []).forEach(function (item) { claimed.add(item.signupId); });
    });
    var all = (view.signups || []).filter(function (signup) { return signup.commission > 0; });
    var requested = signupIds == null ? all.filter(function (signup) { return !claimed.has(signup.signupId); }).map(function (signup) { return signup.signupId; }) : signupIds;
    if (!Array.isArray(requested)) throw codedError('not_claimable');
    if (!requested.length) throw codedError('nothing_to_claim');
    var unique = Array.from(new Set(requested));
    if (unique.some(function (signupId) { return claimed.has(signupId); })) throw codedError('already_claimed');
    var byId = new Map(all.map(function (signup) { return [signup.signupId, signup]; }));
    var selected = unique.map(function (signupId) { return byId.get(signupId); });
    if (selected.some(function (signup) { return !signup; })) throw codedError('not_claimable');
    var claimItems = selected.map(function (signup) { return { signupId: signup.signupId, amount: cents(signup.commission) }; });
    return { id: id || require('node:crypto').randomUUID(), code: normalized, items: claimItems,
      amount: cents(claimItems.reduce(function (sum, item) { return sum + item.amount; }, 0)),
      status: 'pending', createdAt: now || new Date().toISOString() };
  }

  function codedError(code) { var error = new Error(code); error.code = code; return error; }

  function transition(claim, action, now) {
    var next = Object.assign({}, claim), at = now || new Date().toISOString();
    if (action === 'approve' && claim.status === 'pending') { next.status = 'approved'; next.approvedAt = at; return next; }
    if (action === 'paid' && claim.status === 'approved') { next.status = 'paid'; next.paidAt = at; return next; }
    if (action === 'reject' && (claim.status === 'pending' || claim.status === 'approved')) { next.status = 'rejected'; next.rejectedAt = at; return next; }
    throw codedError('bad_transition');
  }

  function emptyTotals() { return { signups: 0, interviewed: 0, paying: 0, monthlyRevenue: 0, commissionEarned: 0, claimable: 0, pending: 0, approved: 0, paid: 0 }; }
  function buildTotals(signups, claims) {
    var result = emptyTotals();
    signups.forEach(function (signup) {
      result.signups++;
      if (signup.status === 'interviewed' || signup.status === 'paying') result.interviewed++;
      if (signup.status === 'paying') result.paying++;
      result.monthlyRevenue += signup.monthlyRevenue;
      result.commissionEarned += signup.commission;
      if (signup.commission > 0 && !signup.claimStatus) result.claimable += signup.commission;
    });
    (claims || []).forEach(function (claim) { if (Object.prototype.hasOwnProperty.call(result, claim.status)) result[claim.status] += claim.amount; });
    Object.keys(result).forEach(function (key) { if (key !== 'signups' && key !== 'interviewed' && key !== 'paying') result[key] = cents(result[key]); });
    return result;
  }

  function publicClaims(code, names, claims, signups) {
    var namesById = new Map();
    signups.forEach(function (signup) { namesById.set(signup.signupId, signup.firstName); });
    return (claims || []).filter(function (claim) { return claim.code === code; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).map(function (claim) {
      return { id: claim.id, amount: claim.amount, status: claim.status, createdAt: claim.createdAt,
        approvedAt: claim.approvedAt, paidAt: claim.paidAt,
        items: (claim.items || []).map(function (item) { return { signupId: item.signupId, firstName: namesById.get(item.signupId) || 'Someone', amount: item.amount }; }) };
    });
  }

  function ambassadorView(code, names, signups, billing, claims, siteUrl, idSecret) {
    code = normalizeCode(code);
    var viewed = allSignupViews(code, signups, billing, claims, idSecret);
    var relatedClaims = (claims || []).filter(function (claim) { return claim.code === code; });
    return { code: code, name: names[code], active: true,
      perk: { plan: 'Vision Max', price: 100, free: true, note: 'Free while you are an active ambassador' },
      link: (siteUrl || 'https://arnavjhajharia.github.io/vision-site/') + '?ref=' + code,
      signups: viewed, totals: buildTotals(viewed, relatedClaims), claims: publicClaims(code, names, relatedClaims, viewed) };
  }

  function adminView(names, signups, billing, claims, idSecret) {
    var ambassadors = Object.keys(names).map(function (code) {
      var viewed = allSignupViews(code, signups, billing, claims, idSecret), related = (claims || []).filter(function (claim) { return claim.code === code; });
      var totals = buildTotals(viewed, related);
      return { code: code, name: names[code], signups: totals.signups, interviewed: totals.interviewed, paying: totals.paying,
        monthlyRevenue: totals.monthlyRevenue, commissionEarned: totals.commissionEarned, claimable: totals.claimable,
        pending: totals.pending, approved: totals.approved, paid: totals.paid, owed: totals.approved };
    });
    var totals = emptyTotals();
    ambassadors.forEach(function (ambassador) { Object.keys(totals).forEach(function (key) { totals[key] += ambassador[key]; }); });
    totals.owed = ambassadors.reduce(function (sum, ambassador) { return sum + ambassador.owed; }, 0);
    ['monthlyRevenue', 'commissionEarned', 'claimable', 'pending', 'approved', 'paid', 'owed'].forEach(function (key) { totals[key] = cents(totals[key]); });
    var nameById = new Map();
    signups.forEach(function (record) { nameById.set(signupId(record.email, idSecret), firstName(record)); });
    var publicAdminClaims = (claims || []).slice().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).map(function (claim) {
      return { id: claim.id, code: claim.code, name: names[claim.code] || 'Unknown', amount: claim.amount, status: claim.status,
        createdAt: claim.createdAt, approvedAt: claim.approvedAt, paidAt: claim.paidAt, rejectedAt: claim.rejectedAt,
        items: (claim.items || []).map(function (item) { return { signupId: item.signupId, firstName: nameById.get(item.signupId) || 'Someone', amount: item.amount }; }) };
    });
    return { ambassadors: ambassadors, totals: totals, claims: publicAdminClaims };
  }

  var api = { mergeSignups: mergeSignups, signupId: signupId, firstName: firstName, statusOf: statusOf, priceOf: priceOf,
    planOf: planOf, claimableFor: claimableFor, createClaim: createClaim, transition: transition,
    ambassadorView: ambassadorView, adminView: adminView };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.AmbassadorCore = api;
})(typeof window !== 'undefined' ? window : this);
