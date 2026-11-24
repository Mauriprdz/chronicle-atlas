// Chronicle Atlas - single page app (hash router, no build step)
// Auth: JWT stored in localStorage and sent as "Authorization: Bearer <token>".

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const main = $('#main');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const ROLE_LABEL = { user: 'Standard User', investigator: 'Investigator', admin: 'Admin' };

// ------------------------------------------------------------------ state & session
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const state = {
  token: store.get('atlas.token'),
  user: JSON.parse(store.get('atlas.user') || 'null'),
  config: { siteName: 'Chronicle Atlas', maxDevices: 2 },
  topics: null,
  favorites: new Set(),
  currentTopic: null,
};

let deviceId = store.get('atlas.device');
if (!deviceId) { deviceId = crypto.randomUUID(); store.set('atlas.device', deviceId); }

function decodeJwt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part))));
  } catch { return null; }
}
function tokenValid() {
  if (!state.token) return false;
  const p = decodeJwt(state.token);
  return Boolean(p && p.exp && p.exp * 1000 > Date.now() + 5000 && p.userId && p.role);
}
const isAuthed = () => tokenValid() && state.user;
const hasRole = (...roles) => isAuthed() && roles.includes(state.user.role);

let expiryTimer = null;
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  const p = state.token && decodeJwt(state.token);
  if (!p) return;
  const ms = p.exp * 1000 - Date.now();
  expiryTimer = setTimeout(() => {
    clearSession();
    toast('Your session expired. Please log in again.', 'error');
    redirectToLogin(currentPath());
  }, Math.max(ms, 0));
}
function saveSession(token, user) {
  state.token = token; state.user = user;
  store.set('atlas.token', token); store.set('atlas.user', JSON.stringify(user));
  scheduleExpiry();
}
function clearSession() {
  state.token = null; state.user = null; state.favorites = new Set();
  store.del('atlas.token'); store.del('atlas.user');
  clearTimeout(expiryTimer);
}

