/* ============================================================
   Compass — work, growth & karma tracker
   Vanilla JS, localStorage. No build step, no network.
   ============================================================ */

/* ---------- Config: buckets, subtags, statuses ---------- */
const BUCKETS = [
  { id: 'eng',    name: 'Engineering Manager · TLM · Lead · Staff', short: 'Eng Leadership', color: '#60a5fa' },
  { id: 'visa',   name: 'O-1A · EB1A/C', short: 'Immigration / Extraordinary', color: '#c084fc' },
  { id: 'speaker',name: 'Speaker', short: 'Speaker', color: '#f472b6', subtags: [
      'Conference', 'Course', 'TEDx', 'Lunch & Learn',
      'Newsletter — sequence', 'Newsletter — schedule',
      'LinkedIn — idea', 'LinkedIn — script', 'LinkedIn — format', 'LinkedIn — schedule',
      'YouTube — idea', 'YouTube — script', 'YouTube — assets', 'YouTube — record', 'YouTube — edit', 'YouTube — upload'
    ] },
  { id: 'research',name: 'Research', short: 'Research', color: '#22d3ee', subtags: ['Papers', 'Book'] },
  { id: 'psych',  name: 'Psychology / Neuroscience', short: 'Psych / Neuro', color: '#4ade80' },
];

const STATUSES = [
  { id: 'tbp',      name: 'To be prioritized', color: '#6b7180' },
  { id: 'prio',     name: 'Prioritized',        color: '#60a5fa' },
  { id: 'progress', name: 'In progress',        color: '#fbbf24' },
  { id: 'done',     name: 'Done',               color: '#4ade80' },
];

const KARMA_RULES = { create: 2, prio: 1, progress: 3, done: 10 }; // auto-award on status changes

const STRENGTH_SUGGESTIONS = ['Communication','Strategic thinking','Storytelling','Mentoring','Systems design','Execution','Leadership','Writing','Public speaking','Research','Creativity','Resilience','Analysis','Influence','Empathy','Focus'];
const VALUE_SUGGESTIONS = ['Growth','Impact','Integrity','Craft','Community','Curiosity','Courage','Service','Excellence','Balance','Authenticity','Autonomy','Recognition','Legacy'];

const CHART_COLORS = ['#7c8cff','#60a5fa','#4ade80','#fbbf24','#f472b6','#c084fc','#22d3ee','#f87171','#a3e635','#fb923c'];

/* ---------- State / persistence ---------- */
const LS_KEY = 'compass.v1';
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('load failed', e); }
  return { items: [], karma: [], meta: { created: Date.now() } };
  // karma entry: { date:'YYYY-MM-DD', bucket:'eng', points: 5 }
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  renderKarmaBadge();
}

/* ---------- Helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const todayStr = () => new Date().toISOString().slice(0, 10);
const esc = (s) => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const bucketOf = id => BUCKETS.find(b => b.id === id);
const statusOf = id => STATUSES.find(s => s.id === id);

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(todayStr() + 'T00:00:00');
  return Math.round((d - now) / 86400000);
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
$('#tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab'); if (!btn) return;
  $$('.tab').forEach(t => t.classList.remove('active'));
  $$('.view').forEach(v => v.classList.remove('active'));
  btn.classList.add('active');
  $('#view-' + btn.dataset.view).classList.add('active');
  if (btn.dataset.view === 'charts') renderCharts();
  if (btn.dataset.view === 'insights') renderInsights();
  if (btn.dataset.view === 'karma') renderKarma();
});

/* ============================================================
   BOARD
   ============================================================ */
let filters = { sort: 'deadline', bucket: '', search: '' };
let listMode = false;

function initFilters() {
  const fb = $('#filterBucket');
  BUCKETS.forEach(b => fb.insertAdjacentHTML('beforeend', `<option value="${b.id}">${esc(b.short)}</option>`));
  $('#sortBy').addEventListener('change', e => { filters.sort = e.target.value; renderBoard(); });
  $('#filterBucket').addEventListener('change', e => { filters.bucket = e.target.value; renderBoard(); });
  $('#searchBox').addEventListener('input', e => { filters.search = e.target.value.toLowerCase(); renderBoard(); });
  $('#viewToggle').addEventListener('click', () => {
    listMode = !listMode;
    document.body.classList.toggle('list-mode', listMode);
    $('#viewToggle').textContent = listMode ? '▦ Board' : '☰ List';
    renderBoard();
  });
}

