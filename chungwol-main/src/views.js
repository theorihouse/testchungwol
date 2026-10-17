// HTML 조립 도우미와 공통 레이아웃 (2000년대 지자체 포털 3단 구성)
const db = require('./db');
const { kstNow, pad, weekday, daysIn, WD, lines, todayMd } = require('./util');

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = (s) => new Raw(String(s ?? ''));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(String(v));
}
function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}
const nl2br = (s) => raw(esc(String(s || '')).replace(/\n/g, '<br>'));

async function loadSettings() {
  const rows = await db.all('SELECT key, value FROM settings');
  const S = {};
  rows.forEach((r) => { S[r.key] = r.value; });
  return S;
}

// 작은 픽셀 감성 아이콘
const ICONS = {
  hall: '<rect x="3" y="9" width="18" height="11" fill="#7aa7d8" stroke="#2b4f86"/><path d="M2 9 L12 3 L22 9Z" fill="#3d6db3" stroke="#2b4f86"/><rect x="6" y="12" width="2" height="6" fill="#fff"/><rect x="11" y="12" width="2" height="6" fill="#fff"/><rect x="16" y="12" width="2" height="6" fill="#fff"/>',
  news: '<rect x="3" y="4" width="18" height="16" fill="#fff" stroke="#55657a"/><rect x="5" y="6" width="6" height="5" fill="#9fb6cf"/><path d="M13 7h6M13 10h6M5 13h14M5 16h14" stroke="#55657a"/>',
  folder: '<path d="M2 6h7l2 2h11v12H2Z" fill="#f2c55c" stroke="#a87b1c"/><rect x="2" y="10" width="20" height="10" fill="#f8d77e" stroke="#a87b1c"/>',
  case: '<rect x="3" y="7" width="18" height="13" fill="#e8b85a" stroke="#8b6216"/><rect x="9" y="4" width="6" height="3" fill="none" stroke="#8b6216"/><rect x="3" y="11" width="18" height="2" fill="#c99632"/>',
  tree: '<circle cx="12" cy="9" r="6" fill="#4fa05b" stroke="#2c6e36"/><circle cx="8" cy="12" r="4" fill="#5db86a" stroke="#2c6e36"/><circle cx="16" cy="12" r="4" fill="#5db86a" stroke="#2c6e36"/><rect x="11" y="15" width="2" height="6" fill="#8b5a2b"/>',
  apt: '<rect x="5" y="3" width="14" height="18" fill="#d8c9a8" stroke="#6d5a36"/><g fill="#6d86a8"><rect x="7" y="5" width="3" height="2"/><rect x="14" y="5" width="3" height="2"/><rect x="7" y="9" width="3" height="2"/><rect x="14" y="9" width="3" height="2"/><rect x="7" y="13" width="3" height="2"/><rect x="14" y="13" width="3" height="2"/></g><rect x="10" y="17" width="4" height="4" fill="#6d5a36"/>',
  people: '<circle cx="8" cy="8" r="3.5" fill="#f2c69b" stroke="#7a5536"/><circle cx="16" cy="8" r="3.5" fill="#f2c69b" stroke="#7a5536"/><path d="M2 20c0-5 3-7 6-7s6 2 6 7Z" fill="#4b7fc4" stroke="#2b4f86"/><path d="M10 20c0-5 3-7 6-7s6 2 6 7Z" fill="#52a66b" stroke="#2c6e36"/>',
  home: '<path d="M3 11 L12 3 L21 11" fill="#d9534f" stroke="#8a2a26"/><rect x="5" y="11" width="14" height="10" fill="#f4e3c1" stroke="#8a6a3a"/><rect x="10" y="14" width="4" height="7" fill="#a0522d"/>',
  doc: '<rect x="5" y="3" width="14" height="18" fill="#fff" stroke="#5b7aa6"/><path d="M8 8h8M8 11h8M8 14h8M8 17h5" stroke="#5b7aa6"/>',
  note: '<rect x="5" y="3" width="14" height="18" fill="#f6d35d" stroke="#9a7a12"/><rect x="5" y="3" width="3" height="18" fill="#e0a82e"/><path d="M10 8h7M10 11h7M10 14h5" stroke="#9a7a12"/>',
  mail: '<rect x="3" y="6" width="18" height="12" fill="#fff" stroke="#3d6db3"/><path d="M3 6 L12 13 L21 6" fill="none" stroke="#3d6db3"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2" fill="#5a6b80" stroke="#2f3b4a"/><rect x="9" y="5" width="6" height="8" fill="#bfe0ff"/><g fill="#dde6ef"><rect x="9" y="15" width="2" height="1.5"/><rect x="13" y="15" width="2" height="1.5"/><rect x="9" y="18" width="2" height="1.5"/><rect x="13" y="18" width="2" height="1.5"/></g>',
  speaker: '<path d="M3 9h4l6-4v14l-6-4H3Z" fill="#d9534f" stroke="#8a2a26"/><path d="M16 8c2 2 2 6 0 8M18 6c3 3 3 9 0 12" fill="none" stroke="#8a2a26" stroke-width="1.5"/>',
  arrow: '<path d="M4 8h9V4l8 8-8 8v-4H4Z" fill="#7b4bb7" stroke="#4b2a7a"/>',
  dot: '<circle cx="12" cy="12" r="6" fill="#3d6db3"/>',
};
const icon = (name, size = 22) => raw(`<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`);

