#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Core = require(path.join(ROOT, 'ambassador-core.js'));
const Interview = require(path.join(ROOT, 'interview-core.js'));
const STATIC_FILES = new Set(['/ambassadors.html', '/ambassador-admin.html', '/ambassador-core.js']);

function defaults(opts = {}) {
  return {
    host: opts.host || '127.0.0.1', port: opts.port ?? Number(process.env.PORT || 8787),
    root: opts.root || ROOT,
    waitlistFile: opts.waitlistFile || process.env.WAITLIST_FILE || path.resolve(ROOT, '..', 'personal-agent', 'data', 'waitlist.jsonl'),
    billingFile: opts.billingFile || process.env.AMBASSADOR_BILLING_FILE || path.resolve(ROOT, '..', 'personal-agent', 'data', 'ambassador-billing.json'),
    claimsFile: opts.claimsFile || process.env.AMBASSADOR_CLAIMS_FILE || path.join(ROOT, 'data', 'ambassador-claims.json'),
    namesFile: opts.namesFile || path.join(ROOT, 'ambassadors.json'),
    adminToken: opts.adminToken ?? process.env.ADMIN_TOKEN,
    idSecret: opts.idSecret ?? process.env.AMBASSADOR_ID_SECRET,
    idSecretFile: opts.idSecretFile || path.join(opts.root || ROOT, 'data', 'ambassador-id-secret')
  };
}

function getIdSecret(config) {
  if (config.idSecret) return String(config.idSecret);
  try { return fs.readFileSync(config.idSecretFile, 'utf8').trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fs.mkdirSync(path.dirname(config.idSecretFile), { recursive: true });
    const secret = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(config.idSecretFile, `${secret}\n`, { mode: 0o600, flag: 'wx' }); }
    catch (writeError) { if (writeError.code !== 'EEXIST') throw writeError; }
    return fs.readFileSync(config.idSecretFile, 'utf8').trim();
  }
}

function loadClaimsStore(config) {
  const raw = readJson(config.claimsFile, null);
  if (raw === null) return { claims: [], storedSecret: null };
  if (Array.isArray(raw)) return { claims: raw, storedSecret: null };
  if (raw && Array.isArray(raw.claims) && typeof raw.idSecret === 'string' && raw.idSecret) return { claims: raw.claims, storedSecret: raw.idSecret };
  throw new Error('invalid_claims_store');
}