function filteredItems() {
  let items = state.items.slice();
  if (filters.bucket) items = items.filter(i => i.bucket === filters.bucket);
  if (filters.search) items = items.filter(i =>
    (i.title || '').toLowerCase().includes(filters.search) ||
    (i.description || '').toLowerCase().includes(filters.search));
  return items;
}

function sortItems(items) {
  const s = filters.sort;
  const byDeadline = (a, b) => {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  };
  const arr = items.slice();
  if (s === 'deadline') arr.sort(byDeadline);
  else if (s === 'status') arr.sort((a, b) => STATUSES.findIndex(x => x.id === a.status) - STATUSES.findIndex(x => x.id === b.status) || byDeadline(a, b));
  else if (s === 'bucket') arr.sort((a, b) => (a.bucket || '').localeCompare(b.bucket || '') || byDeadline(a, b));
  else if (s === 'created') arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else if (s === 'impact') arr.sort((a, b) => (b.impact || '').length - (a.impact || '').length);
  return arr;
}

function deadlineChip(item) {
  if (!item.deadline || item.status === 'done') return '';
  const d = daysUntil(item.deadline);
  let cls = 'deadline', label;
  if (d < 0) { cls += ' overdue'; label = `${-d}d overdue`; }
  else if (d === 0) { cls += ' soon'; label = 'due today'; }
  else if (d <= 7) { cls += ' soon'; label = `${d}d left`; }
  else label = new Date(item.deadline + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `<span class="chip ${cls}">⏱ ${label}</span>`;
}

function cardHtml(item) {
  const b = bucketOf(item.bucket);
  const linkCount = (item.linked || []).length;
  return `<div class="card" data-id="${item.id}">
    <div class="card-title">${esc(item.title)}</div>
    <div class="card-meta">
      ${b ? `<span class="chip bucket">${esc(b.short)}${item.subtag ? ' · ' + esc(item.subtag) : ''}</span>` : ''}
      ${deadlineChip(item)}
      ${linkCount ? `<span class="chip link">🔗 ${linkCount}</span>` : ''}
      ${(item.strengths || []).slice(0, 2).map(s => `<span class="chip">${esc(s)}</span>`).join('')}
    </div>
    ${item.description ? `<p class="card-desc">${esc(item.description)}</p>` : ''}
  </div>`;
}

function renderBoard() {
  const board = $('#board');
  const items = sortItems(filteredItems());
  board.innerHTML = STATUSES.map(st => {
    const inCol = items.filter(i => i.status === st.id);
    return `<div class="column" data-status="${st.id}">
      <div class="column-head">
        <span><span class="status-dot" style="background:${st.color}"></span>${st.name}</span>
        <span class="count">${inCol.length}</span>
      </div>
      ${inCol.map(cardHtml).join('') || '<div class="empty-hint">nothing here yet</div>'}
    </div>`;
  }).join('');
  board.querySelectorAll('.card').forEach(c =>
    c.addEventListener('click', () => openModal(c.dataset.id)));
}

/* ============================================================
   MODAL (create / edit)
   ============================================================ */
let editingTokens = { strengths: [], values: [] };

function initModal() {
  // populate selects
  const bsel = $('#f-bucket');
  BUCKETS.forEach(b => bsel.insertAdjacentHTML('beforeend', `<option value="${b.id}">${esc(b.short)}</option>`));
  const ssel = $('#f-status');
  STATUSES.forEach(s => ssel.insertAdjacentHTML('beforeend', `<option value="${s.id}">${esc(s.name)}</option>`));

  bsel.addEventListener('change', syncSubtags);

  $('#newItemBtn').addEventListener('click', () => openModal(null));
  $('#modalClose').addEventListener('click', closeModal);
  $('#cancelBtn').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
  $('#saveBtn').addEventListener('click', saveItem);
  $('#deleteBtn').addEventListener('click', deleteItem);

  setupTokenInput('strengths', STRENGTH_SUGGESTIONS);
  setupTokenInput('values', VALUE_SUGGESTIONS);
}

function syncSubtags() {
  const b = bucketOf($('#f-bucket').value);
  const row = $('#subtagRow'), sel = $('#f-subtag');
  if (b && b.subtags) {
    row.style.display = '';
    const prev = sel.value;
    sel.innerHTML = '<option value="">— none —</option>' + b.subtags.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  } else { row.style.display = 'none'; sel.innerHTML = ''; }
}

function setupTokenInput(kind, suggestions) {
  const input = $(`#${kind}Input`);
  const sugg = $(`#${kind}Sugg`);
  sugg.innerHTML = suggestions.map(s => `<button type="button" class="sugg" data-v="${esc(s)}">+ ${esc(s)}</button>`).join('');
  sugg.querySelectorAll('.sugg').forEach(b => b.addEventListener('click', () => addToken(kind, b.dataset.v)));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addToken(kind, input.value); input.value = ''; }
    else if (e.key === 'Backspace' && !input.value && editingTokens[kind].length) {
      editingTokens[kind].pop(); renderTokens(kind);
    }
  });
}
function addToken(kind, val) {
  val = (val || '').trim();
  if (!val) return;
  if (!editingTokens[kind].some(t => t.toLowerCase() === val.toLowerCase()))
    editingTokens[kind].push(val);
  renderTokens(kind);
}
function renderTokens(kind) {
  const wrap = $(`#${kind}Tokens`);
  const input = $(`#${kind}Input`);
  wrap.querySelectorAll('.token').forEach(t => t.remove());
  editingTokens[kind].forEach((t, i) => {
    const el = document.createElement('span');
    el.className = 'token';
    el.innerHTML = `${esc(t)} <button type="button" data-i="${i}">✕</button>`;
    el.querySelector('button').addEventListener('click', () => { editingTokens[kind].splice(i, 1); renderTokens(kind); });
    wrap.insertBefore(el, input);
  });
}

