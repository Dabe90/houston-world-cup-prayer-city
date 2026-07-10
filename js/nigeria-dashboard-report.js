/**
 * Full monthly unit report embedded in DDBS Nigeria dashboard Reports tab.
 * Reuses MonthlyUnitReport + attendance bridge + meeting notes intelligence.
 */
(function (global) {
  var mounted = false;
  var lastSummaryKey = '';
  var draftListener = null;
  var draftDirty = false;
  var dashboardCtx = null;
  var runtimeOpts = null;

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
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden" id="unit-picker-section">' +
      '<button type="button" id="unit-section-toggle" class="w-full text-left bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3 text-white flex items-center justify-between gap-3">' +
      '<div><h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-layer-group"></i> Select your ministry unit</h2>' +
      '<p id="unit-section-summary" class="text-violet-100 text-xs mt-1">Tap to expand unit list</p></div>' +
      '<i id="unit-section-chevron" class="fas fa-chevron-down text-sm transition-transform"></i></button>' +
      '<div id="unit-section-body" class="hidden border-t border-violet-100">' +
      '<div class="p-5"><div id="unit-cards"></div>' +
      '<div id="other-unit-wrap" class="hidden mt-4"><label for="unit-other-name" class="block text-sm font-medium text-slate-700 mb-1">Unit name <span class="text-red-500">*</span></label>' +
      '<input type="text" id="unit-other-name" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none" /></div></div></div></section>' +
      '<div id="report-collab-banner" class="hidden rounded-xl border px-4 py-3 text-sm"></div>' +
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
      '<p id="report-action-hint" class="text-sm text-slate-600">Share with teammates to collaborate, then leader approves and submits.</p>' +
      '<button type="button" id="btn-share-team" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-ng-green hover:bg-emerald-700 text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-users"></i> Share report with teammates</button>' +
      '<button type="button" id="btn-save-contribution" class="hidden w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-ng-green text-ng-green hover:bg-emerald-50 font-semibold py-3.5 transition">' +
      '<i class="fas fa-pen"></i> Save my additions</button>' +
      '<button type="button" id="btn-approve-report" class="hidden w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-check-double"></i> Approve report</button>' +
      '<button type="button" id="btn-download-pdf" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-light text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-file-pdf"></i> Download report as PDF</button>' +
      '<button type="button" id="btn-email-report" class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold py-3.5 transition">' +
      '<i class="fas fa-envelope"></i> Send to my email</button>' +
      '<button type="button" id="btn-submit-coordinator" class="hidden w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-brand text-brand hover:bg-brand-soft font-semibold py-3.5 transition">' +
      '<i class="fas fa-paper-plane"></i> Submit</button>' +
      '<div id="report-contributions" class="hidden text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-1"></div>' +
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

  function readFormPayload() {
    if (!window.MonthlyUnitReport || !MonthlyUnitReport.readForm) return null;
    var data = MonthlyUnitReport.readForm();
    return {
      reporterName: data.reporterName,
      reporterEmail: data.reporterEmail,
      reporterPhone: data.reporterPhone,
      reportYear: data.reportYear,
      reportMonth: data.reportMonth,
      unitId: data.unitId,
      unitDisplay: data.unitDisplay,
      meetingsHeld: data.meetingsHeld,
      attendance: data.attendance,
      meetingNotesSummary: data.meetingNotesSummary,
      activities: data.activities,
      highlights: data.highlights,
      testimonies: data.testimonies,
      challenges: data.challenges,
      prayerRequests: data.prayerRequests,
      nextMonth: data.nextMonth,
    };
  }

  function applyFormPayload(form) {
    if (!form) return;
    var map = {
      'reporter-name': form.reporterName,
      'reporter-email': form.reporterEmail,
      'reporter-phone': form.reporterPhone,
      'meetings-held': form.meetingsHeld,
      attendance: form.attendance,
      'meeting-notes-summary': form.meetingNotesSummary,
      activities: form.activities,
      highlights: form.highlights,
      testimonies: form.testimonies,
      challenges: form.challenges,
      'prayer-requests': form.prayerRequests,
      'next-month': form.nextMonth,
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el && map[id] != null && map[id] !== undefined) el.value = map[id];
    });
    if (form.reportYear && $('report-year')) $('report-year').value = String(form.reportYear);
    if (form.reportMonth && $('report-month')) $('report-month').value = String(form.reportMonth);
    if (form.unitId) {
      var radio = document.querySelector('input[name="unit"][value="' + form.unitId + '"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    updateUnitSectionSummary();
    if (window.MonthlyUnitReport && MonthlyUnitReport.updatePreview) MonthlyUnitReport.updatePreview();
  }

  function draftDocId(unitId, year, month) {
    return unitId + '_' + year + '_' + String(month).padStart(2, '0');
  }

  function roleForUnit(unitId) {
    var ctx = (dashboardCtx && dashboardCtx.unitContexts) || [];
    var row = ctx.find(function (c) {
      return c.unitId === unitId;
    });
    if (row) return row.role;
    if (dashboardCtx && dashboardCtx.isSuperUser) return 'leader';
    return 'member';
  }

  function showReportStatus(msg, type) {
    var el = $('report-status');
    if (!el) return;
    el.textContent = msg;
    el.className =
      'rounded-xl border px-4 py-3 text-sm ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900');
    el.classList.remove('hidden');
  }

  function updateUnitSectionSummary() {
    var summary = $('unit-section-summary');
    if (!summary) return;
    var unitId = selectedUnitId();
    summary.textContent = unitId
      ? 'Selected: ' + unitLabelFor(unitId)
      : 'Tap to expand unit list';
  }

  function setUnitSectionOpen(open) {
    var body = $('unit-section-body');
    var chevron = $('unit-section-chevron');
    if (body) body.classList.toggle('hidden', !open);
    if (chevron) chevron.classList.toggle('rotate-180', open);
  }

  function bindCollapsibleUnit() {
    var toggle = $('unit-section-toggle');
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', function () {
      var body = $('unit-section-body');
      setUnitSectionOpen(body && body.classList.contains('hidden'));
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.name === 'unit') {
        updateUnitSectionSummary();
        if (selectedUnitId()) setUnitSectionOpen(false);
      }
    });
  }

  function renderContributions(list) {
    var wrap = $('report-contributions');
    if (!wrap) return;
    if (!list || !list.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML =
      '<p class="font-semibold text-slate-700">Team activity</p>' +
      list
        .slice(-6)
        .reverse()
        .map(function (c) {
          return (
            '<p><span class="font-medium text-slate-800">' +
            (c.name || 'Member') +
            ':</span> ' +
            (c.message || 'Updated report') +
            '</p>'
          );
        })
        .join('');
  }

  function updateCollabUi(draft) {
    var unitId = selectedUnitId();
    var role = roleForUnit(unitId);
    var isLeader = role === 'leader';
    var status = (draft && draft.status) || '';
    var banner = $('report-collab-banner');
    var shareBtn = $('btn-share-team');
    var saveBtn = $('btn-save-contribution');
    var approveBtn = $('btn-approve-report');
    var submitBtn = $('btn-submit-coordinator');
    var hint = $('report-action-hint');

    if (banner) {
      if (status === 'shared') {
        banner.className =
          'rounded-xl border border-sky-200 bg-sky-50 text-sky-900 px-4 py-3 text-sm';
        banner.innerHTML =
          '<strong>Shared with unit</strong> — teammates can review and add. Leader approves when ready.';
        banner.classList.remove('hidden');
      } else if (status === 'approved') {
        banner.className =
          'rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm';
        banner.innerHTML =
          '<strong>Approved</strong>' +
          (draft.approvedByName ? ' by ' + draft.approvedByName : '') +
          ' — leader can submit the final report.';
        banner.classList.remove('hidden');
      } else if (status === 'submitted') {
        banner.className =
          'rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-4 py-3 text-sm';
        banner.innerHTML = '<strong>Submitted</strong> — this month\'s report is on file.';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    if (shareBtn) shareBtn.classList.toggle('hidden', status === 'submitted');
    if (saveBtn) saveBtn.classList.toggle('hidden', status !== 'shared');
    if (approveBtn) approveBtn.classList.toggle('hidden', !isLeader || status !== 'shared');
    if (submitBtn) {
      var canSubmit = false;
      if (status !== 'submitted' && isLeader) {
        if (status === 'approved') canSubmit = true;
        else if (dashboardCtx && dashboardCtx.isSuperUser && status !== 'shared') canSubmit = true;
      }
      submitBtn.classList.toggle('hidden', !canSubmit);
    }

    if (hint) {
      if (status === 'shared' && isLeader) {
        hint.textContent = 'Teammates are adding input. Approve when ready, then submit.';
      } else if (status === 'shared') {
        hint.textContent = 'Add your input and tap Save my additions.';
      } else if (status === 'approved' && isLeader) {
        hint.textContent = 'Report approved — submit when you are ready.';
      } else if (isLeader) {
        hint.textContent = 'Share with teammates to collaborate, then approve and submit.';
      } else {
        hint.textContent = 'Your leader will share the report when it is ready for input.';
      }
    }

    renderContributions(draft && draft.contributions);
  }

  function detachDraftListener() {
    if (draftListener) {
      draftListener();
      draftListener = null;
    }
  }

  function watchDraft(opts) {
    detachDraftListener();
    var unitId = selectedUnitId();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    if (!opts.db || !unitId || !year || !month) {
      updateCollabUi(null);
      return;
    }
    draftListener = opts.db
      .collection('nigeria_unit_report_drafts')
      .doc(draftDocId(unitId, year, month))
      .onSnapshot(
        function (snap) {
          var draft = snap.exists ? snap.data() : null;
          updateCollabUi(draft);
          if (!draft || !draft.form || draftDirty) return;
          if (document.activeElement && document.activeElement.closest('#ng-report-root')) return;
          applyFormPayload(draft.form);
        },
        function () {
          updateCollabUi(null);
        }
      );
  }

  function shareWithTeammates(opts) {
    var form = readFormPayload();
    var unitId = selectedUnitId();
    var year = parseInt(form && form.reportYear, 10);
    var month = parseInt(form && form.reportMonth, 10);
    if (!form || !unitId || !year || !month) {
      showReportStatus('Select unit and reporting month first.', 'error');
      return Promise.resolve();
    }
    if (!opts.functions) return Promise.resolve();
    showReportStatus('Sharing with teammates…', 'info');
    return opts.functions
      .httpsCallable('shareNigeriaUnitReportDraft')({
        unitId: unitId,
        reportYear: year,
        reportMonth: month,
        form: form,
      })
      .then(function () {
        showReportStatus('Shared — unit members can review and add.', 'success');
      })
      .catch(function (e) {
        showReportStatus((e && e.message) || 'Could not share report.', 'error');
      });
  }

  function saveContribution(opts) {
    var form = readFormPayload();
    var unitId = selectedUnitId();
    var year = parseInt(form && form.reportYear, 10);
    var month = parseInt(form && form.reportMonth, 10);
    if (!form || !unitId || !year || !month) {
      showReportStatus('Select unit and month first.', 'error');
      return Promise.resolve();
    }
    showReportStatus('Saving your additions…', 'info');
    return opts.functions
      .httpsCallable('contributeNigeriaUnitReportDraft')({
        unitId: unitId,
        reportYear: year,
        reportMonth: month,
        form: form,
        note: 'Added input to the shared report.',
      })
      .then(function () {
        draftDirty = false;
        showReportStatus('Your additions were saved for the team.', 'success');
      })
      .catch(function (e) {
        showReportStatus((e && e.message) || 'Could not save additions.', 'error');
      });
  }

  function approveReport(opts) {
    var form = readFormPayload();
    var unitId = selectedUnitId();
    var year = parseInt(form && form.reportYear, 10);
    var month = parseInt(form && form.reportMonth, 10);
    if (!form || !unitId || !year || !month) {
      showReportStatus('Select unit and month first.', 'error');
      return Promise.resolve();
    }
    showReportStatus('Approving report…', 'info');
    return opts.functions
      .httpsCallable('approveNigeriaUnitReportDraft')({
        unitId: unitId,
        reportYear: year,
        reportMonth: month,
        form: form,
      })
      .then(function () {
        showReportStatus('Report approved — you can submit when ready.', 'success');
      })
      .catch(function (e) {
        showReportStatus((e && e.message) || 'Could not approve report.', 'error');
      });
  }

  function submitReport(opts) {
    if (!window.MonthlyUnitReport) return Promise.resolve();
    var err = MonthlyUnitReport.validateForm(MonthlyUnitReport.readForm());
    if (err) {
      showReportStatus(err, 'error');
      return Promise.resolve();
    }
    var form = readFormPayload();
    var unitId = selectedUnitId();
    showReportStatus('Submitting report…', 'info');
    return opts.functions
      .httpsCallable('submitNigeriaUnitReport')({
        unitId: unitId,
        reportYear: parseInt(form.reportYear, 10),
        reportMonth: parseInt(form.reportMonth, 10),
        activities: form.activities,
        highlights: form.highlights,
        testimonies: form.testimonies,
        challenges: form.challenges,
        prayerRequests: form.prayerRequests,
        nextMonth: form.nextMonth,
        meetingNotesSummary: form.meetingNotesSummary,
      })
      .then(function () {
        showReportStatus('Report submitted successfully!', 'success');
      })
      .catch(function (e) {
        showReportStatus((e && e.message) || 'Submit failed — approve the shared report first.', 'error');
      });
  }

  function overrideSubmitButton(opts) {
    var btn = $('btn-submit-coordinator');
    if (!btn) return;
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', function () {
      submitReport(opts);
    });
  }

  function bindCollabActions(opts) {
    var shareBtn = $('btn-share-team');
    if (shareBtn && !shareBtn.dataset.bound) {
      shareBtn.dataset.bound = '1';
      shareBtn.addEventListener('click', function () {
        shareWithTeammates(opts);
      });
    }
    var saveBtn = $('btn-save-contribution');
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = '1';
      saveBtn.addEventListener('click', function () {
        saveContribution(opts);
      });
    }
    var approveBtn = $('btn-approve-report');
    if (approveBtn && !approveBtn.dataset.bound) {
      approveBtn.dataset.bound = '1';
      approveBtn.addEventListener('click', function () {
        approveReport(opts);
      });
    }
    overrideSubmitButton(opts);

    ['activities', 'highlights', 'testimonies', 'challenges', 'prayer-requests', 'next-month', 'meeting-notes-summary'].forEach(
      function (id) {
        var el = $(id);
        if (el && !el.dataset.draftBound) {
          el.dataset.draftBound = '1';
          el.addEventListener('input', function () {
            draftDirty = true;
          });
        }
      }
    );
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
        watchDraft(opts);
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
        watchDraft(opts);
        updateUnitSectionSummary();
      });
    });
  }

  function mount(container, data, opts) {
    if (!container) return;
    opts = opts || {};
    runtimeOpts = opts;
    dashboardCtx = data;
    detachDraftListener();
    container.innerHTML = reportShellHtml();
    mounted = true;
    lastSummaryKey = '';
    draftDirty = false;

    if (window.MonthlyUnitReport && MonthlyUnitReport.init) {
      if (MonthlyUnitReport.resetInit) MonthlyUnitReport.resetInit();
      MonthlyUnitReport.init();
    }

    prefillReporter(data);
    preselectUnit(data);
    bindCollapsibleUnit();
    updateUnitSectionSummary();
    setUnitSectionOpen(!selectedUnitId());
    bindDashboardHooks(opts);
    bindCollabActions(opts);
    watchDraft(opts);

    loadAttendance(opts.functions, selectedUnitId()).then(function () {
      return generateNotesSummary({ db: opts.db, functions: opts.functions });
    });
  }

  function refresh(data, opts) {
    if (!mounted) return;
    dashboardCtx = data;
    runtimeOpts = opts || runtimeOpts;
    prefillReporter(data);
    loadAttendance(opts.functions, selectedUnitId());
    generateNotesSummary({ db: opts.db, functions: opts.functions });
    watchDraft(opts);
  }

  global.NigeriaDashboardReport = {
    mount: mount,
    refresh: refresh,
    generateNotesSummary: generateNotesSummary,
    detachDraftListener: detachDraftListener,
  };
})(typeof window !== 'undefined' ? window : this);