function panelTitle(S, n, title) {
  const num = S.panel_numbers === 'off' ? '' : html`<span class="num">${pad(n)}</span>`;
  return html`${num}${title}`;
}

function parseMenu(text) {
  return lines(text).map((l) => { const [label, href, ico] = l.split('|').map((x) => (x || '').trim()); return { label, href: href || '#', ico }; });
}

function header(S, opts = {}) {
  const k = kstNow();
  const wd = WD[weekday(k.month, k.day, S.calendar_mode)];
  const menu = parseMenu(S.top_menu);
  return html`
<div id="header" class="box">
  <a class="logo" href="/"><img src="${S.logo_image}" alt="${S.site_name}"></a>
  <div class="hd-main">
    <div class="hd-menu">
      <strong class="hd-title">${S.top_menu_title}</strong>
      ${menu.map((m, i) => html`${i ? raw('<span class="sep">|</span>') : ''}<a href="${m.href}">${m.label}</a>`)}
      <form class="hd-search" action="/search" method="get">
        <input type="text" name="q" value="${opts.q || ''}" aria-label="검색어"><button class="btn-blue" type="submit">찾기</button>
      </form>
    </div>
    <div class="hd-sub">
      <span class="today">${k.month}월 ${k.day}일 (${wd})</span><span class="sep">|</span>
      <span>오늘의 안내 : ${S.today_notice}</span>
      <span class="hd-links">
        <a href="javascript:void(0)" onclick="cwZoom(1)">화면크기 ＋</a> <a href="javascript:void(0)" onclick="cwZoom(-1)">－</a>
        <span class="sep">|</span><a href="/">홈으로</a><span class="sep">|</span><a href="/sitemap">사이트맵</a>
        ${opts.user && opts.user.role === 'admin' ? html`<span class="sep">|</span><a class="admin-link" href="/admin">관리자</a>` : ''}
      </span>
    </div>
  </div>
</div>`;
}