function refreshLinkedOptions(currentId) {
  const sel = $('#f-linked');
  const opts = state.items.filter(i => i.id !== currentId)
    .map(i => `<option value="${i.id}">${esc(i.title)}</option>`).join('');
  sel.innerHTML = '<option value="">— none —</option>' + opts;
}

function openModal(id) {
  const editing = id ? state.items.find(i => i.id === id) : null;
  $('#modalTitle').textContent = editing ? 'Edit work item' : 'New work item';
  $('#deleteBtn').style.display = editing ? '' : 'none';
  $('#f-id').value = editing ? editing.id : '';
  $('#f-title').value = editing ? editing.title : '';
  $('#f-description').value = editing ? (editing.description || '') : '';
  $('#f-bucket').value = editing ? editing.bucket : BUCKETS[0].id;
  syncSubtags();
  $('#f-subtag').value = editing ? (editing.subtag || '') : '';
  $('#f-status').value = editing ? editing.status : 'tbp';
  $('#f-deadline').value = editing ? (editing.deadline || '') : '';
  $('#f-feelDuring').value = editing ? (editing.feelDuring || '') : '';
  $('#f-feelAfter').value = editing ? (editing.feelAfter || '') : '';
  $('#f-impact').value = editing ? (editing.impact || '') : '';
  editingTokens.strengths = editing ? [...(editing.strengths || [])] : [];
  editingTokens.values = editing ? [...(editing.values || [])] : [];
  renderTokens('strengths'); renderTokens('values');
  refreshLinkedOptions(id);
  $('#f-linked').value = editing && editing.linked && editing.linked[0] ? editing.linked[0] : '';
  $('#modalBackdrop').classList.add('open');
  setTimeout(() => $('#f-title').focus(), 50);
}
function closeModal() { $('#modalBackdrop').classList.remove('open'); }

