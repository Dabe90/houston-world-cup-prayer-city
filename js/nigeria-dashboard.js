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
  var EMAIL_LINK_CONTINUE_URL = window.location.origin + window.location.pathname;
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
    ['home', 'programs', 'units', 'new-members', 'kingdom-workforce', 'reports'].forEach(function (name) {
      var panel = $('tab-' + name);
      if (panel) panel.classList.toggle('hidden', name !== tab);
    });
    if (tab === 'programs') renderProgramsPanel();
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

  function buildUnitContextsFromProfile(profile, isSuperUser) {
    return normalizeProfileUnits(profile).map(function (m) {
      var unit = window.NigeriaUnits.getUnit(m.unitId);
      var nextMeeting = unit ? window.NigeriaUnits.getNextMeeting(unit) : null;
      var checkInOpen = false;
      if (nextMeeting && window.NigeriaUnits.isWithinCheckInWindow(nextMeeting)) {
        checkInOpen = true;
      }
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
        checkInOpen: checkInOpen,
        attendanceStats: profile.attendanceStats || null,
        latestReport: null,
        canSubmitReport: m.role === 'leader' || isSuperUser,
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
      return { canView: true, canApprove: true, leaderUnitIds: leaderUnitIds };
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

  function renderHomeTab(data) {
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

  function renderUnitsTab(data) {
    var wrap = $('units-cards');
    if (!wrap) return;
    if (window.DDBSNigeriaMeetingNotes) DDBSNigeriaMeetingNotes.detachAll();
    var ctx = data.unitContexts || [];
    var notesHtml = window.DDBSNigeriaMeetingNotes
      ? DDBSNigeriaMeetingNotes.mountHtml
      : function () {
          return '';
        };
    var profileName = data.profile && data.profile.name;
    wrap.innerHTML = ctx
      .map(function (c) {
        var sched = unitScheduleLabel(c);
        var open = c.checkInOpen;
        var unitMeetings = meetingsForUnit(c);
        var defaultKey = defaultMeetingKey(unitMeetings, c);
        var meeting = meetingForNotes(c);
        return (
          '<div class="unit-card bg-white rounded-2xl shadow-card border border-slate-100 p-5" data-unit-id="' +
          c.unitId +
          '">' +
          '<div class="flex flex-wrap items-center gap-2 mb-3">' +
          '<h3 class="font-bold text-slate-900 flex-1">' +
          c.unitLabel +
          '</h3>' +
          '<span class="text-xs font-semibold rounded-full px-2 py-1 ' +
          (c.role === 'leader' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800') +
          '">' +
          (c.role === 'leader' ? 'Leader' : 'Member') +
          '</span></div>' +
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
          '<p class="text-xs text-slate-500 mt-2 text-center">Opens 20 min before · closes 45 min after</p>' +
          notesHtml(unitMeetings, defaultKey) +
          '</div>'
        );
      })
      .join('');

    wrap.querySelectorAll('.btn-unit-checkin').forEach(function (btn) {
      btn.addEventListener('click', function () {
        checkIn(btn.getAttribute('data-unit-id'));
      });
    });

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
    if (profileSaveInFlight || $('dash-shell') && !$('dash-shell').classList.contains('hidden')) {
      return Promise.resolve();
    }
    showSuperUserChrome();
    hide($('auth-panel'));
    var preview = loadPreviewProfile();
    if (preview && isProfileComplete(preview)) {
      showDashboardSafely(buildLocalDashboard(preview, true));
      return Promise.resolve();
    }
    showOnboarding(coordinatorVolunteer(), true);
    return loadLocalNigeriaProfile().then(function (snap) {
      if (snap.exists && isProfileComplete(snap.data())) {
        showDashboardSafely(buildLocalDashboard(snap.data(), true));
      }
    });
  }

  function processDashboardResponse(data) {
    if (!data || data.eligible === false) {
      if (isClientSuperUser()) return showSuperUserLanding();
      showNotEligible(data && data.message);
      return;
    }
    if (!data.hasProfile || !isProfileComplete(data.profile)) {
      showOnboarding(data.volunteer || coordinatorVolunteer(), data.isSuperUser || isClientSuperUser());
      return;
    }
    if (!data.unitContexts || !data.unitContexts.length) {
      data = buildLocalDashboard(data.profile, data.isSuperUser);
    }
    showDashboardSafely(data);
  }

  function loadLocalNigeriaProfile() {
    return db.collection('nigeria_volunteers').doc(auth.currentUser.uid).get();
  }

  function loadDashboard() {
    if (isClientSuperUser()) {
      showSuperUserLanding();
      return functions
        .httpsCallable('getNigeriaDashboard')()
        .then(function (res) {
          if (res && res.data) processDashboardResponse(res.data);
        })
        .catch(function () {});
    }
    return functions
      .httpsCallable('getNigeriaDashboard')()
      .then(function (res) {
        processDashboardResponse(res.data);
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
    showDashboardSafely(buildLocalDashboard(profile, isClientSuperUser()));
    profileSaveInFlight = false;
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
      finishProfileSave(profile);
      writeProfileToFirestore(profile).catch(console.warn);
      functions.httpsCallable('saveNigeriaProfile')(payload).catch(console.warn);
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
    if (isClientSuperUser()) return showSuperUserLanding();
    hide($('dash-shell'));
    setPublicLanding(true);
    show($('not-eligible-panel'));
    if ($('not-eligible-msg')) $('not-eligible-msg').textContent = message || '';
  }

  function completeEmailLinkIfNeeded() {
    if (!firebase.auth().isSignInWithEmailLink(window.location.href)) {
      return Promise.resolve(false);
    }
    var email = window.localStorage.getItem('emailForSignIn') || window.prompt('Your email:');
    if (!email) return Promise.resolve(false);
    return auth
      .signInWithEmailLink(email, window.location.href)
      .then(function () {
        window.localStorage.removeItem('emailForSignIn');
        window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(function (e) {
        setStatus(e.message, 'error');
      });
  }

  function handleAuthUser(user) {
    hide($('auth-checking'));
    if (user) {
      if ($('btn-signout')) $('btn-signout').classList.remove('hidden');
      hide($('auth-panel'));
      if (profileSaveInFlight) return;
      if ($('dash-shell') && !$('dash-shell').classList.contains('hidden')) return;
      loadDashboard();
      return;
    }
    hide($('btn-signout'));
    hide($('dash-shell'));
    hide($('onboard-panel'));
    setPublicLanding(true);
    hide($('auth-panel'));
    try {
      sessionStorage.removeItem(PREVIEW_PROFILE_KEY);
    } catch (e) {}
  }

  function bind() {
    renderUnitOptions();
    var hashTab = (window.location.hash || '').replace('#', '');
    if (['home', 'programs', 'units', 'new-members', 'kingdom-workforce', 'reports'].indexOf(hashTab) >= 0) {
      activeTab = hashTab;
    }
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });
    if ($('btn-save-profile')) $('btn-save-profile').addEventListener('click', saveProfile);
    if ($('btn-email-link')) $('btn-email-link').addEventListener('click', sendEmailLink);
    if ($('btn-password-signin')) $('btn-password-signin').addEventListener('click', signInPassword);
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
      auth.onAuthStateChanged(handleAuthUser);
    });
  }

  function sendEmailLink() {
    var email = ($('auth-email') && $('auth-email').value || '').trim();
    if (!email) {
      setStatus('Enter email.', 'error');
      return;
    }
    auth
      .sendSignInLinkToEmail(email, { url: EMAIL_LINK_CONTINUE_URL, handleCodeInApp: true })
      .then(function () {
        window.localStorage.setItem('emailForSignIn', email);
        setStatus('Check your inbox for the sign-in link.', 'success');
      })
      .catch(function (e) {
        setStatus(e.message, 'error');
      });
  }

  function signInPassword() {
    var email = ($('auth-email') && $('auth-email').value || '').trim();
    var pw = $('auth-password') && $('auth-password').value;
    if (!email || !pw) {
      setStatus('Enter email and password.', 'error');
      return;
    }
    auth.signInWithEmailAndPassword(email, pw).catch(function (e) {
      setStatus(e.message, 'error');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initFirebase().then(function (ok) {
      if (ok) bind();
    });
  });
})();
