/**
 * Shared unit meeting notes — action tracker persisted per meeting in Firestore.
 * Row layout: Date Captured | Action Description | Date Due | Responsibility |
 * Status | Category | Comments | Date Completed
 */
(function (global) {
  var auth, db, functions;
  var listeners = {};
  var dirty = {};
  var memberCache = {};

  var STATUS_OPTIONS = ['Open', 'In Progress', 'Done', 'Blocked', 'Cancelled'];
  var CATEGORY_OPTIONS = [
    'Prayer',
    'Follow-up',
    'Logistics',
    'Training',
    'Outreach',
    'Admin',
    'Worship',
    'Other',
  ];

  function init(opts) {
    auth = opts.auth;
    db = opts.db;
    functions = opts.functions || null;
    bindRespMenuChrome();
  }

  var respMenuChromeBound = false;
  function bindRespMenuChrome() {
    if (respMenuChromeBound || typeof document === 'undefined') return;
    respMenuChromeBound = true;
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && (t.closest('.mn-resp-picker') || t.closest('.mn-resp-menu'))) return;
      document.querySelectorAll('.mn-resp-picker[open]').forEach(closeRespPicker);
    });
    window.addEventListener('resize', function () {
      document.querySelectorAll('.mn-resp-picker[open]').forEach(placeRespMenu);
    });
    window.addEventListener(
      'scroll',
      function () {
        document.querySelectorAll('.mn-resp-picker[open]').forEach(placeRespMenu);
      },
      true
    );
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function noteDocId(unitId, meetingKey) {
    return String(unitId) + '__' + String(meetingKey).replace(/[/.#\[\]]/g, '_');
  }

  function todayYmdLagos() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function formatMeetingOptionLabel(m) {
    var ymd = m.dateYmd || '';
    if (!ymd) return m.key || 'Meeting';
    var p = String(ymd).split('-');
    if (p.length !== 3) return ymd + (m.dayName ? ' · ' + m.dayName : '');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    try {
      return d.toLocaleDateString('en-GB', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return ymd;
    }
  }

  function newActionId() {
    return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function blankAction(defaults) {
    defaults = defaults || {};
    var resp = normalizeResponsibility(defaults);
    return {
      id: newActionId(),
      dateCaptured: defaults.dateCaptured || todayYmdLagos(),
      actionDescription: defaults.actionDescription || '',
      dateDue: defaults.dateDue || '',
      responsibilityUids: resp.uids,
      responsibilityNames: resp.names,
      responsibilityAll: resp.all,
      responsibilityUid: resp.uids[0] || '',
      responsibilityName: responsibilityDisplayName(resp),
      status: defaults.status || 'Open',
      category: defaults.category || '',
      comments: defaults.comments || '',
      dateCompleted: defaults.dateCompleted || '',
    };
  }

  function normalizeResponsibility(a, members) {
    a = a || {};
    members = members || [];
    var uids = [];
    var names = [];
    var all = a.responsibilityAll === true;
    if (Array.isArray(a.responsibilityUids) && a.responsibilityUids.length) {
      a.responsibilityUids.forEach(function (uid, i) {
        if (!uid) return;
        uids.push(String(uid));
        names.push(
          String(
            (Array.isArray(a.responsibilityNames) && a.responsibilityNames[i]) ||
              'Assigned'
          )
        );
      });
    } else if (a.responsibilityUid) {
      uids = [String(a.responsibilityUid)];
      names = [String(a.responsibilityName || 'Assigned')];
    }
    if (all && members.length) {
      uids = members.map(function (m) {
        return m.uid;
      }).filter(Boolean);
      names = members.map(function (m) {
        return m.name || 'Member';
      });
    }
    if (
      !all &&
      members.length &&
      uids.length === members.length &&
      members.every(function (m) {
        return uids.indexOf(m.uid) !== -1;
      })
    ) {
      all = true;
    }
    return { uids: uids, names: names, all: all };
  }

  function responsibilityDisplayName(resp) {
    if (!resp) return '';
    if (resp.all) return 'All members';
    if (resp.names && resp.names.length) return resp.names.join(', ');
    return '';
  }

  function actionsToContent(actions) {
    return (actions || [])
      .map(function (a) {
        var parts = ['[' + (a.status || 'Open') + ']', a.actionDescription || '(no description)'];
        if (a.responsibilityName) parts.push('Resp: ' + a.responsibilityName);
        if (a.dateDue) parts.push('Due: ' + a.dateDue);
        if (a.category) parts.push('Cat: ' + a.category);
        if (a.comments) parts.push('Notes: ' + a.comments);
        if (a.dateCompleted) parts.push('Done: ' + a.dateCompleted);
        return parts.join(' · ');
      })
      .join('\n');
  }

  function normalizeActions(data, meetingDateYmd, members) {
    if (data && Array.isArray(data.actions) && data.actions.length) {
      return data.actions.map(function (a) {
        var resp = normalizeResponsibility(a, members);
        return {
          id: a.id || newActionId(),
          dateCaptured: a.dateCaptured || meetingDateYmd || todayYmdLagos(),
          actionDescription: a.actionDescription || '',
          dateDue: a.dateDue || '',
          responsibilityUids: resp.uids,
          responsibilityNames: resp.names,
          responsibilityAll: resp.all,
          responsibilityUid: resp.uids[0] || '',
          responsibilityName: responsibilityDisplayName(resp),
          status: a.status || 'Open',
          category: a.category || '',
          comments: a.comments || '',
          dateCompleted: a.dateCompleted || '',
        };
      });
    }
    var legacy = data && data.content ? String(data.content).trim() : '';
    if (legacy) {
      return parseLegacyContent(legacy, meetingDateYmd, members);
    }
    return [];
  }

  function parseLegacyContent(content, meetingDateYmd, members) {
    var raw = String(content || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return [];
    var chunks = [];
    var current = '';
    raw.split('\n').forEach(function (line) {
      if (/^\s*\[[^\]]+\]/.test(line) && current.trim()) {
        chunks.push(current.trim());
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    });
    if (current.trim()) chunks.push(current.trim());
    if (chunks.length === 1 && !/^\s*\[[^\]]+\]/.test(chunks[0])) {
      return [
        blankAction({
          dateCaptured: meetingDateYmd || todayYmdLagos(),
          actionDescription: raw,
          category: 'Other',
        }),
      ];
    }
    return chunks.map(function (chunk) {
      return parseLegacyChunk(chunk, meetingDateYmd, members);
    });
  }

  function parseLegacyChunk(chunk, meetingDateYmd, members) {
    var status = 'Open';
    var rest = String(chunk || '').trim();
    var sm = rest.match(/^\[([^\]]+)\]\s*(?:[—–-]\s*)?([\s\S]*)$/);
    if (sm) {
      status = sm[1];
      rest = sm[2] || '';
    }
    var fields = {};
    var descParts = [];
    rest.split(/\s·\s/).forEach(function (part) {
      var p = String(part || '').trim();
      var km = p.match(/^(Resp|Due|Cat|Notes|Done):\s*([\s\S]*)$/i);
      if (km) {
        var k = km[1].toLowerCase();
        var v = km[2].trim();
        if (k === 'resp') fields.responsibilityName = v;
        else if (k === 'due') fields.dateDue = v;
        else if (k === 'cat') fields.category = v;
        else if (k === 'notes') fields.comments = v;
        else if (k === 'done') fields.dateCompleted = v;
      } else if (p) {
        descParts.push(p);
      }
    });
    var name = fields.responsibilityName || '';
    var matched = (members || []).find(function (m) {
      return name && String(m.name || '').toLowerCase() === name.toLowerCase();
    });
    return blankAction({
      dateCaptured: meetingDateYmd || todayYmdLagos(),
      actionDescription: descParts.join('\n').trim(),
      dateDue: fields.dateDue || '',
      responsibilityUid: matched ? matched.uid : '',
      responsibilityName: name,
      responsibilityNames: name ? [name] : [],
      responsibilityUids: matched ? [matched.uid] : [],
      status: status,
      category: fields.category || '',
      comments: fields.comments || '',
      dateCompleted: fields.dateCompleted || '',
    });
  }

  function detachAll() {
    Object.keys(listeners).forEach(function (k) {
      if (listeners[k]) listeners[k]();
    });
    listeners = {};
    dirty = {};
  }

  function mountHtml(meetings, defaultKey) {
    var options = (meetings || [])
      .map(function (m) {
        return (
          '<option value="' +
          escapeHtml(m.key) +
          '" data-date="' +
          escapeHtml(m.dateYmd || '') +
          '"' +
          (m.key === defaultKey ? ' selected' : '') +
          '>' +
          escapeHtml(formatMeetingOptionLabel(m)) +
          '</option>'
        );
      })
      .join('');
    return (
      '<div class="meeting-notes mt-5 border-t border-slate-100 pt-4">' +
      '<div class="mn-header">' +
      '<div>' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-clipboard-list text-brand mr-1"></i>Meeting notes</h4>' +
      '<p class="text-xs text-slate-500 mt-1">Shared with everyone in this unit. Each action is its own card — tap a meeting date to reopen earlier notes.</p>' +
      '</div>' +
      '<span class="meeting-notes-status text-xs text-slate-500"></span>' +
      '</div>' +
      '<div class="mn-toolbar">' +
      '<div class="mn-meeting-pick">' +
      '<label class="mn-label">Meeting date</label>' +
      '<select class="meeting-notes-picker mn-control">' +
      (options || '<option value="">No meetings scheduled</option>') +
      '</select></div>' +
      '</div>' +
      '<div class="meeting-notes-table-wrap">' +
      '<table class="meeting-notes-table">' +
      '<thead><tr>' +
      '<th class="mn-col-captured">Date Captured</th>' +
      '<th class="mn-col-action">Action Description</th>' +
      '<th class="mn-col-due">Date Due</th>' +
      '<th class="mn-col-resp">Responsibility</th>' +
      '<th class="mn-col-status">Status</th>' +
      '<th class="mn-col-cat">Category</th>' +
      '<th class="mn-col-comments">Comments</th>' +
      '<th class="mn-col-done">Date Completed</th>' +
      '<th class="mn-col-del" aria-label="Remove"></th>' +
      '</tr></thead>' +
      '<tbody class="meeting-notes-rows"></tbody>' +
      '</table></div>' +
      '<div class="mn-footer">' +
      '<button type="button" class="notes-cmd mn-btn mn-btn-primary" data-cmd="add"><i class="fas fa-plus mr-1"></i>Add another row</button>' +
      '<div class="mn-footer-actions">' +
      '<span class="mn-saved-pill hidden" aria-live="polite"><i class="fas fa-circle-check"></i> Saved</span>' +
      '<button type="button" class="notes-cmd mn-btn mn-btn-primary" data-cmd="save"><i class="fas fa-floppy-disk mr-1"></i>Save</button>' +
      '<button type="button" class="notes-cmd mn-btn mn-btn-ghost hidden" data-cmd="edit"><i class="fas fa-pen mr-1"></i>Edit</button>' +
      '</div>' +
      '<p class="meeting-notes-empty text-xs text-slate-500">No actions yet — tap <strong>Add another row</strong>.</p>' +
      '</div></div>'
    );
  }

  function statusOptionsHtml(selected) {
    return STATUS_OPTIONS.map(function (s) {
      return (
        '<option value="' +
        escapeHtml(s) +
        '"' +
        (s === selected ? ' selected' : '') +
        '>' +
        escapeHtml(s) +
        '</option>'
      );
    }).join('');
  }

  function categoryOptionsHtml(selected) {
    var html = '<option value="">—</option>';
    CATEGORY_OPTIONS.forEach(function (c) {
      html +=
        '<option value="' +
        escapeHtml(c) +
        '"' +
        (c === selected ? ' selected' : '') +
        '>' +
        escapeHtml(c) +
        '</option>';
    });
    if (selected && CATEGORY_OPTIONS.indexOf(selected) === -1) {
      html +=
        '<option value="' +
        escapeHtml(selected) +
        '" selected>' +
        escapeHtml(selected) +
        '</option>';
    }
    return html;
  }

  function isMobileNotesLayout() {
    try {
      return window.matchMedia && window.matchMedia('(max-width: 639px)').matches;
    } catch (e) {
      return false;
    }
  }

  function responsibilityPickerHtml(action, members) {
    var resp = normalizeResponsibility(action, members);
    var uidSet = {};
    resp.uids.forEach(function (uid) {
      uidSet[uid] = true;
    });
    var allSelected =
      resp.all ||
      (!!members.length &&
        members.every(function (m) {
          return !!uidSet[m.uid];
        }));
    var menu =
      '<label class="mn-resp-option mn-resp-option-all">' +
      '<input type="checkbox" class="mn-resp-all" ' +
      (allSelected ? 'checked' : '') +
      ' />' +
      '<span>All members</span></label>';
    var seen = {};
    (members || []).forEach(function (m) {
      if (!m.uid) return;
      seen[m.uid] = true;
      menu +=
        '<label class="mn-resp-option">' +
        '<input type="checkbox" class="mn-resp-member" value="' +
        escapeHtml(m.uid) +
        '" data-name="' +
        escapeHtml(m.name || 'Member') +
        '"' +
        (allSelected || uidSet[m.uid] ? ' checked' : '') +
        ' />' +
        '<span>' +
        escapeHtml(m.name || 'Member') +
        '</span></label>';
    });
    resp.uids.forEach(function (uid, i) {
      if (seen[uid]) return;
      menu +=
        '<label class="mn-resp-option">' +
        '<input type="checkbox" class="mn-resp-member" value="' +
        escapeHtml(uid) +
        '" data-name="' +
        escapeHtml(resp.names[i] || 'Assigned') +
        '" checked />' +
        '<span>' +
        escapeHtml(resp.names[i] || 'Assigned') +
        '</span></label>';
    });
    if (!(members || []).length && !resp.uids.length) {
      menu +=
        '<p class="mn-resp-empty text-xs text-slate-500 px-1 py-2">No unit members loaded yet.</p>';
    }
    var label = allSelected
      ? 'All members'
      : resp.names.length
        ? resp.names.join(', ')
        : 'Choose people…';
    var mobile = isMobileNotesLayout();
    return (
      '<div class="mn-resp-picker' +
      (mobile ? ' mn-resp-mobile is-open' : '') +
      '">' +
      '<button type="button" class="mn-resp-summary" title="Responsibility">' +
      '<span class="mn-resp-summary-text">' +
      escapeHtml(label) +
      '</span>' +
      '<i class="fas fa-chevron-down mn-resp-caret" aria-hidden="true"></i>' +
      '</button>' +
      '<div class="mn-resp-menu" role="group" aria-label="Responsibility">' +
      menu +
      '<button type="button" class="mn-resp-done">Done — keep selected</button>' +
      '</div></div>'
    );
  }

  function respMenuFor(tr) {
    var picker = tr.querySelector('.mn-resp-picker');
    if (!picker) return tr;
    return picker._respMenu || picker.querySelector('.mn-resp-menu') || tr;
  }

  function readResponsibilityFromRow(tr) {
    var scope = respMenuFor(tr);
    var allCb = scope.querySelector('.mn-resp-all');
    var memberCbs = scope.querySelectorAll('.mn-resp-member');
    var all = !!(allCb && allCb.checked);
    var uids = [];
    var names = [];
    memberCbs.forEach(function (cb) {
      if (!cb.value) return;
      if (all || cb.checked) {
        uids.push(cb.value);
        names.push(cb.getAttribute('data-name') || 'Assigned');
      }
    });
    var resp = { uids: uids, names: names, all: all };
    return {
      responsibilityUids: uids,
      responsibilityNames: names,
      responsibilityAll: all,
      responsibilityUid: uids[0] || '',
      responsibilityName: responsibilityDisplayName(resp),
    };
  }

  function closeRespPicker(picker) {
    if (!picker) return;
    var menu = picker._respMenu || picker.querySelector('.mn-resp-menu');
    if (menu && !picker.contains(menu)) picker.appendChild(menu);
    if (menu) {
      menu.classList.remove('mn-resp-menu-float');
      menu.style.position = '';
      menu.style.top = '';
      menu.style.bottom = '';
      menu.style.left = '';
      menu.style.width = '';
      menu.style.maxHeight = '';
      menu.style.zIndex = '';
    }
    picker._respMenu = null;
    picker.classList.remove('is-open');
    if (picker.hasAttribute('open')) picker.removeAttribute('open');
  }

  var respDocBound = false;
  function bindRespDocClose() {
    if (respDocBound) return;
    respDocBound = true;
    document.addEventListener('mousedown', function (ev) {
      var t = ev.target;
      if (
        t &&
        t.closest &&
        (t.closest('.mn-resp-menu') || t.closest('.mn-resp-summary') || t.closest('.mn-resp-picker'))
      ) {
        return;
      }
      document.querySelectorAll('.mn-resp-picker.is-open').forEach(function (picker) {
        if (!picker.classList.contains('mn-resp-mobile')) closeRespPicker(picker);
      });
    });
  }

  function placeRespMenu(picker) {
    if (!picker || picker.classList.contains('mn-resp-mobile') || isMobileNotesLayout()) return;
    var menu = picker._respMenu || picker.querySelector('.mn-resp-menu');
    var summary = picker.querySelector('.mn-resp-summary');
    if (!menu || !summary) return;
    picker.classList.add('is-open');
    if (!picker._respMenu) {
      picker._respMenu = menu;
      document.body.appendChild(menu);
      menu.classList.add('mn-resp-menu-float');
    }
    var rect = summary.getBoundingClientRect();
    var menuW = Math.max(rect.width, 260);
    var left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - menuW - 12));
    var spaceBelow = window.innerHeight - rect.bottom - 16;
    var openUp = spaceBelow < 200 && rect.top > 180;
    menu.style.position = 'fixed';
    menu.style.left = left + 'px';
    menu.style.width = menuW + 'px';
    menu.style.zIndex = '80';
    if (openUp) {
      menu.style.top = 'auto';
      menu.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
      menu.style.maxHeight = Math.min(320, Math.max(160, rect.top - 16)) + 'px';
    } else {
      menu.style.bottom = 'auto';
      menu.style.top = (rect.bottom + 6) + 'px';
      menu.style.maxHeight = Math.min(320, Math.max(180, spaceBelow)) + 'px';
    }
  }

  function closeOtherRespPickers(except) {
    document.querySelectorAll('.mn-resp-picker.is-open').forEach(function (picker) {
      if (picker !== except && !picker.classList.contains('mn-resp-mobile')) closeRespPicker(picker);
    });
  }

  function refreshRespSummary(tr) {
    var textEl = tr.querySelector('.mn-resp-summary-text');
    if (!textEl) return;
    var data = readResponsibilityFromRow(tr);
    textEl.textContent = data.responsibilityName || '—';
  }

  function rowHtml(action, members) {
    return (
      '<tr class="meeting-notes-row" data-action-id="' +
      escapeHtml(action.id) +
      '">' +
      '<td class="mn-col-captured" data-label="Date Captured"><input type="date" class="mn-date-captured mn-cell" value="' +
      escapeHtml(action.dateCaptured) +
      '" title="Date Captured" /></td>' +
      '<td class="mn-col-action" data-label="Action Description"><textarea class="mn-description mn-cell mn-cell-text" rows="2" placeholder="What needs to be done…">' +
      escapeHtml(action.actionDescription) +
      '</textarea></td>' +
      '<td class="mn-col-due" data-label="Date Due"><input type="date" class="mn-date-due mn-cell" value="' +
      escapeHtml(action.dateDue) +
      '" title="Date Due" /></td>' +
      '<td class="mn-col-resp" data-label="Responsibility">' +
      responsibilityPickerHtml(action, members) +
      '</td>' +
      '<td class="mn-col-status" data-label="Status"><select class="mn-status mn-cell" title="Status">' +
      statusOptionsHtml(action.status) +
      '</select></td>' +
      '<td class="mn-col-cat" data-label="Category"><select class="mn-category mn-cell" title="Category">' +
      categoryOptionsHtml(action.category) +
      '</select></td>' +
      '<td class="mn-col-comments" data-label="Comments"><textarea class="mn-comments mn-cell mn-cell-text" rows="2" placeholder="Notes…">' +
      escapeHtml(action.comments) +
      '</textarea></td>' +
      '<td class="mn-col-done" data-label="Date Completed"><input type="date" class="mn-date-completed mn-cell" value="' +
      escapeHtml(action.dateCompleted) +
      '" title="Date Completed" /></td>' +
      '<td class="mn-col-del" data-label=""><button type="button" class="mn-remove" title="Remove row"><i class="fas fa-trash-can"></i><span class="mn-remove-text">Remove row</span></button></td>' +
      '</tr>'
    );
  }

  function readActionsFromDom(root) {
    var rows = root.querySelectorAll('.meeting-notes-row');
    var out = [];
    rows.forEach(function (tr) {
      var resp = readResponsibilityFromRow(tr);
      var status = (tr.querySelector('.mn-status') || {}).value || 'Open';
      var dateCompleted = (tr.querySelector('.mn-date-completed') || {}).value || '';
      out.push({
        id: tr.getAttribute('data-action-id') || newActionId(),
        dateCaptured: (tr.querySelector('.mn-date-captured') || {}).value || todayYmdLagos(),
        actionDescription: ((tr.querySelector('.mn-description') || {}).value || '').trim(),
        dateDue: (tr.querySelector('.mn-date-due') || {}).value || '',
        responsibilityUids: resp.responsibilityUids,
        responsibilityNames: resp.responsibilityNames,
        responsibilityAll: resp.responsibilityAll,
        responsibilityUid: resp.responsibilityUid,
        responsibilityName: resp.responsibilityName,
        status: status,
        category: (tr.querySelector('.mn-category') || {}).value || '',
        comments: ((tr.querySelector('.mn-comments') || {}).value || '').trim(),
        dateCompleted: dateCompleted,
      });
    });
    return out;
  }

  function renderRows(root, actions, members) {
    var tbody = root.querySelector('.meeting-notes-rows');
    var empty = root.querySelector('.meeting-notes-empty');
    if (!tbody) return;
    tbody.innerHTML = (actions || [])
      .map(function (a) {
        return rowHtml(a, members);
      })
      .join('');
    if (empty) {
      if (!actions || !actions.length) empty.classList.remove('hidden');
      else empty.classList.add('hidden');
    }
    bindRowEvents(root);
    applyLockedState(root);
  }

  function formatSavedAt(ts) {
    if (!ts || !ts.toDate) return '';
    try {
      return ts.toDate().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
    } catch (e) {
      return '';
    }
  }

  function syncModeUi(root) {
    var locked = !!root._notesLocked;
    var saveBtn = root.querySelector('[data-cmd="save"]');
    var editBtn = root.querySelector('[data-cmd="edit"]');
    var savedPill = root.querySelector('.mn-saved-pill');
    var addBtn = root.querySelector('[data-cmd="add"]');
    if (saveBtn) saveBtn.classList.toggle('hidden', locked);
    if (editBtn) editBtn.classList.toggle('hidden', !locked);
    if (savedPill) savedPill.classList.toggle('hidden', !locked);
    if (addBtn) addBtn.disabled = false;
    root.classList.toggle('mn-locked', locked);
  }

  function applyLockedState(root) {
    var locked = !!root._notesLocked;
    root.querySelectorAll('.mn-cell').forEach(function (el) {
      if (el.tagName === 'TEXTAREA') {
        if (locked) el.setAttribute('readonly', 'readonly');
        else el.removeAttribute('readonly');
        el.disabled = false;
        return;
      }
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT') {
        el.disabled = locked;
        el.removeAttribute('readonly');
      }
    });
    root.querySelectorAll('.mn-resp-picker').forEach(function (picker) {
      if (isMobileNotesLayout()) {
        picker.classList.add('mn-resp-mobile', 'is-open');
        closeRespPicker(picker);
        picker.classList.add('is-open');
      }
      if (locked) {
        if (!picker.classList.contains('mn-resp-mobile')) closeRespPicker(picker);
      }
      picker.classList.toggle('mn-resp-disabled', locked);
      var summary = picker.querySelector('.mn-resp-summary');
      if (summary) summary.disabled = locked;
      picker.querySelectorAll('input, .mn-resp-done').forEach(function (inp) {
        inp.disabled = locked;
      });
    });
    root.querySelectorAll('.mn-remove').forEach(function (btn) {
      btn.disabled = locked;
      btn.classList.toggle('hidden', locked);
    });
    syncModeUi(root);
  }

  function setLocked(root, locked) {
    root._notesLocked = !!locked;
    applyLockedState(root);
  }

  function enterEditMode(root) {
    setLocked(root, false);
    var statusEl = root.querySelector('.meeting-notes-status');
    if (statusEl && !statusEl.textContent) statusEl.textContent = 'Editing…';
  }

  function markDirty(root, opts) {
    var active = opts || root._notesOpts || {};
    if (!active.unitId || !active.meetingKey) return;
    var docId = noteDocId(active.unitId, active.meetingKey);
    dirty[docId] = true;
    var statusEl = root.querySelector('.meeting-notes-status');
    if (statusEl) statusEl.textContent = 'Unsaved changes';
    var savedPill = root.querySelector('.mn-saved-pill');
    if (savedPill) savedPill.classList.add('hidden');
  }

  function saveNote(root, opts) {
    if (!auth || !auth.currentUser || !db) return Promise.resolve();
    var statusEl = root.querySelector('.meeting-notes-status');
    if (!opts.meetingKey) return Promise.resolve();
    var actions = readActionsFromDom(root);
    var docId = noteDocId(opts.unitId, opts.meetingKey);
    var name =
      opts.profileName ||
      auth.currentUser.displayName ||
      (auth.currentUser.email || '').split('@')[0] ||
      'Member';
    if (statusEl) statusEl.textContent = 'Saving…';
    var saveBtn = root.querySelector('[data-cmd="save"]');
    if (saveBtn) saveBtn.disabled = true;
    return db
      .collection('nigeria_unit_meeting_notes')
      .doc(docId)
      .set(
        {
          unitId: opts.unitId,
          meetingKey: opts.meetingKey,
          meetingDateYmd: opts.meetingDateYmd || '',
          unitLabel: opts.unitLabel || '',
          actions: actions,
          content: actionsToContent(actions),
          updatedByUid: auth.currentUser.uid,
          updatedByName: name,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        dirty[docId] = false;
        if (statusEl) statusEl.textContent = 'Saved just now';
        setLocked(root, true);
        if (functions) {
          functions
            .httpsCallable('syncNigeriaMeetingNoteActions', { timeout: 45000 })({ noteId: docId })
            .catch(function () {
              /* boards/emails refresh on next save or scheduled job */
            });
        }
      })
      .catch(function (e) {
        if (statusEl) statusEl.textContent = (e && e.message) || 'Save failed';
        setLocked(root, false);
      })
      .then(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function bindRowEvents(root) {
    var opts = root._notesOpts || {};
    root.querySelectorAll('.meeting-notes-row').forEach(function (tr) {
      if (tr.dataset.bound === '1') return;
      tr.dataset.bound = '1';

      var statusSel = tr.querySelector('.mn-status');
      var completedInp = tr.querySelector('.mn-date-completed');
      if (statusSel) {
        statusSel.addEventListener('change', function () {
          if (root._notesLocked) return;
          if (statusSel.value === 'Done' && completedInp && !completedInp.value) {
            completedInp.value = todayYmdLagos();
          }
          markDirty(root, root._notesOpts || opts);
        });
      }

      var allCb = respMenuFor(tr).querySelector('.mn-resp-all');
      var memberCbs = respMenuFor(tr).querySelectorAll('.mn-resp-member');
      if (allCb) {
        allCb.addEventListener('change', function () {
          if (root._notesLocked) return;
          memberCbs.forEach(function (cb) {
            cb.checked = allCb.checked;
          });
          refreshRespSummary(tr);
          markDirty(root, root._notesOpts || opts);
          if (!isMobileNotesLayout()) {
            var stayOpenAll = tr.querySelector('.mn-resp-picker');
            if (stayOpenAll && stayOpenAll.classList.contains('is-open')) placeRespMenu(stayOpenAll);
          }
        });
      }
      memberCbs.forEach(function (cb) {
        cb.addEventListener('change', function () {
          if (root._notesLocked) return;
          if (allCb) {
            var every = true;
            var any = false;
            memberCbs.forEach(function (m) {
              if (m.checked) any = true;
              else every = false;
            });
            allCb.checked = every && memberCbs.length > 0;
            if (!any) allCb.checked = false;
          }
          refreshRespSummary(tr);
          markDirty(root, root._notesOpts || opts);
          if (!isMobileNotesLayout()) {
            var stayOpen = tr.querySelector('.mn-resp-picker');
            if (stayOpen && stayOpen.classList.contains('is-open')) placeRespMenu(stayOpen);
          }
        });
      });

      var picker = tr.querySelector('.mn-resp-picker');
      if (picker && picker.dataset.menuBound !== '1') {
        picker.dataset.menuBound = '1';
        bindRespDocClose();
        var summaryBtn = picker.querySelector('.mn-resp-summary');
        if (summaryBtn) {
          summaryBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (root._notesLocked) return;
            if (isMobileNotesLayout() || picker.classList.contains('mn-resp-mobile')) return;
            if (picker.classList.contains('is-open')) {
              closeRespPicker(picker);
              return;
            }
            closeOtherRespPickers(picker);
            placeRespMenu(picker);
          });
        }
        var doneBtn = respMenuFor(tr).querySelector('.mn-resp-done');
        if (doneBtn) {
          doneBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            refreshRespSummary(tr);
            if (!picker.classList.contains('mn-resp-mobile')) closeRespPicker(picker);
          });
        }
      }

      tr.querySelectorAll('input, textarea, select').forEach(function (el) {
        if (el.classList.contains('mn-resp-all') || el.classList.contains('mn-resp-member')) {
          return;
        }
        el.addEventListener('input', function () {
          if (root._notesLocked) return;
          markDirty(root, root._notesOpts || opts);
        });
        el.addEventListener('change', function () {
          if (root._notesLocked) return;
          markDirty(root, root._notesOpts || opts);
        });
      });

      var removeBtn = tr.querySelector('.mn-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', function () {
          if (root._notesLocked) {
            enterEditMode(root);
          }
          if (!window.confirm('Remove this action row?')) return;
          var openPicker = tr.querySelector('.mn-resp-picker');
          if (openPicker) closeRespPicker(openPicker);
          tr.remove();
          var empty = root.querySelector('.meeting-notes-empty');
          var remaining = root.querySelectorAll('.meeting-notes-row').length;
          if (empty) {
            if (!remaining) empty.classList.remove('hidden');
            else empty.classList.add('hidden');
          }
          markDirty(root, root._notesOpts || opts);
        });
      }
    });
  }

  function addActionRow(root) {
    enterEditMode(root);
    var members = (root._notesOpts && root._notesOpts.members) || [];
    var tbody = root.querySelector('.meeting-notes-rows');
    var empty = root.querySelector('.meeting-notes-empty');
    if (!tbody) return;
    var action = blankAction({ dateCaptured: todayYmdLagos() });
    tbody.insertAdjacentHTML('beforeend', rowHtml(action, members));
    if (empty) empty.classList.add('hidden');
    bindRowEvents(root);
    applyLockedState(root);
    markDirty(root, root._notesOpts);
    var last = tbody.lastElementChild;
    var desc = last && last.querySelector('.mn-description');
    if (desc) {
      desc.focus();
      try {
        last.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (e) {}
    }
  }

  function loadMembers(opts) {
    if (memberCache[opts.unitId] && memberCache[opts.unitId].length > 1) {
      return Promise.resolve(memberCache[opts.unitId]);
    }
    if (!functions) return Promise.resolve(opts.members || []);
    return functions
      .httpsCallable('getNigeriaUnitMemberOptions', { timeout: 45000 })({ unitId: opts.unitId })
      .then(function (res) {
        var members = (res.data && res.data.members) || [];
        if (!members.length && opts.members && opts.members.length) members = opts.members;
        memberCache[opts.unitId] = members;
        return members;
      })
      .catch(function () {
        return opts.members || memberCache[opts.unitId] || [];
      });
  }

  function subscribeNote(root, opts) {
    var key = noteDocId(opts.unitId, opts.meetingKey);
    // Only one active notes listener per editor — dropping the previous meeting's
    // snapshot stops it from overwriting the UI after the date picker changes.
    if (root._notesListenerKey && listeners[root._notesListenerKey]) {
      listeners[root._notesListenerKey]();
      delete listeners[root._notesListenerKey];
    }
    if (listeners[key]) {
      listeners[key]();
      delete listeners[key];
    }
    root._notesListenerKey = key;
    var statusEl = root.querySelector('.meeting-notes-status');
    if (!opts.meetingKey) return;

    if (statusEl) statusEl.textContent = 'Loading notes…';

    listeners[key] = db
      .collection('nigeria_unit_meeting_notes')
      .doc(key)
      .onSnapshot(
        function (snap) {
          // Skip only while this meeting still has unsaved local edits.
          if (dirty[key]) return;
          var data = snap.exists ? snap.data() : null;
          var actions = normalizeActions(data, opts.meetingDateYmd, opts.members || []);
          root._notesLocked = snap.exists;
          renderRows(root, actions, opts.members || []);
          if (statusEl) {
            if (!data && (!actions || !actions.length)) {
              statusEl.textContent = 'No notes yet for this meeting date';
            } else if (data) {
              statusEl.textContent =
                'Updated by ' +
                (data.updatedByName || 'member') +
                (data.updatedAt ? ' · ' + formatSavedAt(data.updatedAt) : '');
            } else {
              statusEl.textContent = '';
            }
          }
        },
        function (e) {
          if (statusEl) statusEl.textContent = (e && e.message) || 'Could not load notes';
        }
      );
  }

  function markOptionHasNotes(picker, meetingKey) {
    if (!picker || !meetingKey) return;
    var opt = null;
    for (var i = 0; i < picker.options.length; i++) {
      if (picker.options[i].value === meetingKey) {
        opt = picker.options[i];
        break;
      }
    }
    if (!opt) return;
    var base = opt.getAttribute('data-base-label') || opt.textContent.replace(/\s*·\s*has notes\s*$/i, '');
    opt.setAttribute('data-base-label', base);
    if (!/\bhas notes\b/i.test(opt.textContent)) {
      opt.textContent = base + ' · has notes';
    }
  }

  function enrichPickerWithSavedNotes(root, opts) {
    if (!db || !opts || !opts.unitId) return;
    var picker = root.querySelector('.meeting-notes-picker');
    if (!picker) return;
    for (var i = 0; i < picker.options.length; i++) {
      var o = picker.options[i];
      if (!o.getAttribute('data-base-label')) {
        o.setAttribute('data-base-label', o.textContent);
      }
    }
    db.collection('nigeria_unit_meeting_notes')
      .where('unitId', '==', opts.unitId)
      .get()
      .then(function (snap) {
        if (!snap || snap.empty) return;
        var unit = window.NigeriaUnits && NigeriaUnits.getUnit(opts.unitId);
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var mk = d.meetingKey || '';
          var ymd = d.meetingDateYmd || '';
          if (!mk && ymd && unit) {
            mk = NigeriaUnits.meetingKey(unit.id, ymd);
          }
          if (!mk) return;
          var found = false;
          for (var j = 0; j < picker.options.length; j++) {
            if (picker.options[j].value === mk) {
              found = true;
              break;
            }
          }
          if (!found && ymd) {
            var label = formatMeetingOptionLabel({ dateYmd: ymd, key: mk });
            var opt = document.createElement('option');
            opt.value = mk;
            opt.setAttribute('data-date', ymd);
            opt.setAttribute('data-base-label', label);
            opt.textContent = label;
            // Keep chronological order by data-date
            var inserted = false;
            for (var k = 0; k < picker.options.length; k++) {
              var otherYmd = picker.options[k].getAttribute('data-date') || '';
              if (otherYmd && ymd < otherYmd) {
                picker.insertBefore(opt, picker.options[k]);
                inserted = true;
                break;
              }
            }
            if (!inserted) picker.appendChild(opt);
          }
          markOptionHasNotes(picker, mk);
        });
      })
      .catch(function () {
        /* query optional — notes still load by doc id */
      });
  }

  function bindToolbar(root, opts) {
    if (root.dataset.editorBound === '1') return;
    root.dataset.editorBound = '1';
    root.querySelectorAll('.notes-cmd').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var active = root._notesOpts || opts;
        var cmd = btn.getAttribute('data-cmd');
        if (cmd === 'save') {
          saveNote(root, active).then(function () {
            markOptionHasNotes(root.querySelector('.meeting-notes-picker'), active.meetingKey);
          });
          return;
        }
        if (cmd === 'edit') {
          enterEditMode(root);
          var first = root.querySelector('.mn-description');
          if (first) first.focus();
          return;
        }
        if (cmd === 'add') {
          addActionRow(root);
        }
      });
    });
  }

  function attach(root, opts) {
    if (!root || !opts || !opts.unitId) return;
    root._notesOpts = Object.assign({}, opts);
    var picker = root.querySelector('.meeting-notes-picker');
    if (picker && !picker.dataset.bound) {
      picker.dataset.bound = '1';
      picker.addEventListener('change', function () {
        var previous = root._notesOpts || opts;
        var prevDocId =
          previous.unitId && previous.meetingKey
            ? noteDocId(previous.unitId, previous.meetingKey)
            : '';
        if (prevDocId && dirty[prevDocId]) {
          var keep = window.confirm(
            'You have unsaved changes on the previous meeting date.\n\nOK = switch and discard them\nCancel = stay and Save first'
          );
          if (!keep) {
            picker.value = previous.meetingKey || '';
            return;
          }
          dirty[prevDocId] = false;
        }
        var selected = picker.options[picker.selectedIndex];
        var meetingKey = picker.value;
        var meetingDateYmd = selected ? selected.getAttribute('data-date') || '' : '';
        root._notesOpts.meetingKey = meetingKey;
        root._notesOpts.meetingDateYmd = meetingDateYmd;
        // Allow the new meeting's snapshot to paint even if we were mid-edit before.
        root._notesLocked = undefined;
        subscribeNote(root, root._notesOpts);
      });
    }

    if (!opts.meetingKey && picker && picker.value) {
      opts.meetingKey = picker.value;
      var sel = picker.options[picker.selectedIndex];
      opts.meetingDateYmd = sel ? sel.getAttribute('data-date') || '' : '';
      root._notesOpts = Object.assign({}, opts);
    }
    if (!opts.meetingKey) return;

    bindToolbar(root, root._notesOpts);
    enrichPickerWithSavedNotes(root, root._notesOpts);

    loadMembers(root._notesOpts).then(function (members) {
      root._notesOpts.members = members;
      subscribeNote(root, root._notesOpts);
    });
  }

  global.DDBSNigeriaMeetingNotes = {
    init: init,
    mountHtml: mountHtml,
    attach: attach,
    detachAll: detachAll,
    noteDocId: noteDocId,
    actionsToContent: actionsToContent,
  };
})(typeof window !== 'undefined' ? window : this);
