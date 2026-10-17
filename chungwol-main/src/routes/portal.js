// 로그인 후 포털: 메인, 게시판·뉴스, 내 사택, 내 정보, 쪽지, 검색, 입주 프롤로그
const express = require('express');
const db = require('../db');
const auth = require('../auth');
const { nowIso, postDate, timeLabel, todayMd, lines } = require('../util');
const v = require('../views');
const { html, raw, nl2br, icon, panelTitle, portalPage } = v;
const { houseResult, agentFields, readAgent } = require('./public');

const r = express.Router();
const BOARDS = {
  news: { name: '충월소식', write: false },
  notice: { name: '공지사항', write: false },
  life: { name: '생활소식', write: false },
  work: { name: '요원 업무게시판', write: false },
  free: { name: '자유게시판 (직원 전용)', write: true },
};
const STATUS_CLS = { 접수중: 's-new', 확인중: 's-check', 처리중: 's-doing', 완료: 's-done' };

const ORDER = 'ORDER BY md DESC, id DESC';
const listPosts = (board, limit) => db.all(`SELECT * FROM posts WHERE board = ? ${ORDER} LIMIT ${Number(limit)}`, [board]);

// ── 메인 ──────────────────────────────────────────
r.get('/', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const S = req.S;
  const [featured, notice, life, news, work, free, events, online] = await Promise.all([
    db.all(`SELECT * FROM posts WHERE board = 'news' AND featured = 1 ${ORDER} LIMIT 4`),
    listPosts('notice', 9), listPosts('life', 9), listPosts('news', 9), listPosts('work', 5), listPosts('free', 4),
    v.monthEvents(),
    db.all("SELECT u.username, a.name FROM users u LEFT JOIN agents a ON a.user_id = u.id WHERE u.last_seen > ? ORDER BY u.last_seen DESC LIMIT 12",
      [new Date(Date.now() - 5 * 60 * 1000).toISOString()]),
  ]);
  const unread = await db.get('SELECT COUNT(*) AS n FROM messages WHERE to_id = ? AND read_at IS NULL', [req.user.id]);

  const tabList = (posts, board) => html`<ul class="newslist">${posts.map((p, i) => html`
    <li class="${i < 3 ? 'lead' : ''}"><a href="/post/${p.id}">${p.title}</a><span class="d">${postDate(p)}</span>
    ${i < 3 && p.summary ? html`<p>· ${p.summary}</p>` : ''}</li>`)}
    ${posts.length ? '' : html`<li class="muted">등록된 글이 없습니다.</li>`}</ul>`;

  const center = html`
<div id="center">
  <div class="box panel tabs" data-tabs>
    <div class="tab-h">
      <button class="tab on" data-tab="t1">${panelTitle(S, 1, '충월소식')}</button>
      <button class="tab" data-tab="t2">공지사항</button>
      <button class="tab" data-tab="t3">생활소식</button>
      <a class="more" href="/board/news">⊞ 더보기</a>
    </div>
    <div class="tab-b on" id="t1">
      <div class="photo-news">${featured.map((p) => html`
        <a href="/post/${p.id}" class="pn"><img src="${p.image || '/img/news-apt.jpg'}" alt=""><b>${p.title}</b><span>… ${p.summary}</span></a>`)}</div>
      ${tabList(notice, 'notice')}
    </div>
    <div class="tab-b" id="t2">${tabList(notice, 'notice')}</div>
    <div class="tab-b" id="t3">${tabList(life, 'life')}</div>
  </div>

  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 2, '요원 업무게시판')}</b><span class="ph-r"><a href="/board/work">전체글보기</a> | <a href="/board/free/write">새 글 쓰기</a></span></div>
    <table class="list-t">
      <thead><tr><th class="w-ico"></th><th class="w-cat">구분</th><th>제목</th><th class="w-st">상태</th><th class="w-d">등록일</th></tr></thead>
      <tbody>${work.map((p) => html`<tr><td>${icon('folder', 16)}</td><td>${p.category}</td><td class="tl"><a href="/post/${p.id}">${p.title}</a></td>
        <td class="${STATUS_CLS[p.status] || ''}">${p.status}</td><td>${postDate(p)}</td></tr>`)}</tbody>
    </table>
  </div>

  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 3, '자유게시판')}</b> <span class="small">(직원 전용)</span><span class="ph-r"><a href="/board/free">⊞ 더보기</a></span></div>
    <ul class="newslist pb">${free.map((p) => html`<li><a href="/post/${p.id}">${p.title}</a><span class="d">${postDate(p)}</span></li>`)}</ul>
  </div>
</div>`;

  const svc = [['home', '내 사택', '/house'], ['doc', '업무 확인', '/board/work'], ['note', '직원수첩', '/profile'],
    ['mail', `쪽지함${Number(unread.n) ? ` (${unread.n})` : ''}`, '/messages'], ['people', '직원게시판', '/board/free'], ['phone', '시청 연락처', '/pending/시청 연락처']];
  const right = html`
<div id="right">
  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 4, '직원 서비스')}</b><span class="ph-r small"><a href="/profile">개인정보변경</a> | <a href="/sitemap">사이트맵</a></span></div>
    <div class="svc">${svc.map(([ic, label, href]) => html`<a href="${href}" class="svc-b">${icon(ic, 26)}<span>${label}</span></a>`)}</div>
  </div>
  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 5, '오늘의 날씨')}</b> <span class="small">(${S.site_name})</span></div>
    <div class="pb weather"><span class="sun-ico"></span><b>${S.site_name}</b> <span class="temp">${S.weather_today}</span><span class="tmr">${S.weather_tomorrow}</span></div>
  </div>
  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 6, `${S.site_name} 안내도`)}</b></div>
    <div class="map"><img src="${S.map_image}" alt="안내도"></div>
  </div>
  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 7, S.house_complex)}</b><span class="ph-r"><a href="/house">⊞ 더보기</a></span></div>
    <div class="apt"><img src="${S.apt_image}" alt=""><p><b>${S.house_complex}</b><br>${S.apt_caption}</p></div>
  </div>
  <div class="box panel">
    <div class="ph"><b>${panelTitle(S, 8, '시청 알림판')}</b></div>
    <div class="bulletin">${icon('speaker', 40)}<div><b>${S.bulletin_title}</b><p>${nl2br(S.bulletin_body)}</p></div></div>
  </div>
  <div class="box panel">
    <div class="ph"><b>지금 접속 중인 직원</b> <span class="small">(${online.length}명)</span></div>
    <div class="pb small online">${online.map((o) => html`<span>● ${o.name || o.username}</span>`)}</div>
  </div>
</div>`;

  res.send(v.doc({
    title: '', S,
    body: html`${v.header(S, { user: req.user })}<div id="cols3">${v.leftCol(S, req, events)}${center}${right}</div>${v.footer(S)}`,
  }));
});

