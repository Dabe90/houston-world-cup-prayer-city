/**
 * Shared unit meeting notes — live Firestore sync for all members of a unit.
 */
(function (global) {
  var auth, db;
  var listeners = {};
  var saveTimers = {};
  var dirty = {};

  function init(opts) {
    auth = opts.auth;
    db = opts.db;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function noteDocId(unitId, meetingKey) {
    return String(unitId) + '__' + String(meetingKey).replace(/[/.#]/g, '_');
  }

  function detachAll() {
    Object.keys(listeners).forEach(function (k) {
      if (listeners[k]) listeners[k]();
    });
    listeners = {};
    Object.keys(saveTimers).forEach(function (k) {
      clearTimeout(saveTimers[k]);
    });
    saveTimers = {};
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
          escapeHtml(m.dateYmd || m.key) +
          (m.dayName ? ' · ' + escapeHtml(m.dayName) : '') +
          '</option>'
        );
      })
      .join('');
    return (
      '<div class="meeting-notes mt-5 border-t border-slate-100 pt-4">' +
      '<div class="flex flex-wrap items-center justify-between gap-2 mb-2">' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-pen-to-square text-brand mr-1"></i>Meeting notes</h4>' +
      '<span class="meeting-notes-status text-xs text-slate-500"></span></div>' +
      '<p class="text-xs text-slate-500 mb-2">Shared with everyone in this unit — pick a meeting date and type together.</p>' +
      '<label class="block text-xs font-semibold text-slate-600 mb-1">Meeting</label>' +
      '<select class="meeting-notes-picker w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-2 bg-white">' +
      (options || '<option value="">No meetings scheduled</option>') +
      '</select>' +
      '<div class="flex flex-wrap gap-1 mb-2 meeting-notes-toolbar">' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" data-cmd="bullet" title="Bullet line"><i class="fas fa-list-ul"></i></button>' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" data-cmd="number" title="Numbered line"><i class="fas fa-list-ol"></i></button>' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" data-cmd="action" title="Action item">☐</button>' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" data-cmd="divider" title="Divider">—</button>' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-50" data-cmd="save" title="Save now"><i class="fas fa-floppy-disk"></i> Save</button>' +
      '<button type="button" class="notes-cmd text-xs px-2 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50" data-cmd="clear" title="Clear notes">Clear</button>' +
      '</div>' +
      '<textarea class="meeting-notes-body w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[160px] focus:ring-2 focus:ring-ng-green outline-none" placeholder="Prayer points, announcements, assignments, follow-ups…"></textarea>' +
      '</div>'
    );
  }

  function applyCmd(textarea, cmd) {
    if (!textarea) return;
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var val = textarea.value;
    var lineStart = val.lastIndexOf('\n', start - 1) + 1;
    var lineEnd = val.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = val.length;
    var line = val.slice(lineStart, lineEnd);
    var insert = '';
    if (cmd === 'bullet') insert = line.trim() ? '- ' + line.replace(/^[-•]\s*/, '') : '- ';
    else if (cmd === 'number') insert = line.trim() ? '1. ' + line.replace(/^\d+\.\s*/, '') : '1. ';
    else if (cmd === 'action') insert = line.trim() ? '☐ ' + line.replace(/^☐\s*/, '') : '☐ ';
    else if (cmd === 'divider') {
      insert = '\n---\n';
      textarea.value = val.slice(0, start) + insert + val.slice(end);
      textarea.focus();
      return;
    } else return;

    textarea.value = val.slice(0, lineStart) + insert + val.slice(lineEnd);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = lineStart + insert.length;
  }

  function formatSavedAt(ts) {
    if (!ts || !ts.toDate) return '';
    try {
      return ts.toDate().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
    } catch (e) {
      return '';
    }
  }

  function saveNote(root, opts) {
    if (!auth || !auth.currentUser || !db) return Promise.resolve();
    var textarea = root.querySelector('.meeting-notes-body');
    var statusEl = root.querySelector('.meeting-notes-status');
    if (!textarea) return Promise.resolve();
    var docId = noteDocId(opts.unitId, opts.meetingKey);
    var name =
      (opts.profileName) ||
      auth.currentUser.displayName ||
      (auth.currentUser.email || '').split('@')[0] ||
      'Member';
    if (statusEl) statusEl.textContent = 'Saving…';
    return db
      .collection('nigeria_unit_meeting_notes')
      .doc(docId)
      .set(
        {
          unitId: opts.unitId,
          meetingKey: opts.meetingKey,
          meetingDateYmd: opts.meetingDateYmd || '',
          unitLabel: opts.unitLabel || '',
          content: textarea.value,
          updatedByUid: auth.currentUser.uid,
          updatedByName: name,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .then(function () {
        dirty[docId] = false;
        if (statusEl) statusEl.textContent = 'Saved just now';
      })
      .catch(function (e) {
        if (statusEl) statusEl.textContent = (e && e.message) || 'Save failed';
      });
  }

  function scheduleSave(root, opts) {
    var docId = noteDocId(opts.unitId, opts.meetingKey);
    dirty[docId] = true;
    if (saveTimers[docId]) clearTimeout(saveTimers[docId]);
    saveTimers[docId] = setTimeout(function () {
      saveNote(root, opts);
    }, 1200);
  }

  function subscribeNote(root, opts) {
    var key = noteDocId(opts.unitId, opts.meetingKey);
    if (listeners[key]) {
      listeners[key]();
      delete listeners[key];
    }
    var textarea = root.querySelector('.meeting-notes-body');
    var statusEl = root.querySelector('.meeting-notes-status');
    if (!textarea || !opts.meetingKey) return;

    listeners[key] = db
      .collection('nigeria_unit_meeting_notes')
      .doc(key)
      .onSnapshot(
        function (snap) {
          if (!textarea) return;
          if (dirty[key] && document.activeElement === textarea) return;
          var data = snap.exists ? snap.data() : null;
          textarea.value = data && data.content ? data.content : '';
          if (statusEl) {
            if (!data) {
              statusEl.textContent = 'No notes yet — start typing';
            } else {
              statusEl.textContent =
                'Updated by ' +
                (data.updatedByName || 'member') +
                (data.updatedAt ? ' · ' + formatSavedAt(data.updatedAt) : '');
            }
          }
        },
        function (e) {
          if (statusEl) statusEl.textContent = (e && e.message) || 'Could not load notes';
        }
      );
  }

  function bindEditor(root, opts) {
    var textarea = root.querySelector('.meeting-notes-body');
    if (!textarea) return;

    textarea.addEventListener('input', function () {
      scheduleSave(root, root._notesOpts || opts);
    });

    root.querySelectorAll('.notes-cmd').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var active = root._notesOpts || opts;
        var cmd = btn.getAttribute('data-cmd');
        if (cmd === 'save') {
          saveNote(root, active);
          return;
        }
        if (cmd === 'clear') {
          if (!window.confirm('Clear notes for this meeting for everyone in the unit?')) return;
          textarea.value = '';
          saveNote(root, active);
          return;
        }
        applyCmd(textarea, cmd);
        scheduleSave(root, active);
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
        var selected = picker.options[picker.selectedIndex];
        var meetingKey = picker.value;
        var meetingDateYmd = selected ? selected.getAttribute('data-date') || '' : '';
        root._notesOpts.meetingKey = meetingKey;
        root._notesOpts.meetingDateYmd = meetingDateYmd;
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

    if (!root.dataset.editorBound) {
      root.dataset.editorBound = '1';
      bindEditor(root, root._notesOpts);
    }

    subscribeNote(root, root._notesOpts);
  }

  global.DDBSNigeriaMeetingNotes = {
    init: init,
    mountHtml: mountHtml,
    attach: attach,
    detachAll: detachAll,
    noteDocId: noteDocId,
  };
})(typeof window !== 'undefined' ? window : this);
