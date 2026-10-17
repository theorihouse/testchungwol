// 입주 프롤로그 비주얼노벨 엔진: 대사 타자 효과, 선택지, 대화 기록, 서버에 진행 저장
(function () {
  var data = JSON.parse(document.getElementById('vn-data').textContent);
  var byId = {};
  data.script.forEach(function (n) { byId[n.id] = n; });
  var order = data.script.map(function (n) { return n.id; });
  var log = data.log || [];
  var cur = null, typing = null, full = '';

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('vn-stage'), bg = $('vn-bg'), sprite = $('vn-sprite'), nameEl = $('vn-name'), textEl = $('vn-text'),
    choicesEl = $('vn-choices'), nextEl = $('vn-next'), locEl = $('vn-loc'), whereEl = $('vn-where'), stepsEl = $('vn-steps');

  function save(extra) {
    if (data.replay) return Promise.resolve();
    var body = Object.assign({ node: cur && cur.id, log: log }, extra || {});
    return fetch('/api/prologue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
  }

  function renderSteps(step) {
    stepsEl.innerHTML = '';
    data.steps.forEach(function (s, i) {
      var li = document.createElement('li');
      li.textContent = s;
      li.className = i + 1 < step ? 'done' : i + 1 === step ? 'on' : '';
      stepsEl.appendChild(li);
    });
  }

  function show(id) {
    var n = byId[id];
    if (!n) return finish();
    cur = n;
    bg.style.backgroundImage = 'url("' + n.bg.replace(/"/g, '%22') + '")';
    if (n.sprite) { sprite.src = n.sprite; sprite.classList.remove('hide'); } else { sprite.classList.add('hide'); }
    locEl.textContent = n.location;
    whereEl.textContent = n.location;
    nameEl.textContent = n.speaker;
    renderSteps(n.step);
    choicesEl.classList.remove('on');
    choicesEl.innerHTML = '';
    nextEl.style.visibility = 'hidden';
    full = n.text;
    var i = 0;
    textEl.textContent = '';
    clearInterval(typing);
    typing = setInterval(function () {
      i += 1;
      textEl.textContent = full.slice(0, i);
      if (i >= full.length) doneTyping();
    }, 28);
    log.push({ s: n.speaker || '', t: n.text });
    save();
  }

  function doneTyping() {
    clearInterval(typing);
    typing = null;
    textEl.textContent = full;
    if (cur.choices.length) {
      cur.choices.forEach(function (c, i) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<b>' + (i + 1) + '.</b>';
        b.appendChild(document.createTextNode(c.label));
        b.addEventListener('click', function (e) { e.stopPropagation(); choose(i); });
        li.appendChild(b);
        choicesEl.appendChild(li);
      });
      choicesEl.classList.add('on');
    } else {
      nextEl.style.visibility = 'visible';
    }
  }

  function choose(i) {
    var c = cur.choices[i];
    if (!c) return;
    log.push({ s: '▶ 나', t: c.label });
    show(c.next);
  }

  function advance() {
    if (!cur) return;
    if (typing) return doneTyping();
    if (cur.choices.length) return;
    var nx = cur.next;
    if (!nx) { var k = order.indexOf(cur.id); nx = order[k + 1]; }
    if (!nx || nx === 'END') return finish();
    show(nx);
  }

  function finish() {
    clearInterval(typing);
    nameEl.textContent = '';
    textEl.textContent = data.replay ? '— 프롤로그 다시 보기를 마쳤습니다 —' : '— 입주 완료. 충월시에서의 생활이 시작됩니다 —';
    choicesEl.classList.remove('on');
    nextEl.style.visibility = 'hidden';
    renderSteps(data.steps.length + 1);
    cur = null;
    save({ done: true }).then(function () {
      setTimeout(function () { location.href = data.replay ? '/house' : '/'; }, 1600);
    });
  }

  stage.addEventListener('click', advance);
  document.addEventListener('keydown', function (e) {
    if (!$('vn-log').hidden) { if (e.key === 'Escape') $('vn-log').hidden = true; return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && cur && cur.choices.length && !typing) choose(n - 1);
  });
  $('vn-log-btn').addEventListener('click', function () {
    var body = $('vn-log-body');
    body.innerHTML = '';
    log.forEach(function (l) {
      var p = document.createElement('p');
      if (l.s) { var b = document.createElement('b'); b.textContent = l.s; p.appendChild(b); }
      p.appendChild(document.createTextNode(l.t));
      body.appendChild(p);
    });
    $('vn-log').hidden = false;
    body.scrollTop = body.scrollHeight;
  });
  $('vn-log-close').addEventListener('click', function () { $('vn-log').hidden = true; });

  // 이어보기: 저장된 장면부터 (기록 중 마지막 항목은 다시 보여줄 장면이므로 뺀다)
  if (log.length && byId[data.start]) log.pop();
  show(byId[data.start] ? data.start : order[0]);
})();
