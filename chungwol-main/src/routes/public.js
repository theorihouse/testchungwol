// 초대 코드 출입, 로그인, 신규 요원 등록(계정 → 요원 정보 → 계약·사택 배정)
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../auth');
const { nowIso, lines } = require('../util');
const { html, nl2br, simplePage, stepBar, msgBox, icon } = require('../views');

const r = express.Router();

// ── 초대 코드 ──────────────────────────────────────────
r.get('/gate', (req, res) => {
  if (req.gate) return res.redirect(req.user ? '/' : '/login');
  res.send(gatePage(req));
});
function gatePage(req, err) {
  const S = req.S;
  return simplePage(req, {
    title: '초대 코드 확인',
    main: html`
<div class="box panel login-box gate">
  <div class="ph"><b>${S.gate_title}</b></div>
  <div class="pb">
    <p class="lead">${nl2br(S.gate_notice)}</p>
    ${msgBox(err)}
    <form method="post" action="/gate" class="gate-form">
      <label>초대 코드 <input type="text" name="code" autocomplete="off" required autofocus placeholder="예) CHUNGWOL-0000"></label>
      <button class="btn-blue big" type="submit">확인</button>
    </form>
    <p class="muted small">초대 코드는 운영진에게 받을 수 있습니다.</p>
  </div>
</div>`,
  });
}
r.post('/gate', async (req, res) => {
  const inv = await auth.checkInvite(req.body.code);
  if (!inv) return res.status(400).send(gatePage(req, '사용할 수 없는 초대 코드입니다.'));
  if (req.sid) await db.run('DELETE FROM sessions WHERE token = ?', [req.sid]);
  await auth.createGateSession(res, inv.code);
  res.redirect('/login');
});

// ── 로그인 ──────────────────────────────────────────
function loginPage(req, err, username = '') {
  const S = req.S;
  return simplePage(req, {
    title: '직원 로그인',
    main: html`
<div class="login-wrap">
  <div class="box panel login-box">
    <div class="ph"><b>${S.agency_name} 직원 로그인</b><span class="ph-r">직원 전용 서비스</span></div>
    <div class="pb login-grid">
      <form method="post" action="/login" class="login-form">
        <input type="hidden" name="next" value="${req.query.next || ''}">
        ${msgBox(err)}
        <table class="form-t">
          <tr><th>아이디</th><td><input type="text" name="username" value="${username}" required autofocus></td></tr>
          <tr><th>비밀번호</th><td><input type="password" name="password" required></td></tr>
        </table>
        <label class="small"><input type="checkbox" name="remember"> 아이디 저장</label>
        <button class="btn-blue big login-btn" type="submit">로그인</button>
        <div class="login-links"><a href="/help/account">아이디 찾기</a> | <a href="/help/account">비밀번호 찾기</a> | <a href="/register" class="strong">신규 요원 등록</a></div>
      </form>
      <div class="login-photo">
        <img src="${S.login_photo}" alt="">
        <p class="warn">※ ${S.login_warning}</p>
      </div>
    </div>
  </div>
  <div class="box panel">
    <div class="ph"><b>이용 안내</b></div>
    <ul class="pb dotlist">${lines(S.login_notice).map((l) => html`<li>${l}</li>`)}</ul>
  </div>
</div>`,
  });
}
r.get('/login', auth.requireGate, (req, res) => {
  if (req.user) return res.redirect('/');
  res.send(loginPage(req));
});
r.post('/login', auth.requireGate, async (req, res) => {
  const { username = '', password = '' } = req.body;
  const u = await db.get('SELECT * FROM users WHERE username = ?', [username.trim()]);
  if (!u || !auth.verifyPassword(password, u.pw_hash)) return res.status(400).send(loginPage(req, '아이디 또는 비밀번호가 맞지 않습니다.', username));
  if (u.status !== 'active') return res.status(403).send(loginPage(req, '이용이 중지된 계정입니다. 운영진에게 문의하십시오.', username));
  await db.run('UPDATE sessions SET user_id = ? WHERE token = ?', [u.id, req.sid]);
  await db.run('UPDATE users SET last_seen = ? WHERE id = ?', [nowIso(), u.id]);
  const next = String(req.body.next || '');
  res.redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
});
r.post('/logout', async (req, res) => {
  if (req.sid) await db.run('UPDATE sessions SET user_id = NULL WHERE token = ?', [req.sid]);
  res.redirect('/login');
});
r.get('/help/account', auth.requireGate, (req, res) => {
  res.send(simplePage(req, { title: '계정 찾기', main: html`<div class="box panel login-box"><div class="ph"><b>아이디·비밀번호 찾기</b></div><div class="pb"><p>계정 찾기는 운영진(관리자)에게 문의하십시오. 관리자 페이지에서 비밀번호를 초기화할 수 있습니다.</p><p><a href="/login">← 로그인으로</a></p></div></div>` }));
});

