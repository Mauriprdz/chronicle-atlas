// Automated checks for rubrics A1-A5. Usage:
//   npm test                         -> starts an in-memory server and tests it
//   BASE_URL=https://your-app.vercel.app npm test   -> tests a deployment
import crypto from 'node:crypto';

let BASE = process.env.BASE_URL;
let server;
if (!BASE) {
  process.env.PGLITE_DIR = 'memory';
  const { default: app } = await import('../server/app.js');
  server = app.listen(0);
  BASE = `http://localhost:${server.address().port}`;
}

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✔ ${name}`); } else { fail++; console.log(`  ✘ ${name} ${extra}`); }
};
async function call(method, path, { token, body, ua = 'node-test', raw = false } = {}) {
  const headers = { 'User-Agent': ua };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + '/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, ct, data: raw ? await res.text() : ct.includes('json') ? await res.json() : await res.text() };
}
const login = (email, password, deviceId, ua) => call('POST', '/auth/login', { body: { email, password, deviceId }, ua });

const email = `tester${Date.now()}@example.com`;
const PW = 'Str0ng#Pass';

console.log('\nA1 · Registration, JWT, favorites, bookmarks, discussions');
ok('weak password rejected', (await call('POST', '/auth/register', { body: { name: 'T', email, password: 'weak' } })).status === 400);
const reg = await call('POST', '/auth/register', { body: { name: 'Tester', email, password: PW } });
ok('register returns 201 as Standard User', reg.status === 201 && reg.data.user.role === 'user', JSON.stringify(reg.data));
ok('duplicate email rejected (409)', (await call('POST', '/auth/register', { body: { name: 'Tester', email, password: PW } })).status === 409);
ok('wrong password -> 401', (await login(email, 'Wrong#Pass1', 'dev-x')).status === 401);
const l1 = await login(email, PW, 'device-A', 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537');
const T1 = l1.data.token;
const payload = JSON.parse(Buffer.from(T1.split('.')[1], 'base64url').toString());
ok('login returns signed JWT with userId, role, sid, exp', l1.status === 200 && payload.userId === reg.data.user.id && payload.role === 'user' && payload.sid && payload.exp > payload.iat);
ok('/auth/me works with Bearer token', (await call('GET', '/auth/me', { token: T1 })).data.user?.email === email);
ok('add favorite', (await call('POST', '/me/favorites/minoan', { token: T1 })).status === 201);
ok('list favorites persists per user', (await call('GET', '/me/favorites', { token: T1 })).data.some((f) => f.slug === 'minoan'));
ok('remove favorite', (await call('DELETE', '/me/favorites/minoan', { token: T1 })).status === 200 && (await call('GET', '/me/favorites', { token: T1 })).data.length === 0);
const bm = await call('POST', '/me/bookmarks', { token: T1, body: { slug: 'khmer', section: 'Angkor Wat and Angkor Thom', note: 'for essay' } });
ok('add bookmark', bm.status === 201);
ok('list bookmarks', (await call('GET', '/me/bookmarks', { token: T1 })).data[0]?.note === 'for essay');
ok('remove bookmark', (await call('DELETE', `/me/bookmarks/${bm.data.id}`, { token: T1 })).status === 200);
ok('guest cannot create discussion (401)', (await call('POST', '/topics/kush/discussions', { body: { title: 'Hi there', body: 'test' } })).status === 401);
const d = await call('POST', '/topics/kush/discussions', { token: T1, body: { title: 'Meroë iron', body: 'How big was it?' } });
ok('user creates discussion', d.status === 201);
ok('user comments', (await call('POST', `/discussions/${d.data.id}/comments`, { token: T1, body: { body: 'Great question' } })).status === 201);
ok('guest cannot comment (401)', (await call('POST', `/discussions/${d.data.id}/comments`, { body: { body: 'x' } })).status === 401);

console.log('\nA2 · Sessions & 2-device limit');
const l2 = await login(email, PW, 'device-B', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Mobile Safari');
const T2 = l2.data.token;
let sess = await call('GET', '/sessions', { token: T2 });
ok('device identified & logged (UA label)', sess.data.sessions.some((s) => /iOS/.test(s.device_label)) && sess.data.sessions.some((s) => /Windows/.test(s.device_label)));
ok('2 active sessions tracked for user', sess.data.sessions.length === 2);
const l3 = await login(email, PW, 'device-C', 'Mozilla/5.0 (Macintosh; Mac OS X) Firefox/120');
const T3 = l3.data.token;
ok('3rd login revokes oldest (FIFO)', l3.status === 200 && l3.data.revokedSessions.length === 1);
ok('oldest token (device A) now rejected 401', (await call('GET', '/auth/me', { token: T1 })).status === 401);
sess = await call('GET', '/sessions', { token: T3 });
ok('still exactly 2 active sessions', sess.data.sessions.length === 2);
const same = await login(email, PW, 'device-C', 'Mozilla/5.0 (Macintosh; Mac OS X) Firefox/120');
ok('same device re-login replaces its own session (no extra device)', same.data.revokedSessions.length === 0 && (await call('GET', '/sessions', { token: same.data.token })).data.sessions.length === 2);
const T3b = same.data.token;
const sB = (await call('GET', '/sessions', { token: T3b })).data.sessions.find((s) => !s.current);
ok('terminate a specific session', (await call('DELETE', `/sessions/${sB.id}`, { token: T3b })).status === 200);
ok('terminated device rejected', (await call('GET', '/auth/me', { token: T2 })).status === 401);
ok('logout revokes current session', (await call('POST', '/auth/logout', { token: T3b })).status === 200 && (await call('GET', '/auth/me', { token: T3b })).status === 401);

console.log('\nA3 · Password update & recovery');
let T = (await login(email, PW, 'device-A')).data.token;
ok('change password requires correct current password', (await call('PUT', '/auth/password', { token: T, body: { currentPassword: 'Nope#1234', newPassword: 'N3w#Password' } })).status === 400);
ok('change password enforces strong rules', (await call('PUT', '/auth/password', { token: T, body: { currentPassword: PW, newPassword: 'short' } })).status === 400);
ok('change password succeeds', (await call('PUT', '/auth/password', { token: T, body: { currentPassword: PW, newPassword: 'N3w#Password' } })).status === 200);
ok('old password no longer works', (await login(email, PW, 'device-A')).status === 401);
ok('new password works (hashed + verified)', (await login(email, 'N3w#Password', 'device-A')).status === 200);
const f1 = await call('POST', '/auth/forgot', { body: { email } });
const f2 = await call('POST', '/auth/forgot', { body: { email: 'nobody-here@example.com' } });
ok('recovery gives neutral, identical feedback (no enumeration)', f1.status === 200 && f2.status === 200 && f1.data.message === f2.data.message);
ok('invalid token rejected', (await call('POST', '/auth/reset', { body: { token: crypto.randomBytes(32).toString('base64url'), newPassword: 'R3set#Password' } })).status === 400);
if (!process.env.BASE_URL) {
  const adminT = (await login('admin@atlas.demo', 'Admin#2026!', 'admin-dev')).data.token;
  const mail = (await call('GET', '/admin/outbox', { token: adminT })).data.find((m) => m.to_email === email);
  const rawToken = mail?.body.match(/token=([A-Za-z0-9_-]+)/)?.[1];
  ok('secure random token emailed (43 chars base64url)', rawToken?.length === 43);
  ok('token validates', (await call('POST', '/auth/reset/validate', { body: { token: rawToken } })).data.valid === true);
  ok('reset enforces strong password', (await call('POST', '/auth/reset', { body: { token: rawToken, newPassword: 'weak' } })).status === 400);
  ok('reset succeeds', (await call('POST', '/auth/reset', { body: { token: rawToken, newPassword: 'R3set#Password' } })).status === 200);
  ok('token cannot be reused', (await call('POST', '/auth/reset', { body: { token: rawToken, newPassword: 'Again#Pass99' } })).status === 400);
  ok('login with reset password works', (await login(email, 'R3set#Password', 'device-A')).status === 200);
}

console.log('\nA4 · Protected routes, media, token tampering');
T = (await login(email, process.env.BASE_URL ? 'N3w#Password' : 'R3set#Password', 'device-A')).data.token;
ok('public topic overview open to guests', (await call('GET', '/topics/nabataean')).status === 200);
ok('guest blocked from discussions list (401)', (await call('GET', '/topics/kush/discussions')).status === 401);
ok('guest blocked from media (401)', (await call('GET', '/media/kush/1')).status === 401);
const img = await call('GET', '/media/kush/1', { token: T, raw: true });
ok('member gets protected image (SVG)', img.status === 200 && img.ct.includes('image/svg') && img.data.includes('<svg'));
const [h, p, s] = T.split('.');
const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), role: 'admin' })).toString('base64url');
ok('tampered token (role changed) rejected 401', (await call('GET', '/auth/me', { token: `${h}.${forged}.${s}` })).status === 401);
ok('garbage token rejected 401', (await call('GET', '/auth/me', { token: 'abc.def.ghi' })).status === 401);
const jwt = (await import('jsonwebtoken')).default;
const expired = jwt.sign({ userId: 1, role: 'user', sid: 'x' }, 'wrong-secret', { expiresIn: -10 });
ok('expired/foreign-signed token rejected 401', (await call('GET', '/auth/me', { token: expired })).status === 401);

console.log('\nA5 · RBAC');
const topicBody = { slug: `test-topic-${Date.now()}`, title: 'Great Zimbabwe', region: 'Southern Africa', era: '11th-15th c.', summary: 'Stone city of the Shona people.', theme: 'kush', sections: [{ heading: 'Walls', body: 'Dry-stone walls.' }], facts: [] };
ok('JWT carries role', payload.role === 'user');
ok('standard user cannot create topic (403)', (await call('POST', '/topics', { token: T, body: topicBody })).status === 403);
ok('standard user cannot edit topic (403)', (await call('PUT', '/topics/kush', { token: T, body: { title: 'Hacked' } })).status === 403);
ok('standard user cannot open admin API (403)', (await call('GET', '/admin/users', { token: T })).status === 403);
ok('guest cannot create topic (401)', (await call('POST', '/topics', { body: topicBody })).status === 401);
if (!process.env.BASE_URL) {
  const inv = (await login('investigator@atlas.demo', 'Research#2026!', 'inv-dev')).data.token;
  ok('investigator creates topic', (await call('POST', '/topics', { token: inv, body: topicBody })).status === 201);
  ok('investigator edits topic + theme', (await call('PUT', `/topics/${topicBody.slug}`, { token: inv, body: { theme: 'khiva', accent: '#aa3366' } })).status === 200);
  ok('investigator cannot manage users (403)', (await call('GET', '/admin/users', { token: inv })).status === 403);
  ok('investigator cannot change settings (403)', (await call('PUT', '/admin/settings', { token: inv, body: { site_name: 'x' } })).status === 403);
  const adm = (await login('admin@atlas.demo', 'Admin#2026!', 'admin-dev')).data.token;
  const users = (await call('GET', '/admin/users', { token: adm })).data;
  ok('admin lists users', users.length >= 4);
  const u = users.find((x) => x.email === email);
  ok('admin assigns role', (await call('PUT', `/admin/users/${u.id}/role`, { token: adm, body: { role: 'investigator' } })).status === 200);
  ok('old token with stale role is invalidated', (await call('GET', '/auth/me', { token: T })).status === 401);
  ok('admin updates settings', (await call('PUT', '/admin/settings', { token: adm, body: { session_policy: 'reject' } })).data.session_policy === 'reject');
  await login(email, 'R3set#Password', 'p1'); await login(email, 'R3set#Password', 'p2');
  ok('"reject" policy blocks 3rd device (409)', (await login(email, 'R3set#Password', 'p3')).status === 409);
  ok('admin deletes topic', (await call('DELETE', `/topics/${topicBody.slug}`, { token: adm })).status === 200);
}

console.log(`\n${pass} passed, ${fail} failed`);
server?.close();
process.exit(fail ? 1 : 0);