// ------------------------------------------------------------------ API client
class ApiError extends Error {}
async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new ApiError('Network error. Check your connection.'), { status: 0 });
  }
  const isJson = (res.headers.get('content-type') || '').includes('json');
  const data = isJson ? await res.json() : await res.text();
  if (res.status === 401 && auth && state.token) {
    // Expired / tampered / revoked token: clear local state and send to login preserving destination
    clearSession();
    toast(data?.error || 'Session ended. Please log in again.', 'error');
    redirectToLogin(currentPath());
    throw Object.assign(new ApiError(data?.error || 'Unauthorized'), { status: 401, handled: true });
  }
  if (!res.ok) throw Object.assign(new ApiError(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

async function fetchProtectedImage(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${state.token}` } });
  if (res.status === 401) { clearSession(); redirectToLogin(currentPath()); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error('image failed');
  return URL.createObjectURL(await res.blob());
}

// ------------------------------------------------------------------ UI helpers
function toast(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 5200);
}
function formError(form, msg) {
  let box = $('.form-error', form);
  if (!msg) { box?.remove(); return; }
  if (!box) { box = document.createElement('div'); box.className = 'form-error'; box.setAttribute('role', 'alert'); form.prepend(box); }
  box.textContent = msg;
}
async function withBusy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Working…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
}

const PW_RULES = [
  ['len', '8+ characters', (p) => p.length >= 8],
  ['low', 'lowercase letter', (p) => /[a-z]/.test(p)],
  ['up', 'uppercase letter', (p) => /[A-Z]/.test(p)],
  ['num', 'number', (p) => /\d/.test(p)],
  ['sym', 'symbol', (p) => /[^A-Za-z0-9]/.test(p)],
];
const pwRulesHtml = () => `<ul class="pw-rules">${PW_RULES.map(([k, l]) => `<li data-rule="${k}">${l}</li>`).join('')}</ul>`;
function bindPwRules(input, list) {
  const update = () => PW_RULES.forEach(([k, , test]) => $(`[data-rule="${k}"]`, list).classList.toggle('ok', test(input.value)));
  input.addEventListener('input', update); update();
}
const pwStrong = (p) => PW_RULES.every(([, , t]) => t(p));

function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.25 ? '#111111' : '#ffffff';
}
function accentStyle(accent) {
  return accent ? `--accent:${accent};--on-accent:${readableOn(accent)};` : '';
}

// Dynamic theming engine: data-theme on <html> swaps every CSS custom property.
let themeNames = {};
function setTheme(slug = 'atlas', accent = null) {
  const root = document.documentElement;
  root.dataset.theme = slug;
  if (accent) { root.style.setProperty('--accent', accent); root.style.setProperty('--on-accent', readableOn(accent)); }
  else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); }
  $('#theme-name').textContent = themeNames[slug] || slug;
}

// ------------------------------------------------------------------ router
const routes = [];
const route = (pattern, view, opts = {}) => {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ rx, keys, view, opts });
};
const currentPath = () => (location.hash.slice(1) || '/');
const navigate = (path) => { if (currentPath() === path) render(); else location.hash = path; };
function safeNext(next) { return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'; }
function redirectToLogin(intended) {
  const next = intended && !intended.startsWith('/login') ? `?next=${encodeURIComponent(intended)}` : '';
  location.hash = `/login${next}`;
}

let renderSeq = 0;
async function render() {
  const seq = ++renderSeq;
  const full = currentPath();
  const [path, qs] = full.split('?');
  const query = new URLSearchParams(qs || '');
  closeBrain();
  $('#nav').classList.remove('open');

  let match = null, params = {};
  for (const r of routes) {
    const m = path.match(r.rx);
    if (m) { match = r; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
  }
  if (!match) { renderNav(); setTheme(); return notFound(); }

  // ---- route guards (frontend layer; the API enforces the same rules server-side)
  if (match.opts.auth && !tokenValid()) {
    if (state.token) { clearSession(); toast('Your session expired. Please log in again.', 'error'); }
    else toast('Please log in to access that page.');
    return redirectToLogin(full);
  }
  if (match.opts.guestOnly && isAuthed()) return navigate(safeNext(query.get('next')));
  renderNav();
  setTheme();
  state.currentTopic = null;
  if (match.opts.roles && !match.opts.roles.includes(state.user?.role)) return forbidden(match.opts.roles);

  main.innerHTML = '<div class="loading">Loading the archives…</div>';
  try {
    await match.view({ params, query, isCurrent: () => seq === renderSeq });
  } catch (err) {
    if (err.handled) return;
    console.error(err);
    if (err.status === 404) return notFound(err.message);
    if (err.status === 403) return forbidden();
    main.innerHTML = `<div class="center-page"><div class="code">!</div><h1>Something went wrong</h1><p class="muted">${esc(err.message)}</p><a class="btn" href="#/">Back to the atlas</a></div>`;
    window.Sentry?.captureException?.(err);
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function notFound(msg) {
  main.innerHTML = `<div class="center-page"><div class="code">404</div><h1>Lost in the archives</h1><p class="muted">${esc(msg || 'That page does not exist.')}</p><a class="btn" href="#/">Back to the atlas</a></div>`;
}
function forbidden(roles) {
  main.innerHTML = `<div class="center-page"><div class="code">403</div><h1>Restricted area</h1>
    <p class="muted">Your role (<b>${esc(ROLE_LABEL[state.user?.role] || 'Guest')}</b>) cannot open this page${roles ? `. Required: ${roles.map((r) => ROLE_LABEL[r]).join(' or ')}` : ''}.</p>
    <a class="btn" href="#/">Back to the atlas</a></div>`;
}

function renderNav() {
  const path = currentPath().split('?')[0];
  const link = (href, label) => `<a href="#${href}" class="${path === href ? 'active' : ''}">${label}</a>`;
  let html = link('/', 'Explore');
  if (isAuthed()) {
    html += link('/account', 'My research');
    if (hasRole('investigator', 'admin')) html += link('/studio', 'Studio');
    if (hasRole('admin')) html += link('/admin', 'Admin');
    html += `<span class="role-pill" title="${esc(state.user.email)}">${esc(ROLE_LABEL[state.user.role])}</span>`;
    html += `<button class="ghost sm" id="logout-btn">Log out</button>`;
  } else {
    html += link('/login', 'Log in');
    html += `<a href="#/register" class="btn sm" style="color:var(--on-accent)">Register</a>`;
  }
  $('#nav').innerHTML = html;
  $('#logout-btn')?.addEventListener('click', logout);
}

async function logout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* already invalid */ }
  clearSession();
  toast('You have been logged out.');
  navigate('/');
}

async function loadTopics(force = false) {
  if (!state.topics || force) state.topics = await api('/topics', { auth: false });
  return state.topics;
}
async function loadFavorites() {
  if (!isAuthed()) { state.favorites = new Set(); return; }
  const favs = await api('/me/favorites');
  state.favorites = new Set(favs.map((f) => f.slug));
}

// ------------------------------------------------------------------ views
route('/', async () => {
  const [topics] = await Promise.all([loadTopics(), loadFavorites()]);
  const cards = (list) => list.map((t) => `
    <a class="topic-card" href="#/topic/${esc(t.slug)}" data-theme="${esc(t.theme)}" style="${accentStyle(t.accent)}">
      <span class="num">${String(t.number ?? '').padStart(2, '0')}${state.favorites.has(t.slug) ? ' <span aria-label="favorite">★</span>' : ''}</span>
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.summary)}</p>
      <span class="meta">${esc(t.region)} · ${esc(t.era)}</span>
    </a>`).join('') || '<p class="muted">No topics match your search.</p>';

  main.innerHTML = `
    <section class="hero">
      <div class="eyebrow">Thematic investigation platform</div>
      <h1>Explore ${topics.length} civilizations & states</h1>
      <p class="lead">Every topic transforms the interface — palette, typography and motifs — to match the world you are researching. ${isAuthed() ? `Welcome back, <b>${esc(state.user.name)}</b>.` : 'Log in to unlock restricted plates, discussions, favorites and bookmarks.'}</p>
    </section>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search topics, regions, eras…" aria-label="Search topics" />
      ${isAuthed() ? '<label class="row" style="margin:0;font-weight:400"><input type="checkbox" id="fav-only" style="width:auto"> Only my favorites</label>' : ''}
    </div>
    <div class="grid" id="topic-grid">${cards(topics)}</div>`;

  const filter = () => {
    const term = $('#q').value.toLowerCase();
    const favOnly = $('#fav-only')?.checked;
    $('#topic-grid').innerHTML = cards(topics.filter((t) =>
      (!favOnly || state.favorites.has(t.slug)) &&
      `${t.title} ${t.region} ${t.era} ${t.summary}`.toLowerCase().includes(term)));
  };
  $('#q').addEventListener('input', filter);
  $('#fav-only')?.addEventListener('change', filter);
});

route('/topic/:slug', async ({ params, isCurrent }) => {
  const t = await api(`/topics/${encodeURIComponent(params.slug)}`, { auth: false });
  if (!isCurrent()) return;
  state.currentTopic = t;
  setTheme(t.theme, t.accent);
  let bookmarks = [];
  if (isAuthed()) {
    const [, bms] = await Promise.all([loadFavorites(), api('/me/bookmarks')]);
    bookmarks = bms.filter((b) => b.slug === t.slug);
  }
  const isFav = state.favorites.has(t.slug);
  const bmFor = (heading) => bookmarks.find((b) => b.section === heading);
  const lockIcon = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  const next = encodeURIComponent(`/topic/${t.slug}`);

  main.innerHTML = `
    <section class="topic-hero">
      <div class="num-big">${String(t.number ?? '').padStart(2, '0')}</div>
      <div class="eyebrow">Investigation topic</div>
      <h1>${esc(t.title)}</h1>
      <div class="chips"><span class="chip">📍 ${esc(t.region)}</span><span class="chip">⏳ ${esc(t.era)}</span><span class="chip">🎨 ${esc(themeNames[t.theme] || t.theme)} theme</span></div>
      <p class="lead" style="max-width:760px">${esc(t.summary)}</p>
      <div class="row">
        ${isAuthed()
          ? `<button id="fav-btn" class="${isFav ? '' : 'ghost'}" aria-pressed="${isFav}">${isFav ? '★ Favorited' : '☆ Add to favorites'}</button>
             <a class="btn btn-ghost" href="#/topic/${esc(t.slug)}/discussions">💬 Discussions</a>`
          : `<a class="btn" href="#/login?next=${next}">Log in to save & discuss</a>
             <a class="btn btn-ghost" href="#/topic/${esc(t.slug)}/discussions">💬 Discussions (members)</a>`}
        ${hasRole('investigator', 'admin') ? `<a class="btn btn-ghost" href="#/studio/edit/${esc(t.slug)}">✎ Edit topic</a>` : ''}
      </div>
    </section>
    <div class="layout">
      <article class="article">
        ${(t.sections || []).map((s, i) => `
          <section id="sec-${i}">
            <h2>${esc(s.heading)} ${isAuthed() ? `<button class="sm ${bmFor(s.heading) ? '' : 'ghost'} bm" data-sec="${i}" aria-label="Bookmark section">${bmFor(s.heading) ? '🔖 Saved' : '🔖 Bookmark'}</button>` : ''}</h2>
            <p>${esc(s.body)}</p>
            ${isAuthed() ? `<form class="bm-form row" data-sec="${i}" hidden>
              <input name="note" maxlength="500" placeholder="Optional note for this bookmark" value="${esc(bmFor(s.heading)?.note || '')}" style="flex:1;min-width:200px">
              <button class="sm">Save bookmark</button>
              ${bmFor(s.heading) ? `<button type="button" class="sm danger bm-del" data-id="${bmFor(s.heading).id}">Remove</button>` : ''}
            </form>` : ''}
          </section>`).join('')}
        <section>
          <h2>Restricted research plates</h2>
          ${isAuthed()
            ? '<p class="muted small">Served only through an authenticated endpoint with your Bearer token.</p><div class="gallery" id="gallery"><p class="muted">Loading plates…</p></div>'
            : `<div class="locked">${lockIcon}<div><b>Members only.</b> The image plates for this topic are protected media.<br><a href="#/login?next=${next}">Log in</a> or <a href="#/register">create an account</a> to view them.</div></div>`}
        </section>
      </article>
      <aside class="side">
        <div class="card">
          <h3>Field facts</h3>
          <ul class="facts">${(t.facts || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <p class="muted small">Last updated ${fmtDate(t.updated_at)}${t.updated_by_name ? ` by ${esc(t.updated_by_name)}` : ''}.</p>
        </div>
      </aside>
    </div>`;

  $('#fav-btn')?.addEventListener('click', async (e) => {
    const on = state.favorites.has(t.slug);
    await withBusy(e.currentTarget, () => api(`/me/favorites/${t.slug}`, { method: on ? 'DELETE' : 'POST' }));
    on ? state.favorites.delete(t.slug) : state.favorites.add(t.slug);
    toast(on ? 'Removed from favorites.' : 'Added to favorites.');
    render();
  });
  $$('.bm').forEach((btn) => btn.addEventListener('click', () => {
    const form = $(`.bm-form[data-sec="${btn.dataset.sec}"]`);
    form.hidden = !form.hidden;
    if (!form.hidden) $('input', form).focus();
  }));
  $$('.bm-form').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = t.sections[Number(form.dataset.sec)];
    await api('/me/bookmarks', { method: 'POST', body: { slug: t.slug, section: s.heading, note: form.note.value } });
    toast(`Bookmarked “${s.heading}”.`);
    render();
  }));
  $$('.bm-del').forEach((b) => b.addEventListener('click', async () => {
    await api(`/me/bookmarks/${b.dataset.id}`, { method: 'DELETE' });
    toast('Bookmark removed.');
    render();
  }));

  if (isAuthed()) {
    const plates = await api(`/topics/${t.slug}/media`);
    const gallery = $('#gallery');
    if (!gallery || !isCurrent()) return;
    gallery.innerHTML = plates.map((p) => `<figure><img alt="${esc(p.name)} for ${esc(t.title)}" data-src="${esc(p.url)}"><figcaption><b>${esc(p.name)}.</b> ${esc(p.caption)}</figcaption></figure>`).join('');
    for (const img of $$('img[data-src]', gallery)) {
      fetchProtectedImage(img.dataset.src).then((u) => { img.src = u; }).catch(() => { img.alt = 'Could not load image'; });
    }
  }
});

route('/topic/:slug/discussions', async ({ params, isCurrent }) => {
  const [t, threads] = await Promise.all([
    api(`/topics/${encodeURIComponent(params.slug)}`, { auth: false }),
    api(`/topics/${encodeURIComponent(params.slug)}/discussions`),
  ]);
  if (!isCurrent()) return;
  state.currentTopic = t;
  setTheme(t.theme, t.accent);
  main.innerHTML = `
    <p><a href="#/topic/${esc(t.slug)}">← ${esc(t.title)}</a></p>
    <h1>Discussions</h1>
    <div class="grid-2">
      <div class="card">
        <h2>${threads.length} thread${threads.length === 1 ? '' : 's'}</h2>
        ${threads.map((d) => `
          <div class="thread">
            <h3><a href="#/discussion/${d.id}">${esc(d.title)}</a></h3>
            <div class="muted small">by ${esc(d.author)}${d.author_role !== 'user' ? `<span class="badge">${esc(ROLE_LABEL[d.author_role])}</span>` : ''} · ${fmtDate(d.created_at)} · ${d.comment_count} comment${d.comment_count === 1 ? '' : 's'}</div>
          </div>`).join('') || '<p class="muted">No discussions yet. Start the first one!</p>'}
      </div>
      <form class="card" id="new-thread">
        <h2>Start a discussion</h2>
        <label for="d-title">Title</label><input id="d-title" name="title" required minlength="3" maxlength="160">
        <label for="d-body">Message</label><textarea id="d-body" name="body" required minlength="3" maxlength="4000"></textarea>
        <p><button>Post discussion</button></p>
      </form>
    </div>`;
  $('#new-thread').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    try {
      const d = await api(`/topics/${t.slug}/discussions`, { method: 'POST', body: { title: f.title.value, body: f.body.value } });
      navigate(`/discussion/${d.id}`);
    } catch (err) { if (!err.handled) formError(f, err.message); }
  });
}, { auth: true });

route('/discussion/:id', async ({ params, isCurrent }) => {
  const d = await api(`/discussions/${encodeURIComponent(params.id)}`);
  if (!isCurrent()) return;
  setTheme(d.theme, d.accent);
  const canDelete = (uid) => uid === state.user.id || state.user.role === 'admin';
  main.innerHTML = `
    <p><a href="#/topic/${esc(d.slug)}/discussions">← Discussions · ${esc(d.topic_title)}</a></p>
    <div class="card">
      <h1>${esc(d.title)}</h1>
      <p class="muted small">by ${esc(d.author)}${d.author_role !== 'user' ? `<span class="badge">${esc(ROLE_LABEL[d.author_role])}</span>` : ''} · ${fmtDate(d.created_at)}
      ${canDelete(d.user_id) ? ' · <button class="sm danger" id="del-thread">Delete thread</button>' : ''}</p>
      <p style="white-space:pre-wrap">${esc(d.body)}</p>
    </div>
    <div class="card">
      <h2>${d.comments.length} comment${d.comments.length === 1 ? '' : 's'}</h2>
      ${d.comments.map((c) => `
        <div class="comment">
          <div class="row"><span class="who">${esc(c.author)}</span>${c.author_role !== 'user' ? `<span class="badge">${esc(ROLE_LABEL[c.author_role])}</span>` : ''}<span class="muted small">${fmtDate(c.created_at)}</span><span class="spacer"></span>
          ${canDelete(c.user_id) ? `<button class="sm danger del-c" data-id="${c.id}">Delete</button>` : ''}</div>
          <div style="white-space:pre-wrap">${esc(c.body)}</div>
        </div>`).join('') || '<p class="muted">No comments yet.</p>'}
      <form id="new-comment">
        <label for="c-body">Add a comment</label>
        <textarea id="c-body" name="body" required maxlength="2000"></textarea>
        <p><button>Post comment</button></p>
      </form>
    </div>`;
  $('#new-comment').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/discussions/${d.id}/comments`, { method: 'POST', body: { body: e.currentTarget.body.value } }); render(); }
    catch (err) { if (!err.handled) formError(e.currentTarget, err.message); }
  });
  $$('.del-c').forEach((b) => b.addEventListener('click', async () => { await api(`/comments/${b.dataset.id}`, { method: 'DELETE' }); render(); }));
  $('#del-thread')?.addEventListener('click', async () => { await api(`/discussions/${d.id}`, { method: 'DELETE' }); toast('Thread deleted.'); navigate(`/topic/${d.slug}/discussions`); });
}, { auth: true });