// ── STEP 1 계정 등록 ──────────────────────────────────────────
function accountPage(req, err, v = {}) {
  const S = req.S;
  return simplePage(req, {
    title: '신규 요원 등록',
    main: html`
${stepBar(1)}
<div class="reg-grid">
  <form method="post" action="/register" class="box panel">
    <div class="ph"><b>계정 등록</b><span class="ph-r">* 표시는 필수 항목</span></div>
    <div class="pb">
      ${msgBox(err)}
      <table class="form-t wide">
        <tr><th>* 아이디</th><td><input type="text" name="username" id="reg-id" value="${v.username || ''}" required pattern="[a-z0-9_]{4,16}" title="영문 소문자·숫자·_ 4~16자">
          <button type="button" class="btn-small" onclick="cwCheckId()">중복 확인</button> <span id="id-result" class="small"></span>
          <div class="hint">영문 소문자·숫자·_ 4~16자</div></td></tr>
        <tr><th>* 비밀번호</th><td><input type="password" name="password" required minlength="8"><div class="hint">8자 이상</div></td></tr>
        <tr><th>* 비밀번호 확인</th><td><input type="password" name="password2" required minlength="8"></td></tr>
        <tr><th>이메일</th><td><input type="email" name="email" value="${v.email || ''}"><div class="hint">계정 안내용 (선택)</div></td></tr>
      </table>
      <div class="terms"><b>이용약관</b><div class="terms-box">${nl2br(S.terms_text)}</div>
        <label><input type="checkbox" name="agree_terms" required> 이용약관을 확인했습니다.</label></div>
      <div class="terms"><b>개인정보처리방침</b><div class="terms-box">${nl2br(S.privacy_text)}</div>
        <label><input type="checkbox" name="agree_privacy" required> 개인정보처리방침을 확인했습니다.</label></div>
      <div class="btns"><button class="btn-blue big" type="submit">다음 단계 ▶</button> <a class="btn" href="/login">취소</a></div>
    </div>
  </form>
  ${regAside(S)}
</div>`,
  });
}
function regAside(S) {
  return html`<div class="reg-aside">
  <div class="box panel"><div class="ph"><b>작성 안내</b></div><div class="pb small">${nl2br(S.register_guide)}</div></div>
  <div class="box panel"><div class="ph"><b>사택 안내</b></div><div class="pb small"><img class="aside-img" src="${S.house_photo}" alt="">${nl2br(S.house_notice)}</div></div>
</div>`;
}
r.get('/register', auth.requireGate, (req, res) => {
  if (req.user) return res.redirect('/');
  res.send(accountPage(req));
});
r.get('/api/check-id', auth.requireGate, async (req, res) => {
  const id = String(req.query.username || '').trim();
  if (!/^[a-z0-9_]{4,16}$/.test(id)) return res.json({ ok: false, msg: '형식이 맞지 않습니다.' });
  const u = await db.get('SELECT id FROM users WHERE username = ?', [id]);
  res.json(u ? { ok: false, msg: '이미 사용 중인 아이디입니다.' } : { ok: true, msg: '사용할 수 있는 아이디입니다.' });
});
r.post('/register', auth.requireGate, async (req, res) => {
  const { username = '', password = '', password2 = '', email = '' } = req.body;
  const v = { username: username.trim(), email: email.trim() };
  if (!/^[a-z0-9_]{4,16}$/.test(v.username)) return res.status(400).send(accountPage(req, '아이디는 영문 소문자·숫자·_ 4~16자입니다.', v));
  if (password.length < 8) return res.status(400).send(accountPage(req, '비밀번호는 8자 이상이어야 합니다.', v));
  if (password !== password2) return res.status(400).send(accountPage(req, '비밀번호 확인이 일치하지 않습니다.', v));
  if (!req.body.agree_terms || !req.body.agree_privacy) return res.status(400).send(accountPage(req, '약관 확인이 필요합니다.', v));
  const inv = await auth.checkInvite(req.gate, { forSignup: true });
  if (!inv) return res.status(400).send(accountPage(req, '초대 코드의 가입 가능 인원이 모두 찼습니다. 운영진에게 문의하십시오.', v));
  if (await db.get('SELECT id FROM users WHERE username = ?', [v.username])) return res.status(400).send(accountPage(req, '이미 사용 중인 아이디입니다.', v));
  const rows = await db.run('INSERT INTO users (username, pw_hash, email, invite_code, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [v.username, auth.hashPassword(password), v.email, inv.code, nowIso()]);
  const uid = rows[0].id;
  await db.run("INSERT INTO agents (user_id, onboarding) VALUES (?, 'profile')", [uid]);
  await db.run('UPDATE invites SET uses = uses + 1 WHERE code = ?', [inv.code]);
  await db.run('UPDATE sessions SET user_id = ? WHERE token = ?', [uid, req.sid]);
  res.redirect('/register/agent');
});

// ── STEP 2 요원 정보 작성 ──────────────────────────────────────────
function agentPage(req, err, v = {}) {
  const S = req.S;
  return simplePage(req, {
    title: '요원 정보 작성',
    main: html`
${stepBar(2)}
<div class="reg-grid">
  <form method="post" action="/register/agent" class="box panel" id="agent-form">
    <div class="ph"><b>요원 정보 작성</b><span class="ph-r">게임 속 캐릭터 정보입니다</span></div>
    <div class="pb">
      ${msgBox(err)}
      ${agentFields(S, v)}
      <div class="terms"><b>세계관 확인</b>
        <label><input type="checkbox" name="ok_human" required> 나의 요원은 초능력이 없는 <b>평범한 성인 인간</b>입니다.</label><br>
        <label><input type="checkbox" name="ok_work" required> 나의 요원은 <b>괴이 관리 업무</b>라는 사실을 알고 계약합니다.</label>
      </div>
      <div class="btns"><button class="btn-blue big" type="submit">다음 단계 ▶</button></div>
    </div>
  </form>
  ${regAside(S)}
</div>`,
  });
}
function agentFields(S, v) {
  return html`
<table class="form-t wide">
  <tr><th>캐릭터 이미지</th><td>
    <div class="avatar-pick"><img id="avatar-preview" src="${v.avatar || '/img/avatar-blank.svg'}" alt="">
    <div><input type="file" accept="image/*" id="avatar-file" onchange="cwAvatar(this)"><input type="hidden" name="avatar" id="avatar-data" value="${v.avatar || ''}">
    <div class="hint">사원증 사진처럼 쓰입니다. 1MB 이하 (선택)</div></div></div></td></tr>
  <tr><th>* 이름</th><td><input type="text" name="name" value="${v.name || ''}" required maxlength="20"></td></tr>
  <tr><th>* 나이</th><td><input type="number" name="age" value="${v.age || ''}" required min="${S.char_min_age}" max="99" class="short"> 세 <span class="hint">캐릭터는 성인(${S.char_min_age}세 이상)만 가능</span></td></tr>
  <tr><th>이전 직업</th><td><input type="text" name="prev_job" value="${v.prev_job || ''}" maxlength="40"></td></tr>
  <tr><th>공개 소개</th><td><textarea name="intro" rows="3" maxlength="500">${v.intro || ''}</textarea><div class="hint">다른 요원에게 보이는 소개입니다.</div></td></tr>
  <tr><th>계약하게 된 계기</th><td><textarea name="motive" rows="4" maxlength="2000">${v.motive || ''}</textarea><div class="hint">자유롭게 작성하는 롤플레이 배경입니다. 본인만 볼 수 있습니다.</div></td></tr>
</table>`;
}
function readAgent(S, body) {
  const v = {
    name: String(body.name || '').trim().slice(0, 20), age: parseInt(body.age, 10),
    prev_job: String(body.prev_job || '').trim().slice(0, 40), intro: String(body.intro || '').slice(0, 500),
    motive: String(body.motive || '').slice(0, 2000), avatar: String(body.avatar || ''),
  };
  let err = null;
  if (!v.name) err = '이름을 입력하십시오.';
  else if (!(v.age >= Number(S.char_min_age || 19) && v.age <= 99)) err = `캐릭터 나이는 ${S.char_min_age}세 이상이어야 합니다.`;
  else if (v.avatar && !/^data:image\/(png|jpeg|gif|webp);base64,/.test(v.avatar)) err = '이미지 형식이 올바르지 않습니다.';
  else if (v.avatar.length > 1.4 * 1024 * 1024) err = '이미지는 1MB 이하로 올려 주십시오.';
  return { v, err };
}
r.get('/register/agent', auth.requireUser, (req, res) => {
  if (req.agent.onboarding !== 'profile') return res.redirect('/');
  res.send(agentPage(req, null, req.agent));
});
r.post('/register/agent', auth.requireUser, async (req, res) => {
  if (req.agent.onboarding !== 'profile') return res.redirect('/');
  const { v, err } = readAgent(req.S, req.body);
  if (err || !req.body.ok_human || !req.body.ok_work) return res.status(400).send(agentPage(req, err || '세계관 확인이 필요합니다.', v));
  await db.run("UPDATE agents SET name = ?, age = ?, prev_job = ?, intro = ?, motive = ?, avatar = ?, onboarding = 'contract' WHERE user_id = ?",
    [v.name, v.age, v.prev_job, v.intro, v.motive, v.avatar, req.user.id]);
  res.redirect('/register/contract');
});

// ── STEP 3 계약 안내·동의 → 사택 배정 ──────────────────────────────────────────
r.get('/register/contract', auth.requireUser, (req, res) => {
  if (req.agent.onboarding !== 'contract') return res.redirect('/');
  const S = req.S;
  const a = req.agent;
  res.send(simplePage(req, {
    title: '계약 안내',
    main: html`
${stepBar(3)}
<form method="post" action="/register/contract" class="box panel contract">
  <div class="ph"><b>계약 안내 및 동의</b><span class="ph-r">${S.agency_name}</span></div>
  <div class="pb">
    <table class="form-t wide view">
      <tr><th>계약자 (요원)</th><td>${a.name} (${a.age}세)</td></tr>
      <tr><th>계약 기관</th><td>${S.agency_name}</td></tr>
      <tr><th>소속 (가안)</th><td>${S.default_dept}</td></tr>
      <tr><th>신분</th><td>${S.default_rank}</td></tr>
      <tr><th>사택</th><td>${S.house_complex} 독립 세대 1곳 (계약과 동시에 배정)</td></tr>
    </table>
    <div class="terms"><b>계약 내용</b><div class="terms-box tall">${nl2br(S.contract_text)}</div>
      <label><input type="checkbox" name="agree" required> 위 내용을 확인했으며 계약에 동의합니다.</label></div>
    <div class="btns"><button class="btn-blue big" type="submit">계약 및 사택 배정 ▶</button></div>
  </div>
</form>`,
  }));
});

async function assignHouse(S, uid) {
  const dongs = String(S.house_dongs || '101').split(',').map((s) => s.trim()).filter(Boolean);
  const floors = Math.max(1, parseInt(S.house_floors, 10) || 15);
  const units = Math.max(1, parseInt(S.house_units, 10) || 4);
  const taken = new Set((await db.all('SELECT house_dong, house_ho FROM agents WHERE house_dong IS NOT NULL')).map((x) => `${x.house_dong}-${x.house_ho}`));
  const free = [];
  for (const d of dongs) for (let f = 1; f <= floors; f++) for (let u = 1; u <= units; u++) {
    const ho = `${f}${String(u).padStart(2, '0')}`;
    if (!taken.has(`${d}-${ho}`)) free.push([d, ho]);
  }
  if (!free.length) throw new Error('배정할 수 있는 세대가 없습니다. 관리자 설정에서 동·층 수를 늘려 주십시오.');
  for (let tries = 0; tries < 5; tries++) {
    const [d, ho] = free[crypto.randomInt(free.length)];
    try {
      await db.run("UPDATE agents SET house_dong = ?, house_ho = ?, house_status = '배정 완료', onboarding = 'assigned', contracted_at = ?, dept = ?, rank = ?, shift = ? WHERE user_id = ?",
        [d, ho, nowIso(), S.default_dept, S.default_rank, S.default_shift, uid]);
      return;
    } catch (e) { /* 동시 배정 충돌 시 다른 세대로 재시도 */ }
  }
  throw new Error('사택 배정에 실패했습니다. 다시 시도해 주십시오.');
}
r.post('/register/contract', auth.requireUser, async (req, res) => {
  if (req.agent.onboarding !== 'contract') return res.redirect('/');
  if (!req.body.agree) return res.redirect('/register/contract');
  await assignHouse(req.S, req.user.id);
  res.redirect('/register/house');
});

r.get('/register/house', auth.requireUser, (req, res) => {
  const a = req.agent;
  if (!['assigned', 'prologue', 'done'].includes(a.onboarding) || !a.house_dong) return res.redirect('/');
  res.send(simplePage(req, { title: '계약 및 사택 배정', main: houseResult(req, a, a.onboarding === 'assigned') }));
});
function houseResult(req, a, showNext) {
  const S = req.S;
  return html`
${stepBar(3)}
<div class="box panel done-banner"><div class="pb">${icon('doc', 28)} <b>계약이 완료되었습니다.</b> ${a.name} 님, ${S.agency_name}의 ${a.rank}으로 등록되었습니다.</div></div>
<div class="house-grid">
  <div class="box panel">
    <div class="ph"><b>사택 배정 결과</b></div>
    <div class="pb house-res">
      <img src="${S.house_photo}" alt="">
      <table class="form-t view">
        <tr><th>단지명</th><td>${S.house_complex}</td></tr>
        <tr><th>동·호수</th><td class="big-ho">${a.house_dong}동 ${a.house_ho}호</td></tr>
        <tr><th>세대 구분</th><td>독립 세대 (1인)</td></tr>
        <tr><th>배정 상태</th><td><span class="badge ok">${a.house_status}</span></td></tr>
      </table>
    </div>
  </div>
  <div class="house-side">
    <div class="box panel"><div class="ph"><b>계약 확인</b></div>
      <ul class="pb checklist"><li>✔ ${a.rank}</li><li>✔ 계약 완료</li><li>✔ 사택 배정 완료</li></ul></div>
    <div class="box panel"><div class="ph"><b>열쇠 안내</b></div><div class="pb small">${nl2br(S.key_notice)}</div></div>
    <div class="box panel"><div class="ph"><b>입주 전 확인</b></div><div class="pb small">${nl2br(S.house_notice)}</div></div>
  </div>
</div>
<div class="btns center">
  ${showNext ? html`<form method="post" action="/register/house" class="inline"><button class="btn-blue big">입주 안내 확인 ▶</button></form>` : html`<a class="btn-blue big" href="/">홈으로</a>`}
  <button class="btn big" type="button" onclick="window.print()">배정 안내문 출력</button>
</div>`;
}
r.post('/register/house', auth.requireUser, async (req, res) => {
  if (req.agent.onboarding === 'assigned') {
    await db.run("UPDATE agents SET onboarding = 'prologue', prologue_node = NULL WHERE user_id = ?", [req.user.id]);
  }
  res.redirect('/prologue');
});

module.exports = { router: r, houseResult, agentFields, readAgent };
