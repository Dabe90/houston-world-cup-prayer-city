/**
 * Nigeria volunteer dashboard — email sign-in; access by +234 on volunteer registration.
 */
(function () {
  var auth, db, functions;
  var dashboardData = null;
  var EMAIL_LINK_CONTINUE_URL =
    window.location.origin + window.location.pathname;
  var SELF_SERVE_SIGNIN_URL =
    'https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/volunteerSelfServeSignInMail';

  function $(id) {
    return document.getElementById(id);
  }

  function show(el) {
    if (el) el.classList.remove('hidden');
  }
  function hide(el) {
    if (el) el.classList.add('hidden');
  }

  function setStatus(msg, type) {
    var el = $('ng-status');
    if (!el) return;
    el.textContent = msg;
    el.className =
      'rounded-xl border px-4 py-3 text-sm mb-4 ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900');
    show(el);
  }

  function initFirebase() {
    var cfg = window.__FIREBASE_CONFIG__;
    if (!cfg || !cfg.apiKey) {
      show($('setup-banner'));
      hide($('app-main'));
      return Promise.resolve(false);
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    functions = firebase.app().functions('us-central1');
    return auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function (e) {
        console.warn('setPersistence', e);
      })
      .then(function () {
        return true;
      });
  }

  function showSuperUserChrome() {
    if (!isClientSuperUser()) return;
    show($('super-user-panel'));
    if ($('super-user-links') && window.PrayerCitySuperUser) {
      PrayerCitySuperUser.renderLinks($('super-user-links'));
      PrayerCitySuperUser.init({ auth: auth, functions: functions });
    }
    var superBanner = $('super-user-banner');
    if (superBanner) superBanner.classList.remove('hidden');
  }

  function completeEmailLinkIfNeeded() {
    if (!firebase.auth().isSignInWithEmailLink(window.location.href)) {
      return Promise.resolve(false);
    }
    if (auth.currentUser) {
      window.history.replaceState({}, document.title, window.location.pathname);
      return Promise.resolve(false);
    }
    var email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Enter the same email you used to volunteer:');
    }
    if (!email) {
      setStatus('Email required to finish sign-in.', 'error');
      return Promise.resolve(false);
    }
    return auth
      .signInWithEmailLink(email, window.location.href)
      .then(function () {
        window.localStorage.removeItem('emailForSignIn');
        window.history.replaceState({}, document.title, window.location.pathname);
        return true;
      })
      .catch(function (e) {
        setStatus(e.message || 'Sign-in failed', 'error');
        return false;
      });
  }

  function renderUnitOptions() {
    var wrap = $('onboard-units');
    if (!wrap || !window.NigeriaUnits) return;
    wrap.innerHTML = window.NigeriaUnits.NIGERIA_UNITS.map(function (u) {
      return (
        '<label class="flex items-start gap-3 p-3 rounded-xl border-2 border-transparent cursor-pointer hover:bg-slate-50 unit-pick bg-white border-slate-100" data-unit="' +
        u.id +
        '">' +
        '<input type="radio" name="onboard-unit" value="' +
        u.id +
        '" class="mt-1" />' +
        '<div class="min-w-0"><span class="font-semibold text-slate-900 block">' +
        u.label +
        '</span>' +
        '<span class="text-xs text-slate-500">' +
        window.NigeriaUnits.meetingScheduleLabel(u) +
        '</span></div></label>'
      );
    }).join('');
  }

  function formatCountdown(targetIso) {
    var t = new Date(targetIso).getTime() - Date.now();
    if (t <= 0) return 'Starting soon';
    var d = Math.floor(t / 86400000);
    var h = Math.floor((t % 86400000) / 3600000);
    var m = Math.floor((t % 3600000) / 60000);
    if (d > 0) return d + 'd ' + h + 'h ' + m + 'm';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function insightCard(stats) {
    if (!stats || stats.attendanceRate == null) {
      return '<p class="text-slate-600 text-sm">Attendance insights appear after your first meetings this month.</p>';
    }
    var ins = stats.insight || {};
    var colors = {
      excellent: 'from-emerald-500 to-teal-600',
      good: 'from-sky-500 to-blue-600',
      fair: 'from-amber-400 to-orange-500',
      low: 'from-rose-400 to-red-500',
    };
    var grad = colors[ins.level] || colors.fair;
    return (
      '<div class="rounded-2xl bg-gradient-to-br ' +
      grad +
      ' text-white p-5 shadow-md">' +
      '<p class="text-white/80 text-xs uppercase tracking-wider font-semibold">Your attendance this month</p>' +
      '<p class="text-4xl font-bold mt-1">' +
      stats.attendanceRate +
      '%</p>' +
      '<p class="text-sm mt-2 text-white/95">' +
      (ins.message || '') +
      '</p>' +
      '<div class="mt-4 grid grid-cols-3 gap-2 text-center text-xs">' +
      '<div class="bg-white/15 rounded-lg py-2"><div class="font-bold text-lg">' +
      stats.attendedCount +
      '</div>Present</div>' +
      '<div class="bg-white/15 rounded-lg py-2"><div class="font-bold text-lg">' +
      stats.missedCount +
      '</div>Missed</div>' +
      '<div class="bg-white/15 rounded-lg py-2"><div class="font-bold text-lg">' +
      (stats.currentStreak || 0) +
      '</div>Streak</div></div></div>'
    );
  }

  function renderDashboard(data) {
    dashboardData = data;
    var profile = data.profile;
    var unit = window.NigeriaUnits.getUnit(profile.unitId);
    var superBanner = $('super-user-banner');
    if (superBanner) {
      if (data.isSuperUser) {
        superBanner.classList.remove('hidden');
      } else {
        superBanner.classList.add('hidden');
      }
    }
    $('dash-greeting').textContent = 'Welcome, ' + profile.name;
    $('dash-unit-badge').textContent = profile.unitLabel;
    $('dash-role-badge').textContent = profile.role === 'leader' ? 'Unit leader' : 'Member';
    if ($('dash-phone')) $('dash-phone').textContent = profile.phone || '';

    if (unit) {
      $('dash-schedule').textContent = window.NigeriaUnits.meetingScheduleLabel(unit);
    }

    if (data.nextMeeting) {
      $('next-meeting-date').textContent = data.nextMeeting.dateYmd;
      $('next-meeting-countdown').textContent = formatCountdown(data.nextMeeting.startIso);
      show($('next-meeting-card'));
    } else {
      hide($('next-meeting-card'));
    }

    var checkBtn = $('btn-check-in');
    if (data.checkInOpen) {
      checkBtn.disabled = false;
      checkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      $('check-in-hint').textContent = 'Check-in is open for your meeting window.';
    } else {
      checkBtn.disabled = true;
      checkBtn.classList.add('opacity-50', 'cursor-not-allowed');
      $('check-in-hint').textContent = 'Opens 20 min before meeting · closes 45 min after.';
    }

    $('attendance-insight').innerHTML = insightCard(data.attendanceStats);

    var reportEl = $('leader-report-card');
    if (data.latestReport) {
      var r = data.latestReport;
      $('report-summary').innerHTML =
        '<p class="text-sm text-slate-600 mb-2">Submitted by <strong>' +
        (r.leaderName || 'Leader') +
        '</strong></p>' +
        '<p class="text-sm text-slate-800 whitespace-pre-wrap">' +
        (r.activities || '').slice(0, 400) +
        (r.activities && r.activities.length > 400 ? '…' : '') +
        '</p>' +
        (r.attendanceNarrative
          ? '<pre class="mt-3 text-xs bg-slate-50 border border-slate-100 rounded-lg p-3 whitespace-pre-wrap text-slate-600">' +
            r.attendanceNarrative +
            '</pre>'
          : '');
      show(reportEl);
    } else {
      $('report-summary').innerHTML =
        '<p class="text-sm text-slate-500">No leader report for this month yet.</p>';
      show(reportEl);
    }

    if (profile.role === 'leader' || data.isSuperUser) {
      show($('leader-tools'));
      hide($('member-report-note'));
    } else {
      hide($('leader-tools'));
      show($('member-report-note'));
    }

    var recent = $('recent-attendance');
    if (data.recentAttendance && data.recentAttendance.length) {
      recent.innerHTML = data.recentAttendance
        .map(function (a) {
          var ts = a.checkedInAt && a.checkedInAt.toDate ? a.checkedInAt.toDate() : null;
          return (
            '<li class="flex justify-between gap-2 text-sm py-2 border-b border-slate-100 last:border-0">' +
            '<span>' +
            a.meetingDateYmd +
            '</span>' +
            '<span class="text-slate-500 text-xs">' +
            (ts ? ts.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }) : '—') +
            '</span></li>'
          );
        })
        .join('');
    } else {
      recent.innerHTML = '<li class="text-sm text-slate-500 py-2">No check-ins yet.</li>';
    }
  }

  function isProfileComplete(profile) {
    if (!profile) return false;
    if (!profile.name || !profile.unitId || !profile.role) return false;
    if (!window.NigeriaUnits || !NigeriaUnits.getUnit(profile.unitId)) return false;
    return true;
  }

  function showDashboardSafely(data) {
    try {
      hide($('onboard-panel'));
      hide($('auth-panel'));
      hide($('not-eligible-panel'));
      show($('dash-panel'));
      renderDashboard(data);
      return true;
    } catch (e) {
      console.error('renderDashboard', e);
      hide($('dash-panel'));
      return false;
    }
  }

  function showOnboarding(volunteer, isSuperUser) {
    hide($('auth-panel'));
    hide($('dash-panel'));
    hide($('not-eligible-panel'));
    show($('onboard-panel'));
    var hint = $('onboard-super-hint');
    if (hint) hint.classList.toggle('hidden', !isSuperUser);
    if (volunteer && volunteer.name && $('onboard-name')) {
      $('onboard-name').value = volunteer.name;
    }
    if ($('onboard-phone') && volunteer && volunteer.phone) {
      $('onboard-phone').textContent = volunteer.phone;
    }
  }

  function showNotEligible(message) {
    if (isClientSuperUser()) {
      return showSuperUserLanding();
    }
    hide($('auth-panel'));
    hide($('dash-panel'));
    hide($('onboard-panel'));
    show($('not-eligible-panel'));
    if ($('not-eligible-msg')) $('not-eligible-msg').textContent = message || '';
  }

  var SUPER_USER_EMAILS = {
    'abuxberkeley@gmail.com': true,
    'ddbs.htx@gmail.com': true,
  };

  function isClientSuperUser() {
    var email = String(
      (auth.currentUser && auth.currentUser.email) || ''
    )
      .trim()
      .toLowerCase();
    if (!email) return false;
    if (SUPER_USER_EMAILS[email]) return true;
    if (window.PrayerCitySuperUser && PrayerCitySuperUser.isSuperUser(email)) {
      return true;
    }
    return false;
  }

  function loadVolunteerPreview() {
    var uid = auth.currentUser.uid;
    var email = auth.currentUser.email || '';
    return db
      .collection('volunteers')
      .doc(uid)
      .get()
      .then(function (snap) {
        var d = snap.exists ? snap.data() : {};
        return {
          name: d.name || auth.currentUser.displayName || 'Coordinator',
          email: email,
          phone: d.phone || '(coordinator preview)',
        };
      });
  }

  function loadLocalNigeriaProfile() {
    return db.collection('nigeria_volunteers').doc(auth.currentUser.uid).get();
  }

  function buildLocalDashboard(profile, isSuperUser) {
    var unit = window.NigeriaUnits.getUnit(profile.unitId);
    var nextMeeting = unit ? window.NigeriaUnits.getNextMeeting(unit) : null;
    var checkInOpen = false;
    if (nextMeeting && window.NigeriaUnits.isWithinCheckInWindow(nextMeeting)) {
      checkInOpen = true;
    }
    return {
      hasProfile: true,
      eligible: true,
      isSuperUser: isSuperUser,
      profile: profile,
      nextMeeting: nextMeeting
        ? {
            key: nextMeeting.key,
            dateYmd: nextMeeting.dateYmd,
            startIso: nextMeeting.start.toISOString(),
            endIso: nextMeeting.end.toISOString(),
          }
        : null,
      checkInOpen: checkInOpen,
      attendanceStats: profile.attendanceStats || null,
      latestReport: null,
      recentAttendance: [],
    };
  }

  function processDashboardResponse(data) {
    if (!data) return showSuperUserLanding();
    hide($('not-eligible-panel'));
    if (data.eligible === false) {
      if (isClientSuperUser()) {
        return showSuperUserLanding();
      }
      showNotEligible(data.message);
      return;
    }
    if (!data.hasProfile || !isProfileComplete(data.profile)) {
      showOnboarding(
        data.volunteer || coordinatorVolunteer(),
        data.isSuperUser || isClientSuperUser()
      );
      return;
    }
    if (!showDashboardSafely(data)) {
      showOnboarding(
        data.volunteer || coordinatorVolunteer(),
        data.isSuperUser || isClientSuperUser()
      );
    }
  }

  function mergeProfile() {
    return functions.httpsCallable('mergeVolunteerProfile')().catch(function (e) {
      console.warn('mergeVolunteerProfile', e);
    });
  }

  function coordinatorVolunteer() {
    var user = auth.currentUser;
    return {
      name: (user && user.displayName) || 'Coordinator',
      email: (user && user.email) || '',
      phone: 'Coordinator access — all dashboards',
    };
  }

  function showSuperUserLanding() {
    showSuperUserChrome();
    hide($('auth-panel'));
    hide($('not-eligible-panel'));
    hide($('dash-panel'));
    showOnboarding(coordinatorVolunteer(), true);

    return loadLocalNigeriaProfile()
      .then(function (snap) {
        if (!snap.exists || !isProfileComplete(snap.data())) return;
        if (!showDashboardSafely(buildLocalDashboard(snap.data(), true))) {
          showOnboarding(coordinatorVolunteer(), true);
        }
      })
      .catch(function (e) {
        console.warn('loadLocalNigeriaProfile', e);
      });
  }

  function refreshDashboardFromCloud() {
    return functions
      .httpsCallable('getNigeriaDashboard')()
      .then(function (res) {
        if (!res || !res.data) return;
        if (!res.data.hasProfile || !isProfileComplete(res.data.profile)) return;
        showDashboardSafely(res.data);
      })
      .catch(function (err) {
        console.warn('getNigeriaDashboard', err);
      });
  }

  function loadDashboard() {
    if (isClientSuperUser()) {
      showSuperUserLanding();
      mergeProfile()
        .then(refreshDashboardFromCloud)
        .catch(refreshDashboardFromCloud);
      return Promise.resolve();
    }

    showSuperUserChrome();
    return mergeProfile()
      .then(function () {
        return functions.httpsCallable('getNigeriaDashboard')();
      })
      .then(function (res) {
        hideAuthChecking();
        return processDashboardResponse(res.data);
      })
      .catch(function (err) {
        hideAuthChecking();
        throw err;
      });
  }

  function signInWithPassword() {
    var email = ($('auth-email').value || '').trim();
    var pw = $('auth-password').value || '';
    if (!email || !pw) {
      setStatus('Enter email and password.', 'error');
      return;
    }
    setStatus('Signing in…', 'info');
    auth.signInWithEmailAndPassword(email, pw).catch(function (e) {
      setStatus(e.message || 'Sign-in failed', 'error');
    });
  }

  function sendEmailLink() {
    var email = ($('auth-email').value || '').trim();
    if (!email) {
      setStatus('Enter your volunteer email first.', 'error');
      return;
    }
    setStatus('Sending sign-in link…', 'info');

    function sendViaFirebase() {
      return auth
        .sendSignInLinkToEmail(email, {
          url: EMAIL_LINK_CONTINUE_URL,
          handleCodeInApp: true,
        })
        .then(function () {
          window.localStorage.setItem('emailForSignIn', email);
          setStatus('Check your inbox for the sign-in link (allow 1–2 minutes).', 'success');
        });
    }

    if (!SELF_SERVE_SIGNIN_URL) {
      sendViaFirebase().catch(function (e) {
        setStatus(e.message || 'Could not send link', 'error');
      });
      return;
    }

    fetch(SELF_SERVE_SIGNIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email }),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, body: j };
        });
      })
      .then(function (result) {
        if (result.body && result.body.ok) {
          window.localStorage.setItem('emailForSignIn', email);
          setStatus('Check your inbox for the sign-in link from our team.', 'success');
          return;
        }
        return sendViaFirebase();
      })
      .catch(function () {
        sendViaFirebase().catch(function (e) {
          setStatus(e.message || 'Could not send link', 'error');
        });
      });
  }

  function callableErrorMessage(err) {
    if (!err) return 'Request failed.';
    if (err.message) return err.message;
    if (err.details) return String(err.details);
    if (err.code) return err.code;
    return 'Request failed.';
  }

  function buildSavedProfile(name, unitRadio, roleRadio) {
    var unit = window.NigeriaUnits.getUnit(unitRadio.value);
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      name: name,
      phone: isClientSuperUser() ? 'Coordinator preview' : '',
      unitId: unitRadio.value,
      unitLabel: unit ? unit.label : unitRadio.value,
      role: roleRadio.value,
      region: 'nigeria',
      isSuperUser: isClientSuperUser(),
    };
  }

  function finishProfileSave(profile) {
    setStatus('Profile saved!', 'success');
    showSuperUserChrome();
    if (!showDashboardSafely(buildLocalDashboard(profile, isClientSuperUser()))) {
      setStatus('Profile saved but could not open dashboard. Refresh the page.', 'error');
      return;
    }
    refreshDashboardFromCloud();
  }

  function writeProfileToFirestore(profile) {
    return db
      .collection('nigeria_volunteers')
      .doc(auth.currentUser.uid)
      .set(
        Object.assign({}, profile, {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        }),
        { merge: true }
      );
  }

  function saveProfile() {
    var name = ($('onboard-name').value || '').trim();
    var unitRadio = document.querySelector('input[name="onboard-unit"]:checked');
    var roleRadio = document.querySelector('input[name="onboard-role"]:checked');
    var saveBtn = $('btn-save-profile');
    if (!name) {
      setStatus('Enter your name.', 'error');
      return;
    }
    if (!unitRadio) {
      setStatus('Select your unit.', 'error');
      return;
    }
    if (!roleRadio) {
      setStatus('Select leader or member.', 'error');
      return;
    }
    setStatus('Saving profile…', 'info');
    if (saveBtn) saveBtn.disabled = true;

    var payload = {
      name: name,
      unitId: unitRadio.value,
      role: roleRadio.value,
    };
    var profile = buildSavedProfile(name, unitRadio, roleRadio);

    function releaseSaveBtn() {
      if (saveBtn) saveBtn.disabled = false;
    }

    if (isClientSuperUser()) {
      writeProfileToFirestore(profile)
        .then(function () {
          finishProfileSave(profile);
          functions.httpsCallable('saveNigeriaProfile')(payload).catch(function (err) {
            console.warn('saveNigeriaProfile cloud sync', err);
          });
        })
        .catch(function (err) {
          setStatus(callableErrorMessage(err), 'error');
        })
        .finally(releaseSaveBtn);
      return;
    }

    functions
      .httpsCallable('saveNigeriaProfile')(payload)
      .then(function () {
        finishProfileSave(profile);
      })
      .catch(function (err) {
        setStatus(callableErrorMessage(err), 'error');
      })
      .finally(releaseSaveBtn);
  }

  function checkIn() {
    setStatus('Recording attendance…', 'info');
    functions
      .httpsCallable('recordNigeriaAttendance')()
      .then(function (res) {
        if (res.data.alreadyCheckedIn) {
          setStatus('You already checked in for this meeting.', 'success');
        } else {
          setStatus('Attendance recorded — thank you for showing up!', 'success');
        }
        return loadDashboard();
      })
      .catch(function (err) {
        setStatus(err.message || 'Check-in failed.', 'error');
      });
  }

  function submitLeaderReport() {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth() + 1;
    setStatus('Submitting report with attendance analytics…', 'info');
    functions
      .httpsCallable('submitNigeriaUnitReport')({
        reportYear: y,
        reportMonth: m,
        activities: ($('leader-activities').value || '').trim(),
        highlights: ($('leader-highlights').value || '').trim(),
        testimonies: ($('leader-testimonies').value || '').trim(),
        challenges: ($('leader-challenges').value || '').trim(),
        prayerRequests: ($('leader-prayer').value || '').trim(),
        nextMonth: ($('leader-next').value || '').trim(),
      })
      .then(function (res) {
        var a = res.data.attendanceAnalytics;
        var msg = 'Report submitted!';
        if (a && a.highestAttendance) {
          msg +=
            ' Highest attendance: ' +
            a.highestAttendance.date +
            ' (' +
            a.highestAttendance.count +
            ').';
        }
        setStatus(msg, 'success');
        return loadDashboard();
      })
      .catch(function (err) {
        setStatus(err.message || 'Report failed.', 'error');
      });
  }

  function hideAuthChecking() {
    hide($('auth-checking'));
  }

  function showAuthChecking() {
    show($('auth-checking'));
    hide($('auth-panel'));
  }

  function signOut() {
    auth.signOut().then(function () {
      dashboardData = null;
      showAuthChecking();
      hide($('dash-panel'));
      hide($('onboard-panel'));
      hide($('not-eligible-panel'));
    });
  }

  function handleAuthUser(user) {
    hideAuthChecking();
    var signOutBtn = $('btn-signout');
    if (user) {
      if (signOutBtn) signOutBtn.classList.remove('hidden');
      hide($('auth-panel'));
      loadDashboard().catch(function (err) {
        console.error('loadDashboard', err);
        if (isClientSuperUser()) {
          showSuperUserLanding();
          return;
        }
        setStatus(err.message || 'Could not load dashboard.', 'error');
        show($('auth-panel'));
      });
      return;
    }
    if (signOutBtn) signOutBtn.classList.add('hidden');
    hide($('dash-panel'));
    hide($('onboard-panel'));
    hide($('not-eligible-panel'));
    hide($('super-user-panel'));
    show($('auth-panel'));
  }

  function startAuth() {
    var settled = false;
    function finishBootstrap() {
      if (settled) return;
      settled = true;
      hideAuthChecking();
      auth.onAuthStateChanged(handleAuthUser);
    }

    window.setTimeout(function () {
      if (!settled) finishBootstrap();
    }, 4000);

    completeEmailLinkIfNeeded().finally(finishBootstrap);
  }

  function bind() {
    var saveBtn = $('btn-save-profile');
    if ($('btn-password-signin')) {
      $('btn-password-signin').addEventListener('click', signInWithPassword);
    }
    if ($('btn-email-link')) {
      $('btn-email-link').addEventListener('click', sendEmailLink);
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', saveProfile);
    }
    if ($('btn-check-in')) {
      $('btn-check-in').addEventListener('click', checkIn);
    }
    if ($('btn-submit-report')) {
      $('btn-submit-report').addEventListener('click', submitLeaderReport);
    }
    if ($('btn-signout')) {
      $('btn-signout').addEventListener('click', signOut);
    }
    var signOutNe = $('btn-signout-ne');
    if (signOutNe) signOutNe.addEventListener('click', signOut);

    renderUnitOptions();
    startAuth();

    setInterval(function () {
      if (dashboardData && dashboardData.nextMeeting) {
        $('next-meeting-countdown').textContent = formatCountdown(dashboardData.nextMeeting.startIso);
      }
    }, 60000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFirebase().then(function (ok) {
      if (!ok) return;
      bind();
    });
  });
})();