// ---------------- auth views
route('/login', async ({ query }) => {
  const next = safeNext(query.get('next'));
  main.innerHTML = `
    <form class="card auth-card" id="login-form" novalidate>
      <div class="eyebrow">Members</div>
      <h1>Log in</h1>
      ${query.get('next') ? `<p class="form-ok">Log in to continue to <b>${esc(next)}</b>.</p>` : ''}
      <label for="l-email">Email</label><input id="l-email" name="email" type="email" autocomplete="username" required>
      <label for="l-pw">Password</label><input id="l-pw" name="password" type="password" autocomplete="current-password" required>
      <p class="row" style="margin-top:1.2rem"><button>Log in</button><span class="spacer"></span><a href="#/forgot">Forgot password?</a></p>
      <p class="muted small">No account? <a href="#/register">Register</a>. Each account can be active on at most ${state.config.maxDevices} devices at once.</p>
    </form>`;
  const form = $('#login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError(form, null);
    await withBusy($('button:not([type])', form), async () => {
      try {
        const r = await api('/auth/login', { method: 'POST', auth: false, body: { email: form.email.value, password: form.password.value, deviceId } });
        saveSession(r.token, r.user);
        toast(`Welcome, ${r.user.name}!`);
        r.revokedSessions?.forEach((s) => toast(`Device limit (${state.config.maxDevices}) reached: signed out your oldest session (${s.device}).`));
        navigate(next);
      } catch (err) { formError(form, err.message); }
    });
  });
}, { guestOnly: true });