// ── 게시판 ──────────────────────────────────────────
r.get('/board/:board', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const b = BOARDS[req.params.board];
  if (!b) return res.redirect('/');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const per = 15;
  const posts = await db.all(`SELECT p.*, (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS cc FROM posts p WHERE board = ? ${ORDER} LIMIT ${per} OFFSET ${(page - 1) * per}`, [req.params.board]);
  const total = Number((await db.get('SELECT COUNT(*) AS n FROM posts WHERE board = ?', [req.params.board])).n);
  const pages = Math.max(1, Math.ceil(total / per));
  const isWork = req.params.board === 'work';
  res.send(await portalPage(req, {
    title: b.name,
    main: html`
<div class="box panel">
  <div class="ph"><b>${b.name}</b><span class="ph-r">전체 ${total}건 ${b.write ? html` | <a href="/board/${req.params.board}/write">새 글 쓰기</a>` : ''}</span></div>
  <table class="list-t">
    <thead><tr><th class="w-no">번호</th>${isWork ? html`<th class="w-cat">구분</th>` : ''}<th>제목</th>${isWork ? html`<th class="w-st">상태</th>` : html`<th class="w-cat">작성자</th>`}<th class="w-d">등록일</th><th class="w-no">조회</th></tr></thead>
    <tbody>${posts.map((p, i) => html`<tr><td>${total - (page - 1) * per - i}</td>${isWork ? html`<td>${p.category}</td>` : ''}
      <td class="tl"><a href="/post/${p.id}">${p.title}</a>${Number(p.cc) ? html` <span class="cc">[${p.cc}]</span>` : ''}</td>
      ${isWork ? html`<td class="${STATUS_CLS[p.status] || ''}">${p.status}</td>` : html`<td>${p.author_name}</td>`}<td>${postDate(p)}</td><td>${p.views}</td></tr>`)}
    ${posts.length ? '' : html`<tr><td colspan="6">등록된 글이 없습니다.</td></tr>`}</tbody>
  </table>
  <div class="paging">${Array.from({ length: pages }, (_, i) => i + 1).map((n) => (n === page ? html`<b>${n}</b>` : html`<a href="?page=${n}">${n}</a>`))}</div>
</div>`,
  }));
});

