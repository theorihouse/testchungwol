// 관리자 페이지에서 편집 가능한 사이트 설정의 정의와 초기 콘텐츠(모두 기획서 v0.2 기준 가안).
const db = require('./db');
const { nowIso } = require('./util');

// type: text | textarea | lines | select | image | number
const SETTINGS = [
  // 공통
  { key: 'site_name', group: '공통', label: '사이트 이름', type: 'text', value: '충월시' },
  { key: 'logo_image', group: '공통', label: '로고 이미지', type: 'image', value: '/img/logo.png' },
  { key: 'top_menu', group: '공통', label: '상단 메뉴 (한 줄에 "이름|주소")', type: 'lines',
    value: '충월소식|/board/news\n시청업무|/board/work\n생활안내|/board/life\n직원마당|/board/free' },
  { key: 'top_menu_title', group: '공통', label: '상단 메뉴 제목', type: 'text', value: '충월시 생활·업무 안내' },
  { key: 'today_notice', group: '공통', label: '오늘의 안내 (상단 날짜 옆)', type: 'text', value: '야간 시설 점검' },
  { key: 'footer_text', group: '공통', label: '하단 문구', type: 'textarea',
    value: '충월시청 직원 전용 서비스 · 이 사이트에 등장하는 도시·기관·인물은 모두 가상입니다.\n공용 컴퓨터에서는 업무를 마친 뒤 반드시 로그아웃하십시오.' },
  { key: 'calendar_mode', group: '공통', label: '달력 요일 기준 (미정 항목 가안)', type: 'select',
    options: [['2007', '2007년 달력 모티프 요일'], ['real', '현실 오늘의 요일']], value: '2007' },

  // 메인 포털
  { key: 'left_menu', group: '메인 포털', label: '왼쪽 바로가기 (한 줄에 "이름|주소|아이콘")', type: 'lines',
    value: '시청|/board/notice|hall\n지역뉴스|/board/news|news\n업무게시판|/board/work|folder\n사건자료|/pending/사건자료|case\n생활정보|/board/life|tree\n만월아파트|/house|apt\n직원게시판|/board/free|people' },
  { key: 'panel_numbers', group: '메인 포털', label: '패널 제목 앞 번호 표시', type: 'select',
    options: [['on', '표시'], ['off', '숨김']], value: 'on' },
  { key: 'weather_today', group: '메인 포털', label: '오늘의 날씨', type: 'text', value: '18°C 맑음' },
  { key: 'weather_tomorrow', group: '메인 포털', label: '내일 날씨', type: 'text', value: '내일 : 20°C 구름많음' },
  { key: 'map_image', group: '메인 포털', label: '도시 안내도 이미지', type: 'image', value: '/img/map.png' },
  { key: 'apt_image', group: '메인 포털', label: '만월공영아파트 사진', type: 'image', value: '/img/hallway.jpg' },
  { key: 'apt_caption', group: '메인 포털', label: '만월공영아파트 사진 설명', type: 'text',
    value: '시민의 일상이 이어지는, 따뜻한 주거 공간입니다.' },
  { key: 'bulletin_title', group: '메인 포털', label: '시청 알림판 제목', type: 'text',
    value: '안내 방송이 두 번 들리면 응답하지 마십시오.' },
  { key: 'bulletin_body', group: '메인 포털', label: '시청 알림판 본문', type: 'textarea',
    value: '시민 여러분의 안전을 위한 안내입니다.\n이상 징후 발견 시, 즉시 담당 부서로 연락해 주시기 바랍니다.' },

  // 출입·로그인
  { key: 'gate_title', group: '출입·로그인', label: '초대 코드 화면 제목', type: 'text', value: '충월시청 직원 전용 서비스' },
  { key: 'gate_notice', group: '출입·로그인', label: '초대 코드 화면 안내', type: 'textarea',
    value: '이 서비스는 초대받은 직원만 이용할 수 있습니다.\n발급받은 초대 코드를 입력하십시오.' },
  { key: 'login_notice', group: '출입·로그인', label: '로그인 안내 (한 줄에 하나)', type: 'lines',
    value: '신규 요원은 [신규 요원 등록]에서 계정 등록 → 요원 정보 작성 → 계약 및 사택 배정 순으로 진행합니다.\n공용 컴퓨터에서는 아이디 저장을 사용하지 마십시오.\n비밀번호를 5회 이상 잘못 입력하면 담당자에게 문의하십시오.' },
  { key: 'login_warning', group: '출입·로그인', label: '로그인 연출 문구', type: 'text',
    value: '퇴직한 직원의 이름으로 접속하지 마십시오.' },
  { key: 'login_photo', group: '출입·로그인', label: '로그인 화면 사진', type: 'image', value: '/img/news-apt.jpg' },

  // 신규 등록
  { key: 'char_min_age', group: '신규 등록', label: '캐릭터 최소 나이 (성인 기준 가안)', type: 'number', value: '19' },
  { key: 'register_guide', group: '신규 등록', label: '작성 안내', type: 'textarea',
    value: '캐릭터 이름·나이·이전 직업은 게임 속 요원의 정보입니다. 실제 본인의 실명·나이·경력을 적지 마십시오.\n계약하게 된 계기는 자유롭게 작성하십시오. 다른 요원에게는 공개 소개만 보입니다.' },
  { key: 'terms_text', group: '신규 등록', label: '이용약관 (가안)', type: 'textarea',
    value: '[가안] 본 서비스는 초대받은 이용자만 사용할 수 있는 가상 세계관의 롤플레이 게임입니다.\n다른 이용자를 존중하고, 운영진의 안내에 따라 주십시오.\n세부 약관 문안은 운영진이 별도로 확정합니다.' },
  { key: 'privacy_text', group: '신규 등록', label: '개인정보처리방침 (가안)', type: 'textarea',
    value: '[가안] 아이디·비밀번호(암호화)·이메일을 계정 관리 목적으로만 보관합니다.\n세부 방침은 운영진이 별도로 확정합니다.' },

  // 계약·사택
  { key: 'agency_name', group: '계약·사택', label: '계약 기관 (미정, 화면 가안)', type: 'text', value: '충월시청' },
  { key: 'default_dept', group: '계약·사택', label: '기본 소속 부서 (미정, 화면 가안)', type: 'text', value: '이상현상대응과' },
  { key: 'default_rank', group: '계약·사택', label: '시작 직급', type: 'text', value: '계약직 요원' },
  { key: 'default_shift', group: '계약·사택', label: '오늘의 근무 기본값', type: 'text', value: '주간근무' },
  { key: 'contract_text', group: '계약·사택', label: '계약 안내문 (가안)', type: 'textarea',
    value: '[가안] 본인은 괴이 관리 업무임을 알고 계약직 요원으로 근무하는 데 동의합니다.\n계약과 동시에 만월공영아파트의 독립된 한 세대를 사택으로 제공받습니다. 사택은 사용 권한이며 소유권 이전이 아닙니다.\n세부 계약 문안은 운영진이 별도로 확정합니다.' },
  { key: 'house_complex', group: '계약·사택', label: '사택 단지 이름', type: 'text', value: '만월공영아파트' },
  { key: 'house_dongs', group: '계약·사택', label: '배정할 동 (쉼표 구분, 예시값)', type: 'text', value: '101,102,103,104,105' },
  { key: 'house_floors', group: '계약·사택', label: '층 수 (예시값)', type: 'number', value: '15' },
  { key: 'house_units', group: '계약·사택', label: '층당 세대 수 (예시값)', type: 'number', value: '4' },
  { key: 'house_photo', group: '계약·사택', label: '사택 배정 사진', type: 'image', value: '/img/news-apt.jpg' },
  { key: 'key_notice', group: '계약·사택', label: '열쇠 수령 안내 (가안)', type: 'textarea',
    value: '관리사무소에 배정 안내문과 요원증을 제시하고 열쇠를 받으십시오.\n관리사무소 운영 시간 외에는 경비실로 문의하십시오.' },
  { key: 'house_notice', group: '계약·사택', label: '입주 전 확인 사항', type: 'textarea',
    value: '만월공영아파트에는 일반 주민과 요원이 함께 거주합니다.\n요원 한 명당 독립된 한 세대가 제공됩니다.\n평형·가구·관리비 등 세부 주거 규칙은 추후 안내합니다.' },

  // 입주 프롤로그
  { key: 'vn_npc_image', group: '입주 프롤로그', label: '선임 NPC 기본 이미지', type: 'image', value: '/img/senior.svg' },
  { key: 'vn_default_bg', group: '입주 프롤로그', label: '기본 배경 이미지', type: 'image', value: '/img/news-apt.jpg' },
  { key: 'vn_steps', group: '입주 프롤로그', label: '입주 단계 (한 줄에 하나)', type: 'lines',
    value: '선임 만나기\n관리사무소에서 열쇠 수령\n배정받은 사택 방문\n첫 출근 안내받기' },
];