route('/register', async () => {
  if (state.config.registrationOpen === false) {
    main.innerHTML = '<div class="card auth-card"><h1>Registration closed</h1><p class="muted">The administrator has temporarily closed new registrations.</p></div>';
    return;
  }
  main.innerHTML = `
    <form class="card auth-card" id="reg-form" novalidate>
      <div class="eyebrow">Join the expedition</div>
      <h1>Create account</h1>
      <label for="r-name">Name</label><input id="r-name" name="name" autocomplete="name" required minlength="2">
      <label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email" required>
      <label for="r-pw">Password</label><input id="r-pw" name="password" type="password" autocomplete="new-password" required>
      ${pwRulesHtml()}
      <label for="r-pw2">Confirm password</label><input id="r-pw2" name="password2" type="password" autocomplete="new-password" required>
      <p style="margin-top:1.2rem"><button>Create account</button></p>
      <p class="muted small">New accounts start as <b>Standard User</b>. Already registered? <a href="#/login">Log in</a>.</p>
    </form>`;
  const form = $('#reg-form');
  bindPwRules(form.password, $('.pw-rules', form));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pwStrong(form.password.value)) return formError(form, 'Please choose a stronger password (see the rules).');
    if (form.password.value !== form.password2.value) return formError(form, 'Passwords do not match.');
    await withBusy($('button', form), async () => {
      try {
        await api('/auth/register', { method: 'POST', auth: false, body: { name: form.name.value, email: form.email.value, password: form.password.value } });
        const r = await api('/auth/login', { method: 'POST', auth: false, body: { email: form.email.value, password: form.password.value, deviceId } });
        saveSession(r.token, r.user);
        toast('Account created. Welcome to Chronicle Atlas!');
        navigate('/');
      } catch (err) { formError(form, err.message); }
    });
  });
}, { guestOnly: true });

route('/forgot', async () => {
  main.innerHTML = `
    <form class="card auth-card" id="forgot-form" novalidate>
      <div class="eyebrow">Recovery protocol</div>
      <h1>Forgot your password?</h1>
      <p class="muted">Enter your account email. If it exists, we will send a single-use reset link valid for 20 minutes.</p>
      <label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" required>
      <p style="margin-top:1.2rem"><button>Send reset link</button></p>
      <p class="small"><a href="#/login">Back to log in</a></p>
    </form>`;
  const form = $('#forgot-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError(form, null);
    await withBusy($('button', form), async () => {
      try {
        const r = await api('/auth/forgot', { method: 'POST', auth: false, body: { email: form.email.value } });
        form.innerHTML = `<div class="eyebrow">Recovery protocol</div><h1>Check your inbox</h1><p class="form-ok">${esc(r.message)}</p><p><a href="#/login">Back to log in</a></p>`;
      } catch (err) { formError(form, err.message); }
    });
  });
});

route('/reset', async ({ query }) => {
  const token = query.get('token') || '';
  const { valid } = token ? await api('/auth/reset/validate', { method: 'POST', auth: false, body: { token } }) : { valid: false };
  if (!valid) {
    main.innerHTML = `<div class="card auth-card"><h1>Link not valid</h1><p class="muted">This reset link is invalid, expired, or was already used.</p><a class="btn" href="#/forgot">Request a new link</a></div>`;
    return;
  }
  main.innerHTML = `
    <form class="card auth-card" id="reset-form" novalidate>
      <div class="eyebrow">Recovery protocol</div>
      <h1>Choose a new password</h1>
      <label for="n-pw">New password</label><input id="n-pw" name="password" type="password" autocomplete="new-password" required>
      ${pwRulesHtml()}
      <label for="n-pw2">Confirm new password</label><input id="n-pw2" name="password2" type="password" autocomplete="new-password" required>
      <p style="margin-top:1.2rem"><button>Reset password</button></p>
    </form>`;
  const form = $('#reset-form');
  bindPwRules(form.password, $('.pw-rules', form));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pwStrong(form.password.value)) return formError(form, 'Please choose a stronger password.');
    if (form.password.value !== form.password2.value) return formError(form, 'Passwords do not match.');
    await withBusy($('button', form), async () => {
      try {
        const r = await api('/auth/reset', { method: 'POST', auth: false, body: { token, newPassword: form.password.value } });
        clearSession();
        renderNav();
        form.innerHTML = `<h1>Password updated</h1><p class="form-ok">${esc(r.message)} All your devices were signed out.</p><a class="btn" href="#/login">Log in</a>`;
      } catch (err) { formError(form, err.message); }
    });
  });
});