r.get('/board/:board/write', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const b = BOARDS[req.params.board];
  if (!b || !b.write) return res.redirect('/board/' + req.params.board);
  res.send(await portalPage(req, {
    title: '글쓰기',
    main: html`
<form method="post" action="/board/${req.params.board}/write" class="box panel">
  <div class="ph"><b>${b.name} 글쓰기</b></div>
  <div class="pb"><table class="form-t wide">
    <tr><th>제목</th><td><input type="text" name="title" required maxlength="100"></td></tr>
    <tr><th>내용</th><td><textarea name="body" rows="12" required maxlength="5000"></textarea></td></tr>
  </table><div class="btns"><button class="btn-blue big">등록</button> <a class="btn" href="/board/${req.params.board}">목록</a></div></div>
</form>`,
  }));
});
r.post('/board/:board/write', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const b = BOARDS[req.params.board];
  if (!b || !b.write) return res.redirect('/');
  const title = String(req.body.title || '').trim().slice(0, 100);
  const body = String(req.body.body || '').slice(0, 5000);
  if (!title) return res.redirect(`/board/${req.params.board}/write`);
  const rows = await db.run('INSERT INTO posts (board, title, body, author_id, author_name, md, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
    [req.params.board, title, body, req.user.id, req.agent.name || req.user.username, todayMd(), nowIso()]);
  res.redirect('/post/' + rows[0].id);
});

