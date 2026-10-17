// 관리자: 이미지 고르기 미리보기, 이미지 올리기
document.querySelectorAll('.img-pick').forEach(function (box) {
  var url = box.querySelector('.img-url'), sel = box.querySelector('.img-sel'), prev = box.querySelector('.img-prev');
  sel.addEventListener('change', function () { if (sel.value) { url.value = sel.value; prev.src = sel.value; } });
  url.addEventListener('input', function () { prev.src = url.value || '/img/avatar-blank.svg'; });
});

function cwUpload() {
  var files = Array.from(document.getElementById('img-file').files || []);
  var msg = document.getElementById('up-msg');
  if (!files.length) { msg.textContent = '파일을 고르십시오.'; return; }
  var done = 0;
  files.forEach(function (f) {
    if (f.size > 3 * 1024 * 1024) { msg.textContent = f.name + ': 3MB를 넘습니다.'; return; }
    var rd = new FileReader();
    rd.onload = function () {
      fetch('/admin/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, data: rd.result }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          done += 1;
          msg.textContent = j.ok ? done + '개 올림' : j.msg;
          if (done === files.length) location.href = '/admin/images?ok=' + encodeURIComponent('이미지를 올렸습니다.');
        });
    };
    rd.readAsDataURL(f);
  });
}
