/**
 * Coordinator / super-user panel (abuxberkeley@gmail.com, ddbs.htx@gmail.com).
 */
(function (global) {
  var LINKS = [
    { href: '/', label: 'US volunteer dashboard', icon: 'fa-house' },
    { href: 'ddbs-nig.html', label: 'DDBS Nigeria', icon: 'fa-flag' },
    { href: 'monthly-report.html', label: 'Monthly reports', icon: 'fa-file-lines' },
    { href: 'monthly-report.html?region=nigeria', label: 'Nigeria monthly report', icon: 'fa-chart-line' },
    { href: 'digest-intelligence-ops.html', label: 'Digest intelligence', icon: 'fa-robot' },
    { href: 'volunteer-hub.html', label: 'Volunteer hub', icon: 'fa-users' },
    { href: 'gallery.html', label: 'Gallery', icon: 'fa-images' },
    { href: 'faq.html', label: 'FAQ', icon: 'fa-circle-question' },
  ];

  var SUPER_USER_EMAILS = {
    'ddbs.htx@gmail.com': true,
    'abuxberkeley@gmail.com': true,
  };

  function isSuperUser(email) {
    return !!SUPER_USER_EMAILS[String(email || '').trim().toLowerCase()];
  }

  function renderLinks(container) {
    if (!container) return;
    container.innerHTML = LINKS.map(function (l) {
      return (
        '<a href="' +
        l.href +
        '" class="inline-flex items-center gap-1.5 rounded-lg bg-white/90 border border-violet-200 px-3 py-2 text-xs sm:text-sm font-medium text-violet-900 hover:bg-violet-50 transition shadow-sm">' +
        '<i class="fas ' +
        l.icon +
        ' text-violet-600"></i>' +
        l.label +
        '</a>'
      );
    }).join('');
  }

  function showPanel(panel) {
    if (panel) panel.classList.remove('hidden');
  }

  function hidePanel(panel) {
    if (panel) panel.classList.add('hidden');
  }

  /**
   * @param {{ auth: firebase.auth.Auth, functions: firebase.functions.Functions, panelId?: string, linksId?: string }} opts
   */
  function init(opts) {
    if (!opts || !opts.auth || !opts.functions) return;
    var panel = document.getElementById(opts.panelId || 'super-user-panel');
    var links = document.getElementById(opts.linksId || 'super-user-links');
    renderLinks(links);

    opts.auth.onAuthStateChanged(function (user) {
      if (!user) {
        hidePanel(panel);
        return;
      }
      if (isSuperUser(user.email)) {
        showPanel(panel);
        return;
      }
      opts.functions
        .httpsCallable('getPrayerCityAccess')()
        .then(function (res) {
          if (res.data && res.data.isSuperUser) {
            showPanel(panel);
          } else {
            hidePanel(panel);
          }
        })
        .catch(function () {
          hidePanel(panel);
        });
    });
  }

  global.PrayerCitySuperUser = {
    LINKS: LINKS,
    SUPER_USER_EMAILS: SUPER_USER_EMAILS,
    isSuperUser: isSuperUser,
    init: init,
    renderLinks: renderLinks,
  };
})(typeof window !== 'undefined' ? window : this);