// ── 글 보기 (뉴스는 기사 형식) ──────────────────────────────────────────
r.get('/post/:id', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const p = await db.get('SELECT * FROM posts WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!p) return res.redirect('/');
  await db.run('UPDATE posts SET views = views + 1 WHERE id = ?', [p.id]);
  const comments = await db.all('SELECT * FROM comments WHERE post_id = ? ORDER BY id', [p.id]);
  const related = await db.all(`SELECT * FROM posts WHERE board = ? AND id <> ? ${ORDER} LIMIT 5`, [p.board, p.id]);
  const b = BOARDS[p.board] || { name: '' };
  const canEdit = req.user.role === 'admin' || (p.author_id && p.author_id === req.user.id);
  const isNews = p.board === 'news';
  res.send(await portalPage(req, {
    title: p.title,
    main: html`
<div class="box panel article">
  <div class="ph"><b>${b.name}</b>${p.category ? html` <span class="small">› ${p.category}</span>` : ''}
    <span class="ph-r small"><a href="javascript:window.print()">인쇄</a> | <a href="javascript:void(0)" onclick="cwZoom(1)">글자 크게</a> | <a href="javascript:void(0)" onclick="cwZoom(-1)">작게</a></span></div>
  <div class="pb">
    <h1 class="a-title">${p.title}</h1>
    ${isNews && p.summary ? html`<p class="a-sub">${p.summary}</p>` : ''}
    <div class="a-meta">${isNews ? '충월지역소식' : p.author_name} · ${postDate(p)} · 조회 ${Number(p.views) + 1}
      ${p.status ? html` · 상태 <b class="${STATUS_CLS[p.status] || ''}">${p.status}</b>` : ''}</div>
    ${p.image ? html`<div class="a-img"><img src="${p.image}" alt=""></div>` : ''}
    <div class="a-body">${nl2br(p.body)}</div>
    ${canEdit ? html`<form method="post" action="/post/${p.id}/delete" class="right" onsubmit="return confirm('삭제할까요?')"><button class="btn-small">삭제</button></form>` : ''}
  </div>
</div>
<div class="box panel">
  <div class="ph"><b>${isNews ? '독자의견' : '댓글'}</b> <span class="small">(${comments.length})</span></div>
  <ul class="comments pb">${comments.map((c) => html`<li><b>${c.author_name}</b> <span class="d">${timeLabel(c.created_at)}</span>
    ${req.user.role === 'admin' || c.user_id === req.user.id ? html`<form method="post" action="/comment/${c.id}/delete" class="inline"><button class="link-btn">삭제</button></form>` : ''}
    <p>${nl2br(c.body)}</p></li>`)}
    ${comments.length ? '' : html`<li class="muted">첫 의견을 남겨 주십시오.</li>`}</ul>
  <form method="post" action="/post/${p.id}/comment" class="cmt-form pb"><textarea name="body" rows="2" required maxlength="1000" placeholder="의견을 입력하십시오."></textarea><button class="btn-blue">등록</button></form>
</div>
<div class="box panel"><div class="ph"><b>관련 글</b></div>
  <ul class="newslist pb">${related.map((x) => html`<li><a href="/post/${x.id}">${x.title}</a><span class="d">${postDate(x)}</span></li>`)}</ul></div>`,
  }));
});
r.post('/post/:id/comment', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  const body = String(req.body.body || '').trim().slice(0, 1000);
  if (body && (await db.get('SELECT id FROM posts WHERE id = ?', [id]))) {
    await db.run('INSERT INTO comments (post_id, user_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, req.agent.name || req.user.username, body, nowIso()]);
  }
  res.redirect('/post/' + id);
});
r.post('/post/:id/delete', auth.requireUser, async (req, res) => {
  const p = await db.get('SELECT * FROM posts WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (p && (req.user.role === 'admin' || p.author_id === req.user.id)) {
    await db.run('DELETE FROM comments WHERE post_id = ?', [p.id]);
    await db.run('DELETE FROM posts WHERE id = ?', [p.id]);
    return res.redirect('/board/' + p.board);
  }
  res.redirect('/');
});
r.post('/comment/:id/delete', auth.requireUser, async (req, res) => {
  const c = await db.get('SELECT * FROM comments WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (c && (req.user.role === 'admin' || c.user_id === req.user.id)) await db.run('DELETE FROM comments WHERE id = ?', [c.id]);
  res.redirect(c ? '/post/' + c.post_id : '/');
});

// ── 검색 ──────────────────────────────────────────
r.get('/search', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  const like = `%${q.replace(/[%_]/g, '')}%`;
  const rows = q ? await db.all(`SELECT * FROM posts WHERE title LIKE ? OR body LIKE ? ${ORDER} LIMIT 50`, [like, like]) : [];
  res.send(await portalPage(req, {
    title: '검색', q,
    main: html`<div class="box panel"><div class="ph"><b>통합검색</b><span class="ph-r">"${q}" 검색 결과 ${rows.length}건</span></div>
      <ul class="newslist pb">${rows.map((p) => html`<li><span class="small muted">[${(BOARDS[p.board] || {}).name}]</span> <a href="/post/${p.id}">${p.title}</a><span class="d">${postDate(p)}</span></li>`)}
      ${rows.length ? '' : html`<li class="muted">검색 결과가 없습니다.</li>`}</ul></div>`,
  }));
});