const POSTS = [
  // board, title, summary, body, image, status, featured, md, category
  ['news', '충월시 가을 장터 이번 주말 개최', '지역 상권 활력 기대', '구도심 충월상가 일대에서 이번 주말 가을 장터가 열린다. 지역 농특산물과 먹거리, 체험부스 등 다양한 프로그램이 운영될 예정이다.\n\n상인회 관계자는 "날이 일찍 저무니 늦은 시간에는 상가 안쪽 통로 이용을 자제해 달라"고 당부했다.', '/img/news-market.jpg', null, 1, '10-12', '지역'],
  ['news', '충월시, 노후 보행로 정비 사업 착수', '내달부터 단계적 추진', '시는 구도심 일대 노후 보행로 정비 사업에 착수한다고 밝혔다. 공사는 내달부터 구역별로 단계적으로 진행된다.', '/img/news-cityhall.jpg', null, 1, '10-11', '행정'],
  ['news', '가을 햅쌀 수확 한창, 지역 농가 \'풍년 기대\'', '직거래 장터도 준비', '충월시 외곽 들녘에서 햅쌀 수확이 한창이다. 농가들은 올해 작황이 좋다며 풍년을 기대하고 있다.\n\n한 농민은 "해 질 녘에는 논두렁에 누가 서 있어도 부르지 말라"는 옛말을 웃으며 전했다.', '/img/news-field.jpg', null, 1, '10-10', '생활'],
  ['news', '만월공영아파트, 야간 방송 설비 점검 예정', '쾌적한 주거환경 조성', '만월공영아파트 관리사무소는 이번 주 야간에 단지 내 방송 설비를 점검한다고 밝혔다.\n\n관리사무소는 "점검 중 같은 방송이 반복되더라도 별도의 응답은 필요하지 않다"고 안내했다.', '/img/news-apt.jpg', null, 1, '10-13', '사회'],
  ['notice', '만월공영아파트 정기 소독 안내', '전 동 정기 소독이 실시됩니다. 주민 여러분의 협조를 부탁드립니다.', '전 동 정기 소독이 실시됩니다. 주민 여러분의 협조를 부탁드립니다.', null, null, 0, '10-13', null],
  ['notice', '충월시 가을 장터 이번 주말 개최', '지역 농특산물, 먹거리, 체험부스 등 다양한 프로그램이 운영됩니다.', '지역 농특산물, 먹거리, 체험부스 등 다양한 프로그램이 운영됩니다.', null, null, 0, '10-12', null],
  ['notice', '야간 시설 점검 협조 안내', '시 주요 시설에 대한 야간 점검이 진행됩니다. 관계자 외 출입을 자제해 주시기 바랍니다.', '시 주요 시설에 대한 야간 점검이 진행됩니다. 관계자 외 출입을 자제해 주시기 바랍니다.', null, null, 0, '10-11', null],
  ['notice', '충월천 산책로 일부 구간 보수 공사 안내', '', '충월천 산책로 일부 구간에서 보수 공사가 진행됩니다.', null, null, 0, '10-10', null],
  ['life', '가을철 농작물 병해충 방제 지원 사업 신청 안내', '', '병해충 방제 지원 사업 신청을 받습니다.', null, null, 0, '10-09', null],
  ['life', '충월 시민 체육대회 개최 알림', '', '시민 체육대회가 시민공원에서 열립니다.', null, null, 0, '10-08', null],
  ['life', '시청 민원실 주말 운영 안내', '', '민원실은 주말 오전에도 운영합니다.', null, null, 0, '10-07', null],
  ['life', '어린이 놀이터시설 안전 점검 결과 알림', '', '관내 어린이 놀이터 안전 점검 결과를 알려드립니다.', null, null, 0, '10-06', null],
  ['work', '지하상가 야간 순찰', '', '구도심 지하상가 야간 순찰 요청입니다.', null, '접수중', 0, '10-13', '시설점검'],
  ['work', '반복되는 층간소음 신고', '', '같은 시각, 같은 소리가 반복된다는 신고가 접수되었습니다.', null, '확인중', 0, '10-12', '생활민원'],
  ['work', '만월아파트 배수로 점검 요청', '', '배수로에서 물이 거꾸로 흐른다는 민원입니다.', null, '처리중', 0, '10-11', '시설점검'],
  ['work', '구 시가지 가로등 일부 미점등', '', '가로등 일부가 켜지지 않는다는 신고입니다.', null, '완료', 0, '10-10', '현장대응'],
  ['work', '공원 화장실 시설 파손', '', '시민공원 화장실 시설 파손 신고입니다.', null, '확인중', 0, '10-09', '생활민원'],
  ['free', '점심시간 괜찮은 식당 추천 부탁드립니다.', '', '시청 근처에 괜찮은 국숫집 있을까요?', null, null, 0, '10-13', null],
  ['free', '만월아파트 근처 병원 진료시간 아시는 분?', '', '야간 진료하는 곳이 있는지 궁금합니다.', null, null, 0, '10-11', null],
  ['free', '이번 주말 장터 가시는 분 계신가요?', '', '같이 가실 분 구합니다.', null, null, 0, '10-09', null],
  ['free', '가을 되니까 시청 앞 은행나무가 정말 예쁘네요.', '', '출근길에 보니 노랗게 물들었네요.', null, null, 0, '10-08', null],
];