function saveItem() {
  const title = $('#f-title').value.trim();
  if (!title) { toast('Give it a title first'); $('#f-title').focus(); return; }
  const id = $('#f-id').value;
  const linkedVal = $('#f-linked').value;
  const data = {
    title,
    description: $('#f-description').value.trim(),
    bucket: $('#f-bucket').value,
    subtag: $('#f-subtag').value || '',
    status: $('#f-status').value,
    deadline: $('#f-deadline').value || '',
    linked: linkedVal ? [linkedVal] : [],
    strengths: [...editingTokens.strengths],
    values: [...editingTokens.values],
    feelDuring: $('#f-feelDuring').value.trim(),
    feelAfter: $('#f-feelAfter').value.trim(),
    impact: $('#f-impact').value.trim(),
  };

  if (id) {
    const item = state.items.find(i => i.id === id);
    const prevStatus = item.status;
    Object.assign(item, data);
    item.updatedAt = Date.now();
    if (data.status === 'done' && prevStatus !== 'done') item.completedAt = Date.now();
    awardStatusKarma(prevStatus, data.status, data.bucket);
    toast('Updated ✓');
  } else {
    const item = { id: uid(), createdAt: Date.now(), ...data };
    if (data.status === 'done') item.completedAt = Date.now();
    state.items.push(item);
    // creation karma + any status-implied karma
    logKarma(data.bucket, KARMA_RULES.create);
    awardStatusKarma('tbp', data.status, data.bucket);
    toast(`Created · +${KARMA_RULES.create} ⚡`);
  }
  save();
  closeModal();
  renderBoard();
}

function deleteItem() {
  const id = $('#f-id').value;
  if (!id) return;
  if (!confirm('Delete this work item? This cannot be undone.')) return;
  state.items = state.items.filter(i => i.id !== id);
  // clean up links pointing to it
  state.items.forEach(i => { if (i.linked) i.linked = i.linked.filter(l => l !== id); });
  save(); closeModal(); renderBoard();
  toast('Deleted');
}

function awardStatusKarma(prev, next, bucket) {
  if (prev === next) return;
  const order = ['tbp', 'prio', 'progress', 'done'];
  if (order.indexOf(next) <= order.indexOf(prev)) return; // only reward forward progress
  const map = { prio: KARMA_RULES.prio, progress: KARMA_RULES.progress, done: KARMA_RULES.done };
  if (map[next]) { logKarma(bucket, map[next]); toast(`+${map[next]} ⚡ karma`); }
}

/* ============================================================
   KARMA / GAMIFICATION
   ============================================================ */
function logKarma(bucket, points) {
  const d = todayStr();
  let entry = state.karma.find(k => k.date === d && k.bucket === bucket);
  if (entry) entry.points += points;
  else state.karma.push({ date: d, bucket, points });
  save();
}

function karmaForDate(dateStr) {
  return state.karma.filter(k => k.date === dateStr).reduce((s, k) => s + k.points, 0);
}
function last7Dates() {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    arr.push(d.toISOString().slice(0, 10));
  }
  return arr;
}
function currentStreak() {
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (karmaForDate(ds) > 0) streak++;
    else if (i === 0) continue; // today may still be empty; don't break streak on today
    else break;
  }
  return streak;
}

function renderKarmaBadge() {
  $('#todayKarma').textContent = karmaForDate(todayStr());
  const s = currentStreak();
  $('#streakCount').textContent = s;
  const s2 = $('#streakCount2'); if (s2) s2.textContent = s;
}

function renderKarma() {
  renderKarmaBadge();
  const week = last7Dates();
  $('#weekTotal').textContent = week.reduce((sum, d) => sum + karmaForDate(d), 0);

  // log cards
  $('#karmaLog').innerHTML = BUCKETS.map(b => {
    const today = state.karma.filter(k => k.date === todayStr() && k.bucket === b.id).reduce((s, k) => s + k.points, 0);
    return `<div class="karma-bucket">
      <div class="kb-head">
        <span class="kb-name"><span class="status-dot" style="background:${b.color}"></span>${esc(b.short)}</span>
        <span class="kb-today">${today} ⚡</span>
      </div>
      <div class="kb-add">
        <button class="btn small" data-k="${b.id}" data-p="1">+1</button>
        <button class="btn small" data-k="${b.id}" data-p="3">+3</button>
        <button class="btn small" data-k="${b.id}" data-p="5">+5</button>
        <button class="btn small ghost" data-k="${b.id}" data-p="-1" title="undo">−1</button>
      </div>
    </div>`;
  }).join('');
  $('#karmaLog').querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => {
      logKarma(btn.dataset.k, parseInt(btn.dataset.p, 10));
      renderKarma();
      toast(`${btn.dataset.p > 0 ? '+' : ''}${btn.dataset.p} ⚡`);
    }));

  // week grid
  const wg = $('#weekGrid');
  const dayLabels = week.map(d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' }));
  let html = `<div class="wg-cell wg-head wg-label">Bucket</div>` + dayLabels.map(d => `<div class="wg-cell wg-head">${d}</div>`).join('');
  BUCKETS.forEach(b => {
    html += `<div class="wg-cell wg-label">${esc(b.short)}</div>`;
    week.forEach(d => {
      const pts = state.karma.filter(k => k.date === d && k.bucket === b.id).reduce((s, k) => s + k.points, 0);
      const intensity = Math.min(pts / 10, 1);
      const bg = pts ? `color-mix(in srgb, ${b.color} ${Math.round(20 + intensity * 60)}%, transparent)` : '';
      html += `<div class="wg-cell" style="${bg ? `background:${bg};color:var(--text)` : ''}">${pts || '·'}</div>`;
    });
  });
  // totals row
  html += `<div class="wg-cell wg-label" style="font-weight:600">Daily total</div>`;
  week.forEach(d => { html += `<div class="wg-cell" style="font-weight:600">${karmaForDate(d) || '·'}</div>`; });
  wg.innerHTML = html;
}