// ---------------- account
route('/account', async ({ query }) => {
  const tab = query.get('tab') || 'profile';
  const tabs = [['profile', 'Profile & password'], ['devices', 'Devices & sessions'], ['favorites', 'Favorites'], ['bookmarks', 'Bookmarks']];
  main.innerHTML = `
    <div class="eyebrow">My research</div>
    <h1>${esc(state.user.name)}</h1>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="tab-body"><div class="loading">Loading…</div></div>`;
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => navigate(`/account?tab=${b.dataset.tab}`)));
  const body = $('#tab-body');

  if (tab === 'profile') {
    body.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>Profile</h2>
          <p><b>Email:</b> ${esc(state.user.email)}</p>
          <p><b>Role:</b> ${esc(ROLE_LABEL[state.user.role])}</p>
          <p class="muted small">${{
            user: 'You can read every topic, view restricted plates, save favorites & bookmarks, and take part in discussions.',
            investigator: 'You can also create, edit and update topic content and themes from the Studio.',
            admin: 'You have full privileges: users, roles, sessions and platform settings.',
          }[state.user.role]}</p>
        </div>
        <form class="card" id="pw-form" novalidate>
          <h2>Change password</h2>
          <label for="p-cur">Current password</label><input id="p-cur" name="current" type="password" autocomplete="current-password" required>
          <label for="p-new">New password</label><input id="p-new" name="next" type="password" autocomplete="new-password" required>
          ${pwRulesHtml()}
          <label for="p-new2">Confirm new password</label><input id="p-new2" name="next2" type="password" autocomplete="new-password" required>
          <p style="margin-top:1rem"><button>Update password</button></p>
          <p class="hint">For security, your other devices are signed out after a password change.</p>
        </form>
      </div>`;
    const form = $('#pw-form');
    bindPwRules(form.next, $('.pw-rules', form));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      formError(form, null);
      if (!pwStrong(form.next.value)) return formError(form, 'The new password does not meet the rules.');
      if (form.next.value !== form.next2.value) return formError(form, 'New passwords do not match.');
      await withBusy($('button', form), async () => {
        try {
          const r = await api('/auth/password', { method: 'PUT', body: { currentPassword: form.current.value, newPassword: form.next.value } });
          form.reset(); bindPwRules(form.next, $('.pw-rules', form));
          toast(r.message);
        } catch (err) { if (!err.handled) formError(form, err.message); }
      });
    });
  }

  if (tab === 'devices') {
    const r = await api('/sessions');
    const icon = (label) => (/mobile/.test(label) ? '📱' : '💻');
    body.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>Active devices</h2>
          <p class="muted">${r.sessions.length} of ${r.maxDevices} allowed concurrent devices in use. Logging in on a 3rd device signs out the oldest one.</p>
          <div class="meter" aria-hidden="true"><span style="width:${Math.min(100, (r.sessions.length / r.maxDevices) * 100)}%"></span></div>
          ${r.sessions.map((s) => `
            <div class="session">
              <div class="dev-icon">${icon(s.device_label)}</div>
              <div style="flex:1">
                <b>${esc(s.device_label)}</b> ${s.current ? '<span class="badge">This device</span>' : ''}
                <div class="muted small">Signed in ${fmtDate(s.created_at)} · last active ${fmtDate(s.last_seen_at)} · IP ${esc(s.ip || 'n/a')}</div>
                <div class="muted small">Session ID: <code>${esc(s.id.slice(0, 8))}…</code> · expires ${fmtDate(s.expires_at)}</div>
              </div>
              <button class="sm danger end-s" data-id="${esc(s.id)}" data-current="${s.current}">${s.current ? 'Log out' : 'End session'}</button>
            </div>`).join('')}
          ${r.sessions.length > 1 ? '<p style="margin-top:1rem"><button class="ghost" id="end-others">Sign out all other devices</button></p>' : ''}
        </div>
        <div class="card">
          <h2>Recent session history</h2>
          ${r.history.map((h) => `<div class="session"><div class="dev-icon">${icon(h.device_label)}</div><div><b>${esc(h.device_label)}</b><div class="muted small">${fmtDate(h.created_at)} → ${h.revoked_at ? `${fmtDate(h.revoked_at)} (${esc((h.revoked_reason || '').replace(/_/g, ' '))})` : 'expired'}</div></div></div>`).join('') || '<p class="muted">No ended sessions yet.</p>'}
        </div>
      </div>`;
    $$('.end-s').forEach((b) => b.addEventListener('click', async () => {
      await api(`/sessions/${b.dataset.id}`, { method: 'DELETE' });
      if (b.dataset.current === 'true') { clearSession(); toast('Logged out.'); return navigate('/'); }
      toast('Session ended. That device is now signed out.');
      render();
    }));
    $('#end-others')?.addEventListener('click', async () => {
      const x = await api('/sessions', { method: 'DELETE' });
      toast(`Signed out ${x.ended} other device(s).`);
      render();
    });
  }

  if (tab === 'favorites') {
    const favs = await api('/me/favorites');
    body.innerHTML = `<div class="card"><h2>Favorite topics</h2>${favs.map((f) => `
      <div class="session"><span class="dot" style="background:var(--accent)" data-theme="${esc(f.theme)}"></span>
        <div style="flex:1"><a href="#/topic/${esc(f.slug)}"><b>${esc(f.title)}</b></a><div class="muted small">${esc(f.region)} · saved ${fmtDate(f.created_at)}</div></div>
        <button class="sm danger rm-fav" data-slug="${esc(f.slug)}">Remove</button></div>`).join('') || '<p class="muted">No favorites yet. Open a topic and press “Add to favorites”.</p>'}</div>`;
    $$('.rm-fav').forEach((b) => b.addEventListener('click', async () => { await api(`/me/favorites/${b.dataset.slug}`, { method: 'DELETE' }); toast('Removed.'); render(); }));
  }

  if (tab === 'bookmarks') {
    const bms = await api('/me/bookmarks');
    body.innerHTML = `<div class="card"><h2>Bookmarks</h2>${bms.map((b) => `
      <div class="session"><span class="dot" style="background:var(--accent)" data-theme="${esc(b.theme)}"></span>
        <div style="flex:1"><a href="#/topic/${esc(b.slug)}"><b>${esc(b.title)}</b></a> — ${esc(b.section || 'Topic')}
          ${b.note ? `<div class="small">📝 ${esc(b.note)}</div>` : ''}<div class="muted small">${fmtDate(b.created_at)}</div></div>
        <button class="sm danger rm-bm" data-id="${b.id}">Remove</button></div>`).join('') || '<p class="muted">No bookmarks yet. Use the 🔖 button next to any section of a topic.</p>'}</div>`;
    $$('.rm-bm').forEach((b) => b.addEventListener('click', async () => { await api(`/me/bookmarks/${b.dataset.id}`, { method: 'DELETE' }); toast('Removed.'); render(); }));
  }
}, { auth: true });

