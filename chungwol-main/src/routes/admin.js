// 관리자 페이지: 사이트 문구·이미지, 게시물, 일정, 초대 코드, 회원, 이미지 보관함, 입주 프롤로그 대본
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../auth');
const { SETTINGS } = require('../seed');
const { nowIso, postDate, timeLabel } = require('../util');
const v = require('../views');
const { html, nl2br } = v;
const { BOARDS } = require('./portal');

const r = express.Router();
r.use(auth.requireUser, auth.requireAdmin);

const NAV = [['/admin', '대시보드'], ['/admin/settings', '사이트 문구·이미지'], ['/admin/posts', '게시물 관리'], ['/admin/schedule', '일정 관리'],
  ['/admin/vn', '입주 프롤로그 대본'], ['/admin/images', '이미지 보관함'], ['/admin/invites', '초대 코드'], ['/admin/users', '회원 관리']];

function page(req, title, main) {
  const S = req.S;
  return v.doc({
    title: `관리자 · ${title}`, S, bodyClass: 'admin',
    body: html`
<div id="admin-top" class="box"><a href="/admin"><img src="${S.logo_image}" alt=""></a><b>관리자 페이지</b>
  <span class="ph-r"><a href="/">사이트 보기</a> | ${req.user.username} 님 <form method="post" action="/logout" class="inline"><button class="btn-small">로그아웃</button></form></span></div>
<div id="admin-cols">
  <ul class="box admin-nav">${NAV.map(([h, l]) => html`<li><a href="${h}" class="${navOn(req, h) ? 'on' : ''}">${l}</a></li>`)}</ul>
  <div id="admin-main">${req.query.ok ? v.msgBox(req.query.ok, 'ok') : ''}${main}</div>
</div>
<script src="/js/admin.js"></script>`,
  });
}
const navOn = (req, h) => { const p = (req.baseUrl + req.path).replace(/\/$/, ''); return p === h || (h !== '/admin' && p.startsWith(h)); };
const back = (res, path, msg) => res.redirect(path + (path.includes('?') ? '&' : '?') + 'ok=' + encodeURIComponent(msg || '저장했습니다.'));

// ── 대시보드 ──
r.get('/', async (req, res) => {
  const c = async (sql, p = []) => Number((await db.get(sql, p)).n);
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const stats = [
    ['전체 회원', await c('SELECT COUNT(*) AS n FROM users')],
    ['프롤로그 완료', await c("SELECT COUNT(*) AS n FROM agents WHERE onboarding = 'done'")],
    ['지금 접속', await c('SELECT COUNT(*) AS n FROM users WHERE last_seen > ?', [since])],
    ['게시물', await c('SELECT COUNT(*) AS n FROM posts')],
    ['댓글', await c('SELECT COUNT(*) AS n FROM comments')],
    ['활성 초대 코드', await c('SELECT COUNT(*) AS n FROM invites WHERE active = 1')],
  ];
  const recent = await db.all('SELECT u.*, a.name, a.onboarding FROM users u LEFT JOIN agents a ON a.user_id = u.id ORDER BY u.id DESC LIMIT 8');
  res.send(page(req, '대시보드', html`
<div class="box panel"><div class="ph"><b>현황</b></div><div class="pb stats">${stats.map(([l, n]) => html`<div class="stat"><span>${l}</span><b>${n}</b></div>`)}</div></div>
<div class="box panel"><div class="ph"><b>최근 가입</b></div><table class="list-t"><thead><tr><th>아이디</th><th>요원 이름</th><th>진행 단계</th><th>초대 코드</th><th>가입</th></tr></thead>
<tbody>${recent.map((u) => html`<tr><td>${u.username}</td><td>${u.name || '-'}</td><td>${ONBOARD_LABEL[u.onboarding] || u.onboarding}</td><td>${u.invite_code}</td><td>${timeLabel(u.created_at)}</td></tr>`)}</tbody></table></div>
<div class="box panel"><div class="ph"><b>안내</b></div><div class="pb small">기획서에서 <b>미정</b>인 항목(계약 기관·부서명, 사택 동·호수 범위, 캐릭터 최소 나이, 달력 요일 기준, 약관·계약 문안, 프롤로그 대사)은 모두 가안으로 들어가 있으며 이 관리자 페이지에서 바꿀 수 있습니다.</div></div>`));
});
const ONBOARD_LABEL = { profile: '요원 정보 작성 전', contract: '계약 전', assigned: '사택 배정됨', prologue: '프롤로그 진행 중', done: '완료' };

