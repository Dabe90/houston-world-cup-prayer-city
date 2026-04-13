/**
 * Same slot model as index.html volunteer form (Selected shifts format).
 */
(function () {
  var SLOT_META = {
    'shift_2026-06-14_10-11': { date: 'June 14, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-06-14_11-12': { date: 'June 14, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-06-14_12-13': { date: 'June 14, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-06-14_13-14': { date: 'June 14, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-06-14_14-15': { date: 'June 14, 2026', time: '2:00 PM – 3:00 PM' },
    'shift_2026-06-17_10-11': { date: 'June 17, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-06-17_11-12': { date: 'June 17, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-06-17_12-13': { date: 'June 17, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-06-17_13-14': { date: 'June 17, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-06-17_14-15': { date: 'June 17, 2026', time: '2:00 PM – 3:00 PM' },
    'shift_2026-06-20_10-11': { date: 'June 20, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-06-20_11-12': { date: 'June 20, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-06-20_12-13': { date: 'June 20, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-06-20_13-14': { date: 'June 20, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-06-20_14-15': { date: 'June 20, 2026', time: '2:00 PM – 3:00 PM' },
    'shift_2026-06-23_10-11': { date: 'June 23, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-06-23_11-12': { date: 'June 23, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-06-23_12-13': { date: 'June 23, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-06-23_13-14': { date: 'June 23, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-06-23_14-15': { date: 'June 23, 2026', time: '2:00 PM – 3:00 PM' },
    'shift_2026-06-26_16-17': { date: 'June 26, 2026', time: '4:00 PM – 5:00 PM' },
    'shift_2026-06-26_17-18': { date: 'June 26, 2026', time: '5:00 PM – 6:00 PM' },
    'shift_2026-06-26_18-19': { date: 'June 26, 2026', time: '6:00 PM – 7:00 PM' },
    'shift_2026-06-26_19-20': { date: 'June 26, 2026', time: '7:00 PM – 8:00 PM' },
    'shift_2026-06-26_20-21': { date: 'June 26, 2026', time: '8:00 PM – 9:00 PM' },
    'shift_2026-06-29_10-11': { date: 'June 29, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-06-29_11-12': { date: 'June 29, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-06-29_12-13': { date: 'June 29, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-06-29_13-14': { date: 'June 29, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-06-29_14-15': { date: 'June 29, 2026', time: '2:00 PM – 3:00 PM' },
    'shift_2026-07-04_10-11': { date: 'July 4, 2026', time: '10:00 AM – 11:00 AM' },
    'shift_2026-07-04_11-12': { date: 'July 4, 2026', time: '11:00 AM – 12:00 PM' },
    'shift_2026-07-04_12-13': { date: 'July 4, 2026', time: '12:00 PM – 1:00 PM' },
    'shift_2026-07-04_13-14': { date: 'July 4, 2026', time: '1:00 PM – 2:00 PM' },
    'shift_2026-07-04_14-15': { date: 'July 4, 2026', time: '2:00 PM – 3:00 PM' },
  };

  var ROLE_OPTIONS = [
    '',
    'Prayer Partners',
    'Counselors',
    'Logistics and Welfare',
    'Photography and Video',
    'Social Media and Virtual Support',
  ];

  var DAY_TITLE = {
    'June 14, 2026': 'June 14, 2026 (Sunday)',
    'June 17, 2026': 'June 17, 2026 (Wednesday)',
    'June 20, 2026': 'June 20, 2026 (Saturday)',
    'June 23, 2026': 'June 23, 2026 (Tuesday)',
    'June 26, 2026': 'June 26, 2026 (Friday) · 4–9 PM',
    'June 29, 2026': 'June 29, 2026 (Monday)',
    'July 4, 2026': 'July 4, 2026 (Saturday)',
  };

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function groupByDate() {
    var byDate = {};
    var order = [];
    Object.keys(SLOT_META).forEach(function (k) {
      var d = SLOT_META[k].date;
      if (!byDate[d]) {
        byDate[d] = [];
        order.push(d);
      }
      byDate[d].push({ key: k, time: SLOT_META[k].time });
    });
    return { order: order, byDate: byDate };
  }

  function optionTags() {
    var o =
      '<option value="">— Not this slot —</option>';
    ROLE_OPTIONS.forEach(function (r) {
      if (!r) return;
      o += '<option value="' + escapeHtml(r) + '">' + escapeHtml(r) + '</option>';
    });
    return o;
  }

  function render(container) {
    if (!container) return;
    var g = groupByDate();
    var html = '';
    g.order.forEach(function (dateStr) {
      var title = DAY_TITLE[dateStr] || dateStr;
      var slots = g.byDate[dateStr];
      html += '<details class="border border-slate-200 rounded-xl mb-2 overflow-hidden bg-white" open>';
      html +=
        '<summary class="cursor-pointer list-none px-3 py-2.5 bg-slate-50 font-medium text-slate-900 text-sm flex justify-between items-center">';
      html += '<span>' + escapeHtml(title) + '</span>';
      html += '<i class="fas fa-chevron-down text-slate-400 text-xs"></i></summary>';
      html += '<div class="p-3 grid gap-2 sm:grid-cols-2 min-w-0">';
      slots.forEach(function (s) {
        html += '<div class="space-y-1">';
        html +=
          '<label class="block text-xs text-slate-600">' + escapeHtml(s.time) + '</label>';
        html +=
          '<select data-slot-key="' +
          escapeHtml(s.key) +
          '" class="dash-shift-select w-full rounded-lg border border-slate-200 px-2 py-2 text-sm focus:ring-2 focus:ring-brand-light outline-none bg-white">';
        html += optionTags();
        html += '</select></div>';
      });
      html += '</div></details>';
    });
    container.innerHTML = html;
  }

  function getSelectedLines(root) {
    root = root || document;
    var list = [];
    root.querySelectorAll('select.dash-shift-select').forEach(function (sel) {
      var val = (sel.value || '').trim();
      if (!val) return;
      var key = sel.getAttribute('data-slot-key');
      var meta = SLOT_META[key];
      if (meta) list.push(meta.date + ' — ' + meta.time + ' — ' + val);
    });
    return list;
  }

  function findSlotKeyForLine(date, time) {
    var k;
    for (k in SLOT_META) {
      if (SLOT_META[k].date === date && SLOT_META[k].time === time) {
        return k;
      }
    }
    return null;
  }

  function applyShiftsText(root, text) {
    root = root || document;
    root.querySelectorAll('select.dash-shift-select').forEach(function (sel) {
      sel.value = '';
    });
    var t = String(text || '');
    if (!t.trim()) return;
    var lines = t.split(/\r?\n/);
    lines.forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var parts = line.split(' — ');
      if (parts.length < 3) return;
      var date = parts[0].trim();
      var time = parts[1].trim();
      var role = parts.slice(2).join(' — ').trim();
      var key = findSlotKeyForLine(date, time);
      if (!key) return;
      if (ROLE_OPTIONS.indexOf(role) === -1) return;
      var sel = root.querySelector('select[data-slot-key="' + key + '"]');
      if (sel) sel.value = role;
    });
  }

  function buildSheetPayload(root) {
    var lines = getSelectedLines(root);
    var shifts = lines.join('\n');
    var dates = [];
    var times = [];
    var roles = [];
    lines.forEach(function (line) {
      var parts = line.split(' — ');
      if (parts.length >= 3) {
        dates.push(parts[0].trim());
        times.push(parts[1].trim());
        roles.push(parts.slice(2).join(' — ').trim());
      }
    });
    var u = function (arr) {
      var seen = {};
      var out = [];
      arr.forEach(function (x) {
        if (x && !seen[x]) {
          seen[x] = true;
          out.push(x);
        }
      });
      return out;
    };
    var dateStr = u(dates).join('; ');
    var timeslot = u(times).join('; ');
    var position = u(roles).join(', ');
    return {
      dateStr: dateStr,
      position: position,
      timeslot: timeslot,
      shifts: shifts,
    };
  }

  window.VolunteerShiftPicker = {
    SLOT_META: SLOT_META,
    render: render,
    getSelectedLines: getSelectedLines,
    applyShiftsText: applyShiftsText,
    buildSheetPayload: buildSheetPayload,
  };
})();
