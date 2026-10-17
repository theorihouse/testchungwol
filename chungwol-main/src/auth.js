// 초대 코드 출입 → 로그인 세션. 쿠키 하나(cw_sid)에 출입 코드와 로그인 상태를 함께 담는다.
const crypto = require('crypto');
const db = require('./db');
const { nowIso } = require('./util');

const COOKIE = 'cw_sid';
const SESSION_DAYS = 30;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(String(pw), salt, 64);
  const want = Buffer.from(hash, 'hex');
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function setCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

// 초대 코드 검증: 활성 + 만료 전 + 사용 횟수 여유
async function checkInvite(code, { forSignup = false } = {}) {
  const inv = await db.get('SELECT * FROM invites WHERE code = ?', [String(code || '').trim().toUpperCase()]);
  if (!inv || !Number(inv.active)) return null;
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return null;
  if (forSignup && inv.max_uses != null && Number(inv.uses) >= Number(inv.max_uses)) return null;
  return inv;
}

async function createGateSession(res, code) {
  const token = crypto.randomBytes(24).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await db.run('INSERT INTO sessions (token, gate_code, created_at, expires_at) VALUES (?, ?, ?, ?)', [token, code, nowIso(), exp]);
  setCookie(res, token);
  return token;
}

async function loadSession(req, res, next) {
  try {
    req.sid = parseCookies(req.headers.cookie)[COOKIE] || null;
    req.gate = null;
    req.user = null;
    req.agent = null;
    if (req.sid) {
      const s = await db.get('SELECT * FROM sessions WHERE token = ?', [req.sid]);
      if (s && new Date(s.expires_at) > new Date()) {
        // 출입 코드가 비활성화되면 그 코드로 들어온 세션은 다시 코드를 입력해야 한다
        const inv = s.gate_code ? await checkInvite(s.gate_code) : null;
        if (inv) req.gate = s.gate_code;
        if (inv && s.user_id) {
          const u = await db.get('SELECT * FROM users WHERE id = ?', [s.user_id]);
          if (u && u.status === 'active') {
            req.user = u;
            req.agent = await db.get('SELECT * FROM agents WHERE user_id = ?', [u.id]);
            const seen = u.last_seen ? new Date(u.last_seen).getTime() : 0;
            if (Date.now() - seen > 60 * 1000) await db.run('UPDATE users SET last_seen = ? WHERE id = ?', [nowIso(), u.id]);
          }
        }
      }
    }
    res.locals.user = req.user;
    res.locals.agent = req.agent;
    next();
  } catch (e) {
    next(e);
  }
}

const ONBOARD_PATH = { profile: '/register/agent', contract: '/register/contract', assigned: '/register/house', prologue: '/prologue' };

function requireGate(req, res, next) {
  if (!req.gate) return res.redirect('/gate');
  next();
}
function requireUser(req, res, next) {
  if (!req.gate) return res.redirect('/gate');
  if (!req.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}
// 등록·계약·프롤로그를 마치지 않은 요원은 해당 단계로 보낸다
function requireOnboarded(req, res, next) {
  const step = req.agent ? req.agent.onboarding : 'profile';
  if (step !== 'done' && ONBOARD_PATH[step]) return res.redirect(ONBOARD_PATH[step]);
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).send('관리자만 접근할 수 있습니다.');
  next();
}

module.exports = {
  hashPassword, verifyPassword, checkInvite, createGateSession, loadSession,
  requireGate, requireUser, requireOnboarded, requireAdmin, ONBOARD_PATH, setCookie,
};