const SCHEDULE = [
  ['10-05', '충월시 가을 장터'], ['10-12', '농산물 직거래장터'], ['10-19', '만월아파트 소독 작업'], ['10-26', '하천 정화 활동'],
  ['01-01', '신정'], ['02-14', '발렌타인데이'], ['12-25', '크리스마스'],
];

// 선임 NPC 입주 프롤로그 (기획서 18장 대화·진행 순서 가안). {name} {house} {complex} 치환.
const VN = [
  { id: 'p1', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '', text: '전철 종점에서 버스를 한 번 더 갈아타고 나서야 만월공영아파트 정문이 보였다. 관리사무소 앞 게시판에는 빛바랜 공지가 몇 장 붙어 있다.', next: 'p2' },
  { id: 'p2', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '선임 요원', sprite: 'npc', text: '{name} 씨 맞죠? 반갑습니다. 오는 길 멀었죠.', next: 'p3' },
  { id: 'p3', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '선임 요원', sprite: 'npc', text: '사택 배정은 확인했죠? 앞으로 여기서 지내시면 됩니다. 우선 열쇠부터 받아갑시다.',
    choices: '네. 같이 들어가겠습니다.|p6\n다른 요원들도 여기 사나요?|p4\n사택에서도 괴이 사건이 생깁니까?|p5' },
  { id: 'p4', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '선임 요원', sprite: 'npc', text: '몇 명 살죠. 그래도 대부분은 일반 주민분들이에요. 엘리베이터에서 마주치면 그냥 이웃처럼 인사하면 됩니다. 일 얘기는 밖에서 하지 말고요.', next: 'p3b' },
  { id: 'p5', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '선임 요원', sprite: 'npc', text: '…대부분은 평범합니다. 가끔 이상한 일이 섞이긴 하는데, 그건 동네 어디나 그래요. 이상하다 싶으면 혼자 확인하지 말고 저한테 먼저 연락하세요.', next: 'p3b' },
  { id: 'p3b', step: 1, location: '만월공영아파트 관리사무소 앞', speaker: '선임 요원', sprite: 'npc', text: '자, 다른 건 들어가면서 얘기합시다.',
    choices: '네. 같이 들어가겠습니다.|p6\n다른 요원들도 여기 사나요?|p4\n사택에서도 괴이 사건이 생깁니까?|p5' },
  { id: 'p6', step: 2, location: '관리사무소', speaker: '', text: '관리사무소 안은 형광등 하나가 깜빡이고 있었다. 직원이 배정 안내문과 요원증을 번갈아 보더니 서랍에서 열쇠 꾸러미를 꺼냈다.', next: 'p7' },
  { id: 'p7', step: 2, location: '관리사무소', speaker: '관리사무소 직원', text: '{house} 맞으시죠. 여기 열쇠요. 방송은 신경 쓰지 마시고요.', next: 'p8' },
  { id: 'p8', step: 2, location: '관리사무소', speaker: '선임 요원', sprite: 'npc', text: '받았으면 됐습니다. 올라가 봅시다.', next: 'p9' },
  { id: 'p9', step: 3, location: '{house} 앞 복도', bg: '/img/hallway.jpg', speaker: '', text: '긴 복도 끝까지 같은 모양의 현관문이 늘어서 있다. 열쇠는 한 번에 맞았다. 안은 생각보다 깨끗했다.', next: 'p10' },
  { id: 'p10', step: 3, location: '{house} 앞 복도', bg: '/img/hallway.jpg', speaker: '선임 요원', sprite: 'npc', text: '혼자 쓰는 집이니까 편하게 지내요. 필요한 건 관리사무소에 말하면 되고요.',
    choices: '생각보다 괜찮네요.|p11\n밤에 방송이 나온다던데요?|p10b' },
  { id: 'p10b', step: 3, location: '{house} 앞 복도', bg: '/img/hallway.jpg', speaker: '선임 요원', sprite: 'npc', text: '아, 설비 점검이에요. 같은 방송이 반복돼도 대답할 필요는 없어요. …그것만 기억하면 됩니다.', next: 'p11' },
  { id: 'p11', step: 4, location: '{house} 앞 복도', bg: '/img/hallway.jpg', speaker: '선임 요원', sprite: 'npc', text: '내일 첫 출근은 구청 쪽으로 나오면 됩니다. 업무게시판 확인하는 법은 그때 알려줄게요. 오늘은 짐 풀고 푹 쉬어요, {name} 씨.', next: 'END' },
];

