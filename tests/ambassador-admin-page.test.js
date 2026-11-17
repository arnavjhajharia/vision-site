'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('ambassador admin page has private metadata and authenticated claim actions', () => {
  const file = path.resolve(__dirname, '..', 'ambassador-admin.html');
  assert.equal(fs.existsSync(file), true, 'admin page exists');
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<meta\s+name=["']robots["']\s+content=["']noindex["']/i);
  assert.match(html, /\/api\/admin/);
  assert.match(html, /\/approve/);
  assert.match(html, /\/paid/);
  assert.match(html, /\/reject/);
  assert.match(html, /Authorization:\s*['"]Bearer\s*['"]\s*\+/);
  assert.match(html, /sessionStorage/);
  assert.doesNotMatch(html, /localStorage/);
});
