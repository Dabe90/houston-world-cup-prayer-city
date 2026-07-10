/**
 * When monthly-report.html?region=nigeria — prefill attendance from Nigeria dashboard data.
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('region') !== 'nigeria') return;

  function $(id) {
    return document.getElementById(id);
  }

  function init() {
    var cfg = window.__FIREBASE_CONFIG__;
    if (!cfg || !cfg.apiKey || typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    var auth = firebase.auth();
    var functions = firebase.app().functions('us-central1');

    var banner = document.createElement('div');
    banner.id = 'nigeria-attendance-banner';
    banner.className =
      'rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 px-4 py-3 text-sm mb-6';
    banner.innerHTML =
      '<strong>Nigeria mode</strong> — Sign in with your <strong>volunteer email</strong> on <a href="ddbs-nig.html" class="underline font-semibold">DDBS Nigeria</a> to auto-fill attendance (verified by +234 on your registration).';
    var status = $('report-status');
    if (status && status.parentNode) {
      status.parentNode.insertBefore(banner, status);
    }

    auth.onAuthStateChanged(function (user) {
      if (!user) return;
      var year = ($('report-year') && $('report-year').value) || new Date().getFullYear();
      var month = ($('report-month') && $('report-month').value) || new Date().getMonth() + 1;

      functions
        .httpsCallable('getNigeriaAttendanceForReport')({
          reportYear: parseInt(year, 10),
          reportMonth: parseInt(month, 10),
        })
        .then(function (res) {
          applyStats(res.data);
          banner.innerHTML =
            '<strong>Attendance loaded</strong> from your Nigeria check-ins. Review below before submitting.';
          banner.className =
            'rounded-xl border border-sky-200 bg-sky-50 text-sky-900 px-4 py-3 text-sm mb-6';
        })
        .catch(function () {});
    });

    ['report-year', 'report-month'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('change', function () {
          if (!auth.currentUser) return;
          var year = $('report-year').value;
          var month = $('report-month').value;
          functions
            .httpsCallable('getNigeriaAttendanceForReport')({
              reportYear: parseInt(year, 10),
              reportMonth: parseInt(month, 10),
            })
            .then(function (res) {
              applyStats(res.data);
            });
        });
      }
    });
  }

  function applyStats(data) {
    if (!data) return;
    var meetingsEl = $('meetings-held');
    var attendanceEl = $('attendance');
    var highlightsEl = $('highlights');

    if (data.role === 'leader' && data.unitStats) {
      var u = data.unitStats;
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
    } else if (data.personalStats) {
      var p = data.personalStats;
      if (meetingsEl) meetingsEl.value = String(p.pastScheduledCount || p.scheduledCount || '');
      var personal = [
        'Attendance rate: ' + (p.attendanceRate != null ? p.attendanceRate + '%' : '—'),
        'Present: ' + (p.attendedCount || 0) + ' · Missed: ' + (p.missedCount || 0),
        'Current streak: ' + (p.currentStreak || 0),
      ];
      if (p.insight && p.insight.message) personal.push(p.insight.message);
      if (attendanceEl) attendanceEl.value = personal.join('\n');
    }

    if (typeof window.MonthlyUnitReport !== 'undefined' && MonthlyUnitReport.readForm) {
      var preview = $('report-preview');
      if (preview) preview.innerHTML = MonthlyUnitReport.buildReportHtml(MonthlyUnitReport.readForm(), false);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
