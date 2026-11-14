/**
 * Full monthly unit report embedded in DDBS Nigeria dashboard Reports tab.
 * Reuses MonthlyUnitReport + attendance bridge + meeting notes intelligence.
 */
(function (global) {
  var mounted = false;
  var lastSummaryKey = '';
  var draftListener = null;
  var draftDirty = false;
  var applyingDraft = false;
  var dashboardCtx = null;
  var runtimeOpts = null;
  var lastDraftStatus = '';

  function $(id) {
    return document.getElementById(id);
  }

  function isLikelyImageFile(file) {
    if (!file) return false;
    if (file.type && /^image\//i.test(file.type)) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(String(file.name || ''));
  }

  function imageUploadContentType(file) {
    if (file && file.type && /^image\//i.test(file.type)) return file.type;
    var name = String((file && file.name) || '').toLowerCase();
    if (/\.png$/i.test(name)) return 'image/png';
    if (/\.webp$/i.test(name)) return 'image/webp';
    if (/\.gif$/i.test(name)) return 'image/gif';
    if (/\.heic$/i.test(name) || /\.heif$/i.test(name)) return 'image/heic';
    return 'image/jpeg';
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
      '<div id="report-shared-drafts" class="hidden rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm"></div>' +
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
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden" id="notes-intel-section">' +
      '<div class="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 py-3 text-white flex items-center gap-2">' +
      '<button type="button" id="notes-section-toggle" class="flex-1 min-w-0 text-left flex items-center justify-between gap-3" aria-expanded="true" aria-controls="notes-section-body">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-wand-magic-sparkles"></i> Meeting notes intelligence</h2>' +
      '<i id="notes-section-chevron" class="fas fa-chevron-down text-sm transition-transform rotate-180"></i></button>' +
      '<button type="button" id="btn-summarize-notes" class="shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg">Refresh summary</button></div>' +
      '<div id="notes-section-body" class="border-t border-emerald-100">' +
      '<div class="p-5 space-y-2">' +
      '<p class="text-xs text-slate-500">Summarizes shared unit meeting notes for the selected month. Edit before submitting.</p>' +
      '<p id="notes-summary-status" class="text-xs text-slate-500"></p>' +
      '<textarea id="meeting-notes-summary" rows="5" class="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm resize-y min-h-[120px] focus:ring-2 focus:ring-ng-green outline-none" placeholder="Select unit and month, then generate a summary from meeting notes…"></textarea>' +
      '</div></div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden" id="ministry-report-section">' +
      '<button type="button" id="ministry-section-toggle" class="w-full text-left bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-3 text-white flex items-center justify-between gap-3" aria-expanded="true" aria-controls="ministry-section-body">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-scroll"></i> Ministry report</h2>' +
      '<i id="ministry-section-chevron" class="fas fa-chevron-down text-sm transition-transform rotate-180"></i></button>' +
      '<div id="ministry-section-body" class="border-t border-rose-100">' +
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
      '</div></div></section>' +
      '<section class="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden" id="report-photos-section">' +
      '<button type="button" id="photos-section-toggle" class="w-full text-left bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-3 text-white flex items-center justify-between gap-3" aria-expanded="true" aria-controls="photos-section-body">' +
      '<h2 class="font-semibold text-sm flex items-center gap-2"><i class="fas fa-images"></i> Report photos</h2>' +
      '<i id="photos-section-chevron" class="fas fa-chevron-down text-sm transition-transform rotate-180"></i></button>' +
      '<div id="photos-section-body" class="border-t border-sky-100">' +
      '<div class="p-5 space-y-3">' +
      '<p class="text-xs text-slate-500">Add photos from the month — they appear in the live preview, PDF, and final submitted report (up to 12, 5 MB each).</p>' +
      '<input type="hidden" id="report-photos-json" value="[]" />' +
      '<div id="report-photos-grid" class="grid grid-cols-2 sm:grid-cols-3 gap-2"></div>' +
      '<label class="inline-flex items-center gap-2 text-xs font-semibold text-brand cursor-pointer">' +
      '<input type="file" id="report-photo-input" class="hidden" accept="image/*" multiple />' +
      '<span class="rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 hover:bg-brand/10"><i class="fas fa-camera mr-1"></i>Upload photos</span></label>' +
      '<p id="report-photos-status" class="text-xs text-slate-500"></p>' +
      '</div></div></section>' +
      '<section class="report-actions-card">' +
      '<div class="report-actions-head">' +
      '<div class="report-actions-head-row">' +
      '<div class="min-w-0">' +
      '<h2 class="report-actions-title">Review &amp; submit</h2>' +
      '<p id="report-action-hint" class="report-actions-sub">Complete the steps below to finalize this month’s report.</p>' +
      '</div>' +
      '<button type="button" id="btn-reload-shared-draft" class="report-link-btn" title="Reload shared details">' +
      '<i class="fas fa-rotate"></i><span>Refresh</span></button>' +
      '</div>' +
      '<ol id="report-workflow-steps" class="report-steps" aria-label="Report progress">' +
      '<li class="report-step" data-step="draft"><span class="report-step-dot">1</span><span class="report-step-label">Draft</span></li>' +
      '<li class="report-step" data-step="shared"><span class="report-step-dot">2</span><span class="report-step-label">Shared</span></li>' +
      '<li class="report-step" data-step="approved"><span class="report-step-dot">3</span><span class="report-step-label">Approved</span></li>' +
      '<li class="report-step" data-step="submitted"><span class="report-step-dot">4</span><span class="report-step-label">Submitted</span></li>' +
      '</ol>' +
      '</div>' +
      '<div class="report-actions-body">' +
      '<div id="report-status-actions" class="hidden" role="status"></div>' +
      '<div id="report-collab-banner" class="hidden report-inline-note"></div>' +
      '<div class="report-primary-wrap">' +
      '<button type="button" id="btn-share-team" class="report-cta report-cta-share">' +
      '<i class="fas fa-users"></i><span class="report-cta-text">Share with teammates</span></button>' +
      '<button type="button" id="btn-save-contribution" class="hidden report-cta report-cta-save">' +
      '<i class="fas fa-pen"></i><span class="report-cta-text">Save my additions</span></button>' +
      '<button type="button" id="btn-approve-report" class="hidden report-cta report-cta-approve">' +
      '<i class="fas fa-check-double"></i><span class="report-cta-text">Approve report</span></button>' +
      '<button type="button" id="btn-submit-coordinator" class="hidden report-cta report-cta-submit">' +
      '<i class="fas fa-paper-plane"></i><span class="report-cta-text">Submit final report</span></button>' +
      '<button type="button" id="btn-edit-resubmit-report" class="hidden report-cta report-cta-edit">' +
      '<i class="fas fa-pen-to-square"></i><span class="report-cta-text">Edit &amp; resubmit</span></button>' +
      '<button type="button" id="btn-retract-report" class="hidden report-cta report-cta-retract">' +
      '<i class="fas fa-rotate-left"></i><span class="report-cta-text">Retract submission</span></button>' +
      '</div>' +
      '<div id="report-secondary-actions" class="report-secondary-row hidden">' +
      '<button type="button" id="btn-share-team-secondary" class="report-text-btn">' +
      '<i class="fas fa-cloud-arrow-up"></i> Update shared copy</button>' +
      '</div>' +
      '<div class="report-export-block">' +
      '<div class="report-export-head">' +
      '<p class="report-actions-label">Export a copy</p>' +
      '<p class="report-export-hint">Download PDF or PPT file, or open Present / Bolt slides on screen.</p>' +
      '</div>' +
      '<div class="report-export-row report-export-row-6">' +
      '<button type="button" id="btn-download-pdf" class="report-export-chip">' +
      '<i class="fas fa-file-pdf"></i><span>PDF</span></button>' +
      '<button type="button" id="btn-download-pptx-file" class="report-export-chip">' +
      '<i class="fas fa-download"></i><span>PPT file</span></button>' +
      '<button type="button" id="btn-download-pptx" class="report-export-chip">' +
      '<i class="fas fa-file-powerpoint"></i><span>Present</span></button>' +
      '<button type="button" id="btn-present-bolt" class="report-export-chip">' +
      '<i class="fas fa-bolt"></i><span>Bolt</span></button>' +
      '<button type="button" id="btn-print-report" class="report-export-chip">' +
      '<i class="fas fa-print"></i><span>Print</span></button>' +
      '<button type="button" id="btn-email-report" class="report-export-chip">' +
      '<i class="fas fa-envelope"></i><span>Email</span></button>' +
      '</div></div>' +
      '<div id="report-contributions" class="hidden report-contrib"></div>' +
      '</div></section></div>' +
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
    var pick =
      ctx.find(function (c) {
        return c && !c.browseOnly && (c.role === 'leader' || c.canSubmitReport || c.isLeaderView);
      }) ||
      ctx.find(function (c) {
        return c && !c.browseOnly;
      }) ||
      ctx[0];
    if (!pick || !pick.unitId) return;
    var radio = document.querySelector('input[name="unit"][value="' + pick.unitId + '"]');
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function applyAttendanceStats(stats) {
    if (!stats || applyingDraft) return;
    var meetingsEl = $('meetings-held');
    var attendanceEl = $('attendance');
    var highlightsEl = $('highlights');

    if (stats.role === 'leader' && stats.unitStats) {
      var u = stats.unitStats;
      // Never clobber values already filled from a shared draft / manual entry.
      if (meetingsEl && !String(meetingsEl.value || '').trim()) {
        meetingsEl.value = String(u.meetingsHeld || '');
      }
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
      if (attendanceEl && !String(attendanceEl.value || '').trim()) {
        attendanceEl.value = lines.join('\n');
      }
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
      if (meetingsEl && !String(meetingsEl.value || '').trim()) {
        meetingsEl.value = String(p.pastScheduledCount || p.scheduledCount || '');
      }
      var personal = [
        'Attendance rate: ' + (p.attendanceRate != null ? p.attendanceRate + '%' : '—'),
        'Present: ' + (p.attendedCount || 0) + ' · Missed: ' + (p.missedCount || 0),
        'Current streak: ' + (p.currentStreak || 0),
      ];
      if (p.insight && p.insight.message) personal.push(p.insight.message);
      if (attendanceEl && !String(attendanceEl.value || '').trim()) {
        attendanceEl.value = personal.join('\n');
      }
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
      })
      .catch(function () {
        return [];
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

  function reportCallable(functions, name, timeoutMs) {
    return functions.httpsCallable(name, { timeout: timeoutMs || 60000 });
  }

  function withReportBusy(buttonIds, work) {
    var btns = (buttonIds || [])
      .map(function (id) {
        return $(id);
      })
      .filter(Boolean);
    var prev = btns.map(function (b) {
      return b.disabled;
    });
    btns.forEach(function (b) {
      b.disabled = true;
    });
    return Promise.resolve()
      .then(work)
      .finally(function () {
        btns.forEach(function (b, i) {
          b.disabled = prev[i];
        });
      });
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

    // Don't overwrite a shared/manual summary unless the user asked to refresh.
    if (!opts.force && summaryEl && String(summaryEl.value || '').trim()) {
      return Promise.resolve();
    }

    var cacheKey = unitId + '_' + year + '_' + month;
    if (!opts.force && cacheKey === lastSummaryKey && summaryEl && summaryEl.value.trim()) {
      return Promise.resolve();
    }

    if (statusEl) statusEl.textContent = 'Reading meeting notes…';
    var label = unitLabelFor(unitId);
    var period = periodLabel();
    var summarizeBtn = $('btn-summarize-notes');
    if (summarizeBtn) summarizeBtn.disabled = true;

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
          return reportCallable(functions, 'summarizeNigeriaMeetingNotesForReport', 90000)({
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
      })
      .finally(function () {
        if (summarizeBtn) summarizeBtn.disabled = false;
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
      photos: data.photos || [],
    };
  }

  function applyFormPayload(form, opts) {
    if (!form) return;
    opts = opts || {};
    applyingDraft = true;
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
      if (!el) return;
      if (map[id] == null || map[id] === undefined) return;
      var incoming = String(map[id]);
      var current = String(el.value || '');
      // Never let a blank shared/local payload erase filled text.
      if (!incoming.trim() && current.trim()) return;
      el.value = map[id];
    });
    if (form.reportYear && $('report-year')) {
      var ry = parseInt(form.reportYear, 10);
      if (ry) $('report-year').value = String(ry);
    }
    if (form.reportMonth && $('report-month')) {
      var rm = parseInt(form.reportMonth, 10);
      if (rm >= 1 && rm <= 12) $('report-month').value = String(rm);
    }
    if (form.unitId) {
      var radio = document.querySelector('input[name="unit"][value="' + form.unitId + '"]');
      if (radio) {
        radio.checked = true;
        // Do not dispatch change — that reloads attendance and can wipe draft fields.
      }
    }
    if (window.MonthlyUnitReport && MonthlyUnitReport.setPhotos) {
      MonthlyUnitReport.setPhotos(form.photos || []);
    }
    updateUnitSectionSummary();
    if (window.MonthlyUnitReport && MonthlyUnitReport.updatePreview) MonthlyUnitReport.updatePreview();
    window.setTimeout(function () {
      applyingDraft = false;
    }, 0);
  }

  function draftHasContent(form) {
    if (!form) return false;
    return !!(
      String(form.activities || '').trim() ||
      String(form.highlights || '').trim() ||
      String(form.testimonies || '').trim() ||
      String(form.challenges || '').trim() ||
      String(form.prayerRequests || '').trim() ||
      String(form.nextMonth || '').trim() ||
      String(form.meetingNotesSummary || '').trim() ||
      String(form.meetingsHeld || '').trim() ||
      String(form.attendance || '').trim()
    );
  }

  function draftDocId(unitId, year, month) {
    return unitId + '_' + year + '_' + String(month).padStart(2, '0');
  }

  function unitContextFor(unitId) {
    var ctx = (dashboardCtx && dashboardCtx.unitContexts) || [];
    return (
      ctx.find(function (c) {
        return c && c.unitId === unitId;
      }) || null
    );
  }

  function roleForUnit(unitId) {
    if (dashboardCtx && dashboardCtx.isSuperUser) return 'leader';
    var row = unitContextFor(unitId);
    if (!row) return 'member';
    if (row.role === 'leader' || row.canSubmitReport || row.isLeaderView) return 'leader';
    return row.role === 'member' ? 'member' : 'member';
  }

  function isLeaderForUnit(unitId) {
    if (dashboardCtx && dashboardCtx.isSuperUser) return true;
    var row = unitContextFor(unitId);
    if (!row) return false;
    return !!(row.role === 'leader' || row.canSubmitReport || row.isLeaderView);
  }

  function isSoloLeader(unitId) {
    if (!isLeaderForUnit(unitId)) return false;
    var row = unitContextFor(unitId);
    var roster = (row && row.teamRoster) || [];
    if (!roster.length) return true;
    var leaders = roster.filter(function (m) {
      return m && m.role === 'leader';
    });
    return leaders.length <= 1;
  }

  function hasUnitAccess(unitId) {
    if (!unitId) return false;
    if (dashboardCtx && dashboardCtx.isSuperUser) return true;
    return !!unitContextFor(unitId);
  }

  function showReportStatus(msg, type, opts) {
    opts = opts || {};
    var className =
      'rounded-xl border px-3.5 py-2.5 text-sm leading-snug ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900');

    function paint(id) {
      var el = $(id);
      if (!el) return null;
      el.textContent = msg;
      el.className = className;
      el.classList.remove('hidden');
      return el;
    }

    var top = paint('report-status');
    var nearActions = paint('report-status-actions');

    if (opts.scroll === false) return;

    function nearViewport(el) {
      if (!el) return false;
      try {
        var r = el.getBoundingClientRect();
        return r.top < window.innerHeight + 120 && r.bottom > -40;
      } catch (e) {
        return false;
      }
    }

    window.requestAnimationFrame(function () {
      var target =
        opts.anchor === 'actions'
          ? nearActions || top
          : opts.anchor === 'top'
            ? top || nearActions
            : nearViewport(nearActions)
              ? nearActions
              : top || nearActions;
      if (!target) return;
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch (e) {
        try {
          target.scrollIntoView(true);
        } catch (e2) {}
      }
    });
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

  function setReportSectionOpen(prefix, open) {
    var body = $(prefix + '-section-body');
    var chevron = $(prefix + '-section-chevron');
    var toggle = $(prefix + '-section-toggle');
    if (body) body.classList.toggle('hidden', !open);
    if (chevron) chevron.classList.toggle('rotate-180', !!open);
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function bindReportSectionToggle(prefix) {
    var toggle = $(prefix + '-section-toggle');
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', function () {
      var body = $(prefix + '-section-body');
      setReportSectionOpen(prefix, !!(body && body.classList.contains('hidden')));
    });
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

  function bindCollapsibleReportSections() {
    bindReportSectionToggle('notes');
    bindReportSectionToggle('ministry');
    bindReportSectionToggle('photos');
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
      '<p class="report-contrib-title">Recent team activity</p>' +
      '<ul class="report-contrib-list">' +
      list
        .slice(-5)
        .reverse()
        .map(function (c) {
          return (
            '<li><span class="report-contrib-name">' +
            (c.name || 'Member') +
            '</span> ' +
            (c.message || 'Updated report') +
            '</li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function setWorkflowSteps(status) {
    var steps = document.getElementById('report-workflow-steps');
    if (!steps) return;
    var order = ['draft', 'shared', 'approved', 'submitted'];
    var current = status && order.indexOf(status) >= 0 ? status : 'draft';
    var currentIdx = order.indexOf(current);
    steps.querySelectorAll('.report-step').forEach(function (li) {
      var key = li.getAttribute('data-step');
      var idx = order.indexOf(key);
      var done = idx >= 0 && idx < currentIdx;
      var isCurrent = key === current;
      li.classList.toggle('is-done', done);
      li.classList.toggle('is-current', isCurrent);
      if (isCurrent) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
      var dot = li.querySelector('.report-step-dot');
      if (dot) {
        if (done) {
          dot.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
        } else {
          dot.textContent = String(idx + 1);
        }
      }
    });
  }

  function updateCollabUi(draft) {
    var unitId = selectedUnitId();
    var isLeader = isLeaderForUnit(unitId);
    var inUnit = hasUnitAccess(unitId);
    var status = String((draft && draft.status) || '')
      .trim()
      .toLowerCase();
    if (status && ['draft', 'shared', 'approved', 'submitted'].indexOf(status) < 0) {
      status = 'draft';
    }
    lastDraftStatus = status;
    var banner = $('report-collab-banner');
    var shareBtn = $('btn-share-team');
    var shareSecondary = $('btn-share-team-secondary');
    var secondaryRow = $('report-secondary-actions');
    var saveBtn = $('btn-save-contribution');
    var approveBtn = $('btn-approve-report');
    var submitBtn = $('btn-submit-coordinator');
    var editResubmitBtn = $('btn-edit-resubmit-report');
    var retractBtn = $('btn-retract-report');
    var hint = $('report-action-hint');

    setWorkflowSteps(status || 'draft');

    if (banner) {
      if (!unitId) {
        banner.className = 'report-inline-note report-inline-note-shared';
        banner.innerHTML =
          '<i class="fas fa-layer-group"></i><span><strong>Select your unit</strong> above to unlock Share, Approve, Submit, and PPT export for that group.</span>';
        banner.classList.remove('hidden');
      } else if (status === 'shared') {
        banner.className = 'report-inline-note report-inline-note-shared';
        banner.innerHTML =
          '<i class="fas fa-users"></i><span><strong>Open for team input.</strong> Teammates can edit details; the leader taps Approve when ready.</span>';
        banner.classList.remove('hidden');
      } else if (status === 'approved') {
        banner.className = 'report-inline-note report-inline-note-approved';
        banner.innerHTML =
          '<i class="fas fa-check-circle"></i><span><strong>Approved</strong>' +
          (draft && draft.approvedByName ? ' by ' + draft.approvedByName : '') +
          ' — ready for final submit.</span>';
        banner.classList.remove('hidden');
      } else if (status === 'submitted') {
        banner.className = 'report-inline-note report-inline-note-done';
        banner.innerHTML =
          '<i class="fas fa-flag-checkered"></i><span><strong>Submitted</strong> for ' +
          monthLabel(
            ($('report-year') && $('report-year').value) || '',
            ($('report-month') && $('report-month').value) || ''
          ) +
          ' — use <strong>Edit &amp; resubmit</strong> to unlock changes, or <strong>Retract</strong> so teammates can edit again.</span>';
        banner.classList.remove('hidden');
      } else if (inUnit && isLeader && isSoloLeader(unitId)) {
        banner.className = 'report-inline-note report-inline-note-approved';
        banner.innerHTML =
          '<i class="fas fa-user-check"></i><span><strong>You lead this team.</strong> Fill the report and tap Submit — no teammate share step is required.</span>';
        banner.classList.remove('hidden');
      } else if (inUnit && isLeader) {
        banner.className = 'report-inline-note report-inline-note-shared';
        banner.innerHTML =
          '<i class="fas fa-share-nodes"></i><span><strong>Draft.</strong> Share with teammates so they can edit, then Approve and Submit.</span>';
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    // Workflow: Share → (teammates edit) → Approve → Submit → (Edit & resubmit / Retract).
    var solo = isSoloLeader(unitId);
    var showSharePrimary = inUnit && !solo && (!status || status === 'draft');
    var showShareSecondary = inUnit && !solo && (status === 'shared' || status === 'approved');
    var showSave = inUnit && !isLeader && status === 'shared';
    var showApprove = isLeader && !solo && status === 'shared';
    var showSubmit = false;
    if (status !== 'submitted' && isLeader) {
      if (status === 'approved' || solo) showSubmit = true;
      else if (dashboardCtx && dashboardCtx.isSuperUser && status !== 'shared') showSubmit = true;
    }
    var showReopen = isLeader && status === 'submitted';

    if (shareBtn) {
      shareBtn.classList.toggle('hidden', !showSharePrimary);
      var shareLabel = shareBtn.querySelector('.report-cta-text');
      if (shareLabel) shareLabel.textContent = 'Share with teammates';
    }
    if (saveBtn) saveBtn.classList.toggle('hidden', !showSave);
    if (approveBtn) approveBtn.classList.toggle('hidden', !showApprove);
    if (submitBtn) submitBtn.classList.toggle('hidden', !showSubmit);
    if (editResubmitBtn) editResubmitBtn.classList.toggle('hidden', !showReopen);
    if (retractBtn) retractBtn.classList.toggle('hidden', !showReopen);
    if (shareSecondary) shareSecondary.classList.toggle('hidden', !showShareSecondary);
    if (secondaryRow) secondaryRow.classList.toggle('hidden', !showShareSecondary);

    if (hint) {
      if (!unitId) {
        hint.textContent = 'Select your unit (Media Team if that is the team you lead), then continue.';
      } else if (status === 'shared' && isLeader) {
        hint.textContent =
          'Teammates can edit now. When the report looks right, tap Approve report — then Submit.';
      } else if (status === 'shared') {
        hint.textContent = 'Edit the fields above, then save your additions for the team.';
      } else if (status === 'approved' && isLeader) {
        hint.textContent = 'Approved — tap Submit final report when you are ready.';
      } else if (status === 'submitted' && isLeader) {
        hint.textContent =
          'Already submitted. Tap Edit & resubmit to change it, or Retract to let teammates edit, then Approve and Submit again.';
      } else if (status === 'submitted') {
        hint.textContent = 'This month’s report is already submitted. Ask your leader to unlock it if changes are needed.';
      } else if (isLeader && solo) {
        hint.textContent = 'Fill in the report, then tap Submit final report.';
      } else if (isLeader) {
        hint.textContent =
          'Share with teammates so they can edit. Then Approve, then Submit. PPT / PDF exports are below.';
      } else if (inUnit) {
        hint.textContent =
          'You can share a draft with the team. Your leader will Approve and Submit the final report.';
      } else {
        hint.textContent = 'Select your unit to continue.';
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

  var periodHuntToken = 0;

  function monthLabel(year, month) {
    try {
      return new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return String(month) + '/' + String(year);
    }
  }

  function formLooksEmpty() {
    return !(
      String(($('activities') && $('activities').value) || '').trim() ||
      String(($('highlights') && $('highlights').value) || '').trim() ||
      String(($('testimonies') && $('testimonies').value) || '').trim() ||
      String(($('challenges') && $('challenges').value) || '').trim() ||
      String(($('prayer-requests') && $('prayer-requests').value) || '').trim() ||
      String(($('next-month') && $('next-month').value) || '').trim() ||
      String(($('meeting-notes-summary') && $('meeting-notes-summary').value) || '').trim()
    );
  }

  /** If this month has no shared content, jump to the newest draft that does. */
  function huntRecentSharedDraft(opts, unitId, year, month) {
    if (!opts.db || !unitId) return Promise.resolve(false);
    var token = ++periodHuntToken;
    var candidates = [];
    var cursor = new Date(year, month - 1, 1);
    for (var i = 0; i < 6; i++) {
      var d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      candidates.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }
    return Promise.all(
      candidates.map(function (c) {
        return opts.db
          .collection('nigeria_unit_report_drafts')
          .doc(draftDocId(unitId, c.year, c.month))
          .get()
          .then(function (snap) {
            return { meta: c, snap: snap };
          })
          .catch(function () {
            return { meta: c, snap: null };
          });
      })
    ).then(function (rows) {
      if (token !== periodHuntToken) return false;
      var hit = null;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row.snap || !row.snap.exists) continue;
        var data = row.snap.data() || {};
        if (!draftHasContent(data.form)) continue;
        if (row.meta.year === year && row.meta.month === month) {
          hit = row;
          break;
        }
        if (!hit) hit = row;
      }
      if (!hit) {
        // Multi-unit members often land on the wrong unit — ask the server.
        return openBestSharedDraftViaCallable(opts, { preferUnitId: unitId });
      }
      if (hit.meta.year === year && hit.meta.month === month) {
        applyFormPayload(hit.snap.data().form, { force: true });
        draftDirty = false;
        updateCollabUi(hit.snap.data());
        showReportStatus('Shared report details loaded for ' + monthLabel(year, month) + '.', 'success');
        return true;
      }
      if ($('report-year')) $('report-year').value = String(hit.meta.year);
      if ($('report-month')) $('report-month').value = String(hit.meta.month);
      draftDirty = false;
      showReportStatus(
        'Opened shared ' +
          monthLabel(hit.meta.year, hit.meta.month) +
          ' report (this month had no saved details yet).',
        'success'
      );
      loadAttendance(opts.functions, unitId);
      watchDraft(opts);
      return true;
    });
  }

  function renderAvailableSharedDrafts(drafts, active) {
    var wrap = $('report-shared-drafts');
    if (!wrap) return;
    var others = (drafts || []).filter(function (d) {
      if (!active) return true;
      return !(
        d.unitId === active.unitId &&
        Number(d.reportYear) === Number(active.reportYear) &&
        Number(d.reportMonth) === Number(active.reportMonth)
      );
    });
    if (!others.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }
    wrap.classList.remove('hidden');
    wrap.innerHTML =
      '<p class="font-semibold text-slate-800 mb-2">Other shared reports you can open</p>' +
      '<div class="flex flex-col gap-2">' +
      others
        .slice(0, 6)
        .map(function (d) {
          return (
            '<button type="button" class="btn-open-shared-draft text-left rounded-lg border border-sky-200 bg-white hover:bg-sky-50 px-3 py-2 text-sm" data-unit="' +
            String(d.unitId || '') +
            '" data-year="' +
            String(d.reportYear || '') +
            '" data-month="' +
            String(d.reportMonth || '') +
            '">' +
            '<span class="font-medium text-slate-900">' +
            (d.unitLabel || d.unitId) +
            '</span>' +
            '<span class="text-slate-600"> · ' +
            monthLabel(d.reportYear, d.reportMonth) +
            '</span>' +
            (d.status ? ' <span class="text-slate-400">(' + d.status + ')</span>' : '') +
            (d.sharedByName ? '<span class="block text-xs text-slate-500 mt-0.5">Shared by ' + d.sharedByName + '</span>' : '') +
            '</button>'
          );
        })
        .join('') +
      '</div>';
    wrap.querySelectorAll('.btn-open-shared-draft').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openDraftSelection(runtimeOpts, {
          unitId: btn.getAttribute('data-unit'),
          reportYear: parseInt(btn.getAttribute('data-year'), 10),
          reportMonth: parseInt(btn.getAttribute('data-month'), 10),
        });
      });
    });
  }

  function openDraftSelection(opts, draft) {
    if (!opts || !draft || !draft.unitId) return;
    var radio = document.querySelector('input[name="unit"][value="' + draft.unitId + '"]');
    if (radio) radio.checked = true;
    if ($('report-year') && draft.reportYear) $('report-year').value = String(draft.reportYear);
    if ($('report-month') && draft.reportMonth) $('report-month').value = String(draft.reportMonth);
    draftDirty = false;
    updateUnitSectionSummary();
    if (draft.form && draftHasContent(draft.form)) {
      applyFormPayload(draft.form, { force: true });
      updateCollabUi({
        status: draft.status,
        form: draft.form,
        contributions: draft.contributions,
        sharedByName: draft.sharedByName,
        approvedByName: draft.approvedByName,
      });
      showReportStatus(
        'Opened ' + (draft.unitLabel || draft.unitId) + ' · ' + monthLabel(draft.reportYear, draft.reportMonth) + '.',
        'success'
      );
    }
    loadAttendance(opts.functions, draft.unitId);
    watchDraft(opts);
  }

  function periodRank(year, month) {
    return Number(year) * 12 + Number(month);
  }

  function pickBestSharedDraft(drafts, preferUnitId) {
    if (!drafts || !drafts.length) return null;
    var selected = selectedUnitId();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    var selectedRank = year && month ? periodRank(year, month) : null;
    var unitFocus = preferUnitId || selected || '';

    function notNewerThanSelected(d) {
      if (selectedRank == null) return true;
      return periodRank(d.reportYear, d.reportMonth) <= selectedRank;
    }

    function pickFrom(list) {
      if (!list || !list.length) return null;
      var submitted = list.find(function (d) {
        return d.status === 'submitted';
      });
      if (submitted) return submitted;
      var approved = list.find(function (d) {
        return d.status === 'approved';
      });
      if (approved) return approved;
      var shared = list.find(function (d) {
        return d.status === 'shared';
      });
      if (shared) return shared;
      return list[0];
    }

    var exact = drafts.find(function (d) {
      return (
        d.unitId === selected &&
        Number(d.reportYear) === year &&
        Number(d.reportMonth) === month
      );
    });
    if (exact) return exact;

    // Prefer the selected unit, but never jump forward to a newer month than the
    // reporting period on screen (e.g. stay on September, do not auto-open October).
    if (unitFocus) {
      var sameUnitNotNewer = drafts.filter(function (d) {
        return d.unitId === unitFocus && notNewerThanSelected(d);
      });
      var bestSame = pickFrom(sameUnitNotNewer);
      if (bestSame) return bestSame;
    }

    var anyNotNewer = drafts.filter(notNewerThanSelected);
    var bestAny = pickFrom(anyNotNewer);
    if (bestAny) return bestAny;

    // Last resort only when no selected period: newest shared/submitted.
    if (selectedRank == null) {
      var shared = drafts.find(function (d) {
        return d.status === 'shared';
      });
      if (shared) return shared;
      return drafts[0];
    }
    return null;
  }

  function openBestSharedDraftViaCallable(opts, flags) {
    flags = flags || {};
    if (!opts || !opts.functions) return Promise.resolve(false);
    if (openBestSharedDraftViaCallable._busy) return Promise.resolve(false);
    openBestSharedDraftViaCallable._busy = true;
    return reportCallable(opts.functions, 'listMyNigeriaUnitReportDrafts', 45000)({})
      .then(function (res) {
        openBestSharedDraftViaCallable._busy = false;
        var drafts = (res.data && res.data.drafts) || [];
        if (!drafts.length) {
          renderAvailableSharedDrafts([], null);
          return false;
        }
        var best = pickBestSharedDraft(drafts, flags.preferUnitId);
        renderAvailableSharedDrafts(drafts, best);
        if (!best) return false;
        // Only auto-switch when the on-screen form is still empty (never clobber typing).
        if (!formLooksEmpty() && !flags.force) return true;
        var already =
          selectedUnitId() === best.unitId &&
          Number(($('report-year') && $('report-year').value) || 0) === Number(best.reportYear) &&
          Number(($('report-month') && $('report-month').value) || 0) === Number(best.reportMonth) &&
          draftHasContent(best.form) &&
          !formLooksEmpty();
        if (already) {
          applyFormPayload(best.form, { force: true });
          draftDirty = false;
          updateCollabUi(best);
          return true;
        }
        openDraftSelection(opts, best);
        return true;
      })
      .catch(function (e) {
        openBestSharedDraftViaCallable._busy = false;
        console.warn('listMyNigeriaUnitReportDrafts', e);
        return false;
      });
  }

  function watchDraft(opts) {
    detachDraftListener();
    var unitId = selectedUnitId();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    if (!opts.db || !unitId || !year || !month) {
      updateCollabUi(null);
      if (opts.functions) openBestSharedDraftViaCallable(opts, { force: false });
      return;
    }

    function applyDraftSnapshot(draft, announce) {
      updateCollabUi(draft);
      if (!draft || !draftHasContent(draft.form)) {
        if (announce && formLooksEmpty()) {
          huntRecentSharedDraft(opts, unitId, year, month);
        }
        return;
      }
      if (draftDirty && !(formLooksEmpty() && draftHasContent(draft.form))) return;
      applyFormPayload(draft.form, { force: true });
      draftDirty = false;
      if (announce && draftHasContent(draft.form)) {
        showReportStatus('Shared report details loaded for ' + monthLabel(year, month) + '.', 'success');
      }
      // Still list other units' shared drafts for multi-unit members.
      if (announce) openBestSharedDraftViaCallable(opts, { preferUnitId: unitId });
    }

    // One-shot get first (more reliable on mobile than waiting on snapshot).
    opts.db
      .collection('nigeria_unit_report_drafts')
      .doc(draftDocId(unitId, year, month))
      .get()
      .then(function (snap) {
        applyDraftSnapshot(snap.exists ? snap.data() : null, true);
      })
      .catch(function (e) {
        console.warn('draft get', e);
        if (formLooksEmpty()) {
          // Permission errors on empty months used to look like "can't see shared report".
          openBestSharedDraftViaCallable(opts, { preferUnitId: unitId });
        }
      });

    draftListener = opts.db
      .collection('nigeria_unit_report_drafts')
      .doc(draftDocId(unitId, year, month))
      .onSnapshot(
        function (snap) {
          applyDraftSnapshot(snap.exists ? snap.data() : null, false);
        },
        function (err) {
          console.warn('draft watch', err);
          // Do not clear a successfully loaded form on permission noise.
          if (formLooksEmpty()) {
            openBestSharedDraftViaCallable(opts, { preferUnitId: unitId });
          }
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
    if (!draftHasContent(form)) {
      var proceed = window.confirm(
        'Your report fields look empty. Sharing now can make the team see a blank report.\n\nShare anyway?'
      );
      if (!proceed) {
        showReportStatus('Share cancelled — fill in the report details first.', 'error');
        return Promise.resolve();
      }
    }
    showReportStatus('Sharing with teammates…', 'info');
    return withReportBusy(['btn-share-team', 'btn-submit-coordinator'], function () {
      return reportCallable(opts.functions, 'shareNigeriaUnitReportDraft', 60000)({
        unitId: unitId,
        reportYear: year,
        reportMonth: month,
        form: form,
      })
        .then(function (res) {
          draftDirty = false;
          var unitLabel = unitLabelFor(unitId) || unitId;
          var emailed = ((res && res.data && res.data.emailedTo) || [])
            .map(function (r) {
              return r.name || r.email;
            })
            .filter(Boolean);
          var mailLine = emailed.length
            ? ' Emailed: ' + emailed.join(', ') + '.'
            : ' Shared on the hub — other leaders can open Reports now.';
          showReportStatus(
            'Shared with ' +
              unitLabel +
              ' leaders.' +
              mailLine +
              ' They can open Reports, then the shared ' +
              unitLabel +
              ' · ' +
              monthLabel(year, month) +
              ' report.',
            'success'
          );
          watchDraft(opts);
        })
        .catch(function (e) {
          var msg = (e && e.message) || 'Could not share report.';
          if (/deadline|timeout/i.test(msg)) {
            msg = 'Sharing timed out. Check your connection and try again.';
          }
          showReportStatus(msg, 'error');
        });
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
    return withReportBusy(['btn-save-contribution'], function () {
      return reportCallable(opts.functions, 'contributeNigeriaUnitReportDraft', 60000)({
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
          var msg = (e && e.message) || 'Could not save additions.';
          if (/deadline|timeout/i.test(msg)) {
            msg = 'Save timed out. Your edits may not have been saved — try again.';
          }
          showReportStatus(msg, 'error');
        });
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
    return withReportBusy(['btn-approve-report', 'btn-share-team'], function () {
      return reportCallable(opts.functions, 'approveNigeriaUnitReportDraft', 60000)({
        unitId: unitId,
        reportYear: year,
        reportMonth: month,
        form: form,
      })
        .then(function () {
          showReportStatus('Report approved — you can submit when ready.', 'success');
        })
        .catch(function (e) {
          var msg = (e && e.message) || 'Could not approve report.';
          if (/deadline|timeout/i.test(msg)) {
            msg = 'Approval timed out. Try again in a moment.';
          }
          showReportStatus(msg, 'error');
        });
    });
  }

  function submitReport(opts) {
    if (!window.MonthlyUnitReport) return Promise.resolve();
    var err = MonthlyUnitReport.validateForm(MonthlyUnitReport.readForm());
    if (err) {
      showReportStatus(err, 'error');
      return Promise.resolve();
    }
    var unitId = selectedUnitId();
    if (!unitId) {
      showReportStatus('Select your unit first — Media Team if that is the report you are filing.', 'error');
      return Promise.resolve();
    }
    if (!isLeaderForUnit(unitId) && !(dashboardCtx && dashboardCtx.isSuperUser)) {
      showReportStatus(
        'Only the leader of this unit can submit. If you lead Media Team, tap Media Team — not Communications & Social Media.',
        'error'
      );
      return Promise.resolve();
    }
    if (!isSoloLeader(unitId)) {
      if (!lastDraftStatus || lastDraftStatus === 'draft') {
        var shareFirst = window.confirm(
          'This report has not been shared with the other group leaders yet.\n\nOK = share it with them first (they get an email)\nCancel = stay on this draft'
        );
        if (shareFirst) return shareWithTeammates(opts);
        showReportStatus('Share with the other leaders before submitting the final report.', 'error');
        return Promise.resolve();
      }
      if (lastDraftStatus === 'shared') {
        showReportStatus(
          'Approve the shared report first, then submit. Other leaders can add details while it is shared.',
          'error'
        );
        return Promise.resolve();
      }
    }
    var form = readFormPayload();
    showReportStatus('Submitting report…', 'info');
    return withReportBusy(
      ['btn-submit-coordinator', 'btn-share-team', 'btn-approve-report'],
      function () {
        return reportCallable(opts.functions, 'submitNigeriaUnitReport', 90000)({
          unitId: unitId,
          reportYear: parseInt(form.reportYear, 10),
          reportMonth: parseInt(form.reportMonth, 10),
          meetingsHeld: form.meetingsHeld,
          attendance: form.attendance,
          activities: form.activities,
          highlights: form.highlights,
          testimonies: form.testimonies,
          challenges: form.challenges,
          prayerRequests: form.prayerRequests,
          nextMonth: form.nextMonth,
          meetingNotesSummary: form.meetingNotesSummary,
          photos: form.photos || [],
        })
          .then(function (res) {
            var emailed = ((res && res.data && res.data.emailedTo) || [])
              .map(function (r) {
                return r.name || r.email;
              })
              .filter(Boolean);
            var mailLine = emailed.length
              ? ' Notification emailed to ' + emailed.join(', ') + '.'
              : ' Report is on file. If a leader did not get mail, ask them to open Reports on the hub.';
            showReportStatus('Report submitted successfully!' + mailLine, 'success');
          })
          .catch(function (e) {
            var msg =
              (e && e.message) || 'Submit failed — approve the shared report first.';
            if (/deadline|timeout/i.test(msg)) {
              msg = 'Submit timed out. Check Reports again — it may have gone through.';
            } else if (/internal/i.test(msg)) {
              msg =
                'Submit hit a server error. If you already emailed yourself a copy, that part is fine — try Submit once more.';
            }
            showReportStatus(msg, 'error');
          });
      }
    );
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

  function reopenSubmittedReport(opts, mode) {
    var unitId = selectedUnitId();
    var year = parseInt(($('report-year') && $('report-year').value) || '', 10);
    var month = parseInt(($('report-month') && $('report-month').value) || '', 10);
    if (!unitId || !year || !month) {
      showReportStatus('Select the unit and reporting month first.', 'error');
      return Promise.resolve();
    }
    if (!opts.functions) return Promise.resolve();
    var isRetract = mode === 'retract';
    var ok = window.confirm(
      isRetract
        ? 'Retract this submission?\n\nThe team can edit again, then you will approve and submit once more.\nThe previous filed copy stays until you submit again.'
        : 'Unlock this submitted report for editing?\n\nYou can edit the fields, then tap Submit final report again.\nThe previous filed copy stays until you submit again.'
    );
    if (!ok) return Promise.resolve();
    showReportStatus(isRetract ? 'Retracting submission…' : 'Unlocking report for edits…', 'info');
    return withReportBusy(
      ['btn-edit-resubmit-report', 'btn-retract-report', 'btn-submit-coordinator'],
      function () {
        return reportCallable(opts.functions, 'reopenNigeriaUnitReportDraft', 60000)({
          unitId: unitId,
          reportYear: year,
          reportMonth: month,
          mode: isRetract ? 'retract' : 'edit',
        })
          .then(function (res) {
            draftDirty = false;
            var msg =
              (res && res.data && res.data.message) ||
              (isRetract
                ? 'Submission retracted — teammates can edit again.'
                : 'Unlocked — edit the fields, then submit again.');
            showReportStatus(msg, 'success');
            watchDraft(opts);
          })
          .catch(function (e) {
            var msg = (e && e.message) || 'Could not reopen that report.';
            if (/not found|not been deployed|404/i.test(msg)) {
              msg =
                'Resubmit is not live on the server yet. Deploy Cloud Functions, then try again.';
            }
            showReportStatus(msg, 'error');
          });
      }
    );
  }

  function bindCollabActions(opts) {
    var shareBtn = $('btn-share-team');
    if (shareBtn && !shareBtn.dataset.bound) {
      shareBtn.dataset.bound = '1';
      shareBtn.addEventListener('click', function () {
        shareWithTeammates(opts);
      });
    }
    var shareSecondary = $('btn-share-team-secondary');
    if (shareSecondary && !shareSecondary.dataset.bound) {
      shareSecondary.dataset.bound = '1';
      shareSecondary.addEventListener('click', function () {
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
    var editResubmitBtn = $('btn-edit-resubmit-report');
    if (editResubmitBtn && !editResubmitBtn.dataset.bound) {
      editResubmitBtn.dataset.bound = '1';
      editResubmitBtn.addEventListener('click', function () {
        reopenSubmittedReport(opts, 'edit');
      });
    }
    var retractBtn = $('btn-retract-report');
    if (retractBtn && !retractBtn.dataset.bound) {
      retractBtn.dataset.bound = '1';
      retractBtn.addEventListener('click', function () {
        reopenSubmittedReport(opts, 'retract');
      });
    }
    var reloadBtn = $('btn-reload-shared-draft');
    if (reloadBtn && !reloadBtn.dataset.bound) {
      reloadBtn.dataset.bound = '1';
      reloadBtn.addEventListener('click', function () {
        draftDirty = false;
        showReportStatus('Reloading shared report details…', 'info');
        openBestSharedDraftViaCallable(opts, { force: true, preferUnitId: selectedUnitId() }).then(function () {
          watchDraft(opts);
        });
      });
    }
    overrideSubmitButton(opts);

    ['activities', 'highlights', 'testimonies', 'challenges', 'prayer-requests', 'next-month', 'meeting-notes-summary'].forEach(
      function (id) {
        var el = $(id);
        if (el && !el.dataset.draftBound) {
          el.dataset.draftBound = '1';
          el.addEventListener('input', function () {
            if (applyingDraft) return;
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
    return reportCallable(functions, 'getNigeriaAttendanceForReport', 45000)({
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

  function bindReportPhotoUploads(opts) {
    var input = $('report-photo-input');
    var statusEl = $('report-photos-status');
    if (!input || input.dataset.bound) return;
    input.dataset.bound = '1';
    if (window.MonthlyUnitReport && MonthlyUnitReport.renderPhotoGrid) {
      MonthlyUnitReport.renderPhotoGrid();
    }
    input.addEventListener('change', function () {
      var files = Array.prototype.slice.call(input.files || []);
      input.value = '';
      var storage = opts && opts.storage;
      var auth = opts && opts.auth;
      var user = auth && auth.currentUser;
      if (!storage || !user) {
        if (statusEl) statusEl.textContent = 'Sign in required to upload photos.';
        return;
      }
      var unitId = selectedUnitId() || 'unit';
      var year = ($('report-year') && $('report-year').value) || 'year';
      var month = ($('report-month') && $('report-month').value) || 'mm';
      var period = year + '-' + String(month).padStart(2, '0');
      var existing = (window.MonthlyUnitReport && MonthlyUnitReport.getPhotos()) || [];
      var remaining = Math.max(0, 12 - existing.length);
      if (!remaining) {
        if (statusEl) statusEl.textContent = 'You can add up to 12 photos.';
        return;
      }
      var chain = Promise.resolve(existing.slice());
      files.slice(0, remaining).forEach(function (file) {
        chain = chain.then(function (list) {
          if (!isLikelyImageFile(file)) return list;
          if (file.size > 8 * 1024 * 1024) {
            if (statusEl) statusEl.textContent = 'Each photo must be under 8 MB.';
            return list;
          }
          if (statusEl) statusEl.textContent = 'Uploading ' + (file.name || 'photo') + '…';
          var safe = String(file.name || 'photo')
            .replace(/[^\w.\-]+/g, '_')
            .slice(0, 40);
          var path =
            'nigeria_unit_media/' +
            unitId +
            '/reports/' +
            period +
            '/' +
            Date.now() +
            '_' +
            user.uid.slice(0, 6) +
            '_' +
            safe;
          return storage
            .ref(path)
            .put(file, { contentType: imageUploadContentType(file) })
            .then(function () {
              return storage.ref(path).getDownloadURL();
            })
            .then(function (url) {
              list.push({ url: url });
              return list;
            });
        });
      });
      chain
        .then(function (list) {
          if (window.MonthlyUnitReport && MonthlyUnitReport.setPhotos) {
            MonthlyUnitReport.setPhotos(list);
          }
          if (window.MonthlyUnitReport && MonthlyUnitReport.updatePreview) {
            MonthlyUnitReport.updatePreview();
          }
          draftDirty = true;
          if (statusEl) statusEl.textContent = 'Photos ready — share or submit to include them in the final report.';
        })
        .catch(function (e) {
          if (statusEl) statusEl.textContent = (e && e.message) || 'Photo upload failed.';
        });
    });
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

  function syncNigeriaUnitsIntoReport(data) {
    if (!window.MonthlyUnitReport || !window.NigeriaUnits) return;
    var unitsArr = MonthlyUnitReport.UNITS;
    if (!unitsArr || !unitsArr.splice) return;
    var source =
      typeof NigeriaUnits.listForUi === 'function'
        ? NigeriaUnits.listForUi()
        : NigeriaUnits.NIGERIA_UNITS || [];
    unitsArr.splice(0, unitsArr.length);
    source.forEach(function (u) {
      unitsArr.push({
        id: u.id,
        category: 'nigeria',
        label: u.label,
        icon: u.icon || 'fa-users',
        gradient: u.gradient || 'from-emerald-500 to-teal-700',
        soft: 'bg-emerald-50 border-emerald-200',
        accent: 'text-emerald-800',
        ring: 'ring-emerald-400',
        barColor: '#059669',
      });
    });

    var wrap = $('unit-cards');
    if (!wrap) return;
    if (data && window.NigeriaUnits && NigeriaUnits.mergeUnitContexts) {
      data.unitContexts = NigeriaUnits.mergeUnitContexts(
        data.unitContexts,
        data.profile,
        data.isSuperUser
      );
      dashboardCtx = data;
    }
    var ctx = (data && data.unitContexts) || [];
    var allowed = {};
    var leadUnits = {};
    ctx.forEach(function (c) {
      if (c && c.unitId && !c.browseOnly) {
        allowed[c.unitId] = true;
        if (c.role === 'leader') leadUnits[c.unitId] = true;
      }
    });
    var showAll = !!(data && data.isSuperUser);
    var list = unitsArr.filter(function (u) {
      return showAll || allowed[u.id];
    });
    if (!list.length) {
      wrap.innerHTML =
        '<p class="text-sm text-slate-600">Your units did not load. Refresh, then select <strong>Media Team</strong> if that is the team you lead.</p>';
      return;
    }

    wrap.innerHTML =
      '<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">' +
      list
        .map(function (u) {
          return (
            '<label class="unit-card cursor-pointer block rounded-2xl border-2 border-transparent p-3 sm:p-4 transition-all hover:shadow-md ' +
            u.soft +
            '" data-unit="' +
            u.id +
            '">' +
            '<input type="radio" name="unit" value="' +
            u.id +
            '" class="sr-only unit-radio" />' +
            '<div class="flex items-start gap-3">' +
            '<span class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ' +
            u.gradient +
            ' text-white flex items-center justify-center shrink-0 shadow-sm">' +
            '<i class="fas ' +
            u.icon +
            ' text-lg"></i></span>' +
            '<div><span class="font-semibold text-slate-900 block text-sm sm:text-base leading-snug">' +
            (u.label || u.id) +
            '</span>' +
            '<span class="text-xs text-slate-500 mt-0.5 block">' +
            (leadUnits[u.id] ? 'You lead this team — tap to report' : 'Tap to select') +
            '</span></div></div></label>'
          );
        })
        .join('') +
      '</div>';

    wrap.querySelectorAll('.unit-radio').forEach(function (radio) {
      radio.addEventListener('change', function () {
        wrap.querySelectorAll('.unit-card').forEach(function (card) {
          var id = card.getAttribute('data-unit');
          var u = unitsArr.find(function (x) {
            return x.id === id;
          });
          var checked = card.querySelector('.unit-radio');
          if (checked && checked.checked && u) {
            card.classList.add('ring-2', u.ring, 'shadow-md');
            card.classList.remove('border-transparent');
          } else {
            card.classList.remove('ring-2', 'shadow-md');
            if (u) card.classList.add('border-transparent');
          }
        });
        if (window.MonthlyUnitReport && MonthlyUnitReport.updatePreview) {
          MonthlyUnitReport.updatePreview();
        }
      });
    });
  }

  function rebindButton(id, handler) {
    var btn = $(id);
    if (!btn || !btn.parentNode) return null;
    var clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', handler);
    return clone;
  }

  function bindExportActions(opts) {
    rebindButton('btn-download-pdf', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.downloadPdf) {
        showReportStatus('PDF tools still loading — refresh and try again.', 'error');
        return;
      }
      showReportStatus('Preparing your PDF…', 'info');
      return withReportBusy(
        ['btn-download-pdf', 'btn-download-pptx-file', 'btn-download-pptx', 'btn-print-report', 'btn-email-report'],
        function () {
        return Promise.resolve(MonthlyUnitReport.downloadPdf()).catch(function (e) {
          var msg = (e && e.message) || '';
          if (msg === 'popup_blocked') {
            showReportStatus(
              'Allow pop-ups for prayercityhtx.com, then tap Download again. Or use Send to my email.',
              'error'
            );
            return;
          }
          if (msg && msg.indexOf('Please') === 0) showReportStatus(msg, 'error');
        });
      });
    });

    rebindButton('btn-download-pptx-file', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.downloadPptx) {
        showReportStatus('PowerPoint download is still loading — refresh and try again.', 'error');
        return;
      }
      showReportStatus('Preparing your PowerPoint file…', 'info');
      return withReportBusy(
        [
          'btn-download-pdf',
          'btn-download-pptx-file',
          'btn-download-pptx',
          'btn-present-bolt',
          'btn-print-report',
          'btn-email-report',
        ],
        function () {
          return Promise.resolve(MonthlyUnitReport.downloadPptx()).catch(function (e) {
            var msg = (e && e.message) || '';
            if (msg === 'pptx_unavailable') {
              showReportStatus('PowerPoint tools still loading — refresh and try again.', 'error');
              return;
            }
            if (msg && msg.indexOf('Please') === 0) showReportStatus(msg, 'error');
            else if (msg) showReportStatus(msg, 'error');
          });
        }
      );
    });

    rebindButton('btn-download-pptx', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.presentPptSlides) {
        showReportStatus('Presentation tools still loading — refresh and try again.', 'error');
        return;
      }
      return withReportBusy(
        [
          'btn-download-pdf',
          'btn-download-pptx-file',
          'btn-download-pptx',
          'btn-present-bolt',
          'btn-print-report',
          'btn-email-report',
        ],
        function () {
          return Promise.resolve(MonthlyUnitReport.presentPptSlides()).catch(function (e) {
            var msg = (e && e.message) || '';
            if (msg && msg.indexOf('Please') === 0) showReportStatus(msg, 'error');
          });
        }
      );
    });

    rebindButton('btn-present-bolt', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.presentBoltSlides) {
        showReportStatus('Bolt presentation still loading — refresh and try again.', 'error');
        return;
      }
      return withReportBusy(
        [
          'btn-download-pdf',
          'btn-download-pptx-file',
          'btn-download-pptx',
          'btn-present-bolt',
          'btn-print-report',
          'btn-email-report',
        ],
        function () {
          return Promise.resolve(MonthlyUnitReport.presentBoltSlides()).catch(function (e) {
            var msg = (e && e.message) || '';
            if (msg && msg.indexOf('Please') === 0) showReportStatus(msg, 'error');
            else if (msg === 'empty_deck') {
              showReportStatus('Nothing to present yet — add activities or notes first.', 'error');
            } else if (msg) showReportStatus(msg, 'error');
            else showReportStatus('Could not open Bolt. Try Present or PDF.', 'error');
          });
        }
      );
    });

    rebindButton('btn-print-report', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.openPrintableReport || !MonthlyUnitReport.readForm) {
        showReportStatus('Report tools still loading — refresh and try again.', 'error');
        return;
      }
      var form = MonthlyUnitReport.readForm();
      var err = MonthlyUnitReport.validateForm ? MonthlyUnitReport.validateForm(form) : '';
      if (err) {
        showReportStatus(err, 'error');
        return;
      }
      showReportStatus('Opening print view…', 'info');
      return withReportBusy(
        ['btn-download-pdf', 'btn-download-pptx-file', 'btn-download-pptx', 'btn-print-report', 'btn-email-report'],
        function () {
          return Promise.resolve(MonthlyUnitReport.openPrintableReport(form)).catch(function (e) {
            var msg = (e && e.message) || '';
            if (msg === 'popup_blocked') {
              showReportStatus(
                'Allow pop-ups for prayercityhtx.com, then tap Print again. Or use Send to my email.',
                'error'
              );
            }
          });
        }
      );
    });

    rebindButton('btn-email-report', function () {
      if (!window.MonthlyUnitReport || !MonthlyUnitReport.readForm) {
        showReportStatus('Report form still loading — refresh and try again.', 'error');
        return;
      }
      var form = MonthlyUnitReport.readForm();
      var err = MonthlyUnitReport.validateForm ? MonthlyUnitReport.validateForm(form) : '';
      if (err) {
        showReportStatus(err, 'error');
        return;
      }
      if (!opts.functions) {
        showReportStatus('Email service unavailable. Use Download PDF instead.', 'error');
        return;
      }
      showReportStatus('Sending a copy to your email…', 'info');
      return withReportBusy(
        ['btn-email-report', 'btn-download-pdf', 'btn-download-pptx-file', 'btn-download-pptx', 'btn-print-report'],
        function () {
        return reportCallable(opts.functions, 'emailNigeriaUnitReportCopy', 60000)({
          reporterName: form.reporterName,
          reporterEmail: form.reporterEmail,
          reporterPhone: form.reporterPhone,
          unitId: form.unitId,
          unitDisplay: form.unitDisplay,
          reportYear: parseInt(form.reportYear, 10),
          reportMonth: parseInt(form.reportMonth, 10),
          meetingsHeld: form.meetingsHeld,
          attendance: form.attendance,
          meetingNotesSummary: form.meetingNotesSummary,
          activities: form.activities,
          highlights: form.highlights,
          testimonies: form.testimonies,
          challenges: form.challenges,
          prayerRequests: form.prayerRequests,
          nextMonth: form.nextMonth,
        })
          .then(function (res) {
            var to = (res.data && res.data.emailedTo) || form.reporterEmail;
            showReportStatus('Report emailed to ' + to + '. Check inbox/spam.', 'success');
          })
          .catch(function (e) {
            var msg = (e && e.message) || 'Could not email the report.';
            if (/deadline|timeout/i.test(msg)) {
              msg = 'Email timed out. Try Download PDF, or try Send again in a moment.';
            } else if (/internal/i.test(msg)) {
              msg =
                'Email service returned an error. Check your inbox — it may still have arrived — or use Download PDF.';
            }
            showReportStatus(msg, 'error');
          });
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

    syncNigeriaUnitsIntoReport(data);
    prefillReporter(data);
    preselectUnit(data);
    bindCollapsibleUnit();
    bindCollapsibleReportSections();
    updateUnitSectionSummary();
    setUnitSectionOpen(!selectedUnitId());
    // Keep ministry open by default; collapse notes/photos to shorten the form.
    setReportSectionOpen('notes', true);
    setReportSectionOpen('ministry', true);
    setReportSectionOpen('photos', true);
    bindDashboardHooks(opts);
    bindCollabActions(opts);
    bindExportActions(opts);
    bindReportPhotoUploads(opts);
    // Paint workflow buttons immediately (Share / Approve / Submit / Resubmit).
    updateCollabUi(null);
    // Load shared draft first so attendance/summary helpers do not paint over it.
    watchDraft(opts);
    window.setTimeout(function () {
      loadAttendance(opts.functions, selectedUnitId()).then(function () {
        return generateNotesSummary({ db: opts.db, functions: opts.functions });
      });
    }, 400);
    // If the selected period is still empty, open the best matching draft for this unit
    // without jumping ahead to a newer month (e.g. keep September, do not force October).
    window.setTimeout(function () {
      if (!formLooksEmpty() || !opts.functions) return;
      openBestSharedDraftViaCallable(opts, {
        preferUnitId: selectedUnitId(),
        force: false,
      });
    }, 900);
  }

  function refresh(data, opts) {
    if (!mounted) return;
    dashboardCtx = data;
    runtimeOpts = opts || runtimeOpts;
    syncNigeriaUnitsIntoReport(data);
    prefillReporter(data);
    if (runtimeOpts) bindDashboardHooks(runtimeOpts);
    if (!selectedUnitId()) preselectUnit(data);
    updateCollabUi({ status: lastDraftStatus });
    watchDraft(runtimeOpts || opts);
  }

  global.NigeriaDashboardReport = {
    mount: mount,
    refresh: refresh,
    generateNotesSummary: generateNotesSummary,
    detachDraftListener: detachDraftListener,
    showStatus: showReportStatus,
  };
})(typeof window !== 'undefined' ? window : this);