function calendar(S, events) {
  const k = kstNow();
  const mode = S.calendar_mode;
  const first = weekday(k.month, 1, mode);
  const n = daysIn(k.month, mode);
  const marked = new Set(events.map((e) => e.md));
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(html`<td></td>`);
  for (let d = 1; d <= n; d++) {
    const wd = (first + d - 1) % 7;
    const md = `${pad(k.month)}-${pad(d)}`;
    const cls = [wd === 0 ? 'sun' : '', wd === 6 ? 'sat' : '', d === k.day ? 'today' : '', marked.has(md) ? 'ev' : ''].join(' ');
    cells.push(html`<td class="${cls}">${d}</td>`);
  }
  while (cells.length % 7) cells.push(html`<td></td>`);
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(html`<tr>${cells.slice(i, i + 7)}</tr>`);
  return html`
<div class="box panel cal">
  <div class="ph">${icon('dot', 14)} <b>이달의 일정</b> <span class="cal-m">${k.month}월</span></div>
  <table class="cal-t"><thead><tr><th class="sun">일</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th class="sat">토</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="cal-ev"><b>▶ 주요 일정</b>
    <ul>${events.slice(0, 6).map((e) => html`<li><span class="d">${e.md.replace('-', '.')}</span> ${e.title}</li>`)}</ul>
    ${events.length ? '' : html`<p class="muted">이달 일정이 없습니다.</p>`}
  </div>
</div>`;
}

async function monthEvents() {
  const k = kstNow();
  return db.all('SELECT * FROM schedule WHERE md LIKE ? ORDER BY md', [`${pad(k.month)}-%`]);
}

function leftCol(S, req, events) {
  const menu = parseMenu(S.left_menu);
  const a = req.agent;
  return html`
<div id="left">
  <div class="box quick">
    <div class="quick-h">${icon('arrow', 20)} ${S.site_name} 바로가기</div>
    <ul>${menu.map((m) => html`<li><a href="${m.href}">${icon(m.ico, 22)}<span>${m.label}</span></a></li>`)}</ul>
  </div>
  ${req.user ? html`
  <div class="box agentbox">
    <div class="ab-top"><b>${a && a.name ? a.name : req.user.username}</b> 님 <form method="post" action="/logout" class="inline"><button class="btn-small">로그아웃</button></form></div>
    <ul>
      <li><span class="k">▸ 소속</span> ${a && a.dept || '-'}</li>
      <li><span class="k">▸ 직급</span> ${a && a.rank || '-'} <span class="lv">Lv.${a ? a.level : 1}</span></li>
      <li><span class="k">▸ 오늘의 근무</span> <span class="shift">${a && a.shift || '-'}</span></li>
    </ul>
    <div class="ab-links"><a href="/profile">내 정보 수정</a> | <a href="/house">내 사택</a> | <a href="/messages">쪽지함</a></div>
  </div>` : ''}
  ${calendar(S, events)}
</div>`;
}

function footer(S) {
  return html`<div id="footer"><img src="${S.logo_image}" alt="" class="ft-logo"><p>${nl2br(S.footer_text)}</p></div>`;
}

function doc({ title, body, S, bodyClass = '', head = '' }) {
  return '<!DOCTYPE html>' + html`
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title ? `${title} - ` : ''}${S.site_name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">${raw(head)}
</head><body class="${bodyClass}"><div id="wrap">${body}</div><script src="/js/common.js"></script></body></html>`.s;
}

// 로그인 후 일반 화면: 상단 + 왼쪽 + 본문
async function portalPage(req, { title, main, q }) {
  const S = req.S;
  const events = await monthEvents();
  return doc({
    title, S,
    body: html`${header(S, { user: req.user, q })}<div id="cols2">${leftCol(S, req, events)}<div id="content">${main}</div></div>${footer(S)}`,
  });
}

// 로그인 전·등록 화면: 상단 + 가운데 상자
function simplePage(req, { title, main }) {
  const S = req.S;
  return doc({ title, S, bodyClass: 'simple', body: html`${header(S, { user: req.user })}<div id="single">${main}</div>${footer(S)}` });
}

function stepBar(n) {
  const steps = ['계정 등록', '요원 정보 작성', '계약 및 사택 배정'];
  return html`<ol class="steps">${steps.map((s, i) => html`<li class="${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}"><span>STEP ${i + 1}</span>${s}</li>`)}</ol>`;
}

const msgBox = (m, kind = 'err') => (m ? html`<div class="msg ${kind}">${m}</div>` : '');

module.exports = { html, raw, esc, nl2br, icon, loadSettings, panelTitle, parseMenu, portalPage, simplePage, doc, header, leftCol, monthEvents, footer, stepBar, msgBox, todayMd };