async function seed() {
  for (const s of SETTINGS) {
    await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', [s.key, s.value]);
  }
  const postCount = await db.get('SELECT COUNT(*) AS n FROM posts');
  if (Number(postCount.n) === 0) {
    for (const [board, title, summary, body, image, status, featured, md, category] of POSTS) {
      await db.run(
        'INSERT INTO posts (board, title, summary, body, image, status, featured, md, category, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [board, title, summary, body, image, status, featured, md, category, board === 'free' ? '익명 직원' : '충월시청', nowIso()]
      );
    }
  }
  const schedCount = await db.get('SELECT COUNT(*) AS n FROM schedule');
  if (Number(schedCount.n) === 0) {
    for (const [md, title] of SCHEDULE) await db.run('INSERT INTO schedule (md, title) VALUES (?, ?)', [md, title]);
  }
  const vnCount = await db.get('SELECT COUNT(*) AS n FROM vn_nodes');
  if (Number(vnCount.n) === 0) {
    let i = 0;
    for (const n of VN) {
      await db.run(
        'INSERT INTO vn_nodes (id, sort, step, location, bg, sprite, speaker, text, choices, next) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [n.id, (i += 10), n.step, n.location, n.bg || '', n.sprite || '', n.speaker, n.text, n.choices || '', n.next || '']
      );
    }
  }

  // 초기 초대 코드·관리자 계정 (환경 변수로 지정)
  const code = (process.env.INITIAL_INVITE_CODE || 'CHUNGWOL-2007').trim().toUpperCase();
  await db.run('INSERT INTO invites (code, memo, max_uses, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (code) DO NOTHING',
    [code, '초기 초대 코드', null, nowIso()]);

  const { hashPassword } = require('./auth');
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPw = process.env.ADMIN_PASSWORD || 'admin1234';
  const existing = await db.get('SELECT id FROM users WHERE username = ?', [adminUser]);
  if (!existing) {
    const rows = await db.run(
      "INSERT INTO users (username, pw_hash, role, invite_code, created_at) VALUES (?, ?, 'admin', ?, ?) RETURNING id",
      [adminUser, hashPassword(adminPw), code, nowIso()]
    );
    await db.run(
      "INSERT INTO agents (user_id, name, dept, rank, shift, onboarding, prologue_done) VALUES (?, '운영자', '운영지원', '관리자', '상시', 'done', 1)",
      [rows[0].id]
    );
  }
}

module.exports = { seed, SETTINGS };
