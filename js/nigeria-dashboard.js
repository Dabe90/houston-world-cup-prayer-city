/**
 * DDBS Nigeria dashboard — sidebar profile, tabbed layout, multi-unit, programs.
 */
(function () {
  var auth, db, storage, functions;
  var dashboardData = null;
  var profileSaveInFlight = false;
  var superUserInitDone = false;
  var activeTab = 'home';
  var PREVIEW_PROFILE_KEY = 'ddbsNigeriaPreviewProfile';
  var AUTH_PANEL_OPEN_KEY = 'ngAuthPanelOpen';
  // Always land email links on the Nigeria hub (not the US root). A wrong
  // continue URL + geo-redirect used to strip ?oobCode= and break sign-in.
  var EMAIL_LINK_CONTINUE_URL = 'https://prayercityhtx.com/ng';
  var SELF_SERVE_SIGNIN_URL =
    'https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/volunteerSelfServeSignInMail';
  var SUPER_USER_EMAILS = {
    'abuxberkeley@gmail.com': true,
    'ddbs.htx@gmail.com': true,
  };

  function $(id) {
    return document.getElementById(id);
  }
  function show(el) {
    if (el) el.classList.remove('hidden');
  }
  function hide(el) {
    if (el) el.classList.add('hidden');
  }

  function hubPolicyStartYmd() {
    return (window.NigeriaUnits && NigeriaUnits.HUB_POLICY_START_YMD) || '2026-09-14';
  }

  function clearHubBootLoading() {
    try {
      document.documentElement.classList.remove('ddbs-hub-boot-dash');
    } catch (e) {}
    hide($('hub-boot-loading'));
  }

  function rememberHubView(view) {
    try {
      sessionStorage.setItem('ddbsNgHubView', view === 'dash' ? 'dash' : 'landing');
    } catch (e) {}
  }

  function setPublicLanding(show) {
    if (window.NigeriaLanding && NigeriaLanding.setVisible) {
      NigeriaLanding.setVisible(show);
    } else {
      var wrap = $('ng-public-landing');
      var hero = $('hero-billboard');
      var countdown = $('landing-billion-countdown');
      var mobileNav = $('ng-mobile-nav');
      if (wrap) wrap.classList.toggle('hidden', !show);
      if (hero) hero.classList.toggle('hidden', !show);
      if (countdown) countdown.classList.toggle('hidden', !show);
      if (mobileNav) mobileNav.classList.toggle('hidden', !show);
    }
    if (show) {
      rememberHubView('landing');
      clearHubBootLoading();
    }
  }

  function setHomepageNavVisible(show) {
    var btn = $('btn-view-public-homepage');
    if (!btn) return;
    btn.classList.toggle('is-ng-visible', !!show);
    document.body.classList.toggle('ddbs-on-dashboard', !!show);
  }

  function goToPublicHomepage() {
    rememberHubView('landing');
    var url = window.location.pathname + '?landing=1';
    window.location.href = url;
  }

  function goToDashboardFromLanding() {
    rememberHubView('dash');
    var path = window.location.pathname || 'ddbs-nig.html';
    var hash = window.location.hash || '';
    window.history.replaceState(null, '', path + hash);
    if (auth && auth.currentUser) {
      hide($('btn-open-dashboard'));
      setPublicLanding(false);
      document.documentElement.classList.add('ddbs-hub-boot-dash');
      show($('hub-boot-loading'));
      loadDashboard();
    }
  }

  function setAuthPanelStatus(msg, type) {
    var el = $('auth-panel-status');
    if (!el) {
      setStatus(msg, type);
      return;
    }
    if (!msg) {
      hide(el);
      el.textContent = '';
      return;
    }
    el.textContent = msg;
    el.className =
      'rounded-xl border px-3 py-2.5 text-sm ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900');
    show(el);
  }

  function markAuthPanelOpen() {
    try {
      sessionStorage.setItem(AUTH_PANEL_OPEN_KEY, '1');
    } catch (e) {}
  }

  function clearAuthPanelOpen() {
    try {
      sessionStorage.removeItem(AUTH_PANEL_OPEN_KEY);
    } catch (e) {}
  }

  function wantsAuthPanelVisible() {
    try {
      if (sessionStorage.getItem(AUTH_PANEL_OPEN_KEY) === '1') return true;
    } catch (e) {}
    var hash = (window.location.hash || '').replace('#', '');
    return ['auth', 'units', 'home', 'programs', 'reports', 'kingdom-workforce', 'new-members'].indexOf(hash) >= 0;
  }

  function showAuthPanel(scroll) {
    markAuthPanelOpen();
    var panel = $('auth-panel');
    if (panel) {
      show(panel);
      if (scroll !== false) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function friendlyPasswordSignInError(e) {
    var code = e && e.code;
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Invalid password, or no password is set for this account. Use “Email me a sign-in link” if needed.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account found with that email. Check spelling or sign up to volunteer first.';
    }
    if (code === 'auth/invalid-email') {
      return 'Enter a valid email address.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many attempts. Wait a few minutes, then try again or use a sign-in link.';
    }
    return (e && e.message) || 'Sign-in failed.';
  }

  function sendSignInLinkViaFirebaseClient(email) {
    return auth
      .sendSignInLinkToEmail(email, { url: EMAIL_LINK_CONTINUE_URL, handleCodeInApp: true })
      .then(function () {
        window.localStorage.setItem('emailForSignIn', email);
        setAuthPanelStatus('Check your inbox for the sign-in link.', 'success');
      });
  }

  function sendSignInLinkViaAppsScript(email) {
    return fetch(SELF_SERVE_SIGNIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, continueUrl: EMAIL_LINK_CONTINUE_URL }),
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = {};
          try {
            j = t ? JSON.parse(t) : {};
          } catch (ignore) {}
          return { status: r.status, body: j };
        });
      })
      .then(function (result) {
        if (result.status === 200 && result.body && result.body.ok) {
          window.localStorage.setItem('emailForSignIn', email);
          setAuthPanelStatus(
            'Check your inbox for the sign-in link (sent from ddbs.htx@gmail.com).',
            'success'
          );
          return;
        }
        if (result.status === 404 && result.body && result.body.error === 'not_registered') {
          throw new Error(result.body.message || 'No volunteer record for this email.');
        }
        if (result.status === 429) {
          throw new Error(result.body.message || 'Please wait a minute before trying again.');
        }
        throw new Error((result.body && result.body.message) || 'Could not send sign-in link.');
      });
  }

  function setStatus(msg, type) {
    var el = $('ng-status');
    if (!el) return;
    el.textContent = msg;
    el.className =
      'rounded-xl border px-4 py-3 text-sm ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-sky-200 bg-sky-50 text-sky-900');
    show(el);
  }

  function normalizeProfileUnits(profile) {
    if (!profile) return [];
    if (Array.isArray(profile.units) && profile.units.length) {
      return profile.units.filter(function (u) {
        return u && u.unitId && (u.role === 'leader' || u.role === 'member');
      });
    }
    if (profile.unitId) {
      return [
        {
          unitId: profile.unitId,
          unitLabel: profile.unitLabel || profile.unitId,
          role: profile.role === 'leader' ? 'leader' : 'member',
        },
      ];
    }
    return [];
  }

  function isProfileComplete(profile) {
    var units = normalizeProfileUnits(profile);
    if (!profile || !profile.name || !units.length) return false;
    return units.every(function (u) {
      return window.NigeriaUnits && NigeriaUnits.getUnit(u.unitId);
    });
  }

  function isClientSuperUser() {
    var email = String((auth.currentUser && auth.currentUser.email) || '')
      .trim()
      .toLowerCase();
    if (!email) return false;
    if (SUPER_USER_EMAILS[email]) return true;
    if (window.PrayerCitySuperUser && PrayerCitySuperUser.isSuperUser(email)) return true;
    return false;
  }

  function initFirebase() {
    var cfg = window.__FIREBASE_CONFIG__;
    if (!cfg || !cfg.apiKey) {
      show($('setup-banner'));
      hide($('app-main'));
      return Promise.resolve(false);
    }
    if (typeof firebase === 'undefined') {
      show($('setup-banner'));
      var banner = $('setup-banner');
      if (banner) {
        banner.className =
          'max-w-lg mx-auto m-4 sm:m-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 text-slate-700 text-sm text-center shadow-card';
        banner.innerHTML =
          '<p class="font-semibold text-slate-900"><i class="fas fa-wifi text-slate-400 mr-1.5"></i>Having trouble loading sign-in?</p>' +
          '<p class="mt-2 text-slate-600 leading-relaxed">This network may be blocking our sign-in tools. Try mobile data or another Wi‑Fi, refresh, or open <a class="underline font-medium text-brand" href="https://prayercityhtx.com/ng">prayercityhtx.com/ng</a> directly. You can still browse programs below — or message us on Instagram <a href="https://www.instagram.com/deardaughter_bs" class="underline font-medium text-brand">@deardaughter_bs</a>.</p>';
      }
      return Promise.resolve(false);
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    functions = firebase.app().functions('us-central1');
    if (window.DDBSNigeriaMeetingNotes) {
      DDBSNigeriaMeetingNotes.init({ auth: auth, db: db, functions: functions });
    }
    return auth
      .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function () {})
      .then(function () {
        return true;
      });
  }

  function showSuperUserChrome() {
    if (!isClientSuperUser()) return;
    show($('super-user-panel'));
    if ($('super-user-links') && window.PrayerCitySuperUser) {
      PrayerCitySuperUser.renderLinks($('super-user-links'));
      if (!superUserInitDone) {
        superUserInitDone = true;
        PrayerCitySuperUser.init({ auth: auth, functions: functions });
      }
    }
    var banner = $('super-user-banner');
    if (banner) banner.classList.remove('hidden');
  }

  function savePreviewProfile(profile) {
    try {
      sessionStorage.setItem(PREVIEW_PROFILE_KEY, JSON.stringify(profile));
    } catch (e) {}
  }
  function loadPreviewProfile() {
    try {
      var raw = sessionStorage.getItem(PREVIEW_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    ['home', 'programs', 'units', 'my-members', 'new-members', 'kingdom-workforce', 'reports'].forEach(function (name) {
      var panel = $('tab-' + name);
      if (panel) panel.classList.toggle('hidden', name !== tab);
    });
    if (tab === 'programs') renderProgramsPanel();
    if (tab === 'my-members' && dashboardData) renderMyMembersTab(dashboardData);
    if (tab === 'new-members' && dashboardData) renderNewMembersTab();
    if (tab === 'kingdom-workforce' && dashboardData) renderWorkforceTab();
    if (tab === 'reports' && dashboardData) renderReportsTab(dashboardData);
    try {
      var path = window.location.pathname;
      var hash = tab === 'home' ? '' : '#' + tab;
      window.history.replaceState(null, '', path + hash);
    } catch (e) {}
  }

  function renderUnitOptions() {
    var wrap = $('onboard-units');
    if (!wrap || !window.NigeriaUnits) return;
    wrap.innerHTML = window.NigeriaUnits.NIGERIA_UNITS.map(function (u) {
      return (
        '<div class="unit-row flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-100 bg-slate-50/50" data-unit="' +
        u.id +
        '">' +
        '<label class="flex items-start gap-3 flex-1 cursor-pointer min-w-0">' +
        '<input type="checkbox" class="unit-check mt-1" value="' +
        u.id +
        '" data-unit="' +
        u.id +
        '" />' +
        '<span class="min-w-0"><span class="font-semibold text-slate-900 block">' +
        u.label +
        '</span><span class="text-xs text-slate-500">' +
        NigeriaUnits.meetingScheduleLabel(u) +
        '</span></span></label>' +
        '<select class="unit-role rounded-lg border border-slate-200 text-sm px-2 py-1.5 disabled:opacity-40" data-unit="' +
        u.id +
        '" disabled>' +
        '<option value="member">Member</option>' +
        '<option value="leader">Leader</option>' +
        '</select></div>'
      );
    }).join('');

    wrap.querySelectorAll('.unit-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var row = cb.closest('.unit-row');
        var sel = row && row.querySelector('.unit-role');
        if (sel) sel.disabled = !cb.checked;
      });
    });
  }

  function collectUnitsFromForm() {
    var units = [];
    document.querySelectorAll('.unit-check:checked').forEach(function (cb) {
      var id = cb.value;
      var sel = document.querySelector('.unit-role[data-unit="' + id + '"]');
      var role = (sel && sel.value) || 'member';
      var unit = window.NigeriaUnits.getUnit(id);
      units.push({
        unitId: id,
        unitLabel: unit ? unit.label : id,
        role: role,
      });
    });
    return units;
  }

  function applyUnitsToForm(units) {
    if (!units || !units.length) return;
    units.forEach(function (u) {
      var cb = document.querySelector('.unit-check[value="' + u.unitId + '"]');
      var sel = document.querySelector('.unit-role[data-unit="' + u.unitId + '"]');
      if (cb) {
        cb.checked = true;
        if (sel) {
          sel.disabled = false;
          sel.value = u.role === 'leader' ? 'leader' : 'member';
        }
      }
    });
  }

  function formatCountdown(targetIso) {
    var t = new Date(targetIso).getTime() - Date.now();
    if (t <= 0) return 'Starting soon';
    var d = Math.floor(t / 86400000);
    var h = Math.floor((t % 86400000) / 3600000);
    var m = Math.floor((t % 3600000) / 60000);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  }

  function meetingContextExtras(unit, nextMeeting, isSuperUser, role) {
    var absenceTarget = nextMeeting;
    var checkInOpen = false;
    if (nextMeeting && window.NigeriaUnits.isWithinCheckInWindow(nextMeeting)) {
      checkInOpen = true;
    } else if (nextMeeting && unit) {
      var prev = window.NigeriaUnits.getNextMeeting(
        unit,
        new Date(new Date(nextMeeting.start).getTime() - 86400000)
      );
      if (prev && window.NigeriaUnits.isWithinCheckInWindow(prev)) {
        checkInOpen = true;
        absenceTarget = prev;
      }
    }
    var targetIso = absenceTarget ? absenceTarget.start : null;
    var canRequestPlanned =
      targetIso && new Date(targetIso).getTime() - Date.now() >= 2 * 24 * 60 * 60 * 1000;
    var canRequestEmergency = absenceTarget && window.NigeriaUnits.isWithinCheckInWindow(absenceTarget);
    return {
      checkInOpen: checkInOpen,
      absenceTargetMeeting: absenceTarget
        ? {
            key: absenceTarget.key,
            dateYmd: absenceTarget.dateYmd,
            startIso: absenceTarget.start.toISOString(),
            endIso: absenceTarget.end.toISOString(),
          }
        : null,
      canRequestPlanned: !!canRequestPlanned,
      canRequestEmergency: !!canRequestEmergency,
      absenceQuotas: {
        windowWeeks: 8,
        maxRequests: 2,
        usedInWindow: 0,
        remaining: 2,
        windowStartYmd: hubPolicyStartYmd(),
        windowEndYmd: '2026-11-08',
        emergencyWindowWeeks: 12,
        emergencyMax: 1,
        emergencyUsedInWindow: 0,
        emergencyAvailable: true,
        emergencyResetsAt: null,
      },
      absenceRequest: null,
      unitVision: null,
      lastMeetingDigest: null,
      canEditVision: role === 'leader' || isSuperUser,
    };
  }

  function buildUnitContextsFromProfile(profile, isSuperUser) {
    return normalizeProfileUnits(profile).map(function (m) {
      var unit = window.NigeriaUnits.getUnit(m.unitId);
      var nextMeeting = unit ? window.NigeriaUnits.getNextMeeting(unit) : null;
      var extras = meetingContextExtras(unit, nextMeeting, isSuperUser, m.role);
      return {
        unitId: m.unitId,
        unitLabel: m.unitLabel,
        role: m.role,
        unit: unit,
        nextMeeting: nextMeeting
          ? {
              key: nextMeeting.key,
              dateYmd: nextMeeting.dateYmd,
              startIso: nextMeeting.start.toISOString(),
              endIso: nextMeeting.end.toISOString(),
            }
          : null,
        checkInOpen: extras.checkInOpen,
        alreadyCheckedIn: false,
        attendanceStats: profile.attendanceStats || null,
        latestReport: null,
        canSubmitReport: m.role === 'leader' || isSuperUser,
        canEditVision: extras.canEditVision,
        absenceQuotas: extras.absenceQuotas,
        absenceRequest: extras.absenceRequest,
        absenceTargetMeeting: extras.absenceTargetMeeting,
        canRequestPlanned: extras.canRequestPlanned,
        canRequestEmergency: extras.canRequestEmergency,
        unitVision: extras.unitVision,
        lastMeetingDigest: extras.lastMeetingDigest,
      };
    });
  }

  function canViewMemberSignupsLocal(profile, isSuperUser) {
    if (isSuperUser) return true;
    var viewerUnits = {
      'welcome-hospitality': true,
      'growth-retention': true,
      'workers-coordinator': true,
    };
    return normalizeProfileUnits(profile).some(function (u) {
      return u.role === 'leader' && viewerUnits[u.unitId];
    });
  }

  function workforceAccessLocal(profile, isSuperUser) {
    if (isSuperUser) {
      return { canView: true, canApprove: true, leaderUnitIds: null };
    }
    var canApprove = normalizeProfileUnits(profile).some(function (u) {
      return u.unitId === 'workers-coordinator' && u.role === 'leader';
    });
    if (canApprove) {
      return { canView: true, canApprove: true, leaderUnitIds: null };
    }
    return { canView: false, canApprove: false, leaderUnitIds: [] };
  }

  function buildLocalDashboard(profile, isSuperUser) {
    var units = normalizeProfileUnits(profile);
    var unitIds =
      Array.isArray(profile.unitIds) && profile.unitIds.length
        ? profile.unitIds
        : units.map(function (u) {
            return u.unitId;
          });
    var unitContexts = buildUnitContextsFromProfile(profile, isSuperUser);
    var primary = unitContexts[0] || null;
    return {
      hasProfile: true,
      eligible: true,
      isSuperUser: isSuperUser,
      canViewMemberSignups: canViewMemberSignupsLocal(profile, isSuperUser),
      workforceAccess: workforceAccessLocal(profile, isSuperUser),
      profile: Object.assign({}, profile, { units: units, unitIds: unitIds }),
      unitContexts: unitContexts,
      nextMeeting: primary ? primary.nextMeeting : null,
      checkInOpen: primary ? primary.checkInOpen : false,
      attendanceStats: primary ? primary.attendanceStats : null,
      latestReport: null,
      recentAttendance: [],
    };
  }

  function setSidebarAvatar(name, photoURL) {
    var initial = (name || '?').charAt(0).toUpperCase();
    var img = $('sidebar-avatar-img');
    var initEl = $('sidebar-avatar-initial');
    if (photoURL && img) {
      img.src = photoURL;
      show(img);
      if (initEl) hide(initEl);
    } else if (initEl) {
      initEl.textContent = initial;
      show(initEl);
      if (img) hide(img);
    }
  }

  function renderSidebar(data) {
    var profile = data.profile || {};
    if ($('sidebar-name')) $('sidebar-name').textContent = profile.name || '';
    if ($('sidebar-email')) {
      $('sidebar-email').textContent =
        profile.email || (auth.currentUser && auth.currentUser.email) || '';
    }
    if ($('sidebar-phone')) $('sidebar-phone').textContent = profile.phone || '';
    setSidebarAvatar(profile.name, profile.photoURL);

    var list = $('sidebar-units');
    if (list) {
      var units = normalizeProfileUnits(profile);
      list.innerHTML = units.length
        ? units
            .map(function (u) {
              return (
                '<li class="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">' +
                '<span class="font-medium text-slate-800">' +
                u.unitLabel +
                '</span>' +
                '<span class="text-xs font-semibold ' +
                (u.role === 'leader' ? 'text-amber-700' : 'text-emerald-700') +
                '">' +
                (u.role === 'leader' ? 'Leader' : 'Member') +
                '</span></li>'
              );
            })
            .join('')
        : '<li class="text-slate-500 text-xs">No units yet</li>';
    }
    refreshPasswordButtonLabel();
  }

  function userHasPasswordProvider(user) {
    var providers = (user && user.providerData) || [];
    return providers.some(function (p) {
      return p && p.providerId === 'password';
    });
  }

  function refreshPasswordButtonLabel() {
    var label = $('btn-open-password-label');
    var title = $('ng-password-modal-title');
    var hint = $('sidebar-password-hint');
    var hasPw = userHasPasswordProvider(auth && auth.currentUser);
    if (label) label.textContent = hasPw ? 'Update password' : 'Set password';
    if (title && $('ng-password-modal') && $('ng-password-modal').classList.contains('hidden')) {
      title.textContent = hasPw ? 'Update password' : 'Set a password';
    }
    if (hint) {
      hint.textContent = hasPw
        ? 'Signed in on this device until you sign out. You can sign in with email + password anytime.'
        : 'Signed in on this device until you sign out. Set a password to sign in without an email link next time.';
    }
  }

  function setPassStatus(msg, type) {
    var el = $('ng-pass-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className =
      'text-sm min-h-[1.25rem] pt-1 ' +
      (type === 'error'
        ? 'text-red-600'
        : type === 'success'
          ? 'text-emerald-700'
          : type === 'warn'
            ? 'text-amber-800'
            : 'text-slate-600');
  }

  function openPasswordModal() {
    var modal = $('ng-password-modal');
    if (!modal) return;
    setPassStatus('', 'info');
    if ($('ng-new-pass')) $('ng-new-pass').value = '';
    if ($('ng-new-pass2')) $('ng-new-pass2').value = '';
    if ($('ng-current-pass')) $('ng-current-pass').value = '';
    hide($('ng-current-pass-wrap'));
    var hasPw = userHasPasswordProvider(auth && auth.currentUser);
    if ($('ng-password-modal-title')) {
      $('ng-password-modal-title').textContent = hasPw ? 'Update password' : 'Set a password';
    }
    if ($('ng-password-modal-help')) {
      $('ng-password-modal-help').textContent = hasPw
        ? 'Enter a new password below. If Firebase asks for your current password, that field will appear.'
        : 'First time? Choose a new password below — no current password needed. After saving, you can sign in with email + password or keep using the email link.';
    }
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closePasswordModal() {
    var modal = $('ng-password-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function sendPasswordResetLink(email, intoPassStatus) {
    if (!auth) return Promise.reject(new Error('Auth not ready.'));
    email = String(email || '').trim();
    if (!email) return Promise.reject(new Error('Enter your email first.'));
    return auth.sendPasswordResetEmail(email, {
      url: EMAIL_LINK_CONTINUE_URL,
      handleCodeInApp: false,
    });
  }

  function saveLinkedPassword() {
    var p1 = String(($('ng-new-pass') && $('ng-new-pass').value) || '');
    var p2 = String(($('ng-new-pass2') && $('ng-new-pass2').value) || '');
    if (p1.length < 6) {
      setPassStatus('Use at least 6 characters.', 'error');
      return;
    }
    if (p1 !== p2) {
      setPassStatus('Passwords do not match.', 'error');
      return;
    }
    var user = auth && auth.currentUser;
    var email = user && user.email;
    if (!user || !email) {
      setPassStatus('Sign in first, then set your password.', 'error');
      return;
    }

    function afterPasswordSuccess() {
      setPassStatus(
        'Password saved. Next time you can use email + password, or keep using the email link.',
        'success'
      );
      if ($('ng-new-pass')) $('ng-new-pass').value = '';
      if ($('ng-new-pass2')) $('ng-new-pass2').value = '';
      if ($('ng-current-pass')) $('ng-current-pass').value = '';
      hide($('ng-current-pass-wrap'));
      refreshPasswordButtonLabel();
      window.setTimeout(function () {
        closePasswordModal();
      }, 2200);
    }

    function handleRequiresRecentLogin() {
      var curPw = String(($('ng-current-pass') && $('ng-current-pass').value) || '');
      show($('ng-current-pass-wrap'));
      if (curPw) {
        setPassStatus('Verifying current password…', 'info');
        var reCred = firebase.auth.EmailAuthProvider.credential(email, curPw);
        return user
          .reauthenticateWithCredential(reCred)
          .then(function () {
            return user.updatePassword(p1);
          })
          .then(afterPasswordSuccess)
          .catch(function (e) {
            setPassStatus(
              (e && e.message) ||
                'Current password incorrect. Try “Email me a password reset link” instead.',
              'error'
            );
          });
      }
      setPassStatus(
        'For security, enter your current password above — or tap “Email me a password reset link”.',
        'warn'
      );
    }

    setPassStatus('Saving…', 'info');
    var saveBtn = $('btn-ng-save-password');
    if (saveBtn) saveBtn.disabled = true;
    var cred = firebase.auth.EmailAuthProvider.credential(email, p1);
    user
      .linkWithCredential(cred)
      .then(afterPasswordSuccess)
      .catch(function (e) {
        var code = e && e.code;
        if (code === 'auth/provider-already-linked' || code === 'auth/credential-already-in-use') {
          return user
            .updatePassword(p1)
            .then(afterPasswordSuccess)
            .catch(function (e2) {
              if (e2 && e2.code === 'auth/requires-recent-login') {
                return handleRequiresRecentLogin();
              }
              setPassStatus(
                (e2 && e2.message) || 'Could not update password. Try the reset link below.',
                'error'
              );
            });
        }
        if (code === 'auth/requires-recent-login') {
          return handleRequiresRecentLogin();
        }
        if (code === 'auth/weak-password') {
          setPassStatus('Use a stronger password (at least 6 characters).', 'error');
          return;
        }
        if (code === 'auth/email-already-in-use') {
          setPassStatus(
            'This email already has a password. Use Update password, or email yourself a reset link.',
            'error'
          );
          return;
        }
        setPassStatus(
          ((e && e.message) || 'Could not save password.') +
            ' Try “Email me a password reset link” below.',
          'error'
        );
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function programTileHtml(ev) {
    var P = window.DDBSNigeriaPrograms;
    if (!P) return '';
    var enriched = ev.displayImage ? ev : P.enrichEvent(ev);
    var img = enriched.displayImage || enriched.image;
    var hasFlyer = !!enriched.hasFlyer;
    var badge =
      enriched.kind === 'midweek'
        ? 'bg-emerald-500/90'
        : 'bg-violet-600/90';
    var slotLabel =
      enriched.slot === 'past'
        ? 'Just ended'
        : enriched.kind === 'midweek'
          ? 'Wed Bible Study'
          : 'Coming up';
    var slotClass =
      enriched.slot === 'past' ? 'bg-slate-600/90' : badge;
    var imgClass = hasFlyer
      ? 'absolute inset-0 w-full h-full object-contain p-3 bg-white/95 transition-transform duration-300 group-hover:scale-[1.02]'
      : 'absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105';
    var minH = hasFlyer ? 'min-h-[240px] sm:min-h-[260px]' : 'min-h-[200px] sm:min-h-[220px]';
    return (
      '<article class="program-card group relative rounded-2xl overflow-hidden shadow-card border border-slate-200/80 ' +
      minH +
      '">' +
      '<img src="' +
      img +
      '" alt="" class="' +
      imgClass +
      '" loading="lazy" onerror="this.src=\'' +
      P.themeForEvent({ title: '', kind: 'special' }).image +
      '\'" />' +
      '<div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>' +
      '<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">' +
      '<span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white ' +
      slotClass +
      '">' +
      slotLabel +
      '</span></div>' +
      '<div class="absolute bottom-0 left-0 right-0 p-4 text-white">' +
      '<p class="text-xs font-semibold text-white/80 mb-1">' +
      P.formatDateLabel(enriched) +
      '</p>' +
      '<h4 class="font-bold text-sm sm:text-base leading-snug text-balance">' +
      enriched.title +
      '</h4></div></article>'
    );
  }

  function meetingsForUnit(ctx) {
    var unit = window.NigeriaUnits && NigeriaUnits.getUnit(ctx.unitId);
    if (!unit || !NigeriaUnits.meetingsForNotes) return [];
    return NigeriaUnits.meetingsForNotes(unit, 16);
  }

  function defaultMeetingKey(meetings, ctx) {
    var meeting = meetingForNotes(ctx);
    if (meeting && meeting.key) return meeting.key;
    return meetings.length ? meetings[meetings.length - 1].key : '';
  }

  function meetingForNotes(ctx) {
    if (ctx.nextMeeting && ctx.nextMeeting.key) return ctx.nextMeeting;
    var unit = window.NigeriaUnits && NigeriaUnits.getUnit(ctx.unitId);
    if (!unit) return { key: ctx.unitId + '_hub', dateYmd: '' };
    var next = NigeriaUnits.getNextMeeting(unit);
    if (next) {
      return {
        key: next.key,
        dateYmd: next.dateYmd,
        startIso: next.start.toISOString(),
        endIso: next.end.toISOString(),
      };
    }
    return { key: ctx.unitId + '_hub', dateYmd: '' };
  }

  function formatSignupDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch (e) {
      return iso;
    }
  }

  function renderNewMembersTab() {
    var list = $('new-members-list');
    if (!list || !functions) return;
    list.innerHTML =
      '<p class="text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading sign-ups…</p>';
    hubCallable('getNigeriaMemberSignups', 45000)()
      .then(function (res) {
        var signups = (res.data && res.data.signups) || [];
        if (!signups.length) {
          list.innerHTML = '<p class="text-slate-500">No new sign-ups yet.</p>';
          return;
        }
        list.innerHTML = signups
          .map(function (s) {
            var esc = function (x) {
              return String(x || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            };
            return (
              '<div class="rounded-xl border border-slate-100 p-4 bg-slate-50/50">' +
              '<div class="flex flex-wrap justify-between gap-2 mb-2">' +
              '<p class="font-semibold text-slate-900">' +
              esc(s.name || '—') +
              '</p>' +
              '<p class="text-xs text-slate-500">' +
              formatSignupDate(s.createdAt) +
              '</p></div>' +
              '<p class="text-sm"><a class="text-brand font-medium" href="mailto:' +
              esc(s.email || '') +
              '">' +
              esc(s.email || '—') +
              '</a> · ' +
              esc(s.phone || '—') +
              '</p>' +
              (s.city ? '<p class="text-xs text-slate-600 mt-1">' + esc(s.city) + '</p>' : '') +
              (s.birthday || s.maritalStatus
                ? '<p class="text-xs text-slate-600 mt-1">' +
                  (s.birthday ? 'Birthday: ' + esc(s.birthday) : '') +
                  (s.birthday && s.maritalStatus ? ' · ' : '') +
                  (s.maritalStatus ? 'Marital: ' + esc(s.maritalStatus) : '') +
                  '</p>'
                : '') +
              (s.interest ? '<p class="text-xs text-slate-600 mt-1">Interest: ' + esc(s.interest) + '</p>' : '') +
              (s.notes ? '<p class="text-xs text-slate-500 mt-2 italic">' + esc(s.notes) + '</p>' : '') +
              '</div>'
            );
          })
          .join('');
      })
      .catch(function (e) {
        list.innerHTML =
          '<p class="text-red-700 text-sm">' + (e.message || 'Could not load sign-ups.') + '</p>';
      });
  }

  function updateNewMembersTabVisibility(data) {
    var btn = $('tab-btn-new-members');
    if (!btn) return;
    if (data && data.canViewMemberSignups) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
      if (activeTab === 'new-members') switchTab('home');
    }
  }

  function leaderUnitContexts(data) {
    // Super users: show units they lead / are on, plus Group browse cards.
    // Do NOT treat every membership as a My members section (that flooded the tab).
    return (data && data.unitContexts ? data.unitContexts : []).filter(function (c) {
      if (c.browseOnly) return data && data.isSuperUser === true;
      return c.isLeaderView === true || c.role === 'leader';
    });
  }

  function updateMyMembersTabVisibility(data) {
    var btn = $('tab-btn-my-members');
    if (!btn) return;
    var leaders = leaderUnitContexts(data);
    if (leaders.length || (data && data.isSuperUser)) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
      if (activeTab === 'my-members') switchTab('home');
    }
  }

  function updateWorkforceTabVisibility(data) {
    var btn = $('tab-btn-kingdom-workforce');
    if (!btn) return;
    var access = data && data.workforceAccess;
    if (access && access.canView) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
      if (activeTab === 'kingdom-workforce') switchTab('home');
    }
  }

  function workforceStatusLabel(status) {
    if (status === 'approved') return 'Cleared for hub access';
    if (status === 'in_training') return 'In Workers Training Class';
    return 'Pending Workers Training Class';
  }

  function workforceStatusClass(status) {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800';
    if (status === 'in_training') return 'bg-sky-100 text-sky-800';
    return 'bg-amber-100 text-amber-800';
  }

  function renderWorkforceTab() {
    var list = $('kingdom-workforce-list');
    if (!list || !functions) return;
    list.innerHTML =
      '<p class="text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading enlistments…</p>';
    hubCallable('getNigeriaWorkforceSignups', 45000)()
      .then(function (res) {
        var signups = (res.data && res.data.signups) || [];
        var canApprove = !!(res.data && res.data.canApprove);
        if (!signups.length) {
          list.innerHTML = '<p class="text-slate-500">No Kingdom Workforce enlistments yet.</p>';
          return;
        }
        list.innerHTML = signups
          .map(function (s) {
            var esc = function (x) {
              return String(x || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            };
            var units = (s.units || [])
              .map(function (u) {
                return esc(u.unitLabel || u.unitId || '');
              })
              .join(', ');
            var actions = '';
            if (canApprove && s.status !== 'approved') {
              if (s.status === 'pending_training') {
                actions +=
                  '<button type="button" class="btn-wf-in-training rounded-lg bg-sky-600 text-white text-xs font-semibold px-3 py-2 hover:bg-sky-700" data-id="' +
                  esc(s.id) +
                  '">Mark in training</button>';
              }
              actions +=
                '<button type="button" class="btn-wf-approve rounded-lg bg-ng-green text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-700" data-id="' +
                esc(s.id) +
                '">Greenlight hub access</button>';
            }
            return (
              '<div class="rounded-xl border border-slate-100 p-4 bg-slate-50/50" data-wf-id="' +
              esc(s.id) +
              '">' +
              '<div class="flex flex-wrap justify-between gap-2 mb-2">' +
              '<p class="font-semibold text-slate-900">' +
              esc(s.name || '—') +
              '</p>' +
              '<span class="text-[10px] font-bold uppercase rounded-full px-2 py-1 ' +
              workforceStatusClass(s.status) +
              '">' +
              workforceStatusLabel(s.status) +
              '</span></div>' +
              '<p class="text-xs text-slate-500 mb-2">' +
              formatSignupDate(s.createdAt) +
              '</p>' +
              '<p class="text-sm"><a class="text-brand font-medium" href="mailto:' +
              esc(s.email || '') +
              '">' +
              esc(s.email || '—') +
              '</a> · ' +
              esc(s.phone || '—') +
              '</p>' +
              (s.city ? '<p class="text-xs text-slate-600 mt-1">' + esc(s.city) + '</p>' : '') +
              (units ? '<p class="text-xs text-slate-600 mt-1"><strong>Units:</strong> ' + units + '</p>' : '') +
              (s.notes ? '<p class="text-xs text-slate-500 mt-2 italic">' + esc(s.notes) + '</p>' : '') +
              (actions
                ? '<div class="flex flex-wrap gap-2 mt-3">' + actions + '</div>'
                : '') +
              '</div>'
            );
          })
          .join('');

        list.querySelectorAll('.btn-wf-in-training').forEach(function (btn) {
          btn.addEventListener('click', function () {
            markWorkforceInTraining(btn.getAttribute('data-id'), btn);
          });
        });
        list.querySelectorAll('.btn-wf-approve').forEach(function (btn) {
          btn.addEventListener('click', function () {
            approveWorkforceSignup(btn.getAttribute('data-id'), btn);
          });
        });
      })
      .catch(function (e) {
        list.innerHTML =
          '<p class="text-red-700 text-sm">' + (e.message || 'Could not load enlistments.') + '</p>';
      });
  }

  function markWorkforceInTraining(signupId, btn) {
    if (!signupId || !functions) return;
    if (btn) btn.disabled = true;
    hubCallable('markNigeriaWorkforceInTraining', 45000)({ signupId: signupId })
      .then(function () {
        if (btn) {
          btn.textContent = 'Updated';
          btn.disabled = true;
        }
        renderWorkforceTab();
      })
      .catch(function (e) {
        alert(e.message || 'Could not update status.');
        if (btn) btn.disabled = false;
      });
  }

  function approveWorkforceSignup(signupId, btn) {
    if (!signupId || !functions) return;
    if (
      !window.confirm(
        'Greenlight this worker for hub sign-in? They should have completed Workers Training Class.'
      )
    ) {
      return;
    }
    if (btn) btn.disabled = true;
    hubCallable('approveNigeriaWorkforceSignup', 60000)({ signupId: signupId })
      .then(function () {
        if (btn) {
          btn.textContent = 'Approved';
          btn.disabled = true;
        }
        renderWorkforceTab();
      })
      .catch(function (e) {
        alert(e.message || 'Could not approve.');
        if (btn) btn.disabled = false;
      });
  }

  function submitWorkforceSignup(ev) {
    if (ev) ev.preventDefault();
    var form = $('ng-workforce-form');
    if (!form || !functions) return;
    var unitIds =
      window.NigeriaLanding && NigeriaLanding.getWorkforceUnitIds
        ? NigeriaLanding.getWorkforceUnitIds()
        : [];
    var name = ($('workforce-name') && $('workforce-name').value || '').trim();
    var email = ($('workforce-email') && $('workforce-email').value || '').trim();
    var phone = ($('workforce-phone') && $('workforce-phone').value || '').trim();
    var city = ($('workforce-city') && $('workforce-city').value || '').trim();
    var notes = ($('workforce-notes') && $('workforce-notes').value || '').trim();
    var status = $('workforce-status');
    var btn = $('workforce-submit');
        if (!unitIds.length) {
      var hint = $('ng-workforce-unit-hint');
      if (hint) hint.classList.remove('hidden');
      if (window.NigeriaLanding && NigeriaLanding.openWorkforcePanel) {
        NigeriaLanding.openWorkforcePanel({ requireUnits: true });
      }
      if (status) {
        status.textContent = 'Select at least one unit above.';
        status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        status.classList.remove('hidden');
      }
      return;
    }
    if (!name || !email || !phone) {
      if (status) {
        status.textContent = 'Please fill in name, email, and phone.';
        status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        status.classList.remove('hidden');
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (status) {
      status.textContent = 'Submitting…';
      status.className = 'text-sm rounded-xl px-3 py-2 border border-sky-200 bg-sky-50 text-sky-900';
      status.classList.remove('hidden');
    }
    hubCallable('submitNigeriaWorkforceSignup', 60000)({
      name: name,
      email: email,
      phone: phone,
      city: city,
      notes: notes,
      unitIds: unitIds,
    })
      .then(function (res) {
        form.reset();
        if (window.NigeriaLanding) {
          if (NigeriaLanding.clearWorkforceUnits) NigeriaLanding.clearWorkforceUnits();
          if (NigeriaLanding.closeWorkforcePanel) {
            setTimeout(function () {
              NigeriaLanding.closeWorkforcePanel();
            }, 3200);
          }
        }
        if (status) {
          status.textContent =
            (res.data && res.data.message) ||
            'Enlisted! Check your email about Workers Training Class.';
          status.className =
            'text-sm rounded-xl px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-900';
        }
      })
      .catch(function (e) {
        if (status) {
          status.textContent = e.message || 'Could not submit. Try again or contact the coordinator.';
          status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function submitMemberSignup(ev) {
    if (ev) ev.preventDefault();
    var form = $('ng-signup-form');
    if (!form || !functions) return;
    var name = ($('signup-name') && $('signup-name').value || '').trim();
    var email = ($('signup-email') && $('signup-email').value || '').trim();
    var phone = ($('signup-phone') && $('signup-phone').value || '').trim();
    var city = ($('signup-city') && $('signup-city').value || '').trim();
    var birthday = ($('signup-birthday') && $('signup-birthday').value || '').trim();
    var maritalStatus = ($('signup-marital-status') && $('signup-marital-status').value || '').trim();
    var interest = ($('signup-interest') && $('signup-interest').value || '').trim();
    var notes = ($('signup-notes') && $('signup-notes').value || '').trim();
    var status = $('signup-status');
    var btn = $('signup-submit');
    if (!name || !email || !phone) {
      if (status) {
        status.textContent = 'Please fill in name, email, and phone.';
        status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        status.classList.remove('hidden');
      }
      return;
    }
    if (!birthday || !maritalStatus) {
      if (status) {
        status.textContent = 'Please add your birthday and marital status.';
        status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        status.classList.remove('hidden');
      }
      return;
    }
    if (btn) btn.disabled = true;
    if (status) {
      status.textContent = 'Submitting…';
      status.className = 'text-sm rounded-xl px-3 py-2 border border-sky-200 bg-sky-50 text-sky-900';
      status.classList.remove('hidden');
    }
    hubCallable('submitNigeriaMemberSignup', 60000)({
      name: name,
      email: email,
      phone: phone,
      city: city,
      birthday: birthday,
      maritalStatus: maritalStatus,
      interest: interest,
      notes: notes,
    })
      .then(function (res) {
        form.reset();
        if (window.NigeriaLanding && NigeriaLanding.closeSignupPanel) {
          setTimeout(function () {
            NigeriaLanding.closeSignupPanel();
          }, 2800);
        }
        if (status) {
          status.textContent =
            (res.data && res.data.message) ||
            'Thank you! Check your email — our team will reach out soon.';
          status.className =
            'text-sm rounded-xl px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-900';
        }
      })
      .catch(function (e) {
        if (status) {
          status.textContent = e.message || 'Could not submit. Try again or DM @deardaughter_bs.';
          status.className = 'text-sm rounded-xl px-3 py-2 border border-red-200 bg-red-50 text-red-800';
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function renderProgramsPanel(month) {
    var grid = $('programs-grid');
    var filter = $('programs-month-filter');
    if (!grid || !window.DDBSNigeriaPrograms) return;
    var P = DDBSNigeriaPrograms;
    if (filter && !filter.dataset.ready) {
      filter.innerHTML = '<option value="upcoming">Upcoming</option>';
      for (var m = 1; m <= 12; m++) {
        filter.innerHTML +=
          '<option value="' + m + '">' + P.MONTH_NAMES[m] + ' ' + P.YEAR + '</option>';
      }
      filter.dataset.ready = '1';
      filter.addEventListener('change', function () {
        renderProgramsPanel(filter.value);
      });
    }
    var val = month || (filter && filter.value) || 'upcoming';
    var events;
    if (val === 'upcoming') {
      events = P.featuredTiles();
    } else {
      events = P.byMonth(parseInt(val, 10)).map(function (e) {
        return P.enrichEvent(e);
      });
    }
    grid.innerHTML = events.length
      ? events.map(programTileHtml).join('')
      : '<p class="text-sm text-slate-500 col-span-full">No programs in this view.</p>';
  }

  function unitScheduleLabel(ctx) {
    var unit = (window.NigeriaUnits && NigeriaUnits.getUnit(ctx.unitId)) || ctx.unit;
    if (unit && unit.start && window.NigeriaUnits) {
      return NigeriaUnits.meetingScheduleLabel(unit);
    }
    return ctx.unitLabel || '';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function attendanceWarningBannerHtml(warning, unitLabel) {
    if (!warning) return '';
    var critical = warning.level === 'critical';
    var bar = critical ? 'bg-red-500' : 'bg-amber-400';
    var iconWrap = critical ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
    var titleColor = critical ? 'text-red-900' : 'text-amber-900';
    var border = critical ? 'border-red-200' : 'border-amber-200';
    var icon =
      warning.tier === 'withdrawal'
        ? 'fa-triangle-exclamation'
        : warning.tier === 'final'
          ? 'fa-circle-exclamation'
          : 'fa-bell';
    var stats =
      warning.strikes != null
        ? '<div class="flex flex-wrap gap-2 mt-2">' +
          '<span class="text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">' +
          escapeHtml(String(warning.missed || 0)) +
          ' missed</span>' +
          '<span class="text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">' +
          escapeHtml(String(warning.late || 0)) +
          ' late</span>' +
          '<span class="text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">last ' +
          escapeHtml(String(warning.windowWeeks || 8)) +
          ' weeks</span>' +
          '</div>'
        : '';
    return (
      '<div class="rounded-2xl border ' +
      border +
      ' bg-white shadow-sm overflow-hidden mb-3">' +
      '<div class="flex">' +
      '<div class="w-1.5 ' +
      bar +
      '"></div>' +
      '<div class="flex items-start gap-3 p-4 flex-1">' +
      '<div class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center ' +
      iconWrap +
      '"><i class="fas ' +
      icon +
      '"></i></div>' +
      '<div class="min-w-0">' +
      '<div class="flex items-center gap-2 flex-wrap">' +
      '<p class="font-bold ' +
      titleColor +
      '">' +
      escapeHtml(warning.title) +
      '</p>' +
      (unitLabel
        ? '<span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">' +
          escapeHtml(unitLabel) +
          '</span>'
        : '') +
      '</div>' +
      '<p class="text-sm text-slate-700 mt-1">' +
      escapeHtml(warning.message) +
      '</p>' +
      stats +
      '</div></div></div></div>'
    );
  }

  function formatDigestAttendanceForUser(digest, uid) {
    if (!digest || !Array.isArray(digest.roster)) return '';
    var row = digest.roster.find(function (r) {
      return r.uid === uid;
    });
    if (!row) return 'Attendance not recorded for this meeting.';
    if (row.present) {
      var when = '';
      if (row.checkedInAt && row.checkedInAt.toDate) {
        when = row.checkedInAt.toDate().toLocaleString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      return 'You were present' + (when ? ' — checked in at ' + when + ' WAT' : '') + '.';
    }
    if (row.excused) {
      return (
        'Excused absence — your ' +
        (row.absenceType === 'emergency' ? 'emergency' : 'planned') +
        ' request was approved.'
      );
    }
    var digestYmd = String(digest.meetingDateYmd || digest.dateYmd || '');
    var missFrom = (window.NigeriaUnits && NigeriaUnits.ATTENDANCE_MISS_START_YMD) || '2026-09-15';
    if (digestYmd && digestYmd < missFrom) {
      return 'Attendance tracking restarted on 14 Sep 2026.';
    }
    return 'You were absent — you did not check in for this meeting.';
  }

  function formatMeetingYmd(ymd) {
    if (!ymd) return '';
    var p = String(ymd).split('-');
    if (p.length !== 3) return String(ymd);
    var d = new Date(Date.UTC(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12));
    try {
      return d.toLocaleDateString('en-GB', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return String(ymd);
    }
  }

  function formatQuotaPeriod(quotas) {
    if (!quotas) return '';
    var start = quotas.windowStartYmd || '';
    var end = quotas.windowEndYmd || '';
    if (!start || !end) return 'Current 8-week period (from 14 Sep 2026).';
    return 'Period: ' + formatMeetingYmd(start) + ' – ' + formatMeetingYmd(end);
  }

  function absencePanelHtml(c) {
    var target = c.absenceTargetMeeting;
    if (target && target.dateYmd && String(target.dateYmd) < hubPolicyStartYmd()) {
      target = null;
    }
    if (!target) {
      return (
        '<div class="absence-panel mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">' +
        '<p class="text-xs font-semibold text-slate-700"><i class="fas fa-calendar-xmark mr-1"></i>Request absence</p>' +
        '<p class="text-xs text-slate-500 mt-1">No upcoming meeting is scheduled for this unit yet.</p></div>'
      );
    }
    var quotas = c.absenceQuotas || {};
    var targetLabel = formatMeetingYmd(target.dateYmd);
    var existing = c.absenceRequest;
    if (existing && existing.status === 'approved') {
      return (
        '<div class="absence-panel mt-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3">' +
        '<p class="text-xs font-bold text-violet-900"><i class="fas fa-calendar-xmark mr-1"></i>Absence approved for ' +
        escapeHtml(targetLabel) +
        '</p>' +
        '<p class="text-xs text-violet-800 mt-1">' +
        escapeHtml(existing.type === 'emergency' ? 'Emergency' : 'Planned') +
        ' request — ' +
        escapeHtml(existing.reason || '') +
        '</p></div>'
      );
    }
    var remaining = quotas.remaining != null ? quotas.remaining : 2;
    var periodLine = formatQuotaPeriod(quotas);
    var emergencyNote = quotas.emergencyAvailable
      ? 'Emergency slot available (one per 12-week period from 14 Sep 2026).'
      : 'Emergency slot used — resets ' +
        (quotas.emergencyResetsAt
          ? new Date(quotas.emergencyResetsAt).toLocaleDateString('en-GB', {
              timeZone: 'Africa/Lagos',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'when the next 12-week period starts') +
        '.';
    var typeOptions = '';
    if (c.canRequestPlanned && remaining > 0) {
      typeOptions +=
        '<option value="planned">Planned (2+ days before meeting)</option>';
    }
    if (c.canRequestEmergency && remaining > 0 && quotas.emergencyAvailable) {
      typeOptions +=
        '<option value="emergency">Emergency (last minute / during meeting)</option>';
    }
    if (!typeOptions || remaining <= 0) {
      return (
        '<details class="absence-panel mt-3 rounded-xl border border-slate-200 bg-white overflow-hidden" open>' +
        '<summary class="absence-summary list-none cursor-pointer px-3 py-3">' +
        '<span class="summary-row font-semibold text-sm text-slate-800"><i class="fas fa-calendar-xmark text-violet-600 mr-2"></i>Request absence' +
        '<span class="ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-400">Info</span></span></summary>' +
        '<div class="px-3 pb-3 border-t border-slate-100 pt-2">' +
        '<p class="text-xs text-slate-600 leading-relaxed">' +
        (remaining <= 0
          ? 'You have used both requests allowed in this 8-week period for this unit. ' +
            escapeHtml(periodLine)
          : 'Planned requests open <strong>2+ days before</strong> the meeting (' +
            escapeHtml(targetLabel) +
            '). Emergency requests open from <strong>15 minutes before</strong> until the meeting ends.') +
        '</p>' +
        '<p class="text-xs text-slate-500 mt-2">' +
        escapeHtml(periodLine) +
        '</p>' +
        '<p class="text-xs text-slate-500 mt-1">' +
        escapeHtml(emergencyNote) +
        '</p></div></details>'
      );
    }
    return (
      '<details class="absence-panel mt-3 rounded-xl border border-violet-200 bg-violet-50/40 overflow-hidden" open>' +
      '<summary class="absence-summary list-none cursor-pointer px-3 py-3">' +
      '<span class="summary-row font-semibold text-sm text-violet-900"><i class="fas fa-calendar-xmark mr-2"></i>Request absence — ' +
      escapeHtml(targetLabel) +
      '<span class="ml-auto text-[10px] font-bold uppercase tracking-wide text-violet-600">Open</span></span></summary>' +
      '<div class="px-3 pb-3 border-t border-violet-100 pt-2" data-unit-id="' +
      escapeHtml(c.unitId) +
      '" data-meeting-key="' +
      escapeHtml(target.key) +
      '">' +
      '<p class="text-[11px] text-violet-800/90 mb-2">' +
      remaining +
      ' of ' +
      (quotas.maxRequests || 2) +
      ' requests left this period. ' +
      escapeHtml(periodLine) +
      '. ' +
      escapeHtml(emergencyNote) +
      '</p>' +
      (!c.canRequestEmergency && quotas.emergencyAvailable
        ? '<p class="text-[11px] text-violet-700/80 mb-2">Need an emergency absence? The <strong>Emergency</strong> option appears from 15 minutes before the meeting until it ends.</p>'
        : '') +
      '<label class="block text-[11px] font-medium text-violet-900 mb-1">Type</label>' +
      '<select class="absence-type w-full rounded-lg border border-violet-200 px-2 py-2 text-sm mb-2 bg-white">' +
      typeOptions +
      '</select>' +
      '<label class="block text-[11px] font-medium text-violet-900 mb-1">Reason</label>' +
      '<textarea class="absence-reason w-full rounded-lg border border-violet-200 px-2 py-2 text-sm min-h-[80px] mb-2" placeholder="Brief reason (required)"></textarea>' +
      '<button type="button" class="btn-submit-absence text-sm font-semibold rounded-lg bg-violet-700 text-white px-3 py-2.5 hover:bg-violet-800">Submit absence request</button>' +
      '<p class="absence-status text-xs text-slate-500 mt-2 min-h-[1rem]"></p></div></details>'
    );
  }

  function bindAbsencePanels(wrap) {
    if (!wrap || !functions) return;
    wrap.querySelectorAll('.btn-submit-absence').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('[data-unit-id][data-meeting-key]') || btn.closest('.absence-panel');
        if (!panel) return;
        var unitId = panel.getAttribute('data-unit-id');
        var meetingKey = panel.getAttribute('data-meeting-key');
        var typeEl = panel.querySelector('.absence-type');
        var reasonEl = panel.querySelector('.absence-reason');
        var statusEl = panel.querySelector('.absence-status');
        var type = typeEl ? typeEl.value : 'planned';
        var reason = reasonEl ? reasonEl.value.trim() : '';
        if (reason.length < 8) {
          if (statusEl) statusEl.textContent = 'Please add a brief reason.';
          return;
        }
        if (statusEl) statusEl.textContent = 'Submitting…';
        btn.disabled = true;
        hubCallable('submitNigeriaAbsenceRequest', 45000)({
          unitId: unitId,
          meetingKey: meetingKey,
          type: type,
          reason: reason,
        })
          .then(function () {
            if (statusEl) statusEl.textContent = 'Saved — absence request recorded.';
            setStatus('Absence request saved.', 'success');
            btn.textContent = 'Submitted';
            softReloadDashboard();
          })
          .catch(function (err) {
            if (statusEl) statusEl.textContent = (err && err.message) || 'Failed.';
            setStatus((err && err.message) || 'Absence request failed.', 'error');
            btn.disabled = false;
          });
      });
    });
  }

  function planToEditableText(plan) {
    if (!plan) return '';
    var lines = [];
    lines.push('MILESTONES');
    (plan.milestones || []).forEach(function (m) {
      lines.push(
        '• [' + (m.targetMonth || '') + '] ' + (m.title || '') + ' :: ' + (m.description || '')
      );
    });
    lines.push('', 'ROADMAP');
    (plan.roadmap || []).forEach(function (r) {
      lines.push('## ' + (r.phase || '') + ' :: ' + (r.focus || ''));
      (r.steps || []).forEach(function (s) {
        lines.push('- ' + s);
      });
    });
    lines.push('', 'HOW WE WILL GET THERE');
    (plan.howToGetThere || []).forEach(function (h) {
      lines.push('• ' + h);
    });
    lines.push('', 'HELPFUL TOOLS');
    (plan.toolsAndResources || []).forEach(function (t) {
      lines.push('• ' + (t.name || '') + ' :: ' + (t.purpose || ''));
    });
    return lines.join('\n');
  }

  /** Instant offline starter plan — same shape as the server fallback. */
  function buildClientStarterVisionPlan(visionText, unitLabel) {
    function monthName(offset) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() + offset);
      try {
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } catch (e) {
        return d.toISOString().slice(0, 7);
      }
    }
    var m1 = monthName(0);
    var m2 = monthName(1);
    var m3 = monthName(2);
    var cleanVision = String(visionText || '').replace(/\s+/g, ' ').trim();
    var visionLine = cleanVision
      ? 'Our vision in our own words: "' + cleanVision + '"'
      : 'Share the vision together as a team.';
    var label = unitLabel || 'your unit';
    return {
      milestones: [
        {
          title: 'Everyone knows the vision',
          targetMonth: m1,
          status: 'todo',
          description:
            visionLine +
            ' In the first month, share it with the whole ' +
            label +
            ' team, pray over it together, and agree on what a good result looks like.',
        },
        {
          title: 'A simple weekly rhythm has started',
          targetMonth: m1,
          status: 'todo',
          description:
            'Pick one or two simple things the team will do every week to move the vision forward, and make sure each person knows their part.',
        },
        {
          title: 'More people are taking part',
          targetMonth: m2,
          status: 'todo',
          description:
            'Invite more members to join in, celebrate the early wins, and gently adjust anything that is not working well.',
        },
        {
          title: 'The vision is reaching more people',
          targetMonth: m3,
          status: 'todo',
          description:
            'Open the work up to bless more people beyond the team, and keep encouraging one another along the way.',
        },
        {
          title: 'We finish strong and give thanks',
          targetMonth: m3,
          status: 'todo',
          description:
            'Look back at how far the team has come, thank everyone for their part, and decide which good habits to keep going.',
        },
      ],
      roadmap: [
        {
          phase: m1 + ' — Lay the foundation',
          focus: 'Prayer, clear vision, and small first steps',
          steps: [
            'Meet as a team and pray over the vision together.',
            'Explain the vision in simple words so everyone understands it.',
            'Agree on one or two easy goals for this month.',
            'Give each person a clear, small role.',
          ],
        },
        {
          phase: m2 + ' — Build momentum',
          focus: 'Staying steady and growing the team',
          steps: [
            'Keep a steady weekly rhythm of meetings and activities.',
            'Invite more members to join in and help.',
            'Celebrate small wins to keep everyone encouraged.',
            'Notice what is working and gently fix what is not.',
          ],
        },
        {
          phase: m3 + ' — Reach further and last',
          focus: 'Blessing more people and keeping good habits',
          steps: [
            'Reach out to more people beyond the team.',
            'Review the progress together and give thanks.',
            'Decide which good habits to keep after the three months.',
          ],
        },
      ],
      howToGetThere: [
        'Begin every step with prayer and keep God at the centre.',
        'Keep the goals small and simple so no one feels overwhelmed.',
        'Meet regularly and keep talking to one another.',
        'Share updates often so the whole team feels part of the journey.',
        'Encourage each other and celebrate every small win.',
        'Ask members what they enjoy, and let them serve in those areas.',
      ],
      toolsAndResources: [
        {
          name: 'WhatsApp group',
          purpose: 'Stay in touch, share reminders, and encourage one another during the week.',
        },
        {
          name: 'Shared prayer list',
          purpose: 'Pray together for the vision and for one another.',
        },
        {
          name: 'A simple weekly checklist',
          purpose: 'Keep track of the few things the team wants to do each week.',
        },
        {
          name: 'The Bible and a daily devotional',
          purpose: 'Keep the team grounded in God’s word while you serve.',
        },
        {
          name: 'A short monthly catch-up',
          purpose: 'Look back at the progress, give thanks, and plan the next step.',
        },
      ],
    };
  }

  function hubCallable(name, timeoutMs) {
    if (!functions) throw new Error('Not ready.');
    return functions.httpsCallable(name, { timeout: timeoutMs || 45000 });
  }

  /** Background refresh — never block a save button on this. */
  function softReloadDashboard(opts) {
    return loadDashboard(Object.assign({ preserveStatus: true }, opts || {})).catch(function () {
      /* keep current UI */
    });
  }

  function callableVision(name, timeoutMs) {
    return hubCallable(name, timeoutMs);
  }

  function readableToPlan(text) {
    var plan = { milestones: [], roadmap: [], howToGetThere: [], toolsAndResources: [] };
    var section = '';
    var currentPhase = null;
    String(text || '')
      .split(/\r?\n/)
      .forEach(function (raw) {
        var line = raw.trim();
        if (!line) return;
        var upper = line.toUpperCase();
        if (upper === 'MILESTONES') { section = 'milestones'; return; }
        if (upper === 'ROADMAP') { section = 'roadmap'; currentPhase = null; return; }
        if (upper === 'HOW WE WILL GET THERE') { section = 'how'; return; }
        if (upper === 'HELPFUL TOOLS') { section = 'tools'; return; }

        if (section === 'milestones' && line.charAt(0) === '\u2022') {
          var body = line.replace(/^\u2022\s*/, '');
          var month = '';
          var mb = body.match(/^\[([^\]]*)\]\s*/);
          if (mb) { month = mb[1].trim(); body = body.slice(mb[0].length); }
          var parts = body.split(' :: ');
          plan.milestones.push({
            targetMonth: month,
            title: (parts[0] || '').trim(),
            description: (parts.slice(1).join(' :: ') || '').trim(),
          });
        } else if (section === 'roadmap') {
          if (line.indexOf('##') === 0) {
            var pf = line.replace(/^##\s*/, '').split(' :: ');
            currentPhase = { phase: (pf[0] || '').trim(), focus: (pf.slice(1).join(' :: ') || '').trim(), steps: [] };
            plan.roadmap.push(currentPhase);
          } else if (line.charAt(0) === '-') {
            var step = line.replace(/^-\s*/, '').trim();
            if (!currentPhase) { currentPhase = { phase: '', focus: '', steps: [] }; plan.roadmap.push(currentPhase); }
            if (step) currentPhase.steps.push(step);
          }
        } else if (section === 'how' && line.charAt(0) === '\u2022') {
          plan.howToGetThere.push(line.replace(/^\u2022\s*/, '').trim());
        } else if (section === 'tools' && line.charAt(0) === '\u2022') {
          var tb = line.replace(/^\u2022\s*/, '').split(' :: ');
          plan.toolsAndResources.push({ name: (tb[0] || '').trim(), purpose: (tb.slice(1).join(' :: ') || '').trim() });
        }
      });
    return plan;
  }

  function normalizeVisionStatus(status) {
    var s = String(status || 'todo').toLowerCase();
    return s === 'done' || s === 'doing' ? s : 'todo';
  }

  function visionProgressFromPlan(plan) {
    var list = (plan && plan.milestones) || [];
    var done = 0;
    var doing = 0;
    list.forEach(function (m) {
      var s = normalizeVisionStatus(m && m.status);
      if (s === 'done') done += 1;
      else if (s === 'doing') doing += 1;
    });
    var total = list.length;
    var pct = total ? Math.round(((done + doing * 0.5) / total) * 100) : 0;
    return { total: total, done: done, doing: doing, todo: Math.max(0, total - done - doing), percent: pct };
  }

  function visionProgressBenchHtml(plan) {
    var p = visionProgressFromPlan(plan);
    if (!p.total) return '';
    var label =
      p.percent >= 100
        ? 'Vision achieved — well done!'
        : p.percent >= 50
          ? 'Strong progress — keep going'
          : p.done || p.doing
            ? 'Work is underway'
            : 'Ready to begin';
    return (
      '<div class="vision-progress-bench mb-4 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-3">' +
      '<div class="flex items-center justify-between gap-2 mb-1.5">' +
      '<p class="text-[11px] font-bold uppercase tracking-wide text-emerald-800"><i class="fas fa-chart-line mr-1"></i>Progress bench</p>' +
      '<p class="text-sm font-bold text-emerald-900">' +
      p.percent +
      '%</p></div>' +
      '<div class="h-2.5 rounded-full bg-emerald-100 overflow-hidden mb-2">' +
      '<div class="h-full rounded-full bg-emerald-500 transition-all" style="width:' +
      p.percent +
      '%"></div></div>' +
      '<p class="text-xs text-slate-700">' +
      escapeHtml(label) +
      ' · <strong>' +
      p.done +
      '</strong> done · <strong>' +
      p.doing +
      '</strong> in progress · <strong>' +
      p.todo +
      '</strong> not started</p></div>'
    );
  }

  function milestoneStatusControlsHtml(status, index, canTrack) {
    var cur = normalizeVisionStatus(status);
    var opts = [
      { id: 'todo', label: 'Not started', icon: 'fa-circle', active: 'bg-slate-200 text-slate-700 border-slate-300' },
      { id: 'doing', label: 'In progress', icon: 'fa-person-walking', active: 'bg-amber-100 text-amber-800 border-amber-300' },
      { id: 'done', label: 'Done', icon: 'fa-circle-check', active: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    ];
    if (!canTrack) {
      var curOpt = opts.find(function (o) {
        return o.id === cur;
      });
      return (
        '<span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border ' +
        (curOpt ? curOpt.active : opts[0].active) +
        '"><i class="fas ' +
        (curOpt ? curOpt.icon : 'fa-circle') +
        '"></i>' +
        escapeHtml(curOpt ? curOpt.label : 'Not started') +
        '</span>'
      );
    }
    return (
      '<div class="flex flex-wrap gap-1 mt-2" role="group" aria-label="Milestone progress">' +
      opts
        .map(function (o) {
          var on = o.id === cur;
          return (
            '<button type="button" class="vision-status-btn text-[10px] font-semibold rounded-full px-2 py-1 border transition ' +
            (on ? o.active + ' ring-1 ring-offset-1 ring-current' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50') +
            '" data-milestone-index="' +
            index +
            '" data-status="' +
            o.id +
            '" title="' +
            escapeHtml(o.label) +
            '"><i class="fas ' +
            o.icon +
            ' mr-0.5"></i>' +
            escapeHtml(o.label) +
            '</button>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function visionPlanCardsHtml(plan, opts) {
    opts = opts || {};
    var canTrack = opts.canTrack === true;
    if (!plan) return '';
    var html = visionProgressBenchHtml(plan);
    if (plan.milestones && plan.milestones.length) {
      html +=
        '<div class="mb-4">' +
        '<h5 class="text-[11px] font-bold uppercase tracking-wide text-brand mb-2"><i class="fas fa-flag-checkered mr-1"></i>Milestones</h5>' +
        '<div class="grid sm:grid-cols-2 gap-2">' +
        plan.milestones
          .map(function (m, i) {
            var st = normalizeVisionStatus(m.status);
            var tone =
              st === 'done'
                ? 'border-emerald-200 bg-emerald-50/60'
                : st === 'doing'
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-slate-200 bg-white';
            return (
              '<div class="rounded-xl border ' +
              tone +
              ' p-3 shadow-sm" data-milestone-index="' +
              i +
              '">' +
              '<div class="flex items-start justify-between gap-2 mb-1">' +
              '<span class="inline-block text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">' +
              escapeHtml(m.targetMonth || '') +
              '</span>' +
              (!canTrack ? milestoneStatusControlsHtml(st, i, false) : '') +
              '</div>' +
              '<p class="text-sm font-semibold text-slate-900 leading-snug">' +
              escapeHtml(m.title || '') +
              '</p>' +
              '<p class="text-xs text-slate-600 mt-1">' +
              escapeHtml(m.description || '') +
              '</p>' +
              (canTrack ? milestoneStatusControlsHtml(st, i, true) : '') +
              '</div>'
            );
          })
          .join('') +
        '</div></div>';
    }
    if (plan.roadmap && plan.roadmap.length) {
      html +=
        '<div class="mb-4">' +
        '<h5 class="text-[11px] font-bold uppercase tracking-wide text-brand mb-2"><i class="fas fa-diagram-project mr-1"></i>Roadmap</h5>' +
        '<ol class="relative border-l-2 border-brand/30 ml-2 space-y-3">' +
        plan.roadmap
          .map(function (r, i) {
            return (
              '<li class="ml-4">' +
              '<span class="absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-bold shadow">' +
              (i + 1) +
              '</span>' +
              '<p class="text-sm font-semibold text-slate-900 leading-snug">' +
              escapeHtml(r.phase || '') +
              '</p>' +
              (r.focus
                ? '<p class="text-[11px] text-slate-500 italic mb-1">' + escapeHtml(r.focus) + '</p>'
                : '') +
              '<ul class="list-disc list-inside text-xs text-slate-600 space-y-0.5">' +
              (r.steps || [])
                .map(function (s) {
                  return '<li>' + escapeHtml(s) + '</li>';
                })
                .join('') +
              '</ul></li>'
            );
          })
          .join('') +
        '</ol></div>';
    }
    if (plan.howToGetThere && plan.howToGetThere.length) {
      html +=
        '<div class="mb-4">' +
        '<h5 class="text-[11px] font-bold uppercase tracking-wide text-brand mb-2"><i class="fas fa-shoe-prints mr-1"></i>How we\u2019ll get there</h5>' +
        '<ul class="space-y-1">' +
        plan.howToGetThere
          .map(function (h) {
            return (
              '<li class="flex items-start gap-2 text-xs text-slate-700"><i class="fas fa-circle-check text-emerald-500 mt-0.5 shrink-0"></i><span>' +
              escapeHtml(h) +
              '</span></li>'
            );
          })
          .join('') +
        '</ul></div>';
    }
    if (plan.toolsAndResources && plan.toolsAndResources.length) {
      html +=
        '<div>' +
        '<h5 class="text-[11px] font-bold uppercase tracking-wide text-brand mb-2"><i class="fas fa-toolbox mr-1"></i>Helpful tools</h5>' +
        '<div class="grid sm:grid-cols-2 gap-2">' +
        plan.toolsAndResources
          .map(function (t) {
            return (
              '<div class="rounded-xl border border-slate-200 bg-slate-50 p-2.5">' +
              '<p class="text-xs font-semibold text-slate-900">' +
              escapeHtml(t.name || '') +
              '</p>' +
              '<p class="text-[11px] text-slate-600 mt-0.5">' +
              escapeHtml(t.purpose || '') +
              '</p></div>'
            );
          })
          .join('') +
        '</div></div>';
    }
    return html || '<p class="text-xs text-slate-400">No plan yet — click \u201cCreate my plan\u201d.</p>';
  }

  function visionPhotosHtml(images, opts) {
    opts = opts || {};
    var list = Array.isArray(images) ? images : [];
    var canEdit = opts.canEdit === true;
    var tiles = list
      .map(function (item, i) {
        var url = typeof item === 'string' ? item : item && item.url;
        if (!url) return '';
        var cap = typeof item === 'object' && item.caption ? item.caption : '';
        return (
          '<figure class="vision-photo-tile relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100" data-photo-index="' +
          i +
          '">' +
          '<img src="' +
          escapeHtml(url) +
          '" alt="" class="w-full h-28 object-cover" loading="lazy" />' +
          (cap
            ? '<figcaption class="text-[10px] text-slate-600 px-2 py-1 truncate">' +
              escapeHtml(cap) +
              '</figcaption>'
            : '') +
          (canEdit
            ? '<button type="button" class="vision-photo-remove absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs hover:bg-red-600" data-photo-index="' +
              i +
              '" title="Remove"><i class="fas fa-xmark"></i></button>'
            : '') +
          '</figure>'
        );
      })
      .filter(Boolean)
      .join('');
    if (!canEdit && !tiles) return '';
    return (
      '<div class="vision-photos mt-3">' +
      '<div class="flex items-center justify-between gap-2 mb-1.5">' +
      '<p class="text-xs font-semibold text-slate-600"><i class="fas fa-images text-brand mr-1"></i>Vision story photos</p>' +
      (canEdit
        ? '<label class="text-[11px] font-semibold text-brand cursor-pointer hover:underline">' +
          '<input type="file" class="vision-photo-input hidden" accept="image/*" multiple />' +
          '<i class="fas fa-camera mr-0.5"></i>Add photos</label>'
        : '') +
      '</div>' +
      (canEdit
        ? '<p class="text-[11px] text-slate-400 mb-2">Up to 8 photos (5 MB each). They appear on the shared board when you tap Share with team.</p>'
        : '') +
      '<div class="vision-photo-grid grid grid-cols-2 sm:grid-cols-3 gap-2">' +
      (tiles ||
        (canEdit
          ? '<p class="col-span-full text-[11px] text-slate-400">No photos yet.</p>'
          : '')) +
      '</div></div>'
    );
  }

  function visionPanelHtml(c) {
    var vision = c.unitVision;
    var canEdit = c.canEditVision;
    var images = (vision && (vision.imageUrls || vision.photos)) || [];
    if (!canEdit && (!vision || !vision.plan)) {
      return '';
    }
    if (!canEdit && vision && vision.plan) {
      return (
        '<div class="unit-vision mt-5 border-t border-slate-100 pt-4">' +
        '<h4 class="text-sm font-bold text-slate-900 mb-2"><i class="fas fa-star text-brand mr-1"></i>Our Vision Board</h4>' +
        '<p class="text-xs text-slate-500 mb-2">Shared by your unit leader — watch the progress bench as work moves forward.</p>' +
        '<p class="text-sm text-slate-700 whitespace-pre-wrap rounded-xl bg-slate-50 border border-slate-100 p-3 mb-3">' +
        escapeHtml(vision.visionText || '') +
        '</p>' +
        visionPhotosHtml(images, { canEdit: false }) +
        '<div class="rounded-2xl border border-slate-200 bg-white p-4 mt-3">' +
        visionPlanCardsHtml(vision.plan, { canTrack: false }) +
        '</div></div>'
      );
    }
    var initialCards = vision && vision.plan ? visionPlanCardsHtml(vision.plan, { canTrack: true }) : '';
    var initialReadable = (vision && vision.plan && planToEditableText(vision.plan)) || '';
    var alreadyShared = !!(vision && vision.plan && (vision.visionText || vision.publishedAt));
    var planPayload = '';
    var imagesPayload = '';
    try {
      planPayload = vision && vision.plan ? encodeURIComponent(JSON.stringify(vision.plan)) : '';
      imagesPayload = images.length ? encodeURIComponent(JSON.stringify(images)) : '';
    } catch (ignore) {}
    return (
      '<div class="unit-vision mt-5 border-t border-slate-100 pt-4' +
      (alreadyShared ? ' vision-shared' : '') +
      '" data-unit-id="' +
      escapeHtml(c.unitId) +
      '"' +
      (alreadyShared ? ' data-shared="1"' : '') +
      (planPayload ? ' data-live-plan="' + planPayload + '"' : '') +
      (imagesPayload ? ' data-live-images="' + imagesPayload + '"' : '') +
      '>' +
      '<div class="flex flex-wrap items-start justify-between gap-2 mb-2">' +
      '<div>' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-star text-brand mr-1"></i>My Vision Board</h4>' +
      '<p class="text-xs text-slate-500 mt-1 vision-intro-editing' +
      (alreadyShared ? ' hidden' : '') +
      '>Write where your unit is headed in the next 3 months. Create a plan, then Save &amp; share.</p>' +
      '<p class="text-xs text-emerald-700 mt-1 font-medium vision-intro-shared' +
      (alreadyShared ? '' : ' hidden') +
      '"><i class="fas fa-circle-check mr-1"></i>Shared with your team — they can see this board. Tap Edit to make changes.</p>' +
      '</div>' +
      '<span class="vision-shared-pill inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800' +
      (alreadyShared ? '' : ' hidden') +
      '"><i class="fas fa-users"></i> Shared with team</span>' +
      '</div>' +
      '<div class="grid gap-4 lg:grid-cols-2">' +
      '<div>' +
      '<label class="block text-xs font-semibold text-slate-600 mb-1">Your vision</label>' +
      '<textarea class="vision-text w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[140px] focus:ring-2 focus:ring-ng-green outline-none" placeholder="Our unit will\u2026"' +
      (alreadyShared ? ' readonly' : '') +
      '>' +
      escapeHtml((vision && vision.visionText) || '') +
      '</textarea>' +
      visionPhotosHtml(images, { canEdit: !alreadyShared }) +
      '<div class="flex flex-wrap gap-2 mt-2 vision-edit-actions' +
      (alreadyShared ? ' hidden' : '') +
      '">' +
      '<button type="button" class="btn-generate-vision text-xs font-semibold rounded-lg bg-brand text-white px-3 py-2 hover:bg-brand-light"><i class="fas fa-wand-magic-sparkles mr-1"></i>Create my plan</button>' +
      '</div>' +
      '<p class="vision-status text-xs mt-2 ' +
      (alreadyShared ? 'text-emerald-700 font-medium' : 'text-slate-500') +
      '">' +
      (alreadyShared ? 'This vision is live for your team.' : '') +
      '</p>' +
      '</div>' +
      '<div>' +
      '<div class="flex items-center justify-between mb-1">' +
      '<label class="block text-xs font-semibold text-slate-600">Your plan</label>' +
      '<div class="flex items-center gap-1">' +
      '<button type="button" class="btn-unlock-vision text-[11px] font-semibold rounded-lg border border-brand/30 text-brand px-2.5 py-1 hover:bg-brand-soft' +
      (alreadyShared ? '' : ' hidden') +
      '" title="Edit shared board"><i class="fas fa-pen mr-1"></i>Edit</button>' +
      '<button type="button" class="btn-edit-vision text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50' +
      (alreadyShared ? ' hidden' : '') +
      '" title="Edit plan wording"><i class="fas fa-pen mr-1"></i>Edit wording</button>' +
      '<button type="button" class="btn-save-plan hidden text-[11px] font-semibold rounded-lg bg-ng-green text-white px-2 py-1 hover:bg-emerald-700" title="Done editing"><i class="fas fa-check mr-1"></i>Done editing</button>' +
      '</div>' +
      '</div>' +
      '<div class="vision-plan-view rounded-2xl border border-slate-200 bg-slate-50/70 p-4">' +
      initialCards +
      '</div>' +
      '<textarea class="vision-plan hidden w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[240px] focus:ring-2 focus:ring-ng-green outline-none">' +
      escapeHtml(initialReadable) +
      '</textarea>' +
      '<p class="text-[11px] text-slate-400 mt-1 vision-hint-editing' +
      (alreadyShared ? ' hidden' : '') +
      '>Tap milestone status to track progress. Save &amp; share publishes the board to your team.</p>' +
      '<p class="text-[11px] text-slate-500 mt-1 vision-hint-shared' +
      (alreadyShared ? '' : ' hidden') +
      '>Team can see this board. You can still mark milestone progress. Tap Edit to change the vision or plan.</p>' +
      '<button type="button" class="btn-share-vision mt-2 w-full text-xs font-semibold rounded-lg bg-ng-green text-white px-3 py-2.5 hover:bg-emerald-700' +
      (alreadyShared ? ' hidden' : '') +
      '"><i class="fas fa-share-nodes mr-1"></i><span class="btn-share-label">Save &amp; share with team</span></button>' +
      '</div>' +
      '</div></div>'
    );
  }

  function lastMeetingDigestHtml(c, uid) {
    var digest = c.lastMeetingDigest;
    if (!digest) return '';
    var ymd = String(digest.meetingDateYmd || digest.dateYmd || '');
    var missFrom = (window.NigeriaUnits && NigeriaUnits.ATTENDANCE_MISS_START_YMD) || '2026-09-15';
    if (ymd && ymd < missFrom) return '';
    var attLine = formatDigestAttendanceForUser(digest, uid);
    var notes = String(digest.notesContent || '').trim();
    return (
      '<div class="last-meeting-digest mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-3">' +
      '<p class="text-xs font-bold text-sky-900 uppercase tracking-wide mb-1">Last meeting recap</p>' +
      '<p class="text-xs text-sky-800 font-medium">' +
      escapeHtml(digest.meetingDateYmd || '') +
      ' · ' +
      escapeHtml(digest.unitLabel || c.unitLabel) +
      '</p>' +
      '<p class="text-xs text-slate-700 mt-2"><strong>Your attendance:</strong> ' +
      escapeHtml(attLine) +
      '</p>' +
      (notes
        ? '<p class="text-xs text-slate-600 mt-2 whitespace-pre-wrap"><strong>Notes:</strong> ' +
          escapeHtml(notes.slice(0, 800)) +
          (notes.length > 800 ? '…' : '') +
          '</p>'
        : '<p class="text-xs text-slate-500 mt-2">No shared notes were saved.</p>') +
      '</div>'
    );
  }

  function bindVisionPanels(wrap) {
    if (!wrap || !functions) return;
    wrap.querySelectorAll('.unit-vision[data-unit-id]').forEach(function (panel) {
      var unitId = panel.getAttribute('data-unit-id');
      var genBtn = panel.querySelector('.btn-generate-vision');
      var editBtn = panel.querySelector('.btn-edit-vision');
      var unlockBtn = panel.querySelector('.btn-unlock-vision');
      var savePlanBtn = panel.querySelector('.btn-save-plan');
      var shareBtn = panel.querySelector('.btn-share-vision');
      var shareLabel = panel.querySelector('.btn-share-label');
      var statusEl = panel.querySelector('.vision-status');
      var visionTextEl = panel.querySelector('.vision-text');
      var planEl = panel.querySelector('.vision-plan');
      var viewEl = panel.querySelector('.vision-plan-view');
      var sharedPill = panel.querySelector('.vision-shared-pill');
      var introEditing = panel.querySelector('.vision-intro-editing');
      var introShared = panel.querySelector('.vision-intro-shared');
      var hintEditing = panel.querySelector('.vision-hint-editing');
      var hintShared = panel.querySelector('.vision-hint-shared');
      var editActions = panel.querySelector('.vision-edit-actions');
      var livePlan = readableToPlan(planEl ? planEl.value : '');
      var liveImages = [];
      var shareBusy = false;
      try {
        var packed = panel.getAttribute('data-live-plan');
        if (packed) {
          var parsed = JSON.parse(decodeURIComponent(packed));
          if (parsed && typeof parsed === 'object') livePlan = parsed;
        }
      } catch (ignore) {}
      try {
        var packedImg = panel.getAttribute('data-live-images');
        if (packedImg) {
          var parsedImg = JSON.parse(decodeURIComponent(packedImg));
          if (Array.isArray(parsedImg)) liveImages = parsedImg;
        }
      } catch (ignore2) {}

      function toggleHidden(el, hide) {
        if (!el) return;
        if (hide) el.classList.add('hidden');
        else el.classList.remove('hidden');
      }

      function setSharedMode(shared) {
        panel.classList.toggle('vision-shared', !!shared);
        panel.setAttribute('data-shared', shared ? '1' : '0');
        if (visionTextEl) {
          if (shared) visionTextEl.setAttribute('readonly', 'readonly');
          else visionTextEl.removeAttribute('readonly');
        }
        toggleHidden(sharedPill, !shared);
        toggleHidden(introEditing, shared);
        toggleHidden(introShared, !shared);
        toggleHidden(hintEditing, shared);
        toggleHidden(hintShared, !shared);
        toggleHidden(editActions, shared);
        toggleHidden(shareBtn, shared);
        toggleHidden(unlockBtn, !shared);
        toggleHidden(editBtn, shared);
        if (savePlanBtn) savePlanBtn.classList.add('hidden');
        if (planEl) planEl.classList.add('hidden');
        if (viewEl) viewEl.classList.remove('hidden');
        if (statusEl) {
          statusEl.className =
            'vision-status text-xs mt-2 ' + (shared ? 'text-emerald-700 font-medium' : 'text-slate-500');
          if (shared) {
            statusEl.textContent = 'Shared with your team — they can see this board now.';
          }
        }
        renderPhotos();
      }

      function persistImagesAttr() {
        try {
          panel.setAttribute('data-live-images', encodeURIComponent(JSON.stringify(liveImages)));
        } catch (ignore) {}
      }

      function renderPhotos() {
        var wrapPhotos = panel.querySelector('.vision-photos');
        if (!wrapPhotos) return;
        var shared = panel.getAttribute('data-shared') === '1';
        var html = visionPhotosHtml(liveImages, { canEdit: !shared });
        wrapPhotos.outerHTML = html;
        bindPhotoControls();
      }

      function uploadVisionPhoto(file) {
        if (panel.getAttribute('data-shared') === '1') {
          if (statusEl) statusEl.textContent = 'Tap Edit first to change photos.';
          return Promise.resolve();
        }
        if (!isLikelyImageFile(file)) return Promise.resolve();
        if (file.size > 8 * 1024 * 1024) {
          if (statusEl) statusEl.textContent = 'Each photo must be under 8 MB.';
          return Promise.resolve();
        }
        if (liveImages.length >= 8) {
          if (statusEl) statusEl.textContent = 'You can add up to 8 photos on the vision board.';
          return Promise.resolve();
        }
        var user = auth.currentUser;
        if (!user || !storage) return Promise.resolve();
        if (statusEl) statusEl.textContent = 'Uploading photo…';
        var safe = String(file.name || 'photo')
          .replace(/[^\w.\-]+/g, '_')
          .slice(0, 40);
        var contentType = imageUploadContentType(file);
        var path =
          'nigeria_unit_media/' + unitId + '/vision/' + Date.now() + '_' + user.uid.slice(0, 6) + '_' + safe;
        return storage
          .ref(path)
          .put(file, { contentType: contentType })
          .then(function () {
            return storage.ref(path).getDownloadURL();
          })
          .then(function (url) {
            liveImages.push({ url: url });
            persistImagesAttr();
            renderPhotos();
            if (statusEl) statusEl.textContent = 'Photo added — tap Save & share to publish.';
          })
          .catch(function (e) {
            if (statusEl) statusEl.textContent = (e && e.message) || 'Photo upload failed.';
          });
      }

      function bindPhotoControls() {
        var input = panel.querySelector('.vision-photo-input');
        if (input && !input._bound) {
          input._bound = true;
          input.addEventListener('change', function () {
            var files = Array.prototype.slice.call(input.files || []);
            input.value = '';
            var chain = Promise.resolve();
            files.slice(0, 8 - liveImages.length).forEach(function (f) {
              chain = chain.then(function () {
                return uploadVisionPhoto(f);
              });
            });
          });
        }
        panel.querySelectorAll('.vision-photo-remove').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-photo-index'), 10);
            if (!Number.isInteger(idx)) return;
            liveImages.splice(idx, 1);
            persistImagesAttr();
            renderPhotos();
            if (statusEl) statusEl.textContent = 'Photo removed. Save & share again to update the team board.';
          });
        });
      }

      function renderView() {
        if (!viewEl) return;
        viewEl.innerHTML = visionPlanCardsHtml(livePlan, { canTrack: true });
        bindProgressButtons();
      }

      function applyMilestoneStatus(idx, next) {
        if (!livePlan.milestones) livePlan.milestones = [];
        if (!livePlan.milestones[idx]) return;
        livePlan.milestones[idx] = Object.assign({}, livePlan.milestones[idx], { status: next });
        if (planEl) planEl.value = planToEditableText(livePlan);
        try {
          panel.setAttribute('data-live-plan', encodeURIComponent(JSON.stringify(livePlan)));
        } catch (ignore) {}
        renderView();
      }

      function bindProgressButtons() {
        if (!viewEl) return;
        viewEl.querySelectorAll('.vision-status-btn').forEach(function (btn) {
          btn.addEventListener('click', function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault();
            if (ev && ev.stopPropagation) ev.stopPropagation();
            var idx = parseInt(btn.getAttribute('data-milestone-index'), 10);
            var next = btn.getAttribute('data-status');
            if (!Number.isInteger(idx) || !next) return;
            if (!livePlan.milestones || !livePlan.milestones.length) {
              if (statusEl) statusEl.textContent = 'Create and share the plan first, then mark progress.';
              return;
            }
            var prev = normalizeVisionStatus(livePlan.milestones[idx] && livePlan.milestones[idx].status);
            if (prev === next) {
              if (statusEl) statusEl.textContent = 'Already marked “' + next + '”.';
              return;
            }
            applyMilestoneStatus(idx, next);
            if (statusEl) statusEl.textContent = 'Saving progress…';
            function persistProgress() {
              return callableVision('updateNigeriaVisionProgress', 30000)({
                unitId: unitId,
                milestoneIndex: idx,
                status: next,
              });
            }
            function autoShareThenPersist() {
              var visionText = visionTextEl ? visionTextEl.value.trim() : '';
              if (visionText.length < 20) {
                return Promise.reject(
                  new Error('Write and share your vision first (at least a short paragraph), then mark progress.')
                );
              }
              return callableVision('saveNigeriaUnitVision', 45000)({
                unitId: unitId,
                visionText: visionText,
                plan: livePlan,
                imageUrls: liveImages,
              }).then(function () {
                setSharedMode(true);
                return persistProgress();
              });
            }
            persistProgress()
              .catch(function (err) {
                var msg = (err && err.message) || '';
                if (/share a vision|plan first|not found/i.test(msg)) {
                  return autoShareThenPersist();
                }
                return Promise.reject(err);
              })
              .then(function (res) {
                if (res && res.data && res.data.plan) {
                  livePlan = res.data.plan;
                  if (planEl) planEl.value = planToEditableText(livePlan);
                  try {
                    panel.setAttribute('data-live-plan', encodeURIComponent(JSON.stringify(livePlan)));
                  } catch (ignore) {}
                  renderView();
                }
                var p = (res && res.data && res.data.progress) || visionProgressFromPlan(livePlan);
                if (statusEl) {
                  statusEl.textContent =
                    'Progress updated — ' + p.percent + '% on the bench. Your team can see this too.';
                }
              })
              .catch(function (err) {
                applyMilestoneStatus(idx, prev);
                if (statusEl) statusEl.textContent = (err && err.message) || 'Could not update progress. Try again.';
              });
          });
        });
      }

      function setEditMode(on) {
        if (!planEl || !viewEl) return;
        if (on) {
          planEl.classList.remove('hidden');
          viewEl.classList.add('hidden');
          if (editBtn) editBtn.classList.add('hidden');
          if (savePlanBtn) savePlanBtn.classList.remove('hidden');
          planEl.focus();
        } else {
          var edited = readableToPlan(planEl.value);
          edited.milestones = (edited.milestones || []).map(function (m, i) {
            var prev = livePlan.milestones && livePlan.milestones[i];
            return Object.assign({}, m, {
              status: normalizeVisionStatus((prev && prev.status) || m.status),
            });
          });
          livePlan = edited;
          renderView();
          planEl.classList.add('hidden');
          viewEl.classList.remove('hidden');
          if (editBtn) editBtn.classList.remove('hidden');
          if (savePlanBtn) savePlanBtn.classList.add('hidden');
        }
      }

      function resetShareButton() {
        shareBusy = false;
        if (shareBtn) {
          shareBtn.disabled = false;
          shareBtn.classList.remove('is-saving');
        }
        if (shareLabel) shareLabel.textContent = 'Save & share with team';
      }

      bindProgressButtons();
      bindPhotoControls();

      if (genBtn) {
        genBtn.addEventListener('click', function () {
          if (panel.getAttribute('data-shared') === '1') return;
          var visionText = visionTextEl ? visionTextEl.value.trim() : '';
          if (visionText.length < 20) {
            if (statusEl) statusEl.textContent = 'Write at least a short vision first.';
            return;
          }
          var unitLabel =
            (panel.closest('.unit-card') &&
              panel.closest('.unit-card').querySelector('h3') &&
              panel.closest('.unit-card').querySelector('h3').textContent) ||
            'your unit';
          livePlan = buildClientStarterVisionPlan(visionText, unitLabel.trim());
          if (planEl) planEl.value = planToEditableText(livePlan);
          try {
            panel.setAttribute('data-live-plan', encodeURIComponent(JSON.stringify(livePlan)));
          } catch (ignore) {}
          renderView();
          if (statusEl) {
            statusEl.textContent =
              'Plan ready — review or Edit wording, then Save & share. Trying a richer AI plan briefly…';
          }
          genBtn.disabled = true;
          callableVision('generateNigeriaUnitVision', 20000)({ unitId: unitId, visionText: visionText })
            .then(function (res) {
              if (res.data && res.data.plan && res.data.aiUsed) {
                livePlan = res.data.plan;
                if (planEl) planEl.value = planToEditableText(livePlan);
                try {
                  panel.setAttribute('data-live-plan', encodeURIComponent(JSON.stringify(livePlan)));
                } catch (ignore2) {}
                renderView();
                if (statusEl) {
                  statusEl.textContent = 'AI plan ready — review it, then Save & share with your team.';
                }
              } else if (statusEl) {
                statusEl.textContent = 'Plan ready — review or Edit wording, then Save & share with your team.';
              }
            })
            .catch(function () {
              if (statusEl) {
                statusEl.textContent = 'Plan ready — review or Edit wording, then Save & share with your team.';
              }
            })
            .finally(function () {
              genBtn.disabled = false;
            });
        });
      }

      if (unlockBtn) {
        unlockBtn.addEventListener('click', function () {
          setSharedMode(false);
          if (statusEl) {
            statusEl.textContent = 'Editing unlocked — make changes, then Save & share again.';
          }
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', function () {
          if (panel.getAttribute('data-shared') === '1') return;
          setEditMode(true);
          if (statusEl) statusEl.textContent = 'Editing wording — tap Done editing when finished.';
        });
      }
      if (savePlanBtn) {
        savePlanBtn.addEventListener('click', function () {
          setEditMode(false);
          if (statusEl) statusEl.textContent = 'Edits kept — tap Save & share with team to publish.';
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          if (shareBusy) return;
          var visionText = visionTextEl ? visionTextEl.value.trim() : '';
          if (visionText.length < 20) {
            if (statusEl) statusEl.textContent = 'Please write your vision first.';
            return;
          }
          var plan = readableToPlan(planEl ? planEl.value : '');
          if (livePlan && livePlan.milestones) {
            plan.milestones = (plan.milestones || []).map(function (m, i) {
              var prev = livePlan.milestones[i];
              return Object.assign({}, m, {
                status: normalizeVisionStatus((prev && prev.status) || m.status),
              });
            });
          }
          if ((!plan.milestones || !plan.milestones.length) && (!plan.roadmap || !plan.roadmap.length)) {
            var unitLabel =
              (panel.closest('.unit-card') &&
                panel.closest('.unit-card').querySelector('h3') &&
                panel.closest('.unit-card').querySelector('h3').textContent) ||
              'your unit';
            plan = buildClientStarterVisionPlan(visionText, unitLabel.trim());
            livePlan = plan;
            if (planEl) planEl.value = planToEditableText(plan);
            renderView();
          }
          shareBusy = true;
          shareBtn.disabled = true;
          shareBtn.classList.add('is-saving');
          if (shareLabel) shareLabel.textContent = 'Sharing…';
          if (statusEl) {
            statusEl.className = 'vision-status text-xs mt-2 text-slate-500';
            statusEl.textContent = 'Sharing with your team…';
          }
          var finished = false;
          var safetyTimer = window.setTimeout(function () {
            if (finished) return;
            resetShareButton();
            if (statusEl) {
              statusEl.textContent =
                'Still waiting on the server. Tap Save & share again — your plan is still on this screen.';
            }
          }, 50000);

          callableVision('saveNigeriaUnitVision', 45000)({
            unitId: unitId,
            visionText: visionText,
            plan: plan,
            imageUrls: liveImages,
          })
            .then(function (res) {
              finished = true;
              window.clearTimeout(safetyTimer);
              if (res && res.data && res.data.plan) {
                livePlan = res.data.plan;
                if (planEl) planEl.value = planToEditableText(livePlan);
                renderView();
              } else {
                livePlan = plan;
              }
              try {
                panel.setAttribute('data-live-plan', encodeURIComponent(JSON.stringify(livePlan)));
              } catch (ignore) {}
              resetShareButton();
              setSharedMode(true);
            })
            .catch(function (err) {
              finished = true;
              window.clearTimeout(safetyTimer);
              resetShareButton();
              var msg = (err && err.message) || 'Could not share. Please try again.';
              if (/deadline|timeout/i.test(msg)) {
                msg = 'Share timed out. Tap Save & share again — your plan is still here.';
              }
              if (statusEl) {
                statusEl.className = 'vision-status text-xs mt-2 text-red-600';
                statusEl.textContent = msg;
              }
            });
        });
      }
    });
  }

  function formatActionDue(ymd) {
    if (!ymd) return 'No due date';
    return formatMeetingYmd(ymd) || ymd;
  }

  function actionUrgencyClass(a) {
    var due = String(a.dateDue || '');
    if (!due) return 'border-slate-100';
    var today = '';
    try {
      today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Lagos',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch (e) {
      today = new Date().toISOString().slice(0, 10);
    }
    if (due < today) return 'border-red-200 bg-red-50/60';
    if (due === today) return 'border-amber-200 bg-amber-50/60';
    return 'border-slate-100';
  }

  function openActionCardHtml(a, opts) {
    opts = opts || {};
    var showAssignee = opts.showAssignee === true;
    return (
      '<div class="rounded-xl border p-3 ' +
      actionUrgencyClass(a) +
      '">' +
      '<div class="flex flex-wrap items-start justify-between gap-2">' +
      '<div class="min-w-0 flex-1">' +
      '<p class="font-semibold text-slate-900 text-sm leading-snug">' +
      escapeHtml(a.actionDescription || 'Action') +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-1">' +
      escapeHtml(a.unitLabel || 'Unit') +
      (a.meetingDateYmd ? ' · Meeting ' + escapeHtml(formatMeetingYmd(a.meetingDateYmd)) : '') +
      (showAssignee && a.responsibilityName
        ? ' · ' + escapeHtml(a.responsibilityName)
        : '') +
      '</p></div>' +
      '<div class="text-right shrink-0">' +
      '<span class="inline-block text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-white border border-slate-200 text-slate-700">' +
      escapeHtml(a.status || 'Open') +
      '</span>' +
      '<p class="text-xs font-medium text-brand mt-1">Due ' +
      escapeHtml(formatActionDue(a.dateDue)) +
      '</p></div></div>' +
      '<button type="button" class="btn-open-action-notes mt-2 text-xs font-semibold text-brand underline" data-unit-id="' +
      escapeHtml(a.unitId || '') +
      '" data-meeting-key="' +
      escapeHtml(a.meetingKey || '') +
      '">Open in meeting notes</button></div>'
    );
  }

  function bindOpenActionLinks(root) {
    if (!root) return;
    root.querySelectorAll('.btn-open-action-notes').forEach(function (btn) {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var unitId = btn.getAttribute('data-unit-id') || '';
        var meetingKey = btn.getAttribute('data-meeting-key') || '';
        switchTab('units');
        window.setTimeout(function () {
          var card = document.querySelector('.unit-card[data-unit-id="' + unitId + '"]');
          if (card && card.tagName === 'DETAILS' && !card.open) card.open = true;
          var picker = card && card.querySelector('.meeting-notes-picker');
          if (picker && meetingKey) {
            picker.value = meetingKey;
            picker.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (card) {
            try {
              card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {}
          }
        }, 80);
      });
    });
  }

  function teamActionsPanelHtml(actions) {
    if (!actions || !actions.length) return '';
    return (
      '<div class="mt-5 border-t border-slate-100 pt-4 team-open-actions">' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-list-check text-brand mr-1"></i>Team open actions</h4>' +
      '<p class="text-xs text-slate-500 mt-1 mb-3">Open items from meeting notes — everyone’s board for this unit.</p>' +
      '<div class="space-y-2">' +
      actions
        .map(function (a) {
          return openActionCardHtml(a, { showAssignee: true });
        })
        .join('') +
      '</div></div>'
    );
  }

  function renderHomeTab(data) {
    var warnWrap = $('home-attendance-warnings');
    if (warnWrap) {
      var warnings = (data.unitContexts || [])
        .filter(function (c) {
          return !c.browseOnly;
        })
        .map(function (c) {
          var w = c.attendanceStats && c.attendanceStats.missWarning;
          if (!w) return '';
          return attendanceWarningBannerHtml(w, c.unitLabel);
        })
        .filter(Boolean)
        .join('');
      if (warnings) {
        warnWrap.innerHTML = warnings;
        show(warnWrap);
      } else {
        warnWrap.innerHTML = '';
        hide(warnWrap);
      }
    }

    var myActionsWrap = $('home-my-actions');
    var myActionsList = $('home-my-actions-list');
    if (myActionsWrap && myActionsList) {
      var mine = data.myOpenActions || [];
      if (mine.length) {
        myActionsList.innerHTML = mine
          .map(function (a) {
            return openActionCardHtml(a, { showAssignee: false });
          })
          .join('');
        show(myActionsWrap);
        bindOpenActionLinks(myActionsWrap);
      } else {
        myActionsList.innerHTML = '';
        hide(myActionsWrap);
      }
    }
    var gotoUnits = myActionsWrap && myActionsWrap.querySelector('.btn-goto-units');
    if (gotoUnits && !gotoUnits.dataset.bound) {
      gotoUnits.dataset.bound = '1';
      gotoUnits.addEventListener('click', function () {
        switchTab('units');
      });
    }

    var meetings = $('home-meetings-list');
    if (meetings) {
      var ctx = (data.unitContexts || []).filter(function (c) {
        return !c.browseOnly;
      });
      meetings.innerHTML = ctx.length
        ? ctx
            .map(function (c) {
              var sched = unitScheduleLabel(c);
              var next = c.nextMeeting
                ? formatMeetingYmd(c.nextMeeting.dateYmd) +
                  ' · in ' +
                  formatCountdown(c.nextMeeting.startIso)
                : 'No upcoming meeting';
              return (
                '<div class="rounded-xl border border-slate-100 p-3 flex justify-between gap-3">' +
                '<div><p class="font-semibold text-slate-900">' +
                c.unitLabel +
                '</p><p class="text-xs text-slate-500">' +
                sched +
                '</p></div>' +
                '<p class="text-xs text-brand font-medium text-right shrink-0">' +
                next +
                '</p></div>'
              );
            })
            .join('')
        : '<p class="text-slate-500 text-sm">Add units in your profile.</p>';
    }
  }

  function rosterWaLink(phone) {
    var digits = String(phone || '').replace(/[^0-9]/g, '');
    if (!digits) return '';
    if (digits.length === 11 && digits.charAt(0) === '0') digits = '234' + digits.slice(1);
    return 'https://wa.me/' + digits;
  }

  function rosterStatusBadge(tier) {
    if (tier === 'withdrawal')
      return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-100 text-red-700">Withdrawal</span>';
    if (tier === 'final')
      return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-orange-100 text-orange-700">Final warning</span>';
    if (tier === 'warning')
      return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-amber-100 text-amber-700">Warning</span>';
    if (tier === 'pending')
      return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-violet-100 text-violet-800">Pending hub</span>';
    return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">On track</span>';
  }

  function rosterManageControls(c, m, isSuperUser) {
    if (m.pendingWorkforce) {
      var statusLabel =
        m.workforceStatus === 'approved'
          ? 'Cleared — awaiting hub sign-in'
          : m.workforceStatus === 'in_training'
            ? 'In Workers Training'
            : 'Workforce application';
      return (
        '<p class="text-[10px] text-violet-700 mt-1.5 font-medium">' +
        escapeHtml(statusLabel) +
        '. They appear here after they complete their hub profile.</p>'
      );
    }
    var canManage = isSuperUser || c.role === 'leader';
    if (!canManage) return '';
    if (!isSuperUser && m.role === 'leader') return '';
    var attrs =
      ' data-unit-id="' + escapeHtml(c.unitId) + '" data-target-uid="' + escapeHtml(m.uid) + '"';
    var btns = [];
    if (m.role === 'member') {
      btns.push(
        '<button type="button" class="roster-action text-[10px] font-semibold rounded-md border border-amber-200 text-amber-800 px-2 py-0.5 hover:bg-amber-50"' +
          attrs +
          ' data-action="leader">Make leader</button>'
      );
    } else if (m.role === 'leader' && isSuperUser) {
      btns.push(
        '<button type="button" class="roster-action text-[10px] font-semibold rounded-md border border-slate-200 text-slate-700 px-2 py-0.5 hover:bg-slate-50"' +
          attrs +
          ' data-action="member">Make member</button>'
      );
    }
    btns.push(
      '<button type="button" class="roster-action text-[10px] font-semibold rounded-md border border-red-200 text-red-700 px-2 py-0.5 hover:bg-red-50"' +
        attrs +
        ' data-action="remove">Remove</button>'
    );
    return '<div class="flex flex-wrap gap-1 mt-1.5">' + btns.join('') + '</div>';
  }

  function formatCheckInTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-GB', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  }

  function memberCheckInsHtml(m) {
    if (m.pendingWorkforce || !m.checkIns || !m.checkIns.length) return '';
    var rows = m.checkIns
      .slice()
      .reverse()
      .filter(function (ci) {
        return ci.status === 'present' || ci.status === 'excused' || ci.status === 'missed';
      })
      .map(function (ci) {
        var when = formatCheckInTime(ci.checkedInAtIso);
        var label =
          ci.status === 'present'
            ? '<span class="text-emerald-700 font-semibold">Present</span>' +
              (ci.late ? ' <span class="text-amber-700">(late)</span>' : '') +
              (when ? ' · ' + escapeHtml(when) : '')
            : ci.status === 'excused'
              ? '<span class="text-violet-700 font-semibold">Excused</span>'
              : '<span class="text-slate-400 font-semibold">Missed</span>';
        return (
          '<li class="flex justify-between gap-2 py-0.5 border-b border-slate-50 last:border-0">' +
          '<span class="text-slate-600 shrink-0">' +
          escapeHtml(formatMeetingYmd(ci.dateYmd) || ci.dateYmd) +
          '</span>' +
          '<span class="text-right">' +
          label +
          '</span></li>'
        );
      })
      .join('');
    if (!rows) return '';
    return (
      '<details class="mt-2 rounded-lg border border-slate-100 bg-slate-50/70">' +
      '<summary class="cursor-pointer list-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 flex items-center justify-between gap-2">' +
      '<span><i class="fas fa-clipboard-check text-brand mr-1"></i>Meeting check-ins</span>' +
      '<i class="fas fa-chevron-down text-[9px] text-slate-400"></i></summary>' +
      '<ul class="px-2.5 pb-2 text-[11px] space-y-0.5">' +
      rows +
      '</ul></details>'
    );
  }

  function meetingAttendanceHtml(meetings) {
    if (!meetings || !meetings.length) {
      return (
        '<p class="text-xs text-slate-500 mt-3">No tracked meetings yet (attendance starts from 14 Sep 2026).</p>'
      );
    }
    return (
      '<div class="mt-4 pt-3 border-t border-slate-100">' +
      '<h5 class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2"><i class="fas fa-user-check text-ng-green mr-1"></i>Recent meeting attendance</h5>' +
      meetings
        .map(function (mtg) {
          var presentRows = (mtg.present || [])
            .map(function (p) {
              var when = formatCheckInTime(p.checkedInAtIso);
              return (
                '<li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1 border-b border-emerald-50/80 last:border-0">' +
                '<span class="font-medium text-slate-800">' +
                escapeHtml(p.name) +
                (p.late
                  ? ' <span class="text-[10px] font-semibold text-amber-700">late</span>'
                  : '') +
                '</span>' +
                '<span class="text-[11px] text-slate-500">' +
                (when ? escapeHtml(when) : 'Checked in') +
                '</span></li>'
              );
            })
            .join('');
          var excusedRows = (mtg.excused || [])
            .map(function (e) {
              return (
                '<li class="text-[11px] text-violet-700 py-0.5">' +
                escapeHtml(e.name) +
                ' · excused</li>'
              );
            })
            .join('');
          var absentNote =
            (mtg.absent || []).length > 0
              ? '<p class="text-[11px] text-slate-500 mt-1.5">Absent: ' +
                escapeHtml(
                  mtg.absent
                    .map(function (a) {
                      return a.name;
                    })
                    .join(', ')
                ) +
                '</p>'
              : '';
          return (
            '<details class="rounded-xl border border-slate-200 bg-white overflow-hidden mb-2">' +
            '<summary class="cursor-pointer list-none px-3 py-2.5 hover:bg-slate-50 flex flex-wrap items-center gap-2">' +
            '<span class="font-semibold text-sm text-slate-900">' +
            escapeHtml(formatMeetingYmd(mtg.dateYmd) || mtg.dateYmd) +
            '</span>' +
            '<span class="text-[11px] text-slate-500">' +
            escapeHtml(mtg.dayName || '') +
            '</span>' +
            '<span class="ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ' +
            (mtg.presentCount === mtg.memberCount
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-700') +
            '">' +
            escapeHtml(String(mtg.presentCount || 0)) +
            '/' +
            escapeHtml(String(mtg.memberCount || 0)) +
            ' present</span></summary>' +
            '<div class="px-3 pb-3 border-t border-slate-100 pt-2">' +
            (presentRows
              ? '<p class="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mb-1">Checked in</p><ul class="mb-2">' +
                presentRows +
                '</ul>'
              : '<p class="text-xs text-slate-500 mb-2">No check-ins recorded.</p>') +
            (excusedRows
              ? '<p class="text-[10px] font-bold uppercase tracking-wide text-violet-700 mb-1">Excused</p><ul class="mb-1">' +
                excusedRows +
                '</ul>'
              : '') +
            absentNote +
            '</div></details>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  function rosterList(c) {
    var raw = c && c.teamRoster;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.roster)) {
      if (!c.meetingAttendance && Array.isArray(raw.recentMeetings)) {
        c.meetingAttendance = raw.recentMeetings;
      }
      return raw.roster;
    }
    return [];
  }

  function teamRosterHtml(c, isSuperUser) {
    var roster = rosterList(c);
    if (!c.isLeaderView || !roster.length) return '';
    var atRisk = roster.filter(function (m) {
      return m.tier && m.tier !== 'ok' && m.tier !== 'pending';
    });
    var pendingCount = roster.filter(function (m) {
      return m.pendingWorkforce || m.tier === 'pending';
    }).length;
    var withdrawals = roster.filter(function (m) {
      return m.tier === 'withdrawal';
    });
    var rows = roster
      .map(function (m) {
        var wa = rosterWaLink(m.phone);
        var rowTone =
          m.tier === 'withdrawal'
            ? 'bg-red-50/70 border-red-100'
            : m.tier === 'final'
              ? 'bg-orange-50/60 border-orange-100'
              : m.tier === 'warning'
                ? 'bg-amber-50/50 border-amber-100'
                : m.tier === 'pending' || m.pendingWorkforce
                  ? 'bg-violet-50/60 border-violet-100'
                  : 'bg-white border-slate-100';
        return (
          '<div class="rounded-xl border ' +
          rowTone +
          ' p-2.5 flex items-start gap-2">' +
          '<div class="min-w-0 flex-1">' +
          '<div class="flex items-center gap-2 flex-wrap">' +
          '<span class="text-sm font-semibold text-slate-900 truncate">' +
          escapeHtml(m.name) +
          '</span>' +
          (m.role === 'leader'
            ? '<span class="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">Leader</span>'
            : '') +
          rosterStatusBadge(m.tier) +
          '</div>' +
          (m.pendingWorkforce
            ? '<p class="text-[11px] text-violet-700 mt-0.5">Kingdom Workforce · not on hub attendance yet</p>'
            : '<p class="text-[11px] text-slate-500 mt-0.5">' +
              escapeHtml(String(m.missed || 0)) +
              ' missed · ' +
              escapeHtml(String(m.late || 0)) +
              ' late · last 8 wks</p>') +
          (m.phone ? '<p class="text-[11px] text-slate-500">' + escapeHtml(m.phone) + '</p>' : '') +
          (m.email && m.pendingWorkforce
            ? '<p class="text-[11px] text-slate-500">' + escapeHtml(m.email) + '</p>'
            : '') +
          (m.tier === 'withdrawal'
            ? '<p class="text-[11px] text-red-700 font-medium mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>Withdrawal reached — you may remove them from the WhatsApp group.</p>'
            : '') +
          memberCheckInsHtml(m) +
          rosterManageControls(c, m, isSuperUser) +
          '</div>' +
          (wa
            ? '<a href="' +
              wa +
              '" target="_blank" rel="noopener" class="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 hover:bg-emerald-100"><i class="fas fa-comment-dots mr-1"></i>Message</a>'
            : '') +
          '</div>'
        );
      })
      .join('');

    var summary = withdrawals.length
      ? '<div class="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800 mb-2"><strong>' +
        withdrawals.length +
        '</strong> member' +
        (withdrawals.length === 1 ? '' : 's') +
        ' reached the withdrawal notice — consider removing them from the WhatsApp group.</div>'
      : atRisk.length
        ? '<div class="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 mb-2"><strong>' +
          atRisk.length +
          '</strong> member' +
          (atRisk.length === 1 ? '' : 's') +
          ' need a nudge to stay on track.</div>'
        : pendingCount
          ? '<div class="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 text-xs text-violet-800 mb-2"><strong>' +
            pendingCount +
            '</strong> workforce applicant' +
            (pendingCount === 1 ? '' : 's') +
            ' waiting to finish hub sign-in.</div>'
          : '<div class="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800 mb-2">Everyone is on track.</div>';

    return (
      '<div class="team-roster mt-1">' +
      '<div class="flex items-center justify-between mb-2">' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-users text-brand mr-1"></i>Team roster</h4>' +
      '<span class="text-[11px] text-slate-500">' +
      roster.length +
      ' member' +
      (roster.length === 1 ? '' : 's') +
      '</span>' +
      '</div>' +
      summary +
      '<div class="space-y-2">' +
      rows +
      '</div>' +
      meetingAttendanceHtml(c.meetingAttendance) +
      '</div>'
    );
  }

  function renderMyMembersTab(data) {
    var list = $('my-members-list');
    if (!list) return;
    var leaders = leaderUnitContexts(data);
    if (!leaders.length) {
      list.innerHTML = '<p class="text-slate-500">No unit leadership yet.</p>';
      return;
    }
    // Your units first, then Group browse cards; only auto-open the first real unit
    // (and Group cards that already have people).
    leaders = leaders.slice().sort(function (a, b) {
      if (!!a.browseOnly !== !!b.browseOnly) return a.browseOnly ? 1 : -1;
      return String(a.unitLabel || '').localeCompare(String(b.unitLabel || ''));
    });

    var needsRoster = leaders.some(function (c) {
      return c.rosterDeferred === true && !rosterList(c).length;
    });

    function paintRosters() {
      list.innerHTML = leaders
        .map(function (c, i) {
          var rosterBlock = teamRosterHtml(c, data.isSuperUser === true);
          if (!rosterBlock) {
            rosterBlock =
              '<p class="text-xs text-slate-500">No members listed for this unit yet.</p>';
          }
          var people = rosterList(c);
          var hasPeople = people.length;
          var openAttr = !c.browseOnly && i === 0 ? ' open' : hasPeople && c.browseOnly ? ' open' : '';
          return (
            '<details class="my-members-unit rounded-2xl border border-slate-200 bg-white overflow-hidden"' +
            openAttr +
            '>' +
            '<summary class="cursor-pointer list-none px-4 py-3 bg-slate-50/80 hover:bg-slate-50">' +
            '<span class="summary-row">' +
            '<i class="fas fa-chevron-right my-members-chevron text-slate-400 text-xs"></i>' +
            '<span class="font-semibold text-slate-900 flex-1 min-w-0">' +
            escapeHtml(c.unitLabel) +
            '</span>' +
            '<span class="text-[11px] text-slate-500 shrink-0">' +
            people.length +
            ' members</span></span></summary>' +
            '<div class="p-4 border-t border-slate-100">' +
            rosterBlock +
            '</div></details>'
          );
        })
        .join('');
      bindRosterManage(list);
    }

    if (needsRoster) {
      list.innerHTML =
        '<p class="text-sm text-slate-500 py-6 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Loading member lists…</p>';
      hubCallable('getNigeriaMyMembersRosters', 60000)({
        unitIds: leaders.map(function (c) {
          return c.unitId;
        }),
      })
        .then(function (res) {
          var rosters = (res.data && res.data.rosters) || {};
          var meetingAttendance = (res.data && res.data.meetingAttendance) || {};
          leaders.forEach(function (c) {
            if (rosters[c.unitId]) {
              c.teamRoster = rosters[c.unitId];
              c.rosterDeferred = false;
            } else if (c.rosterDeferred) {
              c.teamRoster = [];
              c.rosterDeferred = false;
            }
            if (meetingAttendance[c.unitId]) {
              c.meetingAttendance = meetingAttendance[c.unitId];
            }
          });
          if (dashboardData && dashboardData.unitContexts) {
            dashboardData.unitContexts.forEach(function (c) {
              if (rosters[c.unitId]) {
                c.teamRoster = rosters[c.unitId];
                c.rosterDeferred = false;
              }
              if (meetingAttendance[c.unitId]) {
                c.meetingAttendance = meetingAttendance[c.unitId];
              }
            });
          }
          paintRosters();
        })
        .catch(function (err) {
          console.error('getNigeriaMyMembersRosters', err);
          list.innerHTML =
            '<p class="text-sm text-red-600 py-4">Could not load member lists. ' +
            escapeHtml((err && err.message) || '') +
            '</p>';
        });
      return;
    }

    paintRosters();
  }

  function bindRosterManage(wrap) {
    if (!wrap || !functions) return;
    wrap.querySelectorAll('.roster-action').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var unitId = btn.getAttribute('data-unit-id');
        var targetUid = btn.getAttribute('data-target-uid');
        var action = btn.getAttribute('data-action');
        var verb =
          action === 'remove'
            ? 'remove this person from the unit'
            : action === 'leader'
              ? 'make this person a leader'
              : 'change this person to a member';
        if (!window.confirm('Are you sure you want to ' + verb + '?')) return;
        btn.disabled = true;
        var original = btn.textContent;
        btn.textContent = 'Updating…';
        hubCallable('setNigeriaMemberRole', 45000)({
          unitId: unitId,
          targetUid: targetUid,
          role: action,
        })
          .then(function () {
            btn.textContent = 'Done';
            setStatus('Member updated.', 'success');
            softReloadDashboard();
          })
          .catch(function (err) {
            window.alert((err && err.message) || 'Could not update the member.');
            btn.disabled = false;
            btn.textContent = original;
          });
      });
    });
  }

  function renderUnitsTab(data) {
    var wrap = $('units-cards');
    if (!wrap) return;
    if (window.DDBSNigeriaMeetingNotes) DDBSNigeriaMeetingNotes.detachAll();
    var ctx = (data.unitContexts || []).filter(function (c) {
      return !c.browseOnly;
    });
    var multi = ctx.length > 1;
    var notesHtml = window.DDBSNigeriaMeetingNotes
      ? DDBSNigeriaMeetingNotes.mountHtml
      : function () {
          return '';
        };
    var profileName = data.profile && data.profile.name;
    wrap.innerHTML = ctx
      .map(function (c, idx) {
        var sched = unitScheduleLabel(c);
        var open = c.checkInOpen;
        var checkedIn = c.alreadyCheckedIn === true;
        var unitMeetings = meetingsForUnit(c);
        var defaultKey = defaultMeetingKey(unitMeetings, c);
        var meeting = meetingForNotes(c);
        var missWarn =
          c.attendanceStats && c.attendanceStats.missWarning
            ? attendanceWarningBannerHtml(c.attendanceStats.missWarning, c.unitLabel)
            : '';
        var uid = auth.currentUser && auth.currentUser.uid;
        var leaderHint =
          c.isLeaderView || c.role === 'leader'
            ? '<p class="mt-4 text-xs text-slate-500 border-t border-slate-100 pt-3"><i class="fas fa-users text-brand mr-1"></i>Manage this unit’s roster in the <button type="button" class="text-brand font-semibold underline btn-goto-my-members">My members</button> tab.</p>'
            : '';
        var checkInBtn;
        if (checkedIn) {
          checkInBtn =
            '<button type="button" class="btn-unit-checkin w-full rounded-xl py-3 font-semibold text-white bg-emerald-600 cursor-default" data-unit-id="' +
            c.unitId +
            '" data-checked-in="1" disabled><i class="fas fa-check-circle mr-2"></i>Checked in</button>' +
            '<p class="text-xs text-emerald-700 mt-2 text-center font-medium">You’re checked in for this meeting.</p>';
        } else {
          checkInBtn =
            '<button type="button" class="btn-unit-checkin w-full rounded-xl py-3 font-semibold text-white ' +
            (open ? 'bg-ng-green hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed') +
            '" data-unit-id="' +
            c.unitId +
            '" ' +
            (open ? '' : 'disabled') +
            '>Check in</button>' +
            '<p class="text-xs text-slate-500 mt-2 text-center">Opens 15 min before · closes 10 min after</p>';
        }
        var body =
          missWarn +
          '<p class="text-sm text-slate-600 mb-1">' +
          sched +
          '</p>' +
          (meeting.dateYmd
            ? '<p class="text-xs text-brand font-medium mb-3">Next meeting: ' +
              escapeHtml(formatMeetingYmd(meeting.dateYmd)) +
              (meeting.startIso ? ' · in ' + formatCountdown(meeting.startIso) : '') +
              '</p>'
            : '') +
          checkInBtn +
          absencePanelHtml(c) +
          lastMeetingDigestHtml(c, uid) +
          leaderHint +
          visionPanelHtml(c) +
          teamActionsPanelHtml(c.teamOpenActions) +
          notesHtml(unitMeetings, defaultKey);

        var roleBadge =
          '<span class="text-xs font-semibold rounded-full px-2 py-1 ' +
          (c.role === 'leader' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') +
          '">' +
          (c.role === 'leader' ? 'Leader' : 'Member') +
          '</span>';

        if (multi) {
          return (
            '<details class="unit-card unit-card-collapse bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden" data-unit-id="' +
            c.unitId +
            '"' +
            (idx === 0 ? ' open' : '') +
            '>' +
            '<summary class="unit-card-summary cursor-pointer list-none px-5 py-4 hover:bg-slate-50/80">' +
            '<span class="summary-row">' +
            '<i class="fas fa-chevron-right unit-card-chevron text-slate-400 text-xs"></i>' +
            '<h3 class="font-bold text-slate-900 flex-1 min-w-0">' +
            escapeHtml(c.unitLabel) +
            '</h3>' +
            roleBadge +
            '</span></summary>' +
            '<div class="unit-card-body px-5 pb-5 border-t border-slate-100 pt-3">' +
            body +
            '</div></details>'
          );
        }

        return (
          '<div class="unit-card bg-white rounded-2xl shadow-card border border-slate-100 p-5" data-unit-id="' +
          c.unitId +
          '">' +
          '<div class="flex flex-wrap items-center gap-2 mb-3">' +
          '<h3 class="font-bold text-slate-900 flex-1">' +
          escapeHtml(c.unitLabel) +
          '</h3>' +
          roleBadge +
          '</div>' +
          body +
          '</div>'
        );
      })
      .join('');

    wrap.querySelectorAll('.btn-unit-checkin').forEach(function (btn) {
      if (btn.getAttribute('data-checked-in') === '1') return;
      btn.addEventListener('click', function () {
        checkIn(btn.getAttribute('data-unit-id'), btn);
      });
    });
    wrap.querySelectorAll('.btn-goto-my-members').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab('my-members');
      });
    });

    bindVisionPanels(wrap);
    bindAbsencePanels(wrap);
    bindOpenActionLinks(wrap);

    if (window.DDBSNigeriaMeetingNotes) {
      ctx.forEach(function (c) {
        var card = wrap.querySelector('.unit-card[data-unit-id="' + c.unitId + '"]');
        var notesRoot = card && card.querySelector('.meeting-notes');
        var unitMeetings = meetingsForUnit(c);
        var meetingKey = defaultMeetingKey(unitMeetings, c);
        var meeting = unitMeetings.find(function (m) {
          return m.key === meetingKey;
        }) || meetingForNotes(c);
        if (notesRoot && meetingKey) {
          var members = rosterList(c)
            .filter(function (m) {
              return m && m.uid && !String(m.uid).startsWith('wf_');
            })
            .map(function (m) {
              return { uid: m.uid, name: m.name, role: m.role };
            });
          DDBSNigeriaMeetingNotes.attach(notesRoot, {
            unitId: c.unitId,
            unitLabel: c.unitLabel,
            meetingKey: meetingKey,
            meetingDateYmd: meeting.dateYmd || '',
            profileName: profileName,
            members: members,
          });
        }
      });
    }
  }

  function renderReportsTab(data) {
    var panels = $('reports-panels');
    var note = $('reports-member-note');
    if (!panels) return;
    if (note) hide(note);

    renderAllReportsBoard(data);

    if (!window.NigeriaDashboardReport) {
      panels.innerHTML =
        '<p class="text-sm text-slate-500">Monthly report module failed to load. Refresh the page.</p>';
      return;
    }

    if (!panels.querySelector('#ng-report-root')) {
      NigeriaDashboardReport.mount(
        panels,
        {
          profile: data.profile,
          unitContexts: data.unitContexts,
          authUser: auth.currentUser,
          isSuperUser: data.isSuperUser || isClientSuperUser(),
          canViewAllUnitReports: !!data.canViewAllUnitReports,
        },
        {
          db: db,
          functions: functions,
          storage: storage,
          auth: auth,
        }
      );
    } else {
      NigeriaDashboardReport.refresh(
        {
          profile: data.profile,
          unitContexts: data.unitContexts,
          authUser: auth.currentUser,
          isSuperUser: data.isSuperUser || isClientSuperUser(),
          canViewAllUnitReports: !!data.canViewAllUnitReports,
        },
        {
          db: db,
          functions: functions,
          storage: storage,
          auth: auth,
        }
      );
    }
  }

  function monthName(month) {
    var names = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    return names[Number(month) - 1] || String(month || '');
  }

  function formatReportSubmittedAt(ts) {
    if (!ts) return '';
    try {
      var d = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('en-NG', { timeZone: 'Africa/Lagos' });
    } catch (e) {
      return '';
    }
  }

  function ensureAllReportsFilters() {
    var yearSel = $('all-reports-year');
    var monthSel = $('all-reports-month');
    if (!yearSel || yearSel.options.length) return;
    var now = new Date();
    var y = now.getFullYear();
    for (var yr = y; yr >= y - 2; yr--) {
      var opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = String(yr);
      if (yr === y) opt.selected = true;
      yearSel.appendChild(opt);
    }
    if (monthSel && monthSel.options.length <= 1) {
      [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ].forEach(function (name, i) {
        var mOpt = document.createElement('option');
        mOpt.value = String(i + 1);
        mOpt.textContent = name;
        monthSel.appendChild(mOpt);
      });
    }
  }

  function bindAllReportsBoardOnce() {
    var board = $('all-reports-board');
    if (!board || board.dataset.bound === '1') return;
    board.dataset.bound = '1';
    var refreshBtn = $('btn-refresh-all-reports');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadAllUnitReports();
      });
    }
    ['all-reports-year', 'all-reports-month'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('change', function () {
          loadAllUnitReports();
        });
      }
    });
  }

  var allUnitReportsById = {};

  function setAllReportsStatus(msg) {
    var status = $('all-reports-status');
    if (status) status.textContent = msg || '';
  }

  function exportSubmittedReport(reportId, mode) {
    var r = allUnitReportsById[reportId];
    if (!r) {
      setAllReportsStatus('Could not find that report. Tap Refresh and try again.');
      return;
    }
    if (!window.MonthlyUnitReport) {
      setAllReportsStatus('Export tools still loading — refresh the page and try again.');
      return;
    }
    var data =
      typeof MonthlyUnitReport.fromSubmittedReport === 'function'
        ? MonthlyUnitReport.fromSubmittedReport(r)
        : r;
    var label = (r.unitLabel || 'Unit') + ' · ' + monthName(r.reportMonth) + ' ' + (r.reportYear || '');
    if (mode === 'present' || mode === 'pptx') {
      if (!MonthlyUnitReport.presentPptSlides) {
        setAllReportsStatus('PPT presentation is unavailable. Try Bolt or PDF.');
        return;
      }
      setAllReportsStatus('');
      Promise.resolve(MonthlyUnitReport.presentPptSlides(data)).catch(function (e) {
        setAllReportsStatus((e && e.message) || 'Could not open that presentation.');
      });
      return;
    }
    if (mode === 'bolt') {
      if (!MonthlyUnitReport.presentBoltSlides) {
        setAllReportsStatus('Bolt presentation is unavailable. Try Present or PDF.');
        return;
      }
      setAllReportsStatus('');
      Promise.resolve(MonthlyUnitReport.presentBoltSlides(data)).catch(function (e) {
        setAllReportsStatus((e && e.message) || 'Could not open Bolt presentation.');
      });
      return;
    }
    if (mode === 'pptx-download') {
      if (!MonthlyUnitReport.downloadPptx) {
        setAllReportsStatus('PowerPoint download is unavailable. Try Present or PDF.');
        return;
      }
      setAllReportsStatus('Preparing PowerPoint download for ' + label + '…');
      Promise.resolve(MonthlyUnitReport.downloadPptx(data))
        .then(function () {
          setAllReportsStatus('PowerPoint downloaded for ' + label + '.');
        })
        .catch(function (e) {
          setAllReportsStatus((e && e.message) || 'Could not build PowerPoint for that report.');
        });
      return;
    }
    if (!MonthlyUnitReport.downloadPdf) {
      setAllReportsStatus('PDF export is unavailable right now.');
      return;
    }
    setAllReportsStatus('Preparing PDF for ' + label + '…');
    Promise.resolve(MonthlyUnitReport.downloadPdf(data))
      .then(function () {
        setAllReportsStatus('PDF ready for ' + label + '.');
      })
      .catch(function (e) {
        var msg = (e && e.message) || 'Could not export that report.';
        if (msg === 'popup_blocked') {
          msg = 'Allow pop-ups, then try PDF again — or use PowerPoint.';
        }
        setAllReportsStatus(msg);
      });
  }

  function reportOverviewCardHtml(r) {
    var period = monthName(r.reportMonth) + ' ' + (r.reportYear || '');
    var submitted = formatReportSubmittedAt(r.submittedAt);
    var safeId = escapeHtml(r.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    var bodyId = 'all-report-body-' + safeId;
    return (
      '<article class="rounded-2xl border border-slate-200 bg-white overflow-hidden">' +
      '<button type="button" class="btn-toggle-all-report w-full text-left px-4 py-3 flex flex-wrap items-start justify-between gap-2 hover:bg-slate-50" data-target="' +
      bodyId +
      '">' +
      '<div class="min-w-0">' +
      '<p class="font-semibold text-slate-900 text-sm">' +
      escapeHtml(r.unitLabel || 'Unit') +
      '</p>' +
      '<p class="text-xs text-slate-500 mt-0.5">' +
      escapeHtml(period) +
      (r.leaderName ? ' · ' + escapeHtml(r.leaderName) : '') +
      (submitted ? ' · submitted ' + escapeHtml(submitted) : '') +
      '</p></div>' +
      '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">Submitted</span>' +
      '</button>' +
      '<div class="px-4 pb-3 flex flex-wrap gap-2">' +
      '<button type="button" class="btn-export-all-report-bolt inline-flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold px-3 py-2 min-h-[36px]" data-report-id="' +
      escapeHtml(r.id) +
      '"><i class="fas fa-bolt"></i> Bolt</button>' +
      '<button type="button" class="btn-export-all-report-present inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-2 min-h-[36px]" data-report-id="' +
      escapeHtml(r.id) +
      '"><i class="fas fa-play"></i> Present</button>' +
      '<button type="button" class="btn-export-all-report-pdf inline-flex items-center gap-1.5 rounded-lg bg-brand hover:bg-brand-light text-white text-xs font-semibold px-3 py-2 min-h-[36px]" data-report-id="' +
      escapeHtml(r.id) +
      '"><i class="fas fa-file-pdf"></i> PDF</button>' +
      '<button type="button" class="btn-export-all-report-pptx-dl inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-900 text-xs font-semibold px-3 py-2 min-h-[36px]" data-report-id="' +
      escapeHtml(r.id) +
      '"><i class="fas fa-download"></i> PPT file</button>' +
      '<button type="button" class="btn-toggle-all-report rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold px-3 py-2 min-h-[36px]" data-target="' +
      bodyId +
      '">Details</button>' +
      '</div>' +
      '<div id="' +
      bodyId +
      '" class="hidden border-t border-slate-100 px-4 py-3 space-y-3 text-sm text-slate-700">' +
      (r.meetingsHeld !== '' && r.meetingsHeld != null
        ? '<p><span class="font-semibold text-slate-900">Meetings:</span> ' +
          escapeHtml(String(r.meetingsHeld)) +
          '</p>'
        : '') +
      (r.attendanceNarrative
        ? '<p><span class="font-semibold text-slate-900">Attendance:</span> ' +
          escapeHtml(r.attendanceNarrative) +
          '</p>'
        : '') +
      (r.meetingNotesSummary
        ? '<div><p class="font-semibold text-slate-900 mb-1">Meeting notes summary</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.meetingNotesSummary) +
          '</p></div>'
        : '') +
      (r.activities
        ? '<div><p class="font-semibold text-slate-900 mb-1">Activities</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.activities) +
          '</p></div>'
        : '') +
      (r.highlights
        ? '<div><p class="font-semibold text-slate-900 mb-1">Highlights</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.highlights) +
          '</p></div>'
        : '') +
      (r.testimonies
        ? '<div><p class="font-semibold text-slate-900 mb-1">Testimonies</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.testimonies) +
          '</p></div>'
        : '') +
      (r.challenges
        ? '<div><p class="font-semibold text-slate-900 mb-1">Challenges</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.challenges) +
          '</p></div>'
        : '') +
      (r.prayerRequests
        ? '<div><p class="font-semibold text-slate-900 mb-1">Prayer requests</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.prayerRequests) +
          '</p></div>'
        : '') +
      (r.nextMonth
        ? '<div><p class="font-semibold text-slate-900 mb-1">Next month</p><p class="whitespace-pre-wrap text-slate-600">' +
          escapeHtml(r.nextMonth) +
          '</p></div>'
        : '') +
      '</div></article>'
    );
  }

  function loadAllUnitReports() {
    var board = $('all-reports-board');
    var list = $('all-reports-list');
    var status = $('all-reports-status');
    if (!board || !list || !functions || board.classList.contains('hidden')) return;
    ensureAllReportsFilters();
    var year = parseInt(($('all-reports-year') && $('all-reports-year').value) || '', 10);
    var month = parseInt(($('all-reports-month') && $('all-reports-month').value) || '', 10);
    if (status) status.textContent = 'Loading reports…';
    list.innerHTML =
      '<p class="text-sm text-slate-500 py-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i>Loading…</p>';
    hubCallable('listNigeriaUnitReports', 60000)({
      reportYear: year || undefined,
      reportMonth: month || undefined,
    })
      .then(function (res) {
        var reports = (res.data && res.data.reports) || [];
        allUnitReportsById = {};
        reports.forEach(function (r) {
          if (r && r.id) allUnitReportsById[r.id] = r;
        });
        if (status) {
          status.textContent = reports.length
            ? reports.length +
              ' report' +
              (reports.length === 1 ? '' : 's') +
              ' found — tap Bolt or Present to open slides, or PDF / PPT file to download'
            : 'No submitted reports for this filter yet.';
        }
        if (!reports.length) {
          list.innerHTML =
            '<p class="text-sm text-slate-500 text-center py-6">No reports submitted for the selected period.</p>';
          return;
        }
        list.innerHTML = reports.map(reportOverviewCardHtml).join('');
        list.querySelectorAll('.btn-toggle-all-report').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var target = document.getElementById(btn.getAttribute('data-target'));
            if (target) target.classList.toggle('hidden');
          });
        });
        list.querySelectorAll('.btn-export-all-report-pdf').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            exportSubmittedReport(btn.getAttribute('data-report-id'), 'pdf');
          });
        });
        list.querySelectorAll('.btn-export-all-report-present').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            exportSubmittedReport(btn.getAttribute('data-report-id'), 'present');
          });
        });
        list.querySelectorAll('.btn-export-all-report-bolt').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            exportSubmittedReport(btn.getAttribute('data-report-id'), 'bolt');
          });
        });
        list.querySelectorAll('.btn-export-all-report-pptx-dl').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            exportSubmittedReport(btn.getAttribute('data-report-id'), 'pptx-download');
          });
        });
      })
      .catch(function (e) {
        var msg = (e && e.message) || 'Could not load reports.';
        if (status) status.textContent = msg;
        list.innerHTML = '<p class="text-sm text-red-600 py-4">' + escapeHtml(msg) + '</p>';
      });
  }

  function renderAllReportsBoard(data) {
    var board = $('all-reports-board');
    if (!board) return;
    var allowed = !!(data && data.canViewAllUnitReports);
    if (!allowed) {
      board.classList.add('hidden');
      return;
    }
    board.classList.remove('hidden');
    ensureAllReportsFilters();
    bindAllReportsBoardOnce();
    loadAllUnitReports();
  }

  function renderDashboard(data) {
    dashboardData = data;
    rememberHubView('dash');
    clearHubBootLoading();
    hide($('onboard-panel'));
    hide($('auth-panel'));
    hide($('not-eligible-panel'));
    hide($('btn-open-dashboard'));
    setHomepageNavVisible(true);
    setPublicLanding(false);
    show($('dash-shell'));
    showSuperUserChrome();
    renderSidebar(data);
    renderHomeTab(data);
    renderUnitsTab(data);
    renderReportsTab(data);
    renderProgramsPanel('upcoming');
    updateMyMembersTabVisibility(data);
    updateNewMembersTabVisibility(data);
    updateWorkforceTabVisibility(data);
    switchTab(activeTab);
  }

  function showOnboarding(volunteer, isSuperUser, suggestedUnits) {
    rememberHubView('dash');
    clearHubBootLoading();
    hide($('dash-shell'));
    hide($('auth-panel'));
    hide($('btn-open-dashboard'));
    setHomepageNavVisible(false);
    setPublicLanding(false);
    show($('onboard-panel'));
    var hint = $('onboard-super-hint');
    if (hint) hint.classList.toggle('hidden', !isSuperUser);
    if (volunteer && volunteer.name && $('onboard-name')) {
      $('onboard-name').value = volunteer.name;
    }
    var phoneWrap = $('onboard-phone-wrap');
    if ($('onboard-phone') && volunteer && volunteer.phone) {
      $('onboard-phone').textContent = volunteer.phone;
      if (phoneWrap) show(phoneWrap);
    } else if (phoneWrap) {
      hide(phoneWrap);
    }
    var preview = loadPreviewProfile();
    if (preview) applyUnitsToForm(normalizeProfileUnits(preview));
    else if (suggestedUnits && suggestedUnits.length) applyUnitsToForm(normalizeProfileUnits({ units: suggestedUnits }));
  }

  function showDashboardSafely(data) {
    try {
      renderDashboard(data);
      return true;
    } catch (e) {
      console.error('renderDashboard', e);
      return false;
    }
  }

  function coordinatorVolunteer() {
    return {
      name: (auth.currentUser && auth.currentUser.displayName) || 'Coordinator',
      email: (auth.currentUser && auth.currentUser.email) || '',
      phone: 'Coordinator preview',
    };
  }

  function showSuperUserLanding() {
    showOnboarding(coordinatorVolunteer(), true);
    return loadLocalNigeriaProfile().then(function (snap) {
      if (snap.exists && isProfileComplete(snap.data())) {
        return loadDashboard();
      }
    });
  }

  function processDashboardResponse(data) {
    if (!data || data.eligible === false) {
      if (isClientSuperUser()) {
        showOnboarding(coordinatorVolunteer(), true);
        return;
      }
      showNotEligible(data && data.message);
      return;
    }
    if (!data.hasProfile || !isProfileComplete(data.profile)) {
      showOnboarding(
        data.volunteer || coordinatorVolunteer(),
        data.isSuperUser || isClientSuperUser(),
        data.suggestedUnits
      );
      return;
    }
    if ((!data.unitContexts || !data.unitContexts.length) && data.profile) {
      data = buildLocalDashboard(data.profile, data.isSuperUser || isClientSuperUser());
    }
    showDashboardSafely(data);
  }

  function loadLocalNigeriaProfile() {
    return db.collection('nigeria_volunteers').doc(auth.currentUser.uid).get();
  }

  function loadDashboard(opts) {
    opts = opts || {};
    var keepStatus = opts.preserveStatus === true;
    return hubCallable('getNigeriaDashboard', 60000)()
      .then(function (res) {
        processDashboardResponse(res.data);
      })
      .catch(function (err) {
        console.error('getNigeriaDashboard', err);
        var msg = (err && err.message) || 'Could not load dashboard.';
        if (/deadline|timeout/i.test(msg)) {
          msg = 'Dashboard is taking too long. Pull to refresh or try again in a moment.';
        }
        if (!keepStatus) setStatus(msg, 'error');
        if (auth && auth.currentUser && !keepStatus) {
          setAuthPanelStatus(msg + ' Sign out and sign in again if this keeps happening.', 'error');
        }
        if (isClientSuperUser()) {
          var preview = loadPreviewProfile();
          if (preview && isProfileComplete(preview)) {
            if (!keepStatus) {
              setStatus('Using offline preview — some features need a saved profile.', 'info');
            }
            showDashboardSafely(buildLocalDashboard(preview, true));
            return;
          }
          return loadLocalNigeriaProfile().then(function (snap) {
            if (snap.exists && isProfileComplete(snap.data())) {
              if (!keepStatus) {
                setStatus('Using saved profile — reloading server data failed.', 'info');
              }
              showDashboardSafely(buildLocalDashboard(snap.data(), true));
            } else if (!keepStatus) {
              showOnboarding(coordinatorVolunteer(), true);
              setStatus(msg, 'error');
            }
          });
        }
        if (!keepStatus) setStatus(msg, 'error');
      });
  }

  function buildSavedProfile(name, units) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      name: name,
      phone: isClientSuperUser() ? 'Coordinator preview' : '',
      units: units,
      unitIds: units.map(function (u) {
        return u.unitId;
      }),
      unitId: units[0].unitId,
      unitLabel: units[0].unitLabel,
      role: units[0].role,
      region: 'nigeria',
      isSuperUser: isClientSuperUser(),
      photoURL: (dashboardData && dashboardData.profile && dashboardData.profile.photoURL) || '',
    };
  }

  function finishProfileSave(profile) {
    profileSaveInFlight = true;
    savePreviewProfile(profile);
    setStatus('Profile saved!', 'success');
    writeProfileToFirestore(profile)
      .then(function () {
        softReloadDashboard();
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Profile saved locally; sync failed.', 'error');
        showDashboardSafely(buildLocalDashboard(profile, isClientSuperUser()));
      })
      .finally(function () {
        profileSaveInFlight = false;
      });
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
    if (!auth.currentUser) {
      setStatus('Sign in on prayercityhtx.com first.', 'error');
      return;
    }
    var name = ($('onboard-name') && $('onboard-name').value || '').trim();
    var units = collectUnitsFromForm();
    if (!name) {
      setStatus('Enter your name.', 'error');
      return;
    }
    if (!units.length) {
      setStatus('Select at least one unit.', 'error');
      return;
    }
    setStatus('Saving…', 'info');
    var profile = buildSavedProfile(name, units);
    var payload = { name: name, units: units };
    var saveBtn = $('btn-save-profile');
    if (saveBtn) saveBtn.disabled = true;

    if (isClientSuperUser()) {
      profileSaveInFlight = true;
      savePreviewProfile(profile);
      writeProfileToFirestore(profile)
        .then(function () {
          return hubCallable('saveNigeriaProfile', 45000)(payload);
        })
        .then(function () {
          setStatus('Profile saved!', 'success');
          softReloadDashboard();
        })
        .catch(function (err) {
          setStatus((err && err.message) || 'Could not save.', 'error');
        })
        .finally(function () {
          profileSaveInFlight = false;
          if (saveBtn) saveBtn.disabled = false;
        });
      return;
    }

    hubCallable('saveNigeriaProfile', 45000)(payload)
      .then(function () {
        finishProfileSave(profile);
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Could not save.', 'error');
      })
      .finally(function () {
        if (saveBtn) saveBtn.disabled = false;
      });
  }

  function markCheckInButtonSuccess(btn, already) {
    if (!btn) return;
    btn.disabled = true;
    btn.setAttribute('data-checked-in', '1');
    btn.className =
      'btn-unit-checkin w-full rounded-xl py-3 font-semibold text-white bg-emerald-600 cursor-default';
    btn.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Checked in';
    var hint = btn.nextElementSibling;
    if (hint && hint.tagName === 'P') {
      hint.className = 'text-xs text-emerald-700 mt-2 text-center font-medium';
      hint.textContent = already
        ? 'Already checked in for this meeting.'
        : 'You’re checked in for this meeting.';
    }
  }

  function checkIn(unitId, btn) {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Recording…';
    }
    setStatus('Recording attendance…', 'info');
    hubCallable('recordNigeriaAttendance', 45000)({ unitId: unitId })
      .then(function (res) {
        var already = !!(res.data && res.data.alreadyCheckedIn);
        var msg = already ? 'Already checked in.' : 'Attendance recorded!';
        setStatus(msg, 'success');
        markCheckInButtonSuccess(btn, already);
        if (dashboardData && dashboardData.unitContexts) {
          dashboardData.unitContexts.forEach(function (c) {
            if (c.unitId === unitId) c.alreadyCheckedIn = true;
          });
        }
        softReloadDashboard();
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'Check-in failed.';
        if (/deadline|timeout/i.test(msg)) {
          msg = 'Check-in timed out. If you’re already checked in, refresh — otherwise try again.';
        }
        setStatus(msg, 'error');
        if (btn && btn.getAttribute('data-checked-in') !== '1') {
          btn.disabled = false;
          btn.textContent = 'Check in';
        }
      });
  }

  function uploadSidebarPhoto(file) {
    if (!isLikelyImageFile(file)) return;
    if (file.size > 3 * 1024 * 1024) {
      if ($('sidebar-upload-status')) $('sidebar-upload-status').textContent = 'Max 3 MB.';
      return;
    }
    var user = auth.currentUser;
    if (!user) return;
    var status = $('sidebar-upload-status');
    if (status) status.textContent = 'Uploading…';
    var path = 'volunteer_photos/' + user.uid + '/avatar.jpg';
    storage
      .ref(path)
      .put(file, { contentType: imageUploadContentType(file) })
      .then(function () {
        return storage.ref(path).getDownloadURL();
      })
      .then(function (url) {
        return db.collection('nigeria_volunteers').doc(user.uid).set({ photoURL: url }, { merge: true });
      })
      .then(function () {
        if (status) status.textContent = 'Photo saved.';
        if (dashboardData && dashboardData.profile) {
          dashboardData.profile.photoURL = url;
          setSidebarAvatar(dashboardData.profile.name, url);
        }
      })
      .catch(function (e) {
        if (status) status.textContent = (e && e.message) || 'Upload failed.';
      });
  }

  function showNotEligible(message) {
    if (isClientSuperUser()) {
      showOnboarding(coordinatorVolunteer(), true);
      setStatus(message || 'Complete coordinator preview profile to continue.', 'info');
      return;
    }
    hide($('dash-shell'));
    setPublicLanding(true);
    show($('not-eligible-panel'));
    if ($('not-eligible-msg')) $('not-eligible-msg').textContent = message || '';
  }

  function completeEmailLinkIfNeeded() {
    if (!firebase.auth().isSignInWithEmailLink(window.location.href)) {
      return Promise.resolve(false);
    }
    var email = window.localStorage.getItem('emailForSignIn');
    if (!email) {
      email = window.prompt('Confirm the email address that received the sign-in link:');
    }
    if (!email) {
      setAuthPanelStatus('Enter the same email the link was sent to, then open the link again.', 'error');
      showAuthPanel(true);
      return Promise.resolve(false);
    }
    setAuthPanelStatus('Completing sign-in…', 'info');
    showAuthPanel(false);
    return auth
      .signInWithEmailLink(email, window.location.href)
      .then(function () {
        window.localStorage.removeItem('emailForSignIn');
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthPanelStatus('Signed in — loading your hub…', 'success');
        return true;
      })
      .catch(function (e) {
        var msg = (e && e.message) || 'Sign-in link failed.';
        if (e && (e.code === 'auth/invalid-action-code' || e.code === 'auth/expired-action-code')) {
          msg = 'This sign-in link is expired or already used. Request a new one below.';
        }
        setAuthPanelStatus(msg, 'error');
        showAuthPanel(true);
        return false;
      });
  }

  function handleAuthUser(user) {
    hide($('auth-checking'));
    var forceLanding = /[?&]landing=1(?:&|$)/.test(window.location.search || '');
    if (user && forceLanding) {
      if ($('btn-signout')) $('btn-signout').classList.remove('hidden');
      if ($('btn-open-dashboard')) $('btn-open-dashboard').classList.remove('hidden');
      setHomepageNavVisible(false);
      hide($('dash-shell'));
      hide($('onboard-panel'));
      hide($('auth-panel'));
      hide($('not-eligible-panel'));
      rememberHubView('landing');
      clearHubBootLoading();
      setPublicLanding(true);
      return;
    }
    if (user) {
      clearAuthPanelOpen();
      setAuthPanelStatus('', '');
      if ($('btn-signout')) $('btn-signout').classList.remove('hidden');
      if ($('btn-open-dashboard')) hide($('btn-open-dashboard'));
      hide($('auth-panel'));
      if (profileSaveInFlight) return;
      rememberHubView('dash');
      loadDashboard();
      return;
    }
    hide($('btn-signout'));
    if ($('btn-open-dashboard')) hide($('btn-open-dashboard'));
    setHomepageNavVisible(false);
    hide($('dash-shell'));
    hide($('onboard-panel'));
    rememberHubView('landing');
    clearHubBootLoading();
    setPublicLanding(true);
    if (wantsAuthPanelVisible()) {
      show($('auth-panel'));
    } else {
      hide($('auth-panel'));
    }
    try {
      sessionStorage.removeItem(PREVIEW_PROFILE_KEY);
    } catch (e) {}
  }

  function bind() {
    renderUnitOptions();
    var hashTab = (window.location.hash || '').replace('#', '');
    if (['home', 'programs', 'units', 'my-members', 'new-members', 'kingdom-workforce', 'reports'].indexOf(hashTab) >= 0) {
      activeTab = hashTab;
    }
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });
    if ($('btn-save-profile')) $('btn-save-profile').addEventListener('click', saveProfile);
    if ($('btn-email-link')) $('btn-email-link').addEventListener('click', sendEmailLink);
    if ($('auth-form')) {
      $('auth-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = String(($('auth-password') && $('auth-password').value) || '').trim();
        if (pw) {
          signInPassword();
        } else {
          sendEmailLink();
        }
      });
    } else if ($('btn-password-signin')) {
      $('btn-password-signin').addEventListener('click', signInPassword);
    }
    if ($('btn-signout')) $('btn-signout').addEventListener('click', function () {
      rememberHubView('landing');
      auth.signOut();
    });
    if ($('btn-view-public-homepage')) {
      $('btn-view-public-homepage').addEventListener('click', function (e) {
        e.preventDefault();
        goToPublicHomepage();
      });
    }
    if ($('btn-open-dashboard')) {
      $('btn-open-dashboard').addEventListener('click', goToDashboardFromLanding);
    }
    if ($('btn-edit-profile')) {
      $('btn-edit-profile').addEventListener('click', function () {
        hide($('dash-shell'));
        var p = dashboardData && dashboardData.profile;
        showOnboarding(p || coordinatorVolunteer(), isClientSuperUser());
        if (p) {
          if ($('onboard-name')) $('onboard-name').value = p.name || '';
          applyUnitsToForm(normalizeProfileUnits(p));
        }
      });
    }
    if ($('btn-open-password-modal')) {
      $('btn-open-password-modal').addEventListener('click', openPasswordModal);
    }
    if ($('btn-close-ng-password-modal')) {
      $('btn-close-ng-password-modal').addEventListener('click', closePasswordModal);
    }
    if ($('ng-password-modal-backdrop')) {
      $('ng-password-modal-backdrop').addEventListener('click', closePasswordModal);
    }
    if ($('btn-ng-save-password')) {
      $('btn-ng-save-password').addEventListener('click', saveLinkedPassword);
    }
    if ($('btn-ng-password-reset-email')) {
      $('btn-ng-password-reset-email').addEventListener('click', function () {
        var user = auth && auth.currentUser;
        var email = (user && user.email) || '';
        if (!email) {
          setPassStatus('Sign in first.', 'error');
          return;
        }
        setPassStatus('Sending password reset link…', 'info');
        sendPasswordResetLink(email)
          .then(function () {
            setPassStatus(
              'Check your inbox (and spam) for the reset link. Open it, choose a new password, then sign in here with email + password.',
              'success'
            );
          })
          .catch(function (e) {
            setPassStatus((e && e.message) || 'Could not send reset link.', 'error');
          });
      });
    }
    if ($('btn-forgot-password')) {
      $('btn-forgot-password').addEventListener('click', function () {
        var email = ($('auth-email') && $('auth-email').value || '').trim();
        if (!email) {
          setAuthPanelStatus('Enter your email first, then tap Forgot password.', 'error');
          return;
        }
        setAuthPanelStatus('Sending password reset link…', 'info');
        sendPasswordResetLink(email)
          .then(function () {
            setAuthPanelStatus(
              'Password reset link sent. Check inbox/spam, set a new password, then sign in with email + password.',
              'success'
            );
          })
          .catch(function (e) {
            setAuthPanelStatus((e && e.message) || 'Could not send reset link.', 'error');
          });
      });
    }
    if ($('sidebar-avatar-input')) {
      $('sidebar-avatar-input').addEventListener('change', function (ev) {
        var f = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (f) uploadSidebarPhoto(f);
      });
    }
    if ($('ng-signup-form')) {
      $('ng-signup-form').addEventListener('submit', submitMemberSignup);
    }
    if ($('ng-workforce-form')) {
      $('ng-workforce-form').addEventListener('submit', submitWorkforceSignup);
    }
    completeEmailLinkIfNeeded().finally(function () {
      var ready = auth.authStateReady ? auth.authStateReady() : Promise.resolve();
      ready.finally(function () {
        auth.onAuthStateChanged(handleAuthUser);
      });
    });
  }

  function sendEmailLink() {
    if (!auth) {
      setAuthPanelStatus('Sign-in is still loading. Please wait a moment and try again.', 'error');
      return;
    }
    var email = ($('auth-email') && $('auth-email').value || '').trim();
    if (!email) {
      setAuthPanelStatus('Enter your email first.', 'error');
      return;
    }
    setAuthPanelStatus('Sending link…', 'info');
    var sendPromise = SELF_SERVE_SIGNIN_URL
      ? sendSignInLinkViaAppsScript(email)
      : sendSignInLinkViaFirebaseClient(email);
    sendPromise
      .catch(function (e) {
        if (SELF_SERVE_SIGNIN_URL) {
          return sendSignInLinkViaFirebaseClient(email);
        }
        throw e;
      })
      .catch(function (e) {
        setAuthPanelStatus((e && e.message) || 'Could not send link.', 'error');
      });
  }

  function signInPassword() {
    if (!auth) {
      setAuthPanelStatus('Sign-in is still loading. Please wait a moment and try again.', 'error');
      return;
    }
    var email = ($('auth-email') && $('auth-email').value || '').trim();
    var pw = String(($('auth-password') && $('auth-password').value) || '').trim();
    if (!email || !pw) {
      setAuthPanelStatus('Enter email and password.', 'error');
      return;
    }
    var btn = $('btn-password-signin');
    if (btn) btn.disabled = true;
    setAuthPanelStatus('Signing in…', 'info');
    auth
      .signInWithEmailAndPassword(email, pw)
      .then(function () {
        setAuthPanelStatus('Signed in — loading your hub…', 'success');
      })
      .catch(function (e) {
        setAuthPanelStatus(friendlyPasswordSignInError(e), 'error');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  window.NigeriaDashboard = {
    openAuthPanel: showAuthPanel,
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (window.PrayerCityRouting && PrayerCityRouting.markStayOnNigeriaHub) {
      PrayerCityRouting.markStayOnNigeriaHub();
    }
    initFirebase().then(function (ok) {
      if (!ok) return;
      bind();
      if (wantsAuthPanelVisible() && !auth.currentUser) {
        showAuthPanel(false);
      }
    });
  });
})();