// ── 내 사택 / 내 정보 ──────────────────────────────────────────
r.get('/house', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const a = req.agent;
  const neighbors = a.house_dong ? await db.all('SELECT name, house_ho, intro FROM agents WHERE house_dong = ? AND user_id <> ? ORDER BY house_ho', [a.house_dong, req.user.id]) : [];
  res.send(await portalPage(req, {
    title: '내 사택',
    main: a.house_dong ? html`${houseResult(req, a, false)}
      <div class="box panel"><div class="ph"><b>같은 동의 요원</b></div><ul class="pb dotlist">${neighbors.map((n) => html`<li>${n.house_ho}호 · ${n.name} ${n.intro ? html`<span class="muted">— ${n.intro}</span>` : ''}</li>`)}
      ${neighbors.length ? '' : html`<li class="muted">같은 동에 등록된 다른 요원이 없습니다. 대부분은 일반 주민입니다.</li>`}</ul></div>
      <div class="btns"><a class="btn" href="/prologue?replay=1">입주 프롤로그 다시 보기</a></div>`
      : html`<div class="box panel"><div class="pb">배정된 사택이 없습니다.</div></div>`,
  }));
});

r.get('/profile', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  res.send(await portalPage(req, { title: '내 정보 수정', main: profileMain(req, null, req.agent) }));
});
function profileMain(req, msg, a) {
  const S = req.S;
  return html`<form method="post" action="/profile" class="box panel"><div class="ph"><b>직원수첩 · 내 정보 수정</b></div><div class="pb">
    ${msg ? v.msgBox(msg[1], msg[0]) : ''}
    <table class="form-t wide view"><tr><th>아이디</th><td>${req.user.username}</td></tr><tr><th>소속 / 직급</th><td>${req.agent.dept} / ${req.agent.rank} (Lv.${req.agent.level}, 경험치 ${req.agent.exp})</td></tr>
    <tr><th>사택</th><td>${S.house_complex} ${req.agent.house_dong}동 ${req.agent.house_ho}호</td></tr></table>
    ${agentFields(S, a)}
    <table class="form-t wide"><tr><th>새 비밀번호</th><td><input type="password" name="new_password" minlength="8"><div class="hint">바꿀 때만 입력 (8자 이상)</div></td></tr></table>
    <div class="btns"><button class="btn-blue big">저장</button></div></div></form>`;
}
r.post('/profile', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const { v: a, err } = readAgent(req.S, req.body);
  if (err) return res.status(400).send(await portalPage(req, { title: '내 정보 수정', main: profileMain(req, ['err', err], a) }));
  await db.run('UPDATE agents SET name = ?, age = ?, prev_job = ?, intro = ?, motive = ?, avatar = ? WHERE user_id = ?',
    [a.name, a.age, a.prev_job, a.intro, a.motive, a.avatar, req.user.id]);
  const np = String(req.body.new_password || '');
  if (np && np.length >= 8) await db.run('UPDATE users SET pw_hash = ? WHERE id = ?', [require('../auth').hashPassword(np), req.user.id]);
  req.agent = await db.get('SELECT * FROM agents WHERE user_id = ?', [req.user.id]);
  res.send(await portalPage(req, { title: '내 정보 수정', main: profileMain(req, ['ok', '저장했습니다.'], req.agent) }));
});