/* ============================================================
   CHARTS  (pure SVG/DOM, no libs)
   ============================================================ */
function barChart(el, rows, opt = {}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  el.innerHTML = rows.length ? rows.map((r, i) => {
    const pct = (r.value / max) * 100;
    const color = r.color || CHART_COLORS[i % CHART_COLORS.length];
    return `<div class="bar-row">
      <div class="bl" title="${esc(r.label)}">${esc(r.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bv">${opt.suffix ? r.value + opt.suffix : r.value}</div>
    </div>`;
  }).join('') : `<div class="empty-hint">no data yet</div>`;
}

function donutChart(el, rows) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) { el.innerHTML = `<div class="empty-hint">no data yet</div>`; return; }
  let acc = 0; const R = 54, C = 2 * Math.PI * R;
  const segs = rows.map((r, i) => {
    const frac = r.value / total;
    const color = r.color || CHART_COLORS[i % CHART_COLORS.length];
    const dash = `${frac * C} ${C}`;
    const off = -acc * C; acc += frac;
    return `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${color}" stroke-width="20"
      stroke-dasharray="${dash}" stroke-dashoffset="${off}" transform="rotate(-90 70 70)"/>`;
  }).join('');
  const legend = rows.map((r, i) => {
    const color = r.color || CHART_COLORS[i % CHART_COLORS.length];
    const pct = Math.round((r.value / total) * 100);
    return `<div class="li"><span class="sw" style="background:${color}"></span>${esc(r.label)} · ${r.value} (${pct}%)</div>`;
  }).join('');
  el.innerHTML = `<div class="donut-wrap">
    <svg width="140" height="140" viewBox="0 0 140 140">${segs}
      <text x="70" y="66" text-anchor="middle" fill="var(--text)" font-size="22" font-weight="700">${total}</text>
      <text x="70" y="84" text-anchor="middle" fill="var(--text-faint)" font-size="10">total</text>
    </svg>
    <div class="legend">${legend}</div>
  </div>`;
}