// ---------------- studio (Investigator + Admin)
const STUDIO = { auth: true, roles: ['investigator', 'admin'] };

route('/studio', async () => {
  const topics = await loadTopics(true);
  main.innerHTML = `
    <div class="row"><div><div class="eyebrow">Investigator studio</div><h1>Topics</h1></div><span class="spacer"></span><a class="btn" href="#/studio/new">+ New topic</a></div>
    <p class="muted">Create, edit and update topic content and themes. These write operations are enforced on the server for Investigator/Admin only.</p>
    <div class="card table-wrap"><table>
      <thead><tr><th>#</th><th>Topic</th><th>Theme</th><th>Updated</th><th></th></tr></thead>
      <tbody>${topics.map((t) => `<tr>
        <td>${t.number ?? ''}</td><td><a href="#/topic/${esc(t.slug)}">${esc(t.title)}</a></td>
        <td><span class="dot" data-theme="${esc(t.theme)}" style="background:var(--accent);${accentStyle(t.accent)}"></span> ${esc(themeNames[t.theme] || t.theme)}</td>
        <td class="small muted">${fmtDate(t.updated_at)}</td>
        <td><a class="btn sm btn-ghost" href="#/studio/edit/${esc(t.slug)}">Edit</a></td></tr>`).join('')}</tbody>
    </table></div>`;
}, STUDIO);

async function topicEditor(slug) {
  const themes = await api('/themes', { auth: false });
  const t = slug ? await api(`/topics/${encodeURIComponent(slug)}`, { auth: false })
    : { slug: '', title: '', region: '', era: '', summary: '', sections: [{ heading: '', body: '' }], facts: [], theme: 'atlas', accent: null };
  setTheme(t.theme, t.accent);
  main.innerHTML = `
    <p><a href="#/studio">← Studio</a></p>
    <h1>${slug ? `Edit: ${esc(t.title)}` : 'New topic'}</h1>
    <form class="card" id="topic-form" novalidate>
      <div class="grid-2">
        <div><label for="t-title">Title</label><input id="t-title" name="title" value="${esc(t.title)}" required></div>
        <div><label for="t-slug">Slug (URL)</label><input id="t-slug" name="slug" value="${esc(t.slug)}" ${slug ? 'disabled' : ''} pattern="[a-z0-9-]+" placeholder="e.g. great-zimbabwe"><p class="hint">Lowercase letters, numbers and dashes.${slug ? ' Slug cannot be changed.' : ''}</p></div>
        <div><label for="t-region">Region</label><input id="t-region" name="region" value="${esc(t.region)}"></div>
        <div><label for="t-era">Era</label><input id="t-era" name="era" value="${esc(t.era)}"></div>
      </div>
      <label for="t-summary">Summary</label><textarea id="t-summary" name="summary" required>${esc(t.summary)}</textarea>
      <label>Visual theme <span class="muted small">(preview updates the whole page live)</span></label>
      <div class="swatches">${themes.map((th) => `<label class="swatch ${th.slug === t.theme ? 'sel' : ''}"><input type="radio" name="theme" value="${th.slug}" ${th.slug === t.theme ? 'checked' : ''}><span class="dot" style="background:${th.accent}"></span>${esc(th.name)}</label>`).join('')}</div>
      <div class="row" style="margin-top:.8rem">
        <label class="row" style="margin:0;font-weight:400"><input type="checkbox" id="use-accent" style="width:auto" ${t.accent ? 'checked' : ''}> Custom accent color</label>
        <input type="color" id="t-accent" value="${esc(t.accent || '#c08040')}" style="width:60px;height:38px;padding:2px" ${t.accent ? '' : 'disabled'}>
      </div>
      <h3 style="margin-top:1.4rem">Sections</h3>
      <div id="sections"></div>
      <button type="button" class="ghost sm" id="add-sec">+ Add section</button>
      <label for="t-facts">Field facts <span class="muted small">(one per line)</span></label>
      <textarea id="t-facts" name="facts">${esc((t.facts || []).join('\n'))}</textarea>
      <div class="row" style="margin-top:1.2rem"><button>${slug ? 'Save changes' : 'Create topic'}</button>
        ${slug ? `<a class="btn btn-ghost" href="#/topic/${esc(slug)}">View</a><span class="spacer"></span><button type="button" class="danger" id="del-topic">Delete topic</button>` : ''}</div>
    </form>`;
  const form = $('#topic-form');
  const secBox = $('#sections');
  const addSection = (s = { heading: '', body: '' }) => {
    const div = document.createElement('div');
    div.className = 'section-editor';
    div.innerHTML = `<div class="row"><b class="spacer">Section</b><button type="button" class="sm danger rm">Remove</button></div>
      <label>Heading</label><input class="s-h" value="${esc(s.heading)}"><label>Text</label><textarea class="s-b">${esc(s.body)}</textarea>`;
    $('.rm', div).addEventListener('click', () => div.remove());
    secBox.append(div);
  };
  (t.sections?.length ? t.sections : [{ heading: '', body: '' }]).forEach(addSection);
  $('#add-sec').addEventListener('click', () => addSection());
  const accentInput = $('#t-accent');
  const preview = () => {
    const theme = form.theme.value;
    $$('.swatch').forEach((s) => s.classList.toggle('sel', $('input', s).checked));
    setTheme(theme, $('#use-accent').checked ? accentInput.value : null);
  };
  $$('input[name="theme"]').forEach((r) => r.addEventListener('change', preview));
  $('#use-accent').addEventListener('change', () => { accentInput.disabled = !$('#use-accent').checked; preview(); });
  accentInput.addEventListener('input', preview);
  if (!slug) form.title.addEventListener('input', () => { if (!form.slug.dataset.touched) form.slug.value = form.title.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); });
  form.slug.addEventListener('input', () => { form.slug.dataset.touched = '1'; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError(form, null);
    const payload = {
      title: form.title.value, region: form.region.value, era: form.era.value, summary: form.summary.value,
      theme: form.theme.value, accent: $('#use-accent').checked ? accentInput.value : '',
      sections: $$('.section-editor', secBox).map((d) => ({ heading: $('.s-h', d).value, body: $('.s-b', d).value })),
      facts: form.facts.value.split('\n').map((x) => x.trim()).filter(Boolean),
    };
    if (!slug) payload.slug = form.slug.value;
    await withBusy($('button:not([type])', form), async () => {
      try {
        const r = await api(slug ? `/topics/${slug}` : '/topics', { method: slug ? 'PUT' : 'POST', body: payload });
        state.topics = null;
        toast(slug ? 'Topic updated.' : 'Topic created.');
        navigate(`/topic/${r.slug}`);
      } catch (err) { if (!err.handled) formError(form, err.message); }
    });
  });
  $('#del-topic')?.addEventListener('click', async () => {
    const btn = $('#del-topic');
    if (btn.dataset.confirm !== '1') { btn.dataset.confirm = '1'; btn.textContent = 'Click again to confirm delete'; return; }
    await api(`/topics/${slug}`, { method: 'DELETE' });
    state.topics = null;
    toast('Topic deleted.');
    navigate('/studio');
  });
}
route('/studio/new', () => topicEditor(null), STUDIO);
route('/studio/edit/:slug', ({ params }) => topicEditor(params.slug), STUDIO);

