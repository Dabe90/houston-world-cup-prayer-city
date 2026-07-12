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
  var EMAIL_LINK_CONTINUE_URL = 'https://prayercityhtx.com/ddbs-nig.html';
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
        banner.innerHTML =
          '<p class="font-semibold">Sign-in could not load on this network.</p>' +
          '<p class="mt-2 text-amber-800/90">Please try again on mobile data or another Wi‑Fi, or open <a class="underline font-medium" href="https://prayercityhtx.com/ddbs-nig.html">prayercityhtx.com/ddbs-nig.html</a> directly. If it keeps failing, message us on Instagram <a href="https://www.instagram.com/deardaughter_bs" class="underline font-medium">@deardaughter_bs</a>.</p>';
      }
      return Promise.resolve(false);
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    functions = firebase.app().functions('us-central1');
    if (window.DDBSNigeriaMeetingNotes) {
      DDBSNigeriaMeetingNotes.init({ auth: auth, db: db });
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
    var viewerUnits = { 'welcome-hospitality': true, 'growth-retention': true };
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
    var leaderUnitIds = normalizeProfileUnits(profile)
      .filter(function (u) {
        return u.role === 'leader';
      })
      .map(function (u) {
        return u.unitId;
      });
    if (canApprove) {
      return { canView: true, canApprove: true, leaderUnitIds: null };
    }
    if (leaderUnitIds.length) {
      return { canView: true, canApprove: false, leaderUnitIds: leaderUnitIds };
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
    return NigeriaUnits.meetingsForNotes(unit, 8);
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
    functions
      .httpsCallable('getNigeriaMemberSignups')()
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
    return (data && data.unitContexts ? data.unitContexts : []).filter(function (c) {
      return c.isLeaderView === true || c.role === 'leader' || data.isSuperUser === true;
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
    functions
      .httpsCallable('getNigeriaWorkforceSignups')()
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
    functions
      .httpsCallable('markNigeriaWorkforceInTraining')({ signupId: signupId })
      .then(function () {
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
    functions
      .httpsCallable('approveNigeriaWorkforceSignup')({ signupId: signupId })
      .then(function () {
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
    functions
      .httpsCallable('submitNigeriaWorkforceSignup')({
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
    if (btn) btn.disabled = true;
    if (status) {
      status.textContent = 'Submitting…';
      status.className = 'text-sm rounded-xl px-3 py-2 border border-sky-200 bg-sky-50 text-sky-900';
      status.classList.remove('hidden');
    }
    functions
      .httpsCallable('submitNigeriaMemberSignup')({
        name: name,
        email: email,
        phone: phone,
        city: city,
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
    return 'You were absent — you did not check in for this meeting.';
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
    return 'You were absent — you did not check in for this meeting.';
  }

  function absencePanelHtml(c) {
    var target = c.absenceTargetMeeting;
    if (!target) return '';
    var quotas = c.absenceQuotas || {};
    var existing = c.absenceRequest;
    if (existing && existing.status === 'approved') {
      return (
        '<div class="absence-panel mt-3 rounded-xl border border-violet-100 bg-violet-50/70 p-3">' +
        '<p class="text-xs font-bold text-violet-900"><i class="fas fa-calendar-xmark mr-1"></i>Absence approved for ' +
        escapeHtml(target.dateYmd) +
        '</p>' +
        '<p class="text-xs text-violet-800 mt-1">' +
        escapeHtml(existing.type === 'emergency' ? 'Emergency' : 'Planned') +
        ' request — ' +
        escapeHtml(existing.reason || '') +
        '</p></div>'
      );
    }
    var remaining = quotas.remaining != null ? quotas.remaining : 2;
    var emergencyNote = quotas.emergencyAvailable
      ? 'Emergency slot available (resets every 12 weeks).'
      : 'Emergency slot used — resets ' +
        (quotas.emergencyResetsAt
          ? new Date(quotas.emergencyResetsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : 'in 12 weeks') +
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
        '<div class="absence-panel mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">' +
        '<p class="text-xs font-semibold text-slate-700">Absence requests</p>' +
        '<p class="text-xs text-slate-500 mt-1">' +
        (remaining <= 0
          ? 'You have used both requests allowed in the last 8 weeks for this unit.'
          : 'Planned requests open 2+ days before the meeting. Emergency requests open 15 minutes before until the meeting ends.') +
        '</p>' +
        '<p class="text-xs text-slate-500 mt-1">' +
        escapeHtml(emergencyNote) +
        '</p></div>'
      );
    }
    return (
      '<div class="absence-panel mt-3 rounded-xl border border-violet-100 bg-violet-50/50 p-3" data-unit-id="' +
      escapeHtml(c.unitId) +
      '" data-meeting-key="' +
      escapeHtml(target.key) +
      '">' +
      '<p class="text-xs font-bold text-violet-900 mb-1"><i class="fas fa-calendar-xmark mr-1"></i>Request absence — ' +
      escapeHtml(target.dateYmd) +
      '</p>' +
      '<p class="text-[11px] text-violet-800/90 mb-2">' +
      remaining +
      ' of ' +
      (quotas.maxRequests || 2) +
      ' requests left (8 weeks). ' +
      escapeHtml(emergencyNote) +
      '</p>' +
      (!c.canRequestEmergency && quotas.emergencyAvailable
        ? '<p class="text-[11px] text-violet-700/80 mb-2">Need an emergency absence? The <strong>Emergency</strong> option appears here from 15 minutes before the meeting until it ends.</p>'
        : '') +
      '<select class="absence-type w-full rounded-lg border border-violet-200 px-2 py-1.5 text-xs mb-2 bg-white">' +
      typeOptions +
      '</select>' +
      '<textarea class="absence-reason w-full rounded-lg border border-violet-200 px-2 py-1.5 text-xs min-h-[72px] mb-2" placeholder="Brief reason (required)"></textarea>' +
      '<button type="button" class="btn-submit-absence text-xs font-semibold rounded-lg bg-violet-700 text-white px-3 py-2 hover:bg-violet-800">Submit absence request</button>' +
      '<span class="absence-status text-xs text-slate-500 ml-2"></span></div>'
    );
  }

  function bindAbsencePanels(wrap) {
    if (!wrap || !functions) return;
    wrap.querySelectorAll('.btn-submit-absence').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.closest('.absence-panel');
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
        functions
          .httpsCallable('submitNigeriaAbsenceRequest')({
            unitId: unitId,
            meetingKey: meetingKey,
            type: type,
            reason: reason,
          })
          .then(function () {
            if (statusEl) statusEl.textContent = 'Approved.';
            setStatus('Absence request saved.', 'success');
            return loadDashboard();
          })
          .catch(function (err) {
            if (statusEl) statusEl.textContent = (err && err.message) || 'Failed.';
            setStatus((err && err.message) || 'Absence request failed.', 'error');
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

  function visionPanelHtml(c) {
    var vision = c.unitVision;
    var canEdit = c.canEditVision;
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
        '<div class="rounded-2xl border border-slate-200 bg-white p-4">' +
        visionPlanCardsHtml(vision.plan, { canTrack: false }) +
        '</div></div>'
      );
    }
    var initialCards = vision && vision.plan ? visionPlanCardsHtml(vision.plan, { canTrack: true }) : '';
    var initialReadable = (vision && vision.plan && planToEditableText(vision.plan)) || '';
    var planPayload = '';
    try {
      planPayload = vision && vision.plan ? encodeURIComponent(JSON.stringify(vision.plan)) : '';
    } catch (ignore) {}
    return (
      '<div class="unit-vision mt-5 border-t border-slate-100 pt-4" data-unit-id="' +
      escapeHtml(c.unitId) +
      '"' +
      (planPayload ? ' data-live-plan="' + planPayload + '"' : '') +
      '>' +
      '<h4 class="text-sm font-bold text-slate-900 mb-1"><i class="fas fa-star text-brand mr-1"></i>My Vision Board</h4>' +
      '<p class="text-xs text-slate-500 mb-3">Write where your unit is headed in the next 3 months. After you share the plan, use the progress bench to mark each milestone as not started, in progress, or done — so the team can see the vision being achieved.</p>' +
      '<div class="grid gap-4 lg:grid-cols-2">' +
      '<div>' +
      '<label class="block text-xs font-semibold text-slate-600 mb-1">Your vision</label>' +
      '<textarea class="vision-text w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[140px] focus:ring-2 focus:ring-ng-green outline-none" placeholder="Our unit will\u2026">' +
      escapeHtml((vision && vision.visionText) || '') +
      '</textarea>' +
      '<div class="flex flex-wrap gap-2 mt-2">' +
      '<button type="button" class="btn-generate-vision text-xs font-semibold rounded-lg bg-brand text-white px-3 py-2 hover:bg-brand-light"><i class="fas fa-wand-magic-sparkles mr-1"></i>Create my plan</button>' +
      '</div>' +
      '<p class="vision-status text-xs text-slate-500 mt-2"></p>' +
      '</div>' +
      '<div>' +
      '<div class="flex items-center justify-between mb-1">' +
      '<label class="block text-xs font-semibold text-slate-600">Your plan</label>' +
      '<div class="flex items-center gap-1">' +
      '<button type="button" class="btn-edit-vision text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-600 px-2 py-1 hover:bg-slate-50" title="Edit plan"><i class="fas fa-pen mr-1"></i>Edit</button>' +
      '<button type="button" class="btn-save-plan hidden text-[11px] font-semibold rounded-lg bg-ng-green text-white px-2 py-1 hover:bg-emerald-700" title="Save edits"><i class="fas fa-check mr-1"></i>Save</button>' +
      '</div>' +
      '</div>' +
      '<div class="vision-plan-view rounded-2xl border border-slate-200 bg-slate-50/70 p-4">' +
      initialCards +
      '</div>' +
      '<textarea class="vision-plan hidden w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm min-h-[240px] focus:ring-2 focus:ring-ng-green outline-none">' +
      escapeHtml(initialReadable) +
      '</textarea>' +
      '<p class="text-[11px] text-slate-400 mt-1">Tap a milestone status to update the progress bench. Tap <strong>Edit</strong> only when you need to change the plan wording.</p>' +
      '<button type="button" class="btn-share-vision mt-2 w-full text-xs font-semibold rounded-lg bg-ng-green text-white px-3 py-2.5 hover:bg-emerald-700"><i class="fas fa-share-nodes mr-1"></i>Share with team</button>' +
      '</div>' +
      '</div></div>'
    );
  }

  function lastMeetingDigestHtml(c, uid) {
    var digest = c.lastMeetingDigest;
    if (!digest) return '';
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
      var savePlanBtn = panel.querySelector('.btn-save-plan');
      var shareBtn = panel.querySelector('.btn-share-vision');
      var statusEl = panel.querySelector('.vision-status');
      var visionTextEl = panel.querySelector('.vision-text');
      var planEl = panel.querySelector('.vision-plan');
      var viewEl = panel.querySelector('.vision-plan-view');
      var livePlan = readableToPlan(planEl ? planEl.value : '');
      try {
        var packed = panel.getAttribute('data-live-plan');
        if (packed) {
          var parsed = JSON.parse(decodeURIComponent(packed));
          if (parsed && typeof parsed === 'object') livePlan = parsed;
        }
      } catch (ignore) {}

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
              return functions.httpsCallable('updateNigeriaVisionProgress')({
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
              return functions
                .httpsCallable('saveNigeriaUnitVision')({
                  unitId: unitId,
                  visionText: visionText,
                  plan: livePlan,
                })
                .then(function () {
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

      bindProgressButtons();

      if (genBtn) {
        genBtn.addEventListener('click', function () {
          var visionText = visionTextEl ? visionTextEl.value.trim() : '';
          if (visionText.length < 20) {
            if (statusEl) statusEl.textContent = 'Write at least a short vision first.';
            return;
          }
          if (statusEl) statusEl.textContent = 'Creating your plan…';
          genBtn.disabled = true;
          functions
            .httpsCallable('generateNigeriaUnitVision')({ unitId: unitId, visionText: visionText })
            .then(function (res) {
              if (planEl && res.data && res.data.plan) {
                livePlan = res.data.plan;
                planEl.value = planToEditableText(livePlan);
                renderView();
              }
              if (statusEl) {
                statusEl.textContent =
                  'Your plan is ready — review it, Share with team, then mark milestones on the progress bench.';
              }
            })
            .catch(function (err) {
              if (statusEl) statusEl.textContent = (err && err.message) || 'Could not create a plan. Please try again.';
            })
            .finally(function () {
              genBtn.disabled = false;
            });
        });
      }

      if (editBtn) {
        editBtn.addEventListener('click', function () {
          setEditMode(true);
          if (statusEl) statusEl.textContent = 'Editing — make your changes, then tap Save.';
        });
      }
      if (savePlanBtn) {
        savePlanBtn.addEventListener('click', function () {
          setEditMode(false);
          if (statusEl) statusEl.textContent = 'Edits saved. Tap Share with team to publish.';
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
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
          if (!plan.milestones.length && !plan.roadmap.length) {
            if (statusEl) statusEl.textContent = 'Create your plan first.';
            return;
          }
          if (statusEl) statusEl.textContent = 'Sharing…';
          shareBtn.disabled = true;
          functions
            .httpsCallable('saveNigeriaUnitVision')({ unitId: unitId, visionText: visionText, plan: plan })
            .then(function () {
              livePlan = plan;
              if (statusEl) statusEl.textContent = 'Shared — mark milestones on the progress bench as work moves forward.';
              return loadDashboard();
            })
            .catch(function (err) {
              if (statusEl) statusEl.textContent = (err && err.message) || 'Could not share. Please try again.';
            })
            .finally(function () {
              shareBtn.disabled = false;
            });
        });
      }
    });
  }

  function renderHomeTab(data) {
    var warnWrap = $('home-attendance-warnings');
    if (warnWrap) {
      var warnings = (data.unitContexts || [])
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
    var up = $('home-upcoming-programs');
    var meetings = $('home-meetings-list');
    if (up && window.DDBSNigeriaPrograms) {
      var events = DDBSNigeriaPrograms.featuredTiles();
      up.innerHTML = events.length
        ? events.map(programTileHtml).join('')
        : '<p class="text-sm text-slate-500">No programs scheduled.</p>';
    }
    if (meetings) {
      var ctx = data.unitContexts || [];
      meetings.innerHTML = ctx.length
        ? ctx
            .map(function (c) {
              var sched = unitScheduleLabel(c);
              var next = c.nextMeeting
                ? c.nextMeeting.dateYmd + ' · in ' + formatCountdown(c.nextMeeting.startIso)
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
    return '<span class="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-700">On track</span>';
  }

  function rosterManageControls(c, m, isSuperUser) {
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

  function teamRosterHtml(c, isSuperUser) {
    if (!c.isLeaderView || !c.teamRoster || !c.teamRoster.length) return '';
    var roster = c.teamRoster;
    var atRisk = roster.filter(function (m) {
      return m.tier && m.tier !== 'ok';
    });
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
          '<p class="text-[11px] text-slate-500 mt-0.5">' +
          escapeHtml(String(m.missed || 0)) +
          ' missed · ' +
          escapeHtml(String(m.late || 0)) +
          ' late · last 8 wks</p>' +
          (m.phone ? '<p class="text-[11px] text-slate-500">' + escapeHtml(m.phone) + '</p>' : '') +
          (m.tier === 'withdrawal'
            ? '<p class="text-[11px] text-red-700 font-medium mt-1"><i class="fas fa-triangle-exclamation mr-1"></i>Withdrawal reached — you may remove them from the WhatsApp group.</p>'
            : '') +
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
        : '<div class="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800 mb-2">Everyone is on track. 🎉</div>';

    return (
      '<div class="team-roster mt-1">' +
      '<div class="flex items-center justify-between mb-1">' +
      '<h4 class="text-sm font-bold text-slate-900"><i class="fas fa-users text-brand mr-1"></i>Team roster</h4>' +
      '<span class="text-[11px] text-slate-500">' +
      roster.length +
      ' member' +
      (roster.length === 1 ? '' : 's') +
      '</span>' +
      '</div>' +
      '<p class="text-xs text-slate-500 mb-2">Attendance warnings apply only to this unit. Drop someone here if they should leave this unit only — their other units stay unchanged.</p>' +
      summary +
      '<div class="space-y-2">' +
      rows +
      '</div></div>'
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
    list.innerHTML = leaders
      .map(function (c, i) {
        var rosterBlock = teamRosterHtml(c, data.isSuperUser === true);
        if (!rosterBlock) {
          rosterBlock =
            '<p class="text-xs text-slate-500">No members listed for this unit yet.</p>';
        }
        var openAttr = leaders.length === 1 || i === 0 ? ' open' : '';
        return (
          '<details class="my-members-unit rounded-2xl border border-slate-200 bg-white overflow-hidden"' +
          openAttr +
          '>' +
          '<summary class="cursor-pointer list-none px-4 py-3 flex items-center gap-2 bg-slate-50/80 hover:bg-slate-50">' +
          '<i class="fas fa-chevron-right my-members-chevron text-slate-400 text-xs"></i>' +
          '<span class="font-semibold text-slate-900 flex-1">' +
          escapeHtml(c.unitLabel) +
          '</span>' +
          '<span class="text-[11px] text-slate-500">' +
          ((c.teamRoster && c.teamRoster.length) || 0) +
          ' members</span></summary>' +
          '<div class="p-4 border-t border-slate-100">' +
          rosterBlock +
          '</div></details>'
        );
      })
      .join('');
    bindRosterManage(list);
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
        functions
          .httpsCallable('setNigeriaMemberRole')({ unitId: unitId, targetUid: targetUid, role: action })
          .then(function () {
            return loadDashboard();
          })
          .catch(function (err) {
            window.alert((err && err.message) || 'Could not update the member.');
            btn.disabled = false;
          });
      });
    });
  }

  function renderUnitsTab(data) {
    var wrap = $('units-cards');
    if (!wrap) return;
    if (window.DDBSNigeriaMeetingNotes) DDBSNigeriaMeetingNotes.detachAll();
    var ctx = data.unitContexts || [];
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
        var body =
          missWarn +
          '<p class="text-sm text-slate-600 mb-1">' +
          sched +
          '</p>' +
          (meeting.dateYmd
            ? '<p class="text-xs text-brand font-medium mb-3">Next meeting: ' +
              meeting.dateYmd +
              (meeting.startIso ? ' · in ' + formatCountdown(meeting.startIso) : '') +
              '</p>'
            : '') +
          '<button type="button" class="btn-unit-checkin w-full rounded-xl py-3 font-semibold text-white ' +
          (open ? 'bg-ng-green hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed') +
          '" data-unit-id="' +
          c.unitId +
          '" ' +
          (open ? '' : 'disabled') +
          '>Check in</button>' +
          '<p class="text-xs text-slate-500 mt-2 text-center">Opens 15 min before · closes 10 min after</p>' +
          absencePanelHtml(c) +
          lastMeetingDigestHtml(c, uid) +
          leaderHint +
          visionPanelHtml(c) +
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
            '<summary class="unit-card-summary cursor-pointer list-none px-5 py-4 flex flex-wrap items-center gap-2 hover:bg-slate-50/80">' +
            '<i class="fas fa-chevron-right unit-card-chevron text-slate-400 text-xs"></i>' +
            '<h3 class="font-bold text-slate-900 flex-1">' +
            escapeHtml(c.unitLabel) +
            '</h3>' +
            roleBadge +
            '</summary>' +
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
      btn.addEventListener('click', function () {
        checkIn(btn.getAttribute('data-unit-id'));
      });
    });
    wrap.querySelectorAll('.btn-goto-my-members').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab('my-members');
      });
    });

    bindVisionPanels(wrap);
    bindAbsencePanels(wrap);

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
          DDBSNigeriaMeetingNotes.attach(notesRoot, {
            unitId: c.unitId,
            unitLabel: c.unitLabel,
            meetingKey: meetingKey,
            meetingDateYmd: meeting.dateYmd || '',
            profileName: profileName,
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
        },
        {
          db: db,
          functions: functions,
        }
      );
    } else {
      NigeriaDashboardReport.refresh(
        {
          profile: data.profile,
          unitContexts: data.unitContexts,
          authUser: auth.currentUser,
          isSuperUser: data.isSuperUser || isClientSuperUser(),
        },
        {
          db: db,
          functions: functions,
        }
      );
    }
  }

  function renderDashboard(data) {
    dashboardData = data;
    hide($('onboard-panel'));
    hide($('auth-panel'));
    hide($('not-eligible-panel'));
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

  function showOnboarding(volunteer, isSuperUser) {
    hide($('dash-shell'));
    hide($('auth-panel'));
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
      showOnboarding(data.volunteer || coordinatorVolunteer(), data.isSuperUser || isClientSuperUser());
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

  function loadDashboard() {
    return functions
      .httpsCallable('getNigeriaDashboard')()
      .then(function (res) {
        processDashboardResponse(res.data);
      })
      .catch(function (err) {
        console.error('getNigeriaDashboard', err);
        var msg = (err && err.message) || 'Could not load dashboard.';
        setStatus(msg, 'error');
        if (auth && auth.currentUser) {
          setAuthPanelStatus(msg + ' Sign out and sign in again if this keeps happening.', 'error');
        }
        if (isClientSuperUser()) {
          var preview = loadPreviewProfile();
          if (preview && isProfileComplete(preview)) {
            setStatus('Using offline preview — some features need a saved profile.', 'info');
            showDashboardSafely(buildLocalDashboard(preview, true));
            return;
          }
          return loadLocalNigeriaProfile().then(function (snap) {
            if (snap.exists && isProfileComplete(snap.data())) {
              setStatus('Using saved profile — reloading server data failed.', 'info');
              showDashboardSafely(buildLocalDashboard(snap.data(), true));
            } else {
              showOnboarding(coordinatorVolunteer(), true);
              setStatus(msg, 'error');
            }
          });
        }
        setStatus(msg, 'error');
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
        return loadDashboard();
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

    if (isClientSuperUser()) {
      profileSaveInFlight = true;
      savePreviewProfile(profile);
      writeProfileToFirestore(profile)
        .then(function () {
          return functions.httpsCallable('saveNigeriaProfile')(payload);
        })
        .then(function () {
          setStatus('Profile saved!', 'success');
          return loadDashboard();
        })
        .catch(function (err) {
          setStatus((err && err.message) || 'Could not save.', 'error');
        })
        .finally(function () {
          profileSaveInFlight = false;
        });
      return;
    }

    functions
      .httpsCallable('saveNigeriaProfile')(payload)
      .then(function () {
        finishProfileSave(profile);
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Could not save.', 'error');
      });
  }

  function checkIn(unitId) {
    setStatus('Recording attendance…', 'info');
    functions
      .httpsCallable('recordNigeriaAttendance')({ unitId: unitId })
      .then(function (res) {
        setStatus(
          res.data.alreadyCheckedIn ? 'Already checked in.' : 'Attendance recorded!',
          'success'
        );
        return loadDashboard();
      })
      .catch(function (err) {
        setStatus((err && err.message) || 'Check-in failed.', 'error');
      });
  }

  function uploadSidebarPhoto(file) {
    if (!file || !file.type.match(/^image\//)) return;
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
      .put(file, { contentType: file.type })
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
      hide($('dash-shell'));
      hide($('onboard-panel'));
      hide($('auth-panel'));
      hide($('not-eligible-panel'));
      setPublicLanding(true);
      return;
    }
    if (user) {
      clearAuthPanelOpen();
      setAuthPanelStatus('', '');
      if ($('btn-signout')) $('btn-signout').classList.remove('hidden');
      hide($('auth-panel'));
      if (profileSaveInFlight) return;
      loadDashboard();
      return;
    }
    hide($('btn-signout'));
    hide($('dash-shell'));
    hide($('onboard-panel'));
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
      auth.signOut();
    });
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
    initFirebase().then(function (ok) {
      if (!ok) return;
      bind();
      if (wantsAuthPanelVisible() && !auth.currentUser) {
        showAuthPanel(false);
      }
    });
  });
})();
