// 날짜: 연도를 드러내지 않는 365일 반복 달력. 날짜는 한국 시간 기준 현실 날짜를 따른다.
const nowIso = () => new Date().toISOString();

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours() };
}

const pad = (n) => String(n).padStart(2, '0');
const todayMd = () => { const k = kstNow(); return `${pad(k.month)}-${pad(k.day)}`; };

// mode '2007': 2007년 달력의 요일, 'real': 올해 현실 요일
function calYear(mode) {
  return mode === 'real' ? kstNow().year : 2007;
}
const WD = ['일', '월', '화', '수', '목', '금', '토'];
function weekday(month, day, mode) {
  return new Date(Date.UTC(calYear(mode), month - 1, day)).getUTCDay();
}
function daysIn(month, mode) {
  if (month === 2) return 28; // 연도 없는 365일 달력: 윤일은 쓰지 않는 가안
  return new Date(Date.UTC(calYear(mode), month, 0)).getUTCDate();
}

// 게시물 표시 날짜 "10.13" (md가 있으면 우선, 없으면 작성 시각의 한국 날짜)
function postDate(p) {
  if (p.md) return p.md.replace('-', '.');
  if (!p.created_at) return '';
  const d = new Date(new Date(p.created_at).getTime() + 9 * 3600 * 1000);
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}
function timeLabel(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);

module.exports = { nowIso, kstNow, pad, todayMd, weekday, daysIn, WD, postDate, timeLabel, lines };