// ── 사이트 문구·이미지 ──
const GROUPS = [...new Set(SETTINGS.map((s) => s.group))];
r.get('/settings', async (req, res) => {
  const group = GROUPS.includes(req.query.group) ? req.query.group : GROUPS[0];
  const S = req.S;
  const images = await db.all('SELECT id, name FROM images ORDER BY id DESC');
  const field = (s) => {
    const val = S[s.key] ?? '';
    if (s.type === 'textarea' || s.type === 'lines') return html`<textarea name="${s.key}" rows="${s.type === 'lines' ? 6 : 4}">${val}</textarea>`;
    if (s.type === 'select') return html`<select name="${s.key}">${s.options.map(([k, l]) => html`<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`)}</select>`;
    if (s.type === 'number') return html`<input type="number" name="${s.key}" value="${val}" class="short">`;
    if (s.type === 'image') return imagePicker(s.key, val, images);
    return html`<input type="text" name="${s.key}" value="${val}">`;
  };
  res.send(page(req, '사이트 문구·이미지', html`
<div class="subtabs">${GROUPS.map((g) => html`<a href="?group=${encodeURIComponent(g)}" class="${g === group ? 'on' : ''}">${g}</a>`)}</div>
<form method="post" action="/admin/settings" class="box panel"><input type="hidden" name="_group" value="${group}">
  <div class="ph"><b>${group}</b></div>
  <div class="pb"><table class="form-t wide">${SETTINGS.filter((s) => s.group === group).map((s) => html`<tr><th>${s.label}</th><td>${field(s)}</td></tr>`)}</table>
  <div class="btns"><button class="btn-blue big">저장</button></div></div>
</form>`));
});
function imagePicker(name, val, images) {
  const builtin = ['/img/logo.png', '/img/map.png', '/img/hallway.jpg', '/img/news-market.jpg', '/img/news-cityhall.jpg', '/img/news-field.jpg', '/img/news-apt.jpg', '/img/senior.svg'];
  return html`<div class="img-pick"><img src="${val || '/img/avatar-blank.svg'}" alt="" class="img-prev">
  <div><input type="text" name="${name}" value="${val}" class="img-url">
  <select class="img-sel"><option value="">— 보관함에서 고르기 —</option>
    <optgroup label="기본 이미지">${builtin.map((b) => html`<option value="${b}">${b}</option>`)}</optgroup>
    <optgroup label="올린 이미지">${images.map((i) => html`<option value="/media/${i.id}">${i.name} (/media/${i.id})</option>`)}</optgroup></select>
  <div class="hint">새 이미지는 [이미지 보관함]에서 올린 뒤 고르십시오.</div></div></div>`;
}
r.post('/settings', async (req, res) => {
  const group = req.body._group;
  for (const s of SETTINGS.filter((x) => x.group === group)) {
    if (req.body[s.key] === undefined) continue;
    let val = String(req.body[s.key]).replace(/\r\n/g, '\n');
    if (s.type === 'number') val = String(parseInt(val, 10) || 0);
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [s.key, val]);
  }
  back(res, '/admin/settings?group=' + encodeURIComponent(group));
});