// ── 쪽지함 ──────────────────────────────────────────
r.get('/messages', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const inbox = await db.all('SELECT m.*, u.username, a.name FROM messages m LEFT JOIN users u ON u.id = m.from_id LEFT JOIN agents a ON a.user_id = m.from_id WHERE m.to_id = ? ORDER BY m.id DESC LIMIT 50', [req.user.id]);
  const agents = await db.all("SELECT u.username, a.name FROM users u JOIN agents a ON a.user_id = u.id WHERE u.id <> ? AND u.status = 'active' AND a.onboarding = 'done' ORDER BY a.name", [req.user.id]);
  await db.run('UPDATE messages SET read_at = ? WHERE to_id = ? AND read_at IS NULL', [nowIso(), req.user.id]);
  res.send(await portalPage(req, {
    title: '쪽지함',
    main: html`
<div class="box panel"><div class="ph"><b>받은 쪽지</b></div>
  <table class="list-t"><thead><tr><th class="w-cat">보낸 사람</th><th>내용</th><th class="w-d">받은 시각</th></tr></thead>
  <tbody>${inbox.map((m) => html`<tr class="${m.read_at ? '' : 'unread'}"><td>${m.name || m.username || '알 수 없음'}</td><td class="tl"><b>${m.title}</b><br>${nl2br(m.body)}</td><td>${timeLabel(m.created_at)}</td></tr>`)}
  ${inbox.length ? '' : html`<tr><td colspan="3">받은 쪽지가 없습니다.</td></tr>`}</tbody></table></div>
<form method="post" action="/messages" class="box panel"><div class="ph"><b>쪽지 보내기</b></div><div class="pb">
  <table class="form-t wide"><tr><th>받는 직원</th><td><select name="to" required>${agents.map((x) => html`<option value="${x.username}">${x.name} (${x.username})</option>`)}</select></td></tr>
  <tr><th>제목</th><td><input type="text" name="title" required maxlength="60"></td></tr>
  <tr><th>내용</th><td><textarea name="body" rows="4" required maxlength="1000"></textarea></td></tr></table>
  <div class="btns"><button class="btn-blue">보내기</button></div></div></form>`,
  }));
});
r.post('/messages', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const to = await db.get('SELECT id FROM users WHERE username = ?', [String(req.body.to || '')]);
  const title = String(req.body.title || '').trim().slice(0, 60);
  const body = String(req.body.body || '').trim().slice(0, 1000);
  if (to && title && body) await db.run('INSERT INTO messages (from_id, to_id, title, body, created_at) VALUES (?, ?, ?, ?, ?)', [req.user.id, to.id, title, body, nowIso()]);
  res.redirect('/messages');
});

// ── 사이트맵 / 준비 중 ──────────────────────────────────────────
r.get('/sitemap', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  const links = [['메인', '/'], ...Object.entries(BOARDS).map(([k, b]) => [b.name, '/board/' + k]), ['내 사택', '/house'], ['직원수첩·내 정보', '/profile'], ['쪽지함', '/messages'], ['입주 프롤로그 다시 보기', '/prologue?replay=1']];
  res.send(await portalPage(req, { title: '사이트맵', main: html`<div class="box panel"><div class="ph"><b>사이트맵</b></div><ul class="pb dotlist">${links.map(([l, h]) => html`<li><a href="${h}">${l}</a></li>`)}</ul></div>` }));
});
r.get('/pending/:name', auth.requireUser, auth.requireOnboarded, async (req, res) => {
  res.send(await portalPage(req, { title: req.params.name, main: html`<div class="box panel"><div class="ph"><b>${req.params.name}</b></div><div class="pb pending">${icon('doc', 40)}<p><b>해당 서비스는 준비 중입니다.</b><br>이용에 불편을 드려 죄송합니다.</p></div></div>` }));
});