function tally(items, keyFn) {
  const m = new Map();
  items.forEach(i => { const ks = keyFn(i); (Array.isArray(ks) ? ks : [ks]).forEach(k => { if (k) m.set(k, (m.get(k) || 0) + 1); }); });
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function renderCharts() {
  const items = state.items;
  const done = items.filter(i => i.status === 'done');

  // stat row
  const overdue = items.filter(i => i.status !== 'done' && i.deadline && daysUntil(i.deadline) < 0).length;
  const week = last7Dates();
  $('#statRow').innerHTML = [
    { n: items.length, l: 'Total items' },
    { n: done.length, l: 'Completed' },
    { n: overdue, l: 'Overdue' },
    { n: week.reduce((s, d) => s + karmaForDate(d), 0), l: '⚡ this week' },
  ].map(s => `<div class="stat"><div class="n">${s.n}</div><div class="l">${s.l}</div></div>`).join('');

  // bucket focus (donut)
  donutChart($('#chartBucket'), BUCKETS.map(b => ({
    label: b.short, color: b.color, value: items.filter(i => i.bucket === b.id).length
  })).filter(r => r.value));

  // status pipeline
  barChart($('#chartStatus'), STATUSES.map(s => ({
    label: s.name, color: s.color, value: items.filter(i => i.status === s.id).length
  })));

  // deadline horizon (open items)
  const open = items.filter(i => i.status !== 'done');
  const buckets = { 'Overdue': 0, 'Today–7d': 0, '8–30d': 0, '30d+': 0, 'No date': 0 };
  open.forEach(i => {
    const d = daysUntil(i.deadline);
    if (d === null) buckets['No date']++;
    else if (d < 0) buckets['Overdue']++;
    else if (d <= 7) buckets['Today–7d']++;
    else if (d <= 30) buckets['8–30d']++;
    else buckets['30d+']++;
  });
  barChart($('#chartDeadline'), Object.entries(buckets).map(([label, value], i) => ({
    label, value, color: ['#f87171','#fbbf24','#60a5fa','#4ade80','#6b7180'][i]
  })));

  // impact achieved by bucket (done items with non-empty impact)
  const impactful = done.filter(i => (i.impact || '').trim());
  barChart($('#chartImpact'), BUCKETS.map(b => ({
    label: b.short, color: b.color, value: impactful.filter(i => i.bucket === b.id).length
  })).filter(r => r.value));

  // strengths & values
  barChart($('#chartStrengths'), tally(items, i => i.strengths).slice(0, 8));
  barChart($('#chartValues'), tally(items, i => i.values).slice(0, 8));
}

/* ============================================================
   INSIGHTS  (agentic reflection engine — heuristic)
   ============================================================ */
function renderInsights() {
  const items = state.items;
  const list = $('#insightsList');
  if (!items.length) {
    list.innerHTML = `<div class="insight-card"><h4>Nothing to reflect on yet</h4><p>Add a few work items — tag their strengths, values, buckets and impact — and this page will surface patterns: what's amplifying, what's stalling, and where your focus is going.</p></div>`;
    return;
  }

  const done = items.filter(i => i.status === 'done');
  const active = items.filter(i => i.status === 'progress');
  const insights = [];

  /* --- Strengths amplifying: weight done > in-progress > planned, plus impact --- */
  const strengthScore = new Map();
  items.forEach(i => {
    const w = i.status === 'done' ? 3 : i.status === 'progress' ? 2 : 1;
    const impactBonus = (i.impact || '').trim() ? 1 : 0;
    (i.strengths || []).forEach(s => strengthScore.set(s, (strengthScore.get(s) || 0) + w + impactBonus));
  });
  const topStrengths = [...strengthScore.entries()].sort((a, b) => b[1] - a[1]);
  if (topStrengths.length) {
    insights.push({ cls: 'good', icon: '💪', title: 'Strengths getting amplified',
      body: `You keep leaning on <b>${topStrengths.slice(0, 3).map(s => esc(s[0])).join(', ')}</b> — these show up most in the work you actually finish and that carries impact. This is your compounding edge; name it explicitly in your O-1A / EB1A narrative.`,
      tags: topStrengths.slice(0, 5).map(s => ({ t: s[0], cls: 'up' })) });
  }

  /* --- Appearing as weakness: strengths declared but stuck, or rarely used --- */
  const stuckStrength = new Map(); // strengths attached mostly to non-done, aging items
  items.filter(i => i.status !== 'done').forEach(i => {
    const stale = i.createdAt && (Date.now() - i.createdAt) > 21 * 86400000;
    const overdue = i.deadline && daysUntil(i.deadline) < 0;
    if (stale || overdue) (i.strengths || []).forEach(s => stuckStrength.set(s, (stuckStrength.get(s) || 0) + 1));
  });
  const weakCandidates = [...strengthScore.keys()].filter(s => {
    const total = items.filter(i => (i.strengths || []).includes(s)).length;
    const doneCount = done.filter(i => (i.strengths || []).includes(s)).length;
    return total >= 2 && doneCount === 0;
  });
  const weakList = [...new Set([...stuckStrength.keys(), ...weakCandidates])];
  if (weakList.length) {
    insights.push({ cls: 'warn', icon: '🌱', title: 'Showing up as a weakness (or under-practiced)',
      body: `<b>${weakList.slice(0, 3).map(esc).join(', ')}</b> keep getting attached to items that stall, go overdue, or never reach done. Not necessarily a real weakness — more likely an under-practiced muscle or an area you avoid finishing. Pick one small item here and close it this week.`,
      tags: weakList.slice(0, 5).map(t => ({ t, cls: 'down' })) });
  }

  /* --- Values being achieved --- */
  const valDone = tally(done, i => i.values);
  const valAll = tally(items, i => i.values);
  if (valDone.length) {
    insights.push({ cls: 'good', icon: '❤️', title: 'Values you are actually living',
      body: `In completed work you most expressed <b>${valDone.slice(0, 3).map(v => esc(v.label)).join(', ')}</b>. These aren't aspirational — you shipped them. That alignment is worth protecting.`,
      tags: valDone.slice(0, 5).map(v => ({ t: `${v.label} ·${v.value}`, cls: 'up' })) });
  }
  // values named but never reached done
  const unrealized = valAll.filter(v => !valDone.some(d => d.label === v.label)).map(v => v.label);
  if (unrealized.length) {
    insights.push({ cls: 'warn', icon: '🕯️', title: 'Values named but not yet realized',
      body: `You've attached <b>${unrealized.slice(0, 3).map(esc).join(', ')}</b> to work, but none of it has reached done yet. Aspiration without a completed loop. Which one deserves a finished item?`,
      tags: unrealized.slice(0, 5).map(t => ({ t, cls: 'down' })) });
  }

  /* --- Focus concentration + scarcity (by bucket) --- */
  const focus = BUCKETS.map(b => ({
    b, count: items.filter(i => i.bucket === b.id).length,
    karma: state.karma.filter(k => k.bucket === b.id).reduce((s, k) => s + k.points, 0)
  }));
  const totalCount = focus.reduce((s, f) => s + f.count, 0) || 1;
  const topFocus = focus.slice().sort((a, b) => b.count - a.count)[0];
  const scarce = focus.filter(f => f.count === 0);
  const thin = focus.filter(f => f.count > 0).sort((a, b) => a.count - b.count)[0];

  if (topFocus && topFocus.count) {
    const share = Math.round((topFocus.count / totalCount) * 100);
    insights.push({ cls: '', icon: '🎯', title: 'Where your focus is concentrated',
      body: `<b>${esc(topFocus.b.short)}</b> holds ${share}% of your work items (${topFocus.count} of ${totalCount})${topFocus.karma ? ` and ${topFocus.karma} ⚡ of logged karma` : ''}. ${share > 55 ? 'That is heavy concentration — deliberate strategy, or crowding out other goals?' : 'Reasonably balanced across your buckets.'}`,
      tags: focus.filter(f => f.count).sort((a, b) => b.count - a.count).map(f => ({ t: `${f.b.short} ·${f.count}`, cls: '' })) });
  }
  if (scarce.length || thin) {
    const names = scarce.length ? scarce.map(f => f.b.short) : [thin.b.short];
    insights.push({ cls: 'scarce', icon: '🪫', title: 'Scarce — barely getting attention',
      body: scarce.length
        ? `<b>${names.map(esc).join(', ')}</b> ${names.length > 1 ? 'have' : 'has'} zero work items. If ${names.length > 1 ? 'these matter' : 'this matters'} to your goals (e.g. immigration case, research), they're currently invisible in your system.`
        : `<b>${esc(thin.b.short)}</b> is your thinnest active area (${thin.count} item${thin.count > 1 ? 's' : ''}). Easy to let it wither — decide if it's a real priority or safe to drop.`,
      tags: names.map(t => ({ t, cls: 'down' })) });
  }

  /* --- Momentum / karma note --- */
  const streak = currentStreak();
  if (streak >= 2) {
    insights.push({ cls: 'good', icon: '🔥', title: 'Momentum is real',
      body: `You're on a <b>${streak}-day</b> karma streak. Consistency is the quiet multiplier behind every strength above — protect the streak before chasing intensity.`, tags: [] });
  }

  list.innerHTML = insights.map(i => `<div class="insight-card ${i.cls}">
    <h4>${i.icon} ${i.title}</h4>
    <p>${i.body}</p>
    ${i.tags && i.tags.length ? `<div class="tags">${i.tags.map(t => `<span class="pill ${t.cls || ''}">${esc(t.t)}</span>`).join('')}</div>` : ''}
  </div>`).join('');
}

$('#refreshInsights').addEventListener('click', () => { renderInsights(); toast('Recomputed'); });

/* ============================================================
   IMPORT / EXPORT / SAMPLE
   ============================================================ */
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `compass-backup-${todayStr()}.json`;
  a.click();
  toast('Exported backup');
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.items) throw new Error('not a Compass file');
      if (!confirm('Import will replace current data. Continue?')) return;
      state = { items: data.items || [], karma: data.karma || [], meta: data.meta || {} };
      save(); renderBoard(); toast('Imported ✓');
    } catch (err) { toast('Import failed: ' + err.message); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('#seedBtn').addEventListener('click', () => {
  if (state.items.length && !confirm('Add sample data on top of what you have?')) return;
  seedSample(); save(); renderBoard(); toast('Sample data loaded');
});

function seedSample() {
  const mk = (o) => ({ id: uid(), createdAt: Date.now() - (o.age || 0) * 86400000, linked: [], strengths: [], values: [], ...o });
  const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return x.toISOString().slice(0, 10); };
  const samples = [
    mk({ title: 'Deliver TEDx talk on burnout recovery', bucket: 'speaker', subtag: 'TEDx', status: 'progress', deadline: d(20), age: 10,
        strengths: ['Public speaking', 'Storytelling'], values: ['Impact', 'Courage'], feelDuring: 'Nervous but alive', impact: 'Potential reach 1M+ views' }),
    mk({ title: 'Publish 4-part LinkedIn series on staff-eng growth', bucket: 'speaker', subtag: 'LinkedIn — schedule', status: 'done', deadline: d(-5), age: 25, completedAt: Date.now() - 4 * 86400000,
        strengths: ['Writing', 'Communication'], values: ['Community', 'Growth'], feelAfter: 'Proud, momentum', impact: '2 speaking invites, 400 new followers' }),
    mk({ title: 'Draft O-1A recommendation letter tracker', bucket: 'visa', status: 'prio', deadline: d(14), age: 6,
        strengths: ['Strategic thinking'], values: ['Legacy'] }),
    mk({ title: 'Lead cross-team platform migration', bucket: 'eng', status: 'progress', deadline: d(45), age: 30,
        strengths: ['Leadership', 'Systems design', 'Execution'], values: ['Craft', 'Excellence'], feelDuring: 'Stretched', impact: 'Unblocks 3 teams' }),
    mk({ title: 'Mentor 2 senior engineers to staff', bucket: 'eng', status: 'progress', deadline: d(90), age: 40,
        strengths: ['Mentoring', 'Empathy'], values: ['Service', 'Growth'] }),
    mk({ title: 'Read & summarize 3 papers on memory consolidation', bucket: 'research', subtag: 'Papers', status: 'tbp', deadline: d(30), age: 3,
        strengths: ['Research', 'Analysis'], values: ['Curiosity'] }),
    mk({ title: 'Outline book on engineering leadership', bucket: 'research', subtag: 'Book', status: 'tbp', deadline: '', age: 15,
        strengths: ['Writing'], values: ['Legacy', 'Craft'] }),
    mk({ title: 'Design neuroscience-of-focus lunch & learn', bucket: 'speaker', subtag: 'Lunch & Learn', status: 'done', deadline: d(-12), age: 20, completedAt: Date.now() - 12 * 86400000,
        strengths: ['Public speaking', 'Storytelling'], values: ['Community'], feelAfter: 'Energized', impact: 'Team asked for a series' }),
    mk({ title: 'Weekly reflection: what amplifies my energy', bucket: 'psych', status: 'prio', deadline: d(2), age: 4,
        strengths: ['Analysis'], values: ['Balance', 'Authenticity'] }),
  ];
  state.items.push(...samples);
  // sample karma across the week
  const week = last7Dates();
  const kmap = [['eng', [3, 0, 5, 1, 3, 0, 2]], ['speaker', [5, 3, 0, 3, 5, 1, 0]], ['research', [0, 1, 0, 0, 3, 0, 1]], ['visa', [0, 0, 1, 0, 0, 1, 0]], ['psych', [1, 1, 1, 0, 1, 1, 1]]];
  kmap.forEach(([b, arr]) => arr.forEach((p, i) => { if (p) state.karma.push({ date: week[i], bucket: b, points: p }); }));
}

/* ============================================================
   INIT
   ============================================================ */
initFilters();
initModal();
renderBoard();
renderKarmaBadge();