function stableIdSecret(config, store) {
  const configured = config.idSecret ? String(config.idSecret) : null;
  if (store.storedSecret) {
    if (configured && configured !== store.storedSecret) throw new Error('id_secret_mismatch');
    return store.storedSecret;
  }

  let sidecar = null;
  try { sidecar = fs.readFileSync(config.idSecretFile, 'utf8').trim(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (store.claims.length && !sidecar) throw new Error('id_secret_missing_for_existing_claims');
  if (configured && sidecar && configured !== sidecar) throw new Error('id_secret_mismatch');
  if (configured) {
    if (!sidecar) {
      fs.mkdirSync(path.dirname(config.idSecretFile), { recursive: true });
      try { fs.writeFileSync(config.idSecretFile, `${configured}\n`, { mode: 0o600, flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
      const saved = fs.readFileSync(config.idSecretFile, 'utf8').trim();
      if (saved !== configured) throw new Error('id_secret_mismatch');
    }
    return configured;
  }
  return sidecar || getIdSecret(config);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function loadData(config) {
  const lines = fs.existsSync(config.waitlistFile) ? fs.readFileSync(config.waitlistFile, 'utf8') : '';
  const records = Core.mergeSignups(lines);
  const rawBilling = readJson(config.billingFile, {});
  const billing = Object.fromEntries(Object.entries(rawBilling).map(([email, value]) => [String(email).trim().toLowerCase(), value]));
  const claimsStore = loadClaimsStore(config);
  const claims = claimsStore.claims;
  const names = readJson(config.namesFile, {});
  const idSecret = stableIdSecret(config, claimsStore);
  return { records, billing, claims, names, idSecret };
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > 10 * 1024) {
        settled = true;
        reject(Object.assign(new Error('body_too_large'), { status: 413 }));
        req.removeAllListeners('data'); req.resume(); return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return reject(Object.assign(new Error('invalid_content_type'), { status: 400 }));
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (_) { reject(Object.assign(new Error('invalid_json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function authorized(req, config) {
  if (!config.adminToken) return { status: 503, error: 'admin_disabled' };
  const match = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return { status: 401, error: 'unauthorized' };
  const supplied = match[1].trim();
  const expectedBuffer = Buffer.from(String(config.adminToken));
  const suppliedBuffer = Buffer.from(supplied);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return { status: 401, error: 'unauthorized' };
  return null;
}

function saveClaims(file, claims, idSecret) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify({ idSecret, claims }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

export function createServer(opts = {}) {
  const config = defaults(opts);
  // Fail before listening if an existing claim ledger cannot be paired with its original ID key.
  loadData(config);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${config.host}`);
    const route = url.pathname;
    try {
      if (req.method === 'GET' && route === '/') {
        res.writeHead(302, { Location: '/ambassadors.html' }); res.end(); return;
      }
      if (req.method === 'GET' && STATIC_FILES.has(route)) {
        const file = path.join(config.root, route.slice(1));
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
        const type = route.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); fs.createReadStream(file).pipe(res); return;
      }
      if (req.method === 'GET' && route === '/api/ambassador') {
        const code = Interview.normalizeRef(url.searchParams.get('code'));
        const data = loadData(config);
        if (!code || !Object.prototype.hasOwnProperty.call(data.names, code)) { json(res, 404, { error: 'unknown_code' }); return; }
        json(res, 200, Core.ambassadorView(code, data.names, data.records, data.billing, data.claims, undefined, data.idSecret)); return;
      }
      if (req.method === 'POST' && route === '/api/ambassador/claims') {
        const body = await readBody(req); const code = Interview.normalizeRef(body.code);
        const data = loadData(config);
        if (!code || !Object.prototype.hasOwnProperty.call(data.names, code)) { json(res, 404, { error: 'unknown_code' }); return; }
        const view = Core.ambassadorView(code, data.names, data.records, data.billing, data.claims, undefined, data.idSecret);
        try {
          const claim = Core.createClaim(code, view, data.claims, body.signupIds, new Date().toISOString(), crypto.randomUUID());
          data.claims.push(claim); saveClaims(config.claimsFile, data.claims, data.idSecret); json(res, 201, { claim });
        } catch (error) {
          const status = error.code === 'nothing_to_claim' || error.code === 'already_claimed' || error.code === 'not_claimable' ? 400 : 500;
          json(res, status, { error: error.code || 'claim_failed' });
        }
        return;
      }
      if (req.method === 'GET' && route === '/api/admin') {
        const authError = authorized(req, config); if (authError) { json(res, authError.status, { error: authError.error }); return; }
        const data = loadData(config); json(res, 200, Core.adminView(data.names, data.records, data.billing, data.claims, data.idSecret)); return;
      }
      const adminClaim = route.match(/^\/api\/admin\/claims\/([^/]+)\/(approve|paid|reject)$/);
      if (req.method === 'POST' && adminClaim) {
        const authError = authorized(req, config); if (authError) { json(res, authError.status, { error: authError.error }); return; }
        let claimId;
        try { claimId = decodeURIComponent(adminClaim[1]); } catch (_) { json(res, 404, { error: 'unknown_claim' }); return; }
        const data = loadData(config), index = data.claims.findIndex((claim) => claim.id === claimId);
        if (index < 0) { json(res, 404, { error: 'unknown_claim' }); return; }
        try {
          data.claims[index] = Core.transition(data.claims[index], adminClaim[2], new Date().toISOString());
          saveClaims(config.claimsFile, data.claims, data.idSecret); json(res, 200, { claim: data.claims[index] });
        } catch (error) { json(res, error.code === 'bad_transition' ? 409 : 500, { error: error.code || 'transition_failed' }); }
        return;
      }
      json(res, 404, { error: 'not_found' });
    } catch (error) {
      if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : 'server_error' });
      else res.destroy();
    }
  });
  return server;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const config = defaults();
  const server = createServer(config);
  server.listen(config.port, config.host, () => console.log(`Ambassador dashboard: http://${config.host}:${server.address().port}/ambassadors.html`));
}
