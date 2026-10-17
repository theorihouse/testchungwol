// 탭, 글자 크기, 아이디 중복 확인, 캐릭터 이미지 미리보기
(function () {
  document.querySelectorAll('[data-tabs]').forEach(function (box) {
    box.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        box.querySelectorAll('.tab, .tab-b').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        document.getElementById(t.dataset.tab).classList.add('on');
      });
    });
  });
  var z = 1;
  try { z = parseFloat(localStorage.getItem('cw-zoom')) || 1; } catch (e) {}
  document.documentElement.style.setProperty('--zoom', z);
  window.cwZoom = function (d) {
    z = Math.min(1.4, Math.max(0.9, Math.round((z + d * 0.1) * 10) / 10));
    document.documentElement.style.setProperty('--zoom', z);
    try { localStorage.setItem('cw-zoom', z); } catch (e) {}
  };
})();

function cwCheckId() {
  var v = document.getElementById('reg-id').value;
  var out = document.getElementById('id-result');
  fetch('/api/check-id?username=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (j) {
    out.textContent = j.msg;
    out.style.color = j.ok ? '#22652f' : '#a12b25';
  });
}

function cwAvatar(input) {
  var f = input.files && input.files[0];
  if (!f) return;
  if (f.size > 1024 * 1024) { alert('1MB 이하 이미지만 올릴 수 있습니다.'); input.value = ''; return; }
  var rd = new FileReader();
  rd.onload = function () {
    document.getElementById('avatar-data').value = rd.result;
    document.getElementById('avatar-preview').src = rd.result;
  };
  rd.readAsDataURL(f);
}