// ── 게시물 ──
r.get('/posts', async (req, res) => {
  const board = BOARDS[req.query.board] ? req.query.board : 'news';
  const posts = await db.all('SELECT * FROM posts WHERE board = ? ORDER BY md DESC, id DESC LIMIT 200', [board]);
  res.send(page(req, '게시물 관리', html`
<div class="subtabs">${Object.entries(BOARDS).map(([k, b]) => html`<a href="?board=${k}" class="${k === board ? 'on' : ''}">${b.name}</a>`)}</div>
<div class="box panel"><div class="ph"><b>${BOARDS[board].name}</b><span class="ph-r"><a class="btn-blue" href="/admin/posts/new?board=${board}">＋ 새 글</a></span></div>
<table class="list-t"><thead><tr><th class="w-d">표시일</th><th>제목</th><th class="w-cat">구분/상태</th><th class="w-cat">메인 사진</th><th class="w-cat">작성자</th><th class="w-st">관리</th></tr></thead>
<tbody>${posts.map((p) => html`<tr><td>${postDate(p)}</td><td class="tl"><a href="/post/${p.id}">${p.title}</a></td><td>${p.category || ''} ${p.status || ''}</td>
<td>${Number(p.featured) ? '✔' : ''}</td><td>${p.author_name}</td><td><a href="/admin/posts/${p.id}">수정</a> ·
<form method="post" action="/admin/posts/${p.id}/delete" class="inline" onsubmit="return confirm('삭제할까요?')"><button class="link-btn">삭제</button></form></td></tr>`)}</tbody></table></div>`));
});
r.get('/posts/:id', async (req, res) => {
  const isNew = req.params.id === 'new';
  const p = isNew ? { board: BOARDS[req.query.board] ? req.query.board : 'news', md: v.todayMd() } : await db.get('SELECT * FROM posts WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!p) return res.redirect('/admin/posts');
  const images = await db.all('SELECT id, name FROM images ORDER BY id DESC');
  res.send(page(req, '게시물 편집', html`
<form method="post" action="/admin/posts/${isNew ? 'new' : p.id}" class="box panel"><div class="ph"><b>${isNew ? '새 글' : '글 수정'}</b></div><div class="pb">
<table class="form-t wide">
  <tr><th>게시판</th><td><select name="board">${Object.entries(BOARDS).map(([k, b]) => html`<option value="${k}" ${k === p.board ? 'selected' : ''}>${b.name}</option>`)}</select></td></tr>
  <tr><th>제목</th><td><input type="text" name="title" value="${p.title || ''}" required></td></tr>
  <tr><th>요약 / 부제</th><td><input type="text" name="summary" value="${p.summary || ''}"><div class="hint">메인 목록 아래 한 줄, 뉴스 기사 부제로 쓰입니다.</div></td></tr>
  <tr><th>본문</th><td><textarea name="body" rows="12">${p.body || ''}</textarea></td></tr>
  <tr><th>사진</th><td>${imagePicker('image', p.image || '', images)}</td></tr>
  <tr><th>구분</th><td><input type="text" name="category" value="${p.category || ''}" class="short"> <span class="hint">업무게시판: 시설점검·생활민원·현장대응 등 / 뉴스: 지역·사회·생활·문화·행정</span></td></tr>
  <tr><th>상태</th><td><select name="status"><option value="">(없음)</option>${['접수중', '확인중', '처리중', '완료'].map((s) => html`<option ${s === p.status ? 'selected' : ''}>${s}</option>`)}</select> <span class="hint">업무게시판용</span></td></tr>
  <tr><th>표시 날짜</th><td><input type="text" name="md" value="${p.md || ''}" class="short" placeholder="MM-DD" pattern="\\d{2}-\\d{2}"> <span class="hint">연도 없이 월-일 (예: 10-13). 목록은 이 날짜순입니다.</span></td></tr>
  <tr><th>작성자 표시</th><td><input type="text" name="author_name" value="${p.author_name || '충월시청'}" class="short"></td></tr>
  <tr><th>메인 사진 기사</th><td><label><input type="checkbox" name="featured" ${Number(p.featured) ? 'checked' : ''}> 메인 01 충월소식 사진 영역에 노출 (뉴스, 최대 4개)</label></td></tr>
</table><div class="btns"><button class="btn-blue big">저장</button> <a class="btn" href="/admin/posts?board=${p.board}">목록</a></div></div></form>`));
});
r.post('/posts/:id', async (req, res) => {
  const b = req.body;
  const board = BOARDS[b.board] ? b.board : 'news';
  const md = /^\d{2}-\d{2}$/.test(b.md || '') ? b.md : v.todayMd();
  const vals = [board, String(b.title || '').slice(0, 200), b.summary || '', String(b.body || '').replace(/\r\n/g, '\n'), b.image || null, b.category || null, b.status || null, b.featured ? 1 : 0, md, b.author_name || '충월시청'];
  if (req.params.id === 'new') {
    await db.run('INSERT INTO posts (board, title, summary, body, image, category, status, featured, md, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [...vals, nowIso()]);
  } else {
    await db.run('UPDATE posts SET board = ?, title = ?, summary = ?, body = ?, image = ?, category = ?, status = ?, featured = ?, md = ?, author_name = ? WHERE id = ?', [...vals, parseInt(req.params.id, 10) || 0]);
  }
  back(res, '/admin/posts?board=' + board);
});
r.post('/posts/:id/delete', async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  const p = await db.get('SELECT board FROM posts WHERE id = ?', [id]);
  await db.run('DELETE FROM comments WHERE post_id = ?', [id]);
  await db.run('DELETE FROM posts WHERE id = ?', [id]);
  back(res, '/admin/posts?board=' + (p ? p.board : 'news'), '삭제했습니다.');
});

// ── 일정 ──
r.get('/schedule', async (req, res) => {
  const rows = await db.all('SELECT * FROM schedule ORDER BY md');
  res.send(page(req, '일정 관리', html`
<div class="box panel"><div class="ph"><b>연간 일정</b> <span class="small">(연도 없이 매년 반복, 메인 달력 "주요 일정"에 해당 월이 표시됩니다)</span></div>
<table class="list-t"><thead><tr><th class="w-d">날짜</th><th>내용</th><th class="w-st">관리</th></tr></thead>
<tbody>${rows.map((e) => html`<tr><td>${e.md}</td><td class="tl">${e.title}</td><td><form method="post" action="/admin/schedule/${e.id}/delete" class="inline"><button class="link-btn">삭제</button></form></td></tr>`)}</tbody></table>
<form method="post" action="/admin/schedule" class="pb inline-form">새 일정: <input type="text" name="md" placeholder="MM-DD" pattern="\\d{2}-\\d{2}" required class="short"> <input type="text" name="title" required placeholder="일정 이름"> <button class="btn-blue">추가</button></form></div>`));
});
r.post('/schedule', async (req, res) => {
  if (/^\d{2}-\d{2}$/.test(req.body.md || '') && req.body.title) await db.run('INSERT INTO schedule (md, title) VALUES (?, ?)', [req.body.md, String(req.body.title).slice(0, 60)]);
  back(res, '/admin/schedule');
});
r.post('/schedule/:id/delete', async (req, res) => {
  await db.run('DELETE FROM schedule WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  back(res, '/admin/schedule', '삭제했습니다.');
});

// ── 입주 프롤로그 대본 ──
r.get('/vn', async (req, res) => {
  const nodes = await db.all('SELECT * FROM vn_nodes ORDER BY sort, id');
  res.send(page(req, '입주 프롤로그 대본', html`
<div class="box panel"><div class="ph"><b>입주 프롤로그 장면</b><span class="ph-r"><a class="btn" href="/prologue?replay=1" target="_blank">미리 보기</a> <a class="btn-blue" href="/admin/vn/new">＋ 장면 추가</a></span></div>
<div class="pb small">대사에 <code>{name}</code>(요원 이름), <code>{house}</code>(단지·동·호수), <code>{complex}</code>(단지 이름)를 쓰면 요원마다 바뀝니다. 장면은 순서 번호대로 정렬되며, 선택지가 없으면 "다음 장면"으로 넘어갑니다. 다음 장면을 <code>END</code>로 두면 프롤로그가 끝나고 메인으로 이동합니다.</div>
<table class="list-t"><thead><tr><th class="w-no">순서</th><th class="w-no">ID</th><th class="w-no">단계</th><th class="w-cat">화자</th><th>대사</th><th class="w-cat">다음/선택지</th><th class="w-st">관리</th></tr></thead>
<tbody>${nodes.map((n) => html`<tr><td>${n.sort}</td><td>${n.id}</td><td>${n.step}</td><td>${n.speaker || '(지문)'}</td><td class="tl small">${n.text}</td>
<td class="small">${n.choices ? nl2br(n.choices) : n.next}</td><td><a href="/admin/vn/${encodeURIComponent(n.id)}">수정</a></td></tr>`)}</tbody></table></div>`));
});
r.get('/vn/:id', async (req, res) => {
  const isNew = req.params.id === 'new';
  const last = await db.get('SELECT MAX(sort) AS m FROM vn_nodes');
  const n = isNew ? { id: '', sort: Number(last.m || 0) + 10, step: 1, sprite: 'npc' } : await db.get('SELECT * FROM vn_nodes WHERE id = ?', [req.params.id]);
  if (!n) return res.redirect('/admin/vn');
  const images = await db.all('SELECT id, name FROM images ORDER BY id DESC');
  res.send(page(req, '장면 편집', html`
<form method="post" action="/admin/vn/${isNew ? 'new' : encodeURIComponent(n.id)}" class="box panel"><div class="ph"><b>${isNew ? '장면 추가' : `장면 ${n.id} 수정`}</b></div><div class="pb">
<table class="form-t wide">
  <tr><th>장면 ID</th><td><input type="text" name="id" value="${n.id}" required pattern="[A-Za-z0-9_-]+" ${isNew ? '' : 'readonly'} class="short"> <span class="hint">영문·숫자 (예: p12)</span></td></tr>
  <tr><th>순서 번호</th><td><input type="number" name="sort" value="${n.sort}" class="short"></td></tr>
  <tr><th>입주 단계</th><td><input type="number" name="step" value="${n.step}" min="1" max="9" class="short"> <span class="hint">오른쪽 "입주 단계" 목록에서 강조할 번호</span></td></tr>
  <tr><th>현재 위치</th><td><input type="text" name="location" value="${n.location || ''}"></td></tr>
  <tr><th>배경 이미지</th><td>${imagePicker('bg', n.bg || '', images)}<div class="hint">비우면 기본 배경</div></td></tr>
  <tr><th>캐릭터 이미지</th><td><select name="sprite_mode"><option value="">없음</option><option value="npc" ${n.sprite === 'npc' ? 'selected' : ''}>선임 NPC 기본 이미지</option><option value="custom" ${n.sprite && n.sprite !== 'npc' ? 'selected' : ''}>직접 지정 ↓</option></select>
    ${imagePicker('sprite', n.sprite && n.sprite !== 'npc' ? n.sprite : '', images)}</td></tr>
  <tr><th>화자</th><td><input type="text" name="speaker" value="${n.speaker || ''}" class="short"> <span class="hint">비우면 지문</span></td></tr>
  <tr><th>대사</th><td><textarea name="text" rows="4" required>${n.text || ''}</textarea></td></tr>
  <tr><th>선택지</th><td><textarea name="choices" rows="4" placeholder="네. 같이 들어가겠습니다.|p6">${n.choices || ''}</textarea><div class="hint">한 줄에 "선택지 문구|이동할 장면 ID"</div></td></tr>
  <tr><th>다음 장면</th><td><input type="text" name="next" value="${n.next || ''}" class="short"> <span class="hint">선택지가 없을 때 이동할 장면 ID 또는 END</span></td></tr>
</table><div class="btns"><button class="btn-blue big">저장</button> <a class="btn" href="/admin/vn">목록</a></div></div></form>
${isNew ? '' : html`<form method="post" action="/admin/vn/${encodeURIComponent(n.id)}/delete" onsubmit="return confirm('삭제할까요?')" class="right"><button class="btn-small">이 장면 삭제</button></form>`}`));
});
r.post('/vn/:id', async (req, res) => {
  const b = req.body;
  const id = req.params.id === 'new' ? String(b.id || '').trim() : req.params.id;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return back(res, '/admin/vn', '장면 ID가 올바르지 않습니다.');
  const sprite = b.sprite_mode === 'npc' ? 'npc' : b.sprite_mode === 'custom' ? b.sprite || '' : '';
  const vals = [parseInt(b.sort, 10) || 0, parseInt(b.step, 10) || 1, b.location || '', b.bg || '', sprite, b.speaker || '', String(b.text || '').replace(/\r\n/g, '\n'), String(b.choices || '').replace(/\r\n/g, '\n'), String(b.next || '').trim()];
  if (req.params.id === 'new') {
    if (await db.get('SELECT id FROM vn_nodes WHERE id = ?', [id])) return back(res, '/admin/vn', '이미 있는 장면 ID입니다.');
    await db.run('INSERT INTO vn_nodes (sort, step, location, bg, sprite, speaker, text, choices, next, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [...vals, id]);
  } else {
    await db.run('UPDATE vn_nodes SET sort = ?, step = ?, location = ?, bg = ?, sprite = ?, speaker = ?, text = ?, choices = ?, next = ? WHERE id = ?', [...vals, id]);
  }
  back(res, '/admin/vn');
});
r.post('/vn/:id/delete', async (req, res) => {
  await db.run('DELETE FROM vn_nodes WHERE id = ?', [req.params.id]);
  back(res, '/admin/vn', '삭제했습니다.');
});

// ── 이미지 보관함 ──
r.get('/images', async (req, res) => {
  const imgs = await db.all('SELECT id, name, mime, created_at, LENGTH(data) AS size FROM images ORDER BY id DESC');
  res.send(page(req, '이미지 보관함', html`
<div class="box panel"><div class="ph"><b>이미지 올리기</b></div><div class="pb">
  <input type="file" id="img-file" accept="image/*" multiple> <button class="btn-blue" type="button" onclick="cwUpload()">올리기</button> <span id="up-msg" class="small"></span>
  <div class="hint">한 장당 3MB 이하. 올린 이미지는 /media/번호 주소로 문구·게시물·프롤로그 설정에서 고를 수 있습니다. (DB에 저장되어 재배포해도 유지됩니다)</div></div></div>
<div class="box panel"><div class="ph"><b>올린 이미지</b> (${imgs.length})</div><div class="pb gallery">${imgs.map((i) => html`
  <div class="g-item"><img src="/media/${i.id}" alt=""><div class="small"><b>/media/${i.id}</b><br>${i.name}<br>${Math.round(Number(i.size) * 0.75 / 1024)}KB</div>
  <form method="post" action="/admin/images/${i.id}/delete" onsubmit="return confirm('삭제할까요? 사용 중인 곳의 이미지가 사라집니다.')"><button class="link-btn">삭제</button></form></div>`)}</div></div>`));
});
r.post('/images', express.json({ limit: '6mb' }), async (req, res) => {
  const m = /^data:(image\/(png|jpeg|gif|webp|svg\+xml));base64,(.+)$/.exec(String(req.body.data || ''));
  if (!m) return res.status(400).json({ ok: false, msg: '이미지 형식이 아닙니다.' });
  if (m[3].length > 4.2 * 1024 * 1024) return res.status(400).json({ ok: false, msg: '3MB 이하만 올릴 수 있습니다.' });
  const rows = await db.run('INSERT INTO images (name, mime, data, created_at) VALUES (?, ?, ?, ?) RETURNING id', [String(req.body.name || '').slice(0, 80), m[1], m[3], nowIso()]);
  res.json({ ok: true, url: '/media/' + rows[0].id });
});
r.post('/images/:id/delete', async (req, res) => {
  await db.run('DELETE FROM images WHERE id = ?', [parseInt(req.params.id, 10) || 0]);
  back(res, '/admin/images', '삭제했습니다.');
});

// ── 초대 코드 ──
r.get('/invites', async (req, res) => {
  const rows = await db.all('SELECT * FROM invites ORDER BY created_at DESC');
  res.send(page(req, '초대 코드', html`
<div class="box panel"><div class="ph"><b>초대 코드 발급</b></div>
<form method="post" action="/admin/invites" class="pb"><table class="form-t wide">
  <tr><th>코드</th><td><input type="text" name="code" placeholder="비우면 자동 생성" class="short"></td></tr>
  <tr><th>메모</th><td><input type="text" name="memo" placeholder="예) 1차 테스터"></td></tr>
  <tr><th>가입 가능 인원</th><td><input type="number" name="max_uses" min="1" class="short"> <span class="hint">비우면 무제한</span></td></tr>
  <tr><th>만료일</th><td><input type="date" name="expires"> <span class="hint">비우면 만료 없음</span></td></tr>
</table><div class="btns"><button class="btn-blue">발급</button></div></form></div>
<div class="box panel"><div class="ph"><b>발급된 코드</b></div><div class="pb small">코드를 비활성화하면 그 코드로 들어온 사람은 다시 다른 코드를 입력해야 접속할 수 있습니다.</div>
<table class="list-t"><thead><tr><th>코드</th><th>메모</th><th class="w-cat">사용/인원</th><th class="w-cat">만료</th><th class="w-st">상태</th><th class="w-st">관리</th></tr></thead>
<tbody>${rows.map((i) => html`<tr><td><b class="mono">${i.code}</b></td><td class="tl">${i.memo}</td><td>${i.uses} / ${i.max_uses ?? '∞'}</td><td>${i.expires_at ? i.expires_at.slice(0, 10) : '-'}</td>
<td>${Number(i.active) ? html`<span class="badge ok">사용</span>` : html`<span class="badge off">중지</span>`}</td>
<td><form method="post" action="/admin/invites/${encodeURIComponent(i.code)}/toggle" class="inline"><button class="link-btn">${Number(i.active) ? '중지' : '재개'}</button></form></td></tr>`)}</tbody></table></div>`));
});
r.post('/invites', async (req, res) => {
  const code = (String(req.body.code || '').trim() || 'CW-' + crypto.randomBytes(4).toString('hex')).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  const max = parseInt(req.body.max_uses, 10);
  const exp = /^\d{4}-\d{2}-\d{2}$/.test(req.body.expires || '') ? new Date(req.body.expires + 'T23:59:59+09:00').toISOString() : null;
  if (await db.get('SELECT code FROM invites WHERE code = ?', [code])) return back(res, '/admin/invites', '이미 있는 코드입니다.');
  await db.run('INSERT INTO invites (code, memo, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [code, String(req.body.memo || '').slice(0, 80), max > 0 ? max : null, exp, nowIso()]);
  back(res, '/admin/invites', `초대 코드 ${code} 을(를) 발급했습니다.`);
});
r.post('/invites/:code/toggle', async (req, res) => {
  await db.run('UPDATE invites SET active = 1 - active WHERE code = ?', [req.params.code]);
  back(res, '/admin/invites');
});

// ── 회원 ──
r.get('/users', async (req, res) => {
  const rows = await db.all('SELECT u.*, a.name, a.dept, a.rank, a.level, a.exp, a.onboarding, a.house_dong, a.house_ho, a.shift FROM users u LEFT JOIN agents a ON a.user_id = u.id ORDER BY u.id');
  res.send(page(req, '회원 관리', html`
<div class="box panel"><div class="ph"><b>회원 목록</b> (${rows.length})</div>
<table class="list-t"><thead><tr><th>아이디</th><th>요원</th><th>소속/직급</th><th class="w-no">Lv</th><th class="w-cat">사택</th><th class="w-cat">단계</th><th class="w-st">상태</th><th class="w-d">최근 접속</th><th class="w-st">관리</th></tr></thead>
<tbody>${rows.map((u) => html`<tr><td>${u.username}${u.role === 'admin' ? html` <span class="badge">관리자</span>` : ''}</td><td>${u.name || '-'}</td><td>${u.dept || '-'} / ${u.rank || '-'}</td><td>${u.level}</td>
<td>${u.house_dong ? `${u.house_dong}-${u.house_ho}` : '-'}</td><td>${ONBOARD_LABEL[u.onboarding] || '-'}</td>
<td>${u.status === 'active' ? html`<span class="badge ok">정상</span>` : html`<span class="badge off">중지</span>`}</td><td>${timeLabel(u.last_seen)}</td><td><a href="/admin/users/${u.id}">관리</a></td></tr>`)}</tbody></table></div>`));
});
r.get('/users/:id', async (req, res) => {
  const u = await db.get('SELECT u.*, a.* FROM users u LEFT JOIN agents a ON a.user_id = u.id WHERE u.id = ?', [parseInt(req.params.id, 10) || 0]);
  if (!u) return res.redirect('/admin/users');
  const uid = parseInt(req.params.id, 10);
  res.send(page(req, '회원 관리', html`
<form method="post" action="/admin/users/${uid}" class="box panel"><div class="ph"><b>${u.username} · ${u.name || '-'}</b></div><div class="pb">
<table class="form-t wide">
  <tr><th>권한</th><td><select name="role"><option value="user">일반</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option></select></td></tr>
  <tr><th>상태</th><td><select name="status"><option value="active">정상</option><option value="suspended" ${u.status !== 'active' ? 'selected' : ''}>이용 중지</option></select></td></tr>
  <tr><th>요원 이름 / 나이</th><td>${u.name || '-'} / ${u.age || '-'} · 이전 직업 ${u.prev_job || '-'}</td></tr>
  <tr><th>공개 소개</th><td>${nl2br(u.intro || '-')}</td></tr>
  <tr><th>계약 계기</th><td>${nl2br(u.motive || '-')}</td></tr>
  <tr><th>소속</th><td><input type="text" name="dept" value="${u.dept || ''}" class="short"></td></tr>
  <tr><th>직급</th><td><input type="text" name="rank" value="${u.rank || ''}" class="short"> <span class="hint">계약직 → 정식 공무원 → 부서장 등 (승진 규칙 미정, 수동 변경)</span></td></tr>
  <tr><th>오늘의 근무</th><td><input type="text" name="shift" value="${u.shift || ''}" class="short"></td></tr>
  <tr><th>레벨 / 경험치</th><td><input type="number" name="level" value="${u.level || 1}" class="short"> / <input type="number" name="exp" value="${u.exp || 0}" class="short"></td></tr>
  <tr><th>사택 동 / 호</th><td><input type="text" name="house_dong" value="${u.house_dong || ''}" class="short"> 동 <input type="text" name="house_ho" value="${u.house_ho || ''}" class="short"> 호</td></tr>
  <tr><th>진행 단계</th><td><select name="onboarding">${Object.entries(ONBOARD_LABEL).map(([k, l]) => html`<option value="${k}" ${k === u.onboarding ? 'selected' : ''}>${l}</option>`)}</select> <span class="hint">"프롤로그 진행 중"으로 바꾸면 다음 로그인 때 프롤로그를 처음부터 다시 봅니다.</span></td></tr>
</table><div class="btns"><button class="btn-blue big">저장</button> <a class="btn" href="/admin/users">목록</a></div></div></form>
<form method="post" action="/admin/users/${uid}/password" class="box panel"><div class="ph"><b>비밀번호 초기화</b></div><div class="pb inline-form">새 비밀번호 <input type="text" name="password" minlength="8" required class="short"> <button class="btn">변경</button></div></form>`));
});
r.post('/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  const b = req.body;
  if (id === req.user.id && (b.role !== 'admin' || b.status !== 'active')) return back(res, `/admin/users/${id}`, '본인의 관리자 권한이나 상태는 바꿀 수 없습니다.');
  await db.run('UPDATE users SET role = ?, status = ? WHERE id = ?', [b.role === 'admin' ? 'admin' : 'user', b.status === 'active' ? 'active' : 'suspended', id]);
  const onboarding = ONBOARD_LABEL[b.onboarding] ? b.onboarding : 'done';
  try {
    await db.run(`UPDATE agents SET dept = ?, rank = ?, shift = ?, level = ?, exp = ?, house_dong = ?, house_ho = ?, onboarding = ?${onboarding === 'prologue' ? ', prologue_node = NULL, prologue_log = NULL' : ''} WHERE user_id = ?`,
      [b.dept, b.rank, b.shift, parseInt(b.level, 10) || 1, parseInt(b.exp, 10) || 0, b.house_dong || null, b.house_ho || null, onboarding, id]);
  } catch (e) {
    return back(res, `/admin/users/${id}`, '이미 다른 요원이 쓰는 동·호수입니다.');
  }
  back(res, `/admin/users/${id}`);
});
r.post('/users/:id/password', async (req, res) => {
  const pw = String(req.body.password || '');
  if (pw.length >= 8) await db.run('UPDATE users SET pw_hash = ? WHERE id = ?', [auth.hashPassword(pw), parseInt(req.params.id, 10) || 0]);
  back(res, `/admin/users/${req.params.id}`, '비밀번호를 바꿨습니다.');
});

module.exports = { router: r };
