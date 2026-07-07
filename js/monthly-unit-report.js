/**
 * Monthly unit report — form, preview, PDF download, email via FormSubmit.
 */
(function (global) {
  var UNIT_CATEGORIES = [
    { id: 'serve', label: 'Prayer City serve teams' },
    { id: 'groups', label: 'DDBS Groups 1–6' },
    { id: 'leadership', label: 'DDBS leadership & regional' },
    { id: 'other', label: 'Other' },
  ];

  var UNITS = [
    // Prayer City serve teams
    {
      id: 'prayer',
      category: 'serve',
      label: 'Prayer Team',
      icon: 'fa-hands-praying',
      gradient: 'from-violet-500 to-purple-700',
      soft: 'bg-violet-50 border-violet-200',
      accent: 'text-violet-700',
      ring: 'ring-violet-400',
      barColor: '#7c3aed',
    },
    {
      id: 'choir',
      category: 'serve',
      label: 'Choir & Worship',
      icon: 'fa-music',
      gradient: 'from-amber-400 to-orange-600',
      soft: 'bg-amber-50 border-amber-200',
      accent: 'text-amber-800',
      ring: 'ring-amber-400',
      barColor: '#d97706',
    },
    {
      id: 'creative',
      category: 'serve',
      label: 'Creative & Arts',
      icon: 'fa-palette',
      gradient: 'from-rose-400 to-pink-600',
      soft: 'bg-rose-50 border-rose-200',
      accent: 'text-rose-700',
      ring: 'ring-rose-400',
      barColor: '#e11d48',
    },
    {
      id: 'social',
      category: 'serve',
      label: 'Social Media',
      icon: 'fa-hashtag',
      gradient: 'from-sky-400 to-blue-600',
      soft: 'bg-sky-50 border-sky-200',
      accent: 'text-sky-800',
      ring: 'ring-sky-400',
      barColor: '#0284c7',
    },
    {
      id: 'logistics',
      category: 'serve',
      label: 'Logistics & Hospitality',
      icon: 'fa-people-carry-box',
      gradient: 'from-emerald-400 to-teal-600',
      soft: 'bg-emerald-50 border-emerald-200',
      accent: 'text-emerald-800',
      ring: 'ring-emerald-400',
      barColor: '#059669',
    },
    {
      id: 'counseling',
      category: 'serve',
      label: 'Counselors',
      icon: 'fa-heart',
      gradient: 'from-teal-400 to-cyan-600',
      soft: 'bg-teal-50 border-teal-200',
      accent: 'text-teal-800',
      ring: 'ring-teal-400',
      barColor: '#0d9488',
    },
    // DDBS Groups 1–6
    {
      id: 'group1',
      category: 'groups',
      label: 'Group 1',
      badge: '1',
      gradient: 'from-indigo-500 to-indigo-700',
      soft: 'bg-indigo-50 border-indigo-200',
      accent: 'text-indigo-800',
      ring: 'ring-indigo-400',
      barColor: '#4f46e5',
    },
    {
      id: 'group2',
      category: 'groups',
      label: 'Group 2',
      badge: '2',
      gradient: 'from-blue-500 to-blue-700',
      soft: 'bg-blue-50 border-blue-200',
      accent: 'text-blue-800',
      ring: 'ring-blue-400',
      barColor: '#2563eb',
    },
    {
      id: 'group3',
      category: 'groups',
      label: 'Group 3',
      badge: '3',
      gradient: 'from-cyan-500 to-cyan-700',
      soft: 'bg-cyan-50 border-cyan-200',
      accent: 'text-cyan-800',
      ring: 'ring-cyan-400',
      barColor: '#0891b2',
    },
    {
      id: 'group4',
      category: 'groups',
      label: 'Group 4',
      badge: '4',
      gradient: 'from-lime-500 to-green-600',
      soft: 'bg-lime-50 border-lime-200',
      accent: 'text-lime-800',
      ring: 'ring-lime-400',
      barColor: '#65a30d',
    },
    {
      id: 'group5',
      category: 'groups',
      label: 'Group 5',
      badge: '5',
      gradient: 'from-orange-500 to-orange-700',
      soft: 'bg-orange-50 border-orange-200',
      accent: 'text-orange-800',
      ring: 'ring-orange-400',
      barColor: '#ea580c',
    },
    {
      id: 'group6',
      category: 'groups',
      label: 'Group 6',
      badge: '6',
      gradient: 'from-fuchsia-500 to-fuchsia-700',
      soft: 'bg-fuchsia-50 border-fuchsia-200',
      accent: 'text-fuchsia-800',
      ring: 'ring-fuchsia-400',
      barColor: '#c026d3',
    },
    // DDBS leadership & regional
    {
      id: 'bible-study',
      category: 'leadership',
      label: 'Bible Study Team',
      icon: 'fa-book-bible',
      gradient: 'from-slate-700 to-blue-800',
      soft: 'bg-sky-50 border-sky-200',
      accent: 'text-brand',
      ring: 'ring-sky-500',
      barColor: '#0f3d5c',
    },
    {
      id: 'growth-retention',
      category: 'leadership',
      label: 'Growth & Retention Team',
      icon: 'fa-seedling',
      gradient: 'from-green-500 to-emerald-700',
      soft: 'bg-green-50 border-green-200',
      accent: 'text-green-800',
      ring: 'ring-green-400',
      barColor: '#16a34a',
    },
    {
      id: 'comms',
      category: 'leadership',
      label: 'Comms Team',
      icon: 'fa-bullhorn',
      gradient: 'from-sky-500 to-indigo-600',
      soft: 'bg-sky-50 border-sky-200',
      accent: 'text-sky-800',
      ring: 'ring-sky-400',
      barColor: '#0369a1',
    },
    {
      id: 'welcome-hospitality',
      category: 'leadership',
      label: 'Welcome & Hospitality Team',
      icon: 'fa-door-open',
      gradient: 'from-amber-400 to-yellow-600',
      soft: 'bg-yellow-50 border-yellow-200',
      accent: 'text-yellow-800',
      ring: 'ring-yellow-400',
      barColor: '#ca8a04',
    },
    {
      id: 'workers-training',
      category: 'leadership',
      label: 'Workers Training',
      icon: 'fa-chalkboard-user',
      gradient: 'from-violet-400 to-indigo-600',
      soft: 'bg-violet-50 border-violet-200',
      accent: 'text-violet-800',
      ring: 'ring-violet-400',
      barColor: '#6d28d9',
    },
    {
      id: 'state-regional',
      category: 'leadership',
      label: 'State & Regional Reports',
      icon: 'fa-map-location-dot',
      gradient: 'from-red-500 to-rose-700',
      soft: 'bg-red-50 border-red-200',
      accent: 'text-red-800',
      ring: 'ring-red-400',
      barColor: '#dc2626',
    },
    {
      id: 'other',
      category: 'other',
      label: 'Other unit',
      icon: 'fa-layer-group',
      gradient: 'from-slate-500 to-slate-700',
      soft: 'bg-slate-50 border-slate-200',
      accent: 'text-slate-700',
      ring: 'ring-slate-400',
      barColor: '#475569',
    },
  ];

  var COORDINATOR_EMAIL = 'ddbs.htx@gmail.com';

  function $(id) {
    return document.getElementById(id);
  }

  function getUnit(id) {
    return UNITS.find(function (u) {
      return u.id === id;
    });
  }

  function monthLabel(year, month) {
    var d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function readForm() {
    var unitId = document.querySelector('input[name="unit"]:checked');
    unitId = unitId ? unitId.value : '';
    var unit = getUnit(unitId);
    var otherName = ($('unit-other-name') && $('unit-other-name').value.trim()) || '';
    var unitDisplay = unit
      ? unit.id === 'other' && otherName
        ? otherName
        : unit.label
      : '';

    return {
      reporterName: ($('reporter-name') && $('reporter-name').value.trim()) || '',
      reporterEmail: ($('reporter-email') && $('reporter-email').value.trim()) || '',
      reporterPhone: ($('reporter-phone') && $('reporter-phone').value.trim()) || '',
      reportYear: ($('report-year') && $('report-year').value) || '',
      reportMonth: ($('report-month') && $('report-month').value) || '',
      unitId: unitId,
      unitDisplay: unitDisplay,
      unit: unit,
      meetingsHeld: ($('meetings-held') && $('meetings-held').value.trim()) || '',
      attendance: ($('attendance') && $('attendance').value.trim()) || '',
      activities: ($('activities') && $('activities').value.trim()) || '',
      highlights: ($('highlights') && $('highlights').value.trim()) || '',
      challenges: ($('challenges') && $('challenges').value.trim()) || '',
      prayerRequests: ($('prayer-requests') && $('prayer-requests').value.trim()) || '',
      nextMonth: ($('next-month') && $('next-month').value.trim()) || '',
      testimonies: ($('testimonies') && $('testimonies').value.trim()) || '',
    };
  }

  function validateForm(data) {
    if (!data.reporterName) return 'Please enter your name.';
    if (!data.reporterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.reporterEmail)) {
      return 'Please enter a valid email address.';
    }
    if (!data.unitId) return 'Please select your ministry unit.';
    if (data.unitId === 'other' && !data.unitDisplay) return 'Please name your unit.';
    if (!data.reportMonth || !data.reportYear) return 'Please choose the reporting month.';
    if (!data.activities) return 'Please describe what your unit did this month.';
    return '';
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function nl2br(s) {
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  function buildReportHtml(data, forPdf) {
    var unit = data.unit || getUnit('prayer');
    var period = monthLabel(data.reportYear, data.reportMonth);
    var headerColor = '#0f3d5c';
    var accent = '#c9a227';
    var unitBar = (unit && unit.barColor) || '#475569';

    var section = function (title, body, icon) {
      if (!body) return '';
      return (
        '<div style="margin-bottom:18px;">' +
        '<h3 style="margin:0 0 8px;font-size:14px;color:' +
        headerColor +
        ';font-family:Georgia,serif;">' +
        (icon ? icon + ' ' : '') +
        escapeHtml(title) +
        '</h3>' +
        '<div style="font-size:13px;line-height:1.55;color:#334155;">' +
        nl2br(body) +
        '</div></div>'
      );
    };

    var stats =
      '<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:13px;">' +
      '<tr>' +
      '<td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 0 0 8px;"><strong>Meetings / gatherings</strong><br>' +
      escapeHtml(data.meetingsHeld || '—') +
      '</td>' +
      '<td style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-left:none;border-radius:0 8px 8px 0;"><strong>Attendance (avg or total)</strong><br>' +
      escapeHtml(data.attendance || '—') +
      '</td>' +
      '</tr></table>';

    return (
      '<div id="report-document" style="font-family:system-ui,sans-serif;color:#1e293b;max-width:720px;margin:0 auto;' +
      (forPdf ? 'padding:24px;background:#fff;' : '') +
      '">' +
      '<div style="border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">' +
      '<div style="background:linear-gradient(135deg,' +
      headerColor +
      ',' +
      unitBar +
      ');color:#fff;padding:22px 24px;">' +
      '<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;opacity:0.9;">Dear Daughter Bible Study · Prayer City</p>' +
      '<h1 style="margin:0 0 6px;font-size:22px;font-family:Georgia,serif;font-weight:700;">Monthly Unit Report</h1>' +
      '<p style="margin:0;font-size:15px;opacity:0.95;"><strong>' +
      escapeHtml(data.unitDisplay) +
      '</strong> · ' +
      escapeHtml(period) +
      '</p></div>' +
      '<div style="height:4px;background:' +
      accent +
      ';"></div></div>' +
      '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;">' +
      '<strong>Submitted by:</strong> ' +
      escapeHtml(data.reporterName) +
      '<br><strong>Email:</strong> ' +
      escapeHtml(data.reporterEmail) +
      (data.reporterPhone ? '<br><strong>Phone:</strong> ' + escapeHtml(data.reporterPhone) : '') +
      '</div>' +
      stats +
      section('Activities & ministry this month', data.activities, '✦') +
      section('Highlights & wins', data.highlights, '★') +
      section('Testimonies', data.testimonies, '♥') +
      section('Challenges & needs', data.challenges, '◆') +
      section('Prayer requests', data.prayerRequests, '🙏') +
      section('Plans for next month', data.nextMonth, '→') +
      '<p style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">' +
      'Houston World Cup Prayer City Movement · Generated ' +
      new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }) +
      '</p></div>'
    );
  }

  function buildPlainText(data) {
    var period = monthLabel(data.reportYear, data.reportMonth);
    var lines = [
      'MONTHLY UNIT REPORT — Prayer City',
      'Unit: ' + data.unitDisplay,
      'Period: ' + period,
      '',
      'Submitted by: ' + data.reporterName,
      'Email: ' + data.reporterEmail,
    ];
    if (data.reporterPhone) lines.push('Phone: ' + data.reporterPhone);
    lines.push('', 'Meetings / gatherings: ' + (data.meetingsHeld || '—'));
    lines.push('Attendance: ' + (data.attendance || '—'));
    lines.push('', '--- Activities ---', data.activities);
    if (data.highlights) lines.push('', '--- Highlights ---', data.highlights);
    if (data.testimonies) lines.push('', '--- Testimonies ---', data.testimonies);
    if (data.challenges) lines.push('', '--- Challenges ---', data.challenges);
    if (data.prayerRequests) lines.push('', '--- Prayer requests ---', data.prayerRequests);
    if (data.nextMonth) lines.push('', '--- Next month ---', data.nextMonth);
    return lines.join('\n');
  }

  function showStatus(msg, type) {
    var el = $('report-status');
    if (!el) return;
    el.textContent = msg;
    el.className =
      'rounded-xl border px-4 py-3 text-sm ' +
      (type === 'error'
        ? 'border-red-200 bg-red-50 text-red-900'
        : type === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-brand-soft bg-brand-soft text-brand');
    el.classList.remove('hidden');
  }

  function hideStatus() {
    var el = $('report-status');
    if (el) el.classList.add('hidden');
  }

  function setBusy(busy) {
    ['btn-download-pdf', 'btn-email-report', 'btn-submit-coordinator'].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = busy;
    });
  }

  function updatePreview() {
    var data = readForm();
    var preview = $('report-preview');
    if (!preview) return;
    if (!data.unitId || !data.reportMonth) {
      preview.innerHTML =
        '<p class="text-slate-500 text-sm text-center py-12">Select your unit and month to see a live preview.</p>';
      return;
    }
    preview.innerHTML = buildReportHtml(data, false);
  }

  function populateMonths() {
    var sel = $('report-month');
    var yearSel = $('report-year');
    if (!sel || !yearSel) return;
    var now = new Date();
    var y = now.getFullYear();
    yearSel.innerHTML = '';
    for (var yr = y; yr >= y - 2; yr--) {
      var opt = document.createElement('option');
      opt.value = String(yr);
      opt.textContent = String(yr);
      if (yr === y) opt.selected = true;
      yearSel.appendChild(opt);
    }
    var months = [
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
    sel.innerHTML = '';
    months.forEach(function (name, i) {
      var opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.textContent = name;
      if (i === now.getMonth()) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function unitCardHtml(u) {
    var iconInner = u.badge
      ? '<span class="text-xl font-bold">' + escapeHtml(u.badge) + '</span>'
      : '<i class="fas ' + u.icon + ' text-lg"></i>';
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
      iconInner +
      '</span>' +
      '<div><span class="font-semibold text-slate-900 block text-sm sm:text-base leading-snug">' +
      escapeHtml(u.label) +
      '</span>' +
      '<span class="text-xs text-slate-500 mt-0.5 block">Tap to select</span></div></div></label>'
    );
  }

  function renderUnitCards() {
    var wrap = $('unit-cards');
    if (!wrap) return;
    wrap.innerHTML = UNIT_CATEGORIES.map(function (cat) {
      var units = UNITS.filter(function (u) {
        return u.category === cat.id;
      });
      if (!units.length) return '';
      return (
        '<div class="unit-category mb-6 last:mb-0">' +
        '<h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">' +
        '<span class="h-px flex-1 bg-slate-200"></span>' +
        escapeHtml(cat.label) +
        '<span class="h-px flex-1 bg-slate-200"></span></h3>' +
        '<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">' +
        units.map(unitCardHtml).join('') +
        '</div></div>'
      );
    }).join('');

    wrap.querySelectorAll('.unit-radio').forEach(function (radio) {
      radio.addEventListener('change', onUnitChange);
    });
  }

  function onUnitChange() {
    var data = readForm();
    var otherWrap = $('other-unit-wrap');
    if (otherWrap) {
      otherWrap.classList.toggle('hidden', data.unitId !== 'other');
    }
    document.querySelectorAll('.unit-card').forEach(function (card) {
      var id = card.getAttribute('data-unit');
      var u = getUnit(id);
      var checked = document.querySelector('input[name="unit"][value="' + id + '"]');
      if (checked && checked.checked && u) {
        card.classList.add('ring-2', u.ring, 'shadow-md', 'scale-[1.02]');
        card.classList.remove('border-transparent');
      } else if (u) {
        card.classList.remove('ring-2', u.ring, 'shadow-md', 'scale-[1.02]');
        card.classList.add('border-transparent');
      }
    });
    updatePreview();
  }

  function downloadPdf() {
    var data = readForm();
    var err = validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return;
    }
    hideStatus();
    if (typeof html2pdf === 'undefined') {
      showStatus('PDF library still loading — try again in a moment.', 'error');
      return;
    }
    setBusy(true);
    showStatus('Preparing your PDF…', 'info');

    var container = document.createElement('div');
    container.innerHTML = buildReportHtml(data, true);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    var el = container.querySelector('#report-document');
    var filename =
      'Prayer-City-Unit-Report-' +
      data.unitDisplay.replace(/\s+/g, '-') +
      '-' +
      data.reportYear +
      '-' +
      String(data.reportMonth).padStart(2, '0') +
      '.pdf';

    html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save()
      .then(function () {
        document.body.removeChild(container);
        showStatus('PDF downloaded successfully.', 'success');
      })
      .catch(function () {
        document.body.removeChild(container);
        showStatus('Could not create PDF. Try again or use Print from your browser.', 'error');
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function postFormSubmit(toEmail, data, extra) {
    extra = extra || {};
    var fd = new FormData();
    fd.append('_subject', extra.subject || 'Prayer City — Monthly unit report');
    fd.append('_template', 'table');
    fd.append('_captcha', 'false');
    fd.append('Unit', data.unitDisplay);
    fd.append('Reporting period', monthLabel(data.reportYear, data.reportMonth));
    fd.append('Name', data.reporterName);
    fd.append('Email', data.reporterEmail);
    if (data.reporterPhone) fd.append('Phone', data.reporterPhone);
    fd.append('Meetings / gatherings', data.meetingsHeld || '—');
    fd.append('Attendance', data.attendance || '—');
    fd.append('Activities', data.activities);
    if (data.highlights) fd.append('Highlights', data.highlights);
    if (data.testimonies) fd.append('Testimonies', data.testimonies);
    if (data.challenges) fd.append('Challenges', data.challenges);
    if (data.prayerRequests) fd.append('Prayer requests', data.prayerRequests);
    if (data.nextMonth) fd.append('Plans for next month', data.nextMonth);
    fd.append('Full report (plain text)', buildPlainText(data));
    if (extra.cc) fd.append('_cc', extra.cc);

    return fetch('https://formsubmit.co/ajax/' + encodeURIComponent(toEmail), {
      method: 'POST',
      body: fd,
      headers: { Accept: 'application/json' },
    }).then(function (r) {
      return r.json();
    });
  }

  function emailReport() {
    var data = readForm();
    var err = validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return;
    }
    hideStatus();
    setBusy(true);
    showStatus('Sending a copy to your email…', 'info');

    var subject =
      'Your Prayer City unit report — ' + data.unitDisplay + ' (' + monthLabel(data.reportYear, data.reportMonth) + ')';

    postFormSubmit(data.reporterEmail, data, { subject: subject, cc: COORDINATOR_EMAIL })
      .then(function (res) {
        if (res && res.success) {
          showStatus(
            'Report sent to ' +
              data.reporterEmail +
              '. A copy was CC’d to the Prayer City team. Check spam if you don’t see it within a few minutes.',
            'success'
          );
        } else {
          showStatus('Email could not be sent. Try Download PDF or submit to the coordinator.', 'error');
        }
      })
      .catch(function () {
        showStatus('Email failed — check your connection or try Download PDF.', 'error');
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function submitToCoordinator() {
    var data = readForm();
    var err = validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return;
    }
    hideStatus();
    setBusy(true);
    showStatus('Submitting to Prayer City leadership…', 'info');

    var subject =
      'Monthly unit report — ' +
      data.unitDisplay +
      ' — ' +
      monthLabel(data.reportYear, data.reportMonth) +
      ' (' +
      data.reporterName +
      ')';

    postFormSubmit(COORDINATOR_EMAIL, data, { subject: subject, cc: data.reporterEmail })
      .then(function (res) {
        if (res && res.success) {
          showStatus('Report submitted! Leadership received it and you were CC’d.', 'success');
        } else {
          showStatus('Submission failed. Please try again or email ddbs.htx@gmail.com directly.', 'error');
        }
      })
      .catch(function () {
        showStatus('Submission failed. Please try again later.', 'error');
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function bind() {
    populateMonths();
    renderUnitCards();

    ['reporter-name', 'reporter-email', 'report-month', 'report-year', 'unit-other-name'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('input', updatePreview);
      if (el) el.addEventListener('change', updatePreview);
    });
    ['activities', 'highlights', 'testimonies', 'challenges', 'prayer-requests', 'next-month', 'meetings-held', 'attendance'].forEach(
      function (id) {
        var el = $(id);
        if (el) el.addEventListener('input', updatePreview);
      }
    );

    var pdfBtn = $('btn-download-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', downloadPdf);
    var emailBtn = $('btn-email-report');
    if (emailBtn) emailBtn.addEventListener('click', emailReport);
    var submitBtn = $('btn-submit-coordinator');
    if (submitBtn) submitBtn.addEventListener('click', submitToCoordinator);

    updatePreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  global.MonthlyUnitReport = {
    UNITS: UNITS,
    UNIT_CATEGORIES: UNIT_CATEGORIES,
    readForm: readForm,
    buildReportHtml: buildReportHtml,
  };
})(typeof window !== 'undefined' ? window : this);
