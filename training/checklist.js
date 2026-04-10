(function () {
  var id = document.body.getAttribute('data-checklist-id');
  if (!id) return;
  var KEY = 'wc-pc-training-checklist-' + id;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }

  var state = load();
  document.querySelectorAll('[data-check-item]').forEach(function (el, i) {
    var key = el.getAttribute('data-check-item') || String(i);
    var input = el.querySelector('input[type="checkbox"]');
    if (!input) return;
    input.checked = !!state[key];
    input.addEventListener('change', function () {
      state[key] = input.checked;
      save(state);
    });
  });
})();