// ── 입주 프롤로그 (비주얼노벨) ──────────────────────────────────────────
async function loadScript() {
  return db.all('SELECT * FROM vn_nodes ORDER BY sort, id');
}
r.get('/prologue', auth.requireUser, async (req, res) => {
  const a = req.agent;
  if (a.onboarding !== 'prologue' && !(a.onboarding === 'done' && req.query.replay)) return res.redirect('/');
  const S = req.S;
  const nodes = await loadScript();
  const ctx = { name: a.name || req.user.username, house: `${S.house_complex} ${a.house_dong || '000'}동 ${a.house_ho || '000'}호`, complex: S.house_complex };
  const fill = (s) => String(s || '').replace(/\{(name|house|complex)\}/g, (_, k) => ctx[k]);
  const script = nodes.map((n) => ({
    id: n.id, step: n.step, location: fill(n.location), bg: n.bg || S.vn_default_bg,
    sprite: n.sprite === 'npc' ? S.vn_npc_image : n.sprite || '', speaker: fill(n.speaker), text: fill(n.text),
    choices: lines(n.choices).map((l) => { const [label, next] = l.split('|'); return { label: fill(label), next: (next || '').trim() }; }),
    next: n.next || '',
  }));
  const replay = a.onboarding === 'done';
  const data = { script, start: (!replay && a.prologue_node) || (script[0] && script[0].id), steps: lines(S.vn_steps), replay,
    log: replay ? [] : JSON.parse(a.prologue_log || '[]') };
  res.send(v.doc({
    title: '입주 프롤로그', S, bodyClass: 'vn-body',
    body: html`${v.header(S, { user: req.user })}
<div id="vn-wrap">
  <div class="box vn-stage" id="vn-stage">
    <div class="vn-bg" id="vn-bg"></div>
    <img class="vn-sprite" id="vn-sprite" alt="">
    <div class="vn-loc" id="vn-loc"></div>
    <div class="vn-dialog" id="vn-dialog">
      <div class="vn-name" id="vn-name"></div>
      <div class="vn-text" id="vn-text"></div>
      <div class="vn-next" id="vn-next">▼</div>
    </div>
    <ol class="vn-choices" id="vn-choices"></ol>
  </div>
  <div class="vn-side">
    <div class="box panel"><div class="ph"><b>현재 위치</b></div><div class="pb" id="vn-where"></div></div>
    <div class="box panel"><div class="ph"><b>입주 단계</b></div><ol class="pb vn-steps" id="vn-steps"></ol></div>
    <div class="box panel"><div class="pb vn-btns">
      <button class="btn" type="button" id="vn-log-btn">대화 기록</button>
      <a class="btn" href="${replay ? '/house' : '/'}" id="vn-exit">잠시 나가기</a>
    </div></div>
    <div class="box panel small"><div class="pb muted">클릭·스페이스·엔터로 다음 대사, 숫자 키로 선택지를 고릅니다.</div></div>
  </div>
</div>
<div class="vn-log" id="vn-log" hidden><div class="box panel"><div class="ph"><b>대화 기록</b><button class="btn-small ph-r" id="vn-log-close">닫기</button></div><div class="pb" id="vn-log-body"></div></div></div>
<script id="vn-data" type="application/json">${raw(JSON.stringify(data).replace(/</g, '\\u003c'))}</script>
<script src="/js/vn.js"></script>`,
  }));
});
r.post('/api/prologue', auth.requireUser, async (req, res) => {
  const a = req.agent;
  if (a.onboarding !== 'prologue') return res.json({ ok: true, replay: true });
  const node = String(req.body.node || '');
  const log = Array.isArray(req.body.log) ? req.body.log.slice(-200).map((x) => ({ s: String(x.s || '').slice(0, 40), t: String(x.t || '').slice(0, 500) })) : [];
  if (req.body.done) {
    await db.run("UPDATE agents SET onboarding = 'done', prologue_done = 1, prologue_node = NULL, prologue_log = ? WHERE user_id = ?", [JSON.stringify(log), req.user.id]);
    return res.json({ ok: true, done: true });
  }
  if (!(await db.get('SELECT id FROM vn_nodes WHERE id = ?', [node]))) return res.status(400).json({ ok: false });
  await db.run('UPDATE agents SET prologue_node = ?, prologue_log = ? WHERE user_id = ?', [node, JSON.stringify(log), req.user.id]);
  res.json({ ok: true });
});

// 관리자가 올린 이미지
r.get('/media/:id', auth.requireGate, async (req, res) => {
  const img = await db.get('SELECT mime, data FROM images WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!img) return res.status(404).end();
  res.set('Content-Type', img.mime).set('Cache-Control', 'public, max-age=86400').send(Buffer.from(img.data, 'base64'));
});

module.exports = { router: r, BOARDS };
