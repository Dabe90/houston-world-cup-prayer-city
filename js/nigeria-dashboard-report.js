/**
 * Full monthly unit report embedded in DDBS Nigeria dashboard Reports tab.
 * Reuses MonthlyUnitReport + attendance bridge + meeting notes intelligence.
 */
(function (global) {
  var mounted = false;
  var lastSummaryKey = '';

  function $(id) {
    return document.getElementById(id);
  }

  function reportShellHtml() {
    return (
      '<div id="ng-report-root" class="space-y-4">' +
      '<div id="report-status" class="hidden" role="status"></div>' +
      '<div id="nigeria-report-banner" class="hidden rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm"></div>' +
      '<div class="grid lg:grid-cols-5 gap-6">' +
      '<div class="lg:col-span-3 space-y-5">' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="bg-gradient-to-r from-brand to-brand-light px-5 py-3 text-white">' +
      '<h2 class="font-semibold flex items-center gap-2 text-sm"><i class="fas fa-user-circle"></i> Your information</h2></div>' +
      '<div class="p-5 space-y-4">' +
      '<div class="grid sm:grid-cols-2 gap-4">' +
      '<div><label for="reporter-name" class="block text-sm font-medium text-slate-700 mb-1">Your name <span class="text-red-500">*</span></label>' +
      '<input type="text" id="reporter-name" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-ng-green outline-none" /></div>' +
      '<div><label for="reporter-email" class="block text-sm font-medium text-slate-700 mb-1">Your email <span class="text-red-500">*</span></label>' +
      '<input type="email" id="reporter-email" required class="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-ng-green outline-none" /></div></div>' +
      '<div><label for="reporter-phone" class="block text-sm font-medium text-slate-700 mb-1">Phone <span class="text-slate-400 font-normal">(optional)</span></label>' +
      '<input type="tel" id="reporter-phone" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 focus:ring-2 focus:ring-ng-green outline-none" /></div>' +
      '</div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3 text-white">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-layer-group"></i> Select your ministry unit</h2>' +
      '<p class="text-violet-100 text-xs mt-1">Prayer City teams · DDBS Groups · Nigeria leadership units</p></div>' +
      '<div class="p-5"><div id="unit-cards"></div>' +
      '<div id="other-unit-wrap" class="hidden mt-4"><label for="unit-other-name" class="block text-sm font-medium text-slate-700 mb-1">Unit name <span class="text-red-500">*</span></label>' +
      '<input type="text" id="unit-other-name" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none" /></div></div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-3 text-white">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-calendar-days"></i> Reporting period</h2></div>' +
      '<div class="p-5 grid sm:grid-cols-2 gap-4">' +
      '<div><label for="report-month" class="block text-sm font-medium text-slate-700 mb-1">Month <span class="text-red-500">*</span></label>' +
      '<select id="report-month" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 bg-white outline-none"></select></div>' +
      '<div><label for="report-year" class="block text-sm font-medium text-slate-700 mb-1">Year <span class="text-red-500">*</span></label>' +
      '<select id="report-year" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 bg-white outline-none"></select></div>' +
      '<div><label for="meetings-held" class="block text-sm font-medium text-slate-700 mb-1">Meetings / gatherings held</label>' +
      '<input type="text" id="meetings-held" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none" placeholder="e.g. 4 weekly meetings" /></div>' +
      '<div><label for="attendance" class="block text-sm font-medium text-slate-700 mb-1">Attendance (avg or total)</label>' +
      '<input type="text" id="attendance" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none" placeholder="Auto-filled from check-ins when available" /></div>' +
      '</div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3 text-white flex flex-wrap items-center justify-between gap-2">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-wand-magic-sparkles"></i> Meeting notes intelligence</h2>' +
      '<button type="button" id="btn-summarize-notes" class="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg">Refresh summary</button></div>' +
      '<div class="p-5 space-y-2">' +
      '<p class="text-xs text-slate-500">Summarizes shared unit meeting notes for the selected month. Edit before submitting.</p>' +
      '<p id="notes-summary-status" class="text-xs text-slate-500"></p>' +
      '<textarea id="meeting-notes-summary" rows="5" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm resize-y min-h-[120px] focus:ring-2 focus:ring-ng-green outline-none" placeholder="Select unit and month, then generate a summary from meeting notes…"></textarea>' +
      '</div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-3 text-white">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-scroll"></i> Ministry report</h2></div>' +
      '<div class="p-5 space-y-4">' +
      '<div><label for="activities" class="block text-sm font-medium text-slate-700 mb-1">Activities & ministry this month <span class="text-red-500">*</span></label>' +
      '<textarea id="activities" required rows="4" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y min-h-[100px]"></textarea></div>' +
      '<div><label for="highlights" class="block text-sm font-medium text-slate-700 mb-1">Highlights & wins</label>' +
      '<textarea id="highlights" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y"></textarea></div>' +
      '<div><label for="testimonies" class="block text-sm font-medium text-slate-700 mb-1">Testimonies</label>' +
      '<textarea id="testimonies" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y"></textarea></div>' +
      '<div><label for="challenges" class="block text-sm font-medium text-slate-700 mb-1">Challenges & needs</label>' +
      '<textarea id="challenges" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y"></textarea></div>' +
      '<div><label for="prayer-requests" class="block text-sm font-medium text-slate-700 mb-1">Prayer requests</label>' +
      '<textarea id="prayer-requests" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y"></textarea></div>' +
      '<div><label for="next-month" class="block text-sm font-medium text-slate-700 mb-1">Plans for next month</label>' +
      '<textarea id="next-month" rows="3" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none resize-y"></textarea></div>' +
      '</div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 p-5 space-y-3">' +
      '<h2 class="font-semibold text-slate-900 text-sm flex items-center gap-2"><i class="fas fa-paper-plane text-brand"></i> Send or save your report</h2>' +
      '<p class="text-sm text-slate-600">Preview on the right, then download PDF or email leadership.</p>' +
      '<button type="button" id="btn-download-pdf" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-light text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-file-pdf"></i> Download report as PDF</button>' +
      '<button type="button" id="btn-email-report" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-envelope"></i> Send to my email</button>' +
      '<button type="button" id="btn-submit-coordinator" class="w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand text-brand hover:bg-brand-soft font-semibold py-3.5 transition">' +
      '<i class="fas fa-church"></i> Submit to Prayer City leadership</button>' +
      '</section></div>' +
      '<aside class="lg:col-span-2"><div class="lg:sticky lg:top-20">' +
      '<div class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">' +
      '<div class="px-5 py-3 border-b border-slate-100 bg-slate-50">' +
      '<h2 class="font-semibold text-slate-800 text-sm flex items-center gap-2"><i class="fas fa-eye text-brand"></i> Live preview</h2></div>' +
      '<div id="report-preview" class="p-4 max-h-[75vh] overflow-y-auto text-sm">' +
      '<p class="text-slate-500 text-sm text-center py-12">Select your unit and month to see a live preview.</p></div></div></div></aside>' +
      '</div></div>'
    );
  }

  function selectedUnitId() {
    var radio = document.querySelector('input[name="unit"]:checked');
    return radio ? radio.value : '';
  }

  function monthKey() {
    var y = ($('report-year') && $('report-year').value) || '';
    var m = ($('report-month') && $('report-month').value) || '';
    return y && m ? y + '-' + String(m).padStart(2, '0') : '';
  }

  function prefillReporter(data) {
    var profile = (data && data.profile) || {};
    var user = data && data.authUser;
    if ($('reporter-name') && !$('reporter-name').value) {
      $('reporter-name').value = profile.name || (user && user.displayName) || '';
    }
    if ($('reporter-phone') && !$('reporter-phone').value) {
      $('reporter-phone').value = profile.phone || '';
    }
    if ($('reporter-email') && !$('reporter-email').value) {
      $('reporter-email').value =
        profile.email || (user && user.email) || '';
    }
  }

  function preselectUnit(data) {
    var ctx = (data && data.unitContexts) || [];
    if (!ctx.length) return;
    var pick = ctx.find(function (c) {
      return c.role === 'leader';
    }) || ctx[0];
    var radio = document.querySelector('input[name="unit"][value="' + pick.unitId + '"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function applyAttendanceStats(stats) {
    if (!stats) return;
    var meetingsEl = $('meetings-held');
    var attendanceEl = $('attendance');
    var highlightsEl = $('highlights');

    if (stats.role === 'leader' && stats.unitStats) {
      var u = stats.unitStats;
      if (meetingsEl) meetingsEl.value = String(u.meetingsHeld || '');
      var lines = [
        'Average per meeting: ' + (u.averageAttendancePerMeeting || 0),
        'Total check-ins: ' + (u.totalCheckIns || 0),
      ];
      if (u.averageAttendanceRate != null) {
        lines.push('Member attendance rate: ' + u.averageAttendanceRate + '%');
      }
      if (u.highestAttendance) {
        lines.push('Highest: ' + u.highestAttendance.date + ' (' + u.highestAttendance.count + ' present)');
      }
      if (u.lowestAttendance) {
        lines.push('Lowest: ' + u.lowestAttendance.date + ' (' + u.lowestAttendance.count + ' present)');
      }
      if (attendanceEl) attendanceEl.value = lines.join('\n');
      if (highlightsEl && u.highestAttendance && !highlightsEl.value.trim()) {
        highlightsEl.value =
          'Best attended meeting: ' +
          u.highestAttendance.date +
          ' with ' +
          u.highestAttendance.count +
          ' check-ins.';
      }
    } else if (stats.personalStats) {
      var p = stats.personalStats;
      if (meetingsEl) meetingsEl.value = String(p.pastScheduledCount || p.scheduledCount || '');
      var personal = [
        'Attendance rate: ' + (p.attendanceRate != null ? p.attendanceRate + '%' : '—'),
        'Present: ' + (p.attendedCount || 0) + ' · Missed: ' + (p.missedCount || 0),
        'Current streak: ' + (p.currentStreak || 0),
      ];
      if (p.insight && p.insight.message) personal.push(p.insight.message);
      if (attendanceEl) attendanceEl.value = personal.join('\n');
    }

    if (window.MonthlyUnitReport && MonthlyUnitReport.updatePreview) {
      MonthlyUnitReport.updatePreview();
    }
  }

  function fetchMeetingNotes(db, unitId, year, month) {
    if (!db || !unitId || !year || !month) return Promise.resolve([]);
    var prefix = year + '-' + String(month).padStart(2, '0');
    return db
      .collection('nigeria_unit_meeting_notes')
      .where('unitId', '==', unitId)
      .get()
      .then(function (snap) {
        var out = [];
        snap.forEach(function (doc) {
          var d = doc.data();
          if (!d || !d.content || !String(d.content).trim()) return;
          if (d.meetingDateYmd && d.meetingDateYmd.indexOf(prefix) !== 0) return;
          out.push({
            meetingDateYmd: d.meetingDateYmd || '',
            meetingKey: d.meetingKey || '',
            content: String(d.content).trim(),
            updatedByName: d.updatedByName || '',
          });
        });
        out.sort(function (a, b) {
          return String(a.meetingDateYmd).localeCompare(String(b.meetingDateYmd));
        });
        return out;
      });
  }

  function summarizeNotesLocally(entries, unitLabel, periodLabel) {
    if (!entries.length) {
      return 'No shared meeting notes were recorded for ' + unitLabel + ' in ' + periodLabel + '.';
    }
    var themes = {};
    var actions = [];
    var prayers = [];
    var bullets = [];

    entries.forEach(function (e) {
      String(e.content)
        .split('\n')
        .forEach(function (line) {
          var t = line.trim();
          if (!t || t === '---') return;
          if (/^☐/.test(t)) actions.push(t.replace(/^☐\s*/, ''));
          else if (/^[-•]/.test(t)) bullets.push(t.replace(/^[-•]\s*/, ''));
          else if (/prayer/i.test(t)) prayers.push(t);
          else bullets.push(t);
          var words = t.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
          if (words.length > 4) themes[words] = (themes[words] || 0) + 1;
        });
    });

    var lines = [
      'Summary from ' + entries.length + ' meeting note(s) — ' + unitLabel + ' (' + periodLabel + ')',
      '',
      'Overview:',
      bullets.slice(0, 6).map(function (b) {
        return '• ' + b;
      }).join('\n') || '• Notes captured across ' + entries.length + ' meeting(s).',
    ];
    if (actions.length) {
      lines.push('', 'Action items:', actions.slice(0, 8).map(function (a) {
        return '☐ ' + a;
      }).join('\n'));
    }
    if (prayers.length) {
      lines.push('', 'Prayer & follow-ups:', prayers.slice(0, 5).map(function (p) {
        return '• ' + p;
      }).join('\n'));
    }
    return lines.join('\n');
  }

  function formatAiSummary(output) {
    if (!output) return '';
    var lines = [];
    if (output.executiveSummary) lines.push(output.executiveSummary);
    if (output.keyTopics && output.keyTopics.length) {
      lines.push('', 'Key topics:', output.keyTopics.map(function (t) {
        return '• ' + t;
      }).join('\n'));
    }
    if (output.actionItems && output.actionItems.length) {
      lines.push('', 'Action items:', output.actionItems.map(function (t) {
        return '☐ ' + t;
      }).join('\n'));
    }
    if (output.prayerAndFollowUps && output.prayerAndFollowUps.length) {
      lines.push('', 'Prayer & follow-ups:', output.prayerAndFollowUps.map(function (t) {
        return '• ' + t;
      }).join('\n'));
    }
    return lines.join('\n').trim();
  }

  function periodLabel() {
    var y = ($('report-year') && $('report-year').value) || '';
    var m = ($('report-month') && $('report-month').value) || '';
    if (!y || !m) return '';
    var d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function unitLabelFor(id) {
    if (window.MonthlyUnitReport && MonthlyUnitReport.UNITS) {
      var u = MonthlyUnitReport.UNITS.find(function (x) {
        return x.id === id;
      });
      if (u) return u.label;
    }
    return id;
  }

  function generateNotesSummary(opts) {
    opts = opts || {};
    var db = opts.db;
    var functions = opts.functions;
    var unitId = selectedUnitId();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    var statusEl = $('notes-summary-status');
    var summaryEl = $('meeting-notes-summary');
    if (!unitId || !year || !month) {
      if (statusEl) statusEl.textContent = 'Select a unit and reporting month first.';
      return Promise.resolve();
    }

    var cacheKey = unitId + '_' + year + '_' + month;
    if (!opts.force && cacheKey === lastSummaryKey && summaryEl && summaryEl.value.trim()) {
      return Promise.resolve();
    }

    if (statusEl) statusEl.textContent = 'Reading meeting notes…';
    var label = unitLabelFor(unitId);
    var period = periodLabel();

    return fetchMeetingNotes(db, unitId, year, month)
      .then(function (entries) {
        if (!entries.length) {
          var empty = summarizeNotesLocally([], label, period);
          if (summaryEl) summaryEl.value = empty;
          if (statusEl) statusEl.textContent = 'No notes found for this month.';
          lastSummaryKey = cacheKey;
          if (window.MonthlyUnitReport) MonthlyUnitReport.updatePreview();
          return;
        }
        if (statusEl) statusEl.textContent = 'Summarizing ' + entries.length + ' note(s)…';
        if (functions) {
          return functions
            .httpsCallable('summarizeNigeriaMeetingNotesForReport')({
              unitId: unitId,
              reportYear: year,
              reportMonth: month,
              notes: entries,
            })
            .then(function (res) {
              var text =
                (res.data && res.data.summaryText) ||
                formatAiSummary(res.data && res.data.summary) ||
                summarizeNotesLocally(entries, label, period);
              if (summaryEl) summaryEl.value = text;
              if (statusEl) {
                statusEl.textContent =
                  res.data && res.data.aiUsed
                    ? 'AI summary generated — review and edit before submitting.'
                    : 'Summary generated from meeting notes.';
              }
              lastSummaryKey = cacheKey;
              if (window.MonthlyUnitReport) MonthlyUnitReport.updatePreview();
            })
            .catch(function () {
              if (summaryEl) summaryEl.value = summarizeNotesLocally(entries, label, period);
              if (statusEl) statusEl.textContent = 'Local summary generated (AI unavailable).';
              lastSummaryKey = cacheKey;
              if (window.MonthlyUnitReport) MonthlyUnitReport.updatePreview();
            });
        }
        if (summaryEl) summaryEl.value = summarizeNotesLocally(entries, label, period);
        if (statusEl) statusEl.textContent = 'Summary generated from meeting notes.';
        lastSummaryKey = cacheKey;
        if (window.MonthlyUnitReport) MonthlyUnitReport.updatePreview();
      })
      .catch(function (e) {
        if (statusEl) statusEl.textContent = (e && e.message) || 'Could not load meeting notes.';
      });
  }

  function loadAttendance(functions, unitId) {
    if (!functions) return Promise.resolve();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    if (!year || !month) return Promise.resolve();
    return functions
      .httpsCallable('getNigeriaAttendanceForReport')({
        reportYear: year,
        reportMonth: month,
        unitId: unitId || selectedUnitId(),
      })
      .then(function (res) {
        applyAttendanceStats(res.data);
        var banner = $('nigeria-report-banner');
        if (banner) {
          banner.classList.remove('hidden');
          banner.innerHTML =
            '<strong>Attendance loaded</strong> from Nigeria check-ins for the selected unit and month.';
        }
      })
      .catch(function () {});
  }

  function bindDashboardHooks(opts) {
    var summarizeBtn = $('btn-summarize-notes');
    if (summarizeBtn && !summarizeBtn.dataset.bound) {
      summarizeBtn.dataset.bound = '1';
      summarizeBtn.addEventListener('click', function () {
        generateNotesSummary({ db: opts.db, functions: opts.functions, force: true });
      });
    }

    ['report-year', 'report-month'].forEach(function (id) {
      var el = $(id);
      if (el && !el.dataset.ngBound) {
        el.dataset.ngBound = '1';
        el.addEventListener('change', function () {
          lastSummaryKey = '';
          loadAttendance(opts.functions, selectedUnitId());
          generateNotesSummary({ db: opts.db, functions: opts.functions });
        });
      }
    });

    document.querySelectorAll('input[name="unit"]').forEach(function (radio) {
      if (radio.dataset.ngBound) return;
      radio.dataset.ngBound = '1';
      radio.addEventListener('change', function () {
        lastSummaryKey = '';
        loadAttendance(opts.functions, radio.value);
        generateNotesSummary({ db: opts.db, functions: opts.functions });
      });
    });
  }

  function mount(container, data, opts) {
    if (!container) return;
    opts = opts || {};
    container.innerHTML = reportShellHtml();
    mounted = true;
    lastSummaryKey = '';

    if (window.MonthlyUnitReport && MonthlyUnitReport.init) {
      if (MonthlyUnitReport.resetInit) MonthlyUnitReport.resetInit();
      MonthlyUnitReport.init();
    }

    prefillReporter(data);
    preselectUnit(data);
    bindDashboardHooks(opts);

    loadAttendance(opts.functions, selectedUnitId()).then(function () {
      return generateNotesSummary({ db: opts.db, functions: opts.functions });
    });
  }

  function refresh(data, opts) {
    if (!mounted) return;
    prefillReporter(data);
    loadAttendance(opts.functions, selectedUnitId());
    generateNotesSummary({ db: opts.db, functions: opts.functions });
  }

  global.NigeriaDashboardReport = {
    mount: mount,
    refresh: refresh,
    generateNotesSummary: generateNotesSummary,
  };
})(typeof window !== 'undefined' ? window : this);