// ---------------- admin
route('/admin', async ({ query }) => {
  const tab = query.get('tab') || 'overview';
  const tabs = [['overview', 'Overview'], ['users', 'Users & roles'], ['sessions', 'Sessions'], ['settings', 'Platform settings'], ['outbox', 'Email outbox']];
  main.innerHTML = `
    <div class="eyebrow">Administration</div><h1>Admin panel</h1>
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    <div id="tab-body"><div class="loading">Loading…</div></div>`;
  $$('[data-tab]').forEach((b) => b.addEventListener('click', () => navigate(`/admin?tab=${b.dataset.tab}`)));
  const body = $('#tab-body');

  if (tab === 'overview') {
    const s = await api('/admin/stats');
    body.innerHTML = `
      <div class="grid">${[['users', 'Users'], ['topics', 'Topics'], ['discussions', 'Discussions'], ['comments', 'Comments'], ['active_sessions', 'Active sessions']].map(([k, l]) => `<div class="card stat"><b>${s[k]}</b>${l}</div>`).join('')}</div>
      <div class="card" style="margin-top:1.2rem"><h2>Monitoring</h2>
        <p class="muted">Sentry is ${state.config.sentryDsn ? '<b>enabled</b>' : 'not configured (set SENTRY_DSN in Netlify)'}. Use these buttons to send test errors.</p>
        <div class="row"><button class="ghost" id="sentry-api">Trigger server error</button><button class="ghost" id="sentry-ui">Trigger browser error</button></div></div>`;
    $('#sentry-api').addEventListener('click', async () => { try { await api('/admin/sentry-test', { method: 'POST' }); } catch (e) { toast(`Server error sent: ${e.message}`, 'error'); } });
    $('#sentry-ui').addEventListener('click', () => { setTimeout(() => { throw new Error('Sentry browser test error from Admin panel'); }); toast('Browser error thrown.', 'error'); });
  }

  if (tab === 'users') {
    const users = await api('/admin/users');
    body.innerHTML = `<div class="card table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Devices</th><th>Joined</th><th></th></tr></thead>
      <tbody>${users.map((u) => {
        const me = u.id === state.user.id;
        return `<tr>
          <td>${esc(u.name)}${me ? ' <span class="badge">You</span>' : ''}</td><td>${esc(u.email)}</td>
          <td><select class="role-sel" data-id="${u.id}" ${me ? 'disabled' : ''} aria-label="Role for ${esc(u.name)}">${['user', 'investigator', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select></td>
          <td>${me ? esc(u.status) : `<button class="sm ghost status-btn" data-id="${u.id}" data-status="${u.status === 'active' ? 'disabled' : 'active'}">${u.status === 'active' ? 'Active · disable' : 'Disabled · enable'}</button>`}</td>
          <td>${u.active_sessions}/2</td><td class="small muted">${fmtDate(u.created_at)}</td>
          <td>${me ? '' : `<button class="sm danger del-user" data-id="${u.id}">Delete</button>`}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    $$('.role-sel').forEach((s) => s.addEventListener('change', async () => {
      try { await api(`/admin/users/${s.dataset.id}/role`, { method: 'PUT', body: { role: s.value } }); toast(`Role updated to ${ROLE_LABEL[s.value]}. Their active sessions must log in again.`); }
      catch (e) { if (!e.handled) toast(e.message, 'error'); render(); }
    }));
    $$('.status-btn').forEach((b) => b.addEventListener('click', async () => { await api(`/admin/users/${b.dataset.id}/status`, { method: 'PUT', body: { status: b.dataset.status } }); toast('Status updated.'); render(); }));
    $$('.del-user').forEach((b) => b.addEventListener('click', async () => {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Confirm?'; return; }
      await api(`/admin/users/${b.dataset.id}`, { method: 'DELETE' }); toast('User deleted.'); render();
    }));
  }

  if (tab === 'sessions') {
    const sessions = await api('/admin/sessions');
    body.innerHTML = `<div class="card table-wrap"><table>
      <thead><tr><th>User</th><th>Device</th><th>IP</th><th>Signed in</th><th>Last seen</th><th></th></tr></thead>
      <tbody>${sessions.map((s) => `<tr><td>${esc(s.name)}<div class="small muted">${esc(s.email)}</div></td><td>${esc(s.device_label)}</td><td class="small">${esc(s.ip || '')}</td>
        <td class="small">${fmtDate(s.created_at)}</td><td class="small">${fmtDate(s.last_seen_at)}</td>
        <td><button class="sm danger rv" data-id="${esc(s.id)}">Revoke</button></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No active sessions.</td></tr>'}</tbody></table></div>`;
    $$('.rv').forEach((b) => b.addEventListener('click', async () => { await api(`/admin/sessions/${b.dataset.id}`, { method: 'DELETE' }); toast('Session revoked.'); render(); }));
  }

  if (tab === 'settings') {
    const s = await api('/admin/settings');
    body.innerHTML = `<form class="card" id="settings-form" style="max-width:640px">
      <label for="s-name">Site name</label><input id="s-name" name="site_name" value="${esc(s.site_name)}" maxlength="60">
      <label for="s-ann">Announcement banner <span class="muted small">(empty = hidden)</span></label><input id="s-ann" name="announcement" value="${esc(s.announcement)}" maxlength="300">
      <label for="s-reg">New registrations</label><select id="s-reg" name="registration_open"><option value="true" ${s.registration_open === 'true' ? 'selected' : ''}>Open</option><option value="false" ${s.registration_open !== 'true' ? 'selected' : ''}>Closed</option></select>
      <label for="s-pol">When a 3rd device logs in (limit = 2)</label><select id="s-pol" name="session_policy">
        <option value="fifo" ${s.session_policy === 'fifo' ? 'selected' : ''}>Sign out the oldest session (FIFO)</option>
        <option value="reject" ${s.session_policy === 'reject' ? 'selected' : ''}>Reject the new login</option></select>
      <p style="margin-top:1.2rem"><button>Save settings</button></p></form>`;
    $('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      await api('/admin/settings', { method: 'PUT', body: { site_name: f.site_name.value, announcement: f.announcement.value, registration_open: f.registration_open.value, session_policy: f.session_policy.value } });
      await loadConfig();
      toast('Settings saved.');
    });
  }

  if (tab === 'outbox') {
    const mails = await api('/admin/outbox');
    body.innerHTML = `<div class="card"><h2>Simulated email outbox</h2>
      <p class="muted small">When no email provider (RESEND_API_KEY) is configured, recovery emails are stored here so the protocol can be demonstrated. Only Admins can see this; the recovery endpoint never reveals it.</p>
      ${mails.map((m) => `<div class="card" style="background:var(--surface-2)"><b>${esc(m.subject)}</b> → ${esc(m.to_email)} <span class="muted small">${fmtDate(m.created_at)}</span><pre class="mail">${esc(m.body)}</pre></div>`).join('') || '<p class="muted">No emails yet.</p>'}</div>`;
  }
}, { auth: true, roles: ['admin'] });

// ------------------------------------------------------------------ brain button (all views)
const brainBtn = $('#brain-btn');
const brainPanel = $('#brain-panel');
function closeBrain() { brainPanel.hidden = true; brainBtn.setAttribute('aria-expanded', 'false'); }
async function showBrain() {
  brainPanel.hidden = false;
  brainBtn.setAttribute('aria-expanded', 'true');
  brainPanel.innerHTML = '<p class="muted">Thinking…</p>';
  let topic = state.currentTopic;
  if (!topic) {
    const list = await loadTopics();
    const pick = list[Math.floor(Math.random() * list.length)];
    topic = await api(`/topics/${pick.slug}`, { auth: false });
  }
  const facts = topic.facts?.length ? topic.facts : [topic.summary];
  const fact = facts[Math.floor(Math.random() * facts.length)];
  brainPanel.innerHTML = `
    <div class="row"><h3 class="spacer">🧠 Research companion</h3><button class="sm ghost" id="brain-close" aria-label="Close">✕</button></div>
    <p class="muted small">${state.currentTopic ? 'A fact about the topic you are reading:' : 'Did you know?'}</p>
    <div class="fact">${esc(fact)}<div class="small muted" style="margin-top:.4rem">— ${esc(topic.title)}</div></div>
    <div class="row">
      <button class="sm" id="brain-more">Another fact</button>
      <button class="sm ghost" id="brain-random">Surprise me</button>
    </div>
    <p class="small muted" style="margin:.8rem 0 0">Signed in as: ${isAuthed() ? `${esc(state.user.name)} (${esc(ROLE_LABEL[state.user.role])})` : 'Guest'} · Theme: ${esc(themeNames[document.documentElement.dataset.theme] || 'Atlas')}</p>`;
  $('#brain-close').addEventListener('click', closeBrain);
  $('#brain-more').addEventListener('click', showBrain);
  $('#brain-random').addEventListener('click', async () => {
    const list = await loadTopics();
    navigate(`/topic/${list[Math.floor(Math.random() * list.length)].slug}`);
  });
}
brainBtn.addEventListener('click', () => (brainPanel.hidden ? showBrain() : closeBrain()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBrain(); });

// ------------------------------------------------------------------ boot
async function loadConfig() {
  try { state.config = { ...state.config, ...(await api('/config', { auth: false })) }; } catch { /* offline */ }
  $('#site-name').textContent = state.config.siteName;
  document.title = `${state.config.siteName} · Thematic Investigation Platform`;
  const ann = $('#announcement');
  ann.textContent = state.config.announcement || '';
  ann.hidden = !state.config.announcement;
}

function initSentry(dsn) {
  const s = document.createElement('script');
  s.src = '/js/vendor/sentry-11.17.0.min.js'; // self-hosted copy of the official Sentry CDN bundle
  s.onload = () => {
    window.Sentry?.init({ dsn, environment: state.config.environment, tunnel: '/api/monitoring' });
    if (state.user) window.Sentry?.setUser({ id: String(state.user.id), role: state.user.role });
  };
  document.head.append(s);
}

$('#menu-toggle').addEventListener('click', () => {
  const nav = $('#nav');
  nav.classList.toggle('open');
  $('#menu-toggle').setAttribute('aria-expanded', String(nav.classList.contains('open')));
});

// Keep tabs in sync (logout in one tab logs out the others)
window.addEventListener('storage', (e) => {
  if (e.key !== 'atlas.token') return;
  state.token = store.get('atlas.token');
  state.user = JSON.parse(store.get('atlas.user') || 'null');
  scheduleExpiry();
  render();
});

window.addEventListener('hashchange', render);

(async function boot() {
  await loadConfig();
  if (state.config.sentryDsn) initSentry(state.config.sentryDsn);
  try { (await api('/themes', { auth: false })).forEach((t) => (themeNames[t.slug] = t.name)); } catch { /* ignore */ }
  if (state.token && !tokenValid()) clearSession(); // expired while away
  if (tokenValid()) {
    try { const me = await api('/auth/me'); state.user = me.user; store.set('atlas.user', JSON.stringify(me.user)); scheduleExpiry(); }
    catch { /* 401 handled inside api() */ }
  }
  render();
})();
