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
      id: 'moderators-presenters',
      category: 'leadership',
      label: 'Moderators & Presenters',
      icon: 'fa-microphone-lines',
      gradient: 'from-violet-500 to-purple-700',
      soft: 'bg-violet-50 border-violet-200',
      accent: 'text-violet-800',
      ring: 'ring-violet-400',
      barColor: '#7c3aed',
    },
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
      meetingNotesSummary: ($('meeting-notes-summary') && $('meeting-notes-summary').value.trim()) || '',
      activities: ($('activities') && $('activities').value.trim()) || '',
      highlights: ($('highlights') && $('highlights').value.trim()) || '',
      challenges: ($('challenges') && $('challenges').value.trim()) || '',
      prayerRequests: ($('prayer-requests') && $('prayer-requests').value.trim()) || '',
      nextMonth: ($('next-month') && $('next-month').value.trim()) || '',
      testimonies: ($('testimonies') && $('testimonies').value.trim()) || '',
      photos: getPhotos(),
    };
  }

  function getPhotos() {
    var el = $('report-photos-json');
    if (!el) return [];
    try {
      var list = JSON.parse(el.value || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function setPhotos(list) {
    var el = $('report-photos-json');
    if (!el) return;
    var clean = (Array.isArray(list) ? list : [])
      .map(function (item) {
        if (typeof item === 'string') return { url: item };
        return { url: (item && item.url) || '', caption: (item && item.caption) || '' };
      })
      .filter(function (p) {
        return !!p.url;
      })
      .slice(0, 12);
    el.value = JSON.stringify(clean);
    renderPhotoGrid();
  }

  function renderPhotoGrid() {
    var grid = $('report-photos-grid');
    if (!grid) return;
    var photos = getPhotos();
    if (!photos.length) {
      grid.innerHTML = '<p class="col-span-full text-xs text-slate-400">No photos yet.</p>';
      return;
    }
    grid.innerHTML = photos
      .map(function (p, i) {
        return (
          '<figure class="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100">' +
          '<img src="' +
          escapeHtml(p.url) +
          '" alt="" class="w-full h-28 object-cover" loading="lazy" />' +
          '<button type="button" class="report-photo-remove absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs" data-index="' +
          i +
          '" title="Remove"><i class="fas fa-xmark"></i></button></figure>'
        );
      })
      .join('');
    grid.querySelectorAll('.report-photo-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var next = getPhotos();
        if (Number.isInteger(idx)) next.splice(idx, 1);
        setPhotos(next);
        updatePreview();
      });
    });
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

  function photosSectionHtml(photos, opts) {
    opts = opts || {};
    var list = Array.isArray(photos) ? photos : [];
    var urls = list
      .map(function (p) {
        return typeof p === 'string' ? p : p && p.url;
      })
      .filter(Boolean);
    if (!urls.length) return '';

    // Canvas PDF export often fails on mobile when remote images taint the canvas.
    // Use link list for that path; keep embedded images for on-screen preview/print.
    if (opts.linksOnly) {
      return (
        '<div style="margin-bottom:18px;">' +
        '<h3 style="margin:0 0 8px;font-size:14px;color:#0f3d5c;font-family:Georgia,serif;">Photos from the month</h3>' +
        '<ol style="margin:0;padding-left:18px;font-size:12px;line-height:1.5;color:#334155;word-break:break-all;">' +
        urls
          .map(function (url) {
            return (
              '<li style="margin-bottom:6px;"><a href="' +
              escapeHtml(url) +
              '">' +
              escapeHtml(url) +
              '</a></li>'
            );
          })
          .join('') +
        '</ol></div>'
      );
    }

    var rows = '';
    for (var i = 0; i < urls.length; i += 3) {
      rows +=
        '<tr>' +
        urls
          .slice(i, i + 3)
          .map(function (url) {
            return (
              '<td style="padding:4px;width:33%;vertical-align:top;">' +
              '<img src="' +
              escapeHtml(url) +
              '" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />' +
              '</td>'
            );
          })
          .join('') +
        '</tr>';
    }
    return (
      '<div style="margin-bottom:18px;">' +
      '<h3 style="margin:0 0 8px;font-size:14px;color:#0f3d5c;font-family:Georgia,serif;">Photos from the month</h3>' +
      '<table style="width:100%;border-collapse:collapse;">' +
      rows +
      '</table></div>'
    );
  }

  function buildReportHtml(data, forPdf) {
    var unit = data.unit || getUnit('prayer');
    var period = monthLabel(data.reportYear, data.reportMonth);
    var headerColor = '#0f3d5c';
    var accent = '#c9a227';
    var unitBar = (unit && unit.barColor) || '#475569';
    var pdfSafe = !!(data && data._pdfCanvasSafe);

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
      section('Meeting notes summary', data.meetingNotesSummary, '') +
      section('Activities & ministry this month', data.activities, '') +
      section('Highlights & wins', data.highlights, '') +
      section('Testimonies', data.testimonies, '') +
      section('Challenges & needs', data.challenges, '') +
      section('Prayer requests', data.prayerRequests, '') +
      section('Plans for next month', data.nextMonth, '') +
      photosSectionHtml(data.photos, { linksOnly: pdfSafe }) +
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
    if (data.meetingNotesSummary) lines.push('', '--- Meeting notes summary ---', data.meetingNotesSummary);
    lines.push('', '--- Activities ---', data.activities);
    if (data.highlights) lines.push('', '--- Highlights ---', data.highlights);
    if (data.testimonies) lines.push('', '--- Testimonies ---', data.testimonies);
    if (data.challenges) lines.push('', '--- Challenges ---', data.challenges);
    if (data.prayerRequests) lines.push('', '--- Prayer requests ---', data.prayerRequests);
    if (data.nextMonth) lines.push('', '--- Next month ---', data.nextMonth);
    if (data.photos && data.photos.length) {
      lines.push('', '--- Photos ---');
      data.photos.forEach(function (p, i) {
        var url = typeof p === 'string' ? p : p && p.url;
        if (url) lines.push((i + 1) + '. ' + url);
      });
    }
    return lines.join('\n');
  }

  function showStatus(msg, type) {
    // Prefer Nigeria hub status UI (top + next to action buttons + scroll into view).
    if (window.NigeriaDashboardReport && typeof NigeriaDashboardReport.showStatus === 'function') {
      NigeriaDashboardReport.showStatus(msg, type);
      return;
    }
    function paint(id) {
      var el = $(id);
      if (!el) return null;
      el.textContent = msg;
      el.className =
        'rounded-xl border px-4 py-3 text-sm ' +
        (type === 'error'
          ? 'border-red-200 bg-red-50 text-red-900'
          : type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-brand-soft bg-brand-soft text-brand');
      el.classList.remove('hidden');
      return el;
    }
    var top = paint('report-status');
    var near = paint('report-status-actions');
    var target = near || top;
    if (target) {
      try {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {}
    }
  }

  function hideStatus() {
    ['report-status', 'report-status-actions'].forEach(function (id) {
      var el = $(id);
      if (el) el.classList.add('hidden');
    });
  }

  function setBusy(busy) {
    [
      'btn-download-pdf',
      'btn-download-pptx-file',
      'btn-download-pptx',
      'btn-present-bolt',
      'btn-print-report',
      'btn-email-report',
      'btn-submit-coordinator',
    ].forEach(function (id) {
      var b = $(id);
      if (b) b.disabled = busy;
    });
  }

  function isLikelyMobileBrowser() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
    // iPadOS desktop UA
    if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
    return false;
  }

  function reportFilename(data) {
    return (
      'Prayer-City-Unit-Report-' +
      String(data.unitDisplay || 'Unit').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-') +
      '-' +
      data.reportYear +
      '-' +
      String(data.reportMonth).padStart(2, '0') +
      '.pdf'
    );
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 2500);
  }

  function openPrintWindowSync() {
    try {
      var win = window.open('', '_blank');
      if (!win) return null;
      win.document.open();
      win.document.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preparing report…</title></head>' +
          '<body style="font-family:system-ui,sans-serif;padding:24px;color:#0f172a">' +
          '<p style="font-size:16px">Preparing your report…</p>' +
          '<p style="font-size:13px;color:#64748b">If nothing happens, use Share → Save to Files / Save as PDF.</p>' +
          '</body></html>'
      );
      win.document.close();
      return win;
    } catch (e) {
      return null;
    }
  }

  function writePrintableReport(win, data) {
    if (!win || win.closed) return false;
    var html =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      escapeHtml(data.unitDisplay || 'Unit report') +
      '</title><style>' +
      'body{font-family:system-ui,sans-serif;padding:16px;color:#0f172a;background:#fff}' +
      'img{max-width:100%;height:auto}' +
      '@media print{body{padding:0} .no-print{display:none!important}}' +
      '</style></head><body>' +
      '<p class="no-print" style="margin:0 0 16px;padding:12px 14px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:14px">' +
      '<strong>To save a PDF:</strong> use your browser Share / Print menu and choose <em>Save as PDF</em> or <em>Save to Files</em>.' +
      '</p>' +
      buildReportHtml(data, true) +
      '<div class="no-print" style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button type="button" onclick="window.print()" style="padding:12px 18px;border-radius:10px;border:0;background:#0f3d5c;color:#fff;font-weight:600;font-size:15px">Print / Save as PDF</button>' +
      '</div>' +
      '<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},400)}<\/script></body></html>';
    try {
      win.document.open();
      win.document.write(html);
      win.document.close();
      try {
        win.focus();
      } catch (e) {}
      return true;
    } catch (e) {
      return false;
    }
  }

  function openPrintableReport(data, existingWin) {
    try {
      var win = existingWin && !existingWin.closed ? existingWin : window.open('', '_blank');
      if (!win) {
        showStatus(
          'Pop-up blocked. Allow pop-ups for this site, then tap Download / Print again — or use Send to my email.',
          'error'
        );
        return Promise.reject(new Error('popup_blocked'));
      }
      if (!writePrintableReport(win, data)) {
        showStatus('Could not open printable report. Try another browser, or email yourself a copy.', 'error');
        return Promise.reject(new Error('print_write_failed'));
      }
      showStatus(
        'Print view opened — choose “Save as PDF” / “Save to Files” in the share/print sheet.',
        'success'
      );
      return Promise.resolve({ ok: true, mode: 'print' });
    } catch (e) {
      showStatus('Could not open printable report. Try another browser, or email yourself a copy.', 'error');
      return Promise.reject(e);
    }
  }

  function buildPdfSource(data) {
    var safe = {};
    Object.keys(data || {}).forEach(function (k) {
      safe[k] = data[k];
    });
    safe._pdfCanvasSafe = true;
    var container = document.createElement('div');
    container.innerHTML = buildReportHtml(safe, true);
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#fff';
    container.setAttribute('aria-hidden', 'true');
    document.body.appendChild(container);
    return {
      container: container,
      el: container.querySelector('#report-document'),
      cleanup: function () {
        if (container.parentNode) document.body.removeChild(container);
      },
    };
  }

  function validateExportData(data) {
    if (!data) return 'Report data is missing.';
    if (!data.unitDisplay && !data.unitId) return 'Report unit is missing.';
    if (!data.reportMonth || !data.reportYear) return 'Report period is missing.';
    if (
      !String(data.activities || '').trim() &&
      !String(data.meetingNotesSummary || '').trim() &&
      !String(data.highlights || '').trim()
    ) {
      return 'This report has no content to export yet.';
    }
    return '';
  }

  /** Map a submitted overview report (or draft form) into export-ready fields. */
  function fromSubmittedReport(r) {
    r = r || {};
    var unit = getUnit(r.unitId) || {
      id: r.unitId || '',
      label: r.unitLabel || r.unitDisplay || 'Unit',
      barColor: '#008751',
    };
    return {
      reporterName: r.leaderName || r.reporterName || 'Unit leader',
      reporterEmail: r.leaderEmail || r.reporterEmail || '—',
      reporterPhone: r.leaderPhone || r.reporterPhone || '',
      reportYear: String(r.reportYear || ''),
      reportMonth: String(r.reportMonth || ''),
      unitId: r.unitId || '',
      unitDisplay: r.unitLabel || r.unitDisplay || unit.label || r.unitId || 'Unit',
      unit: unit,
      meetingsHeld: r.meetingsHeld != null && r.meetingsHeld !== '' ? String(r.meetingsHeld) : '',
      attendance: r.attendanceNarrative || r.attendance || '',
      meetingNotesSummary: r.meetingNotesSummary || '',
      activities: r.activities || '',
      highlights: r.highlights || '',
      testimonies: r.testimonies || '',
      challenges: r.challenges || '',
      prayerRequests: r.prayerRequests || '',
      nextMonth: r.nextMonth || '',
      photos: Array.isArray(r.photos) ? r.photos : [],
    };
  }

  function downloadPdf(dataOverride) {
    var data = dataOverride || readForm();
    var err = dataOverride ? validateExportData(data) : validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return Promise.reject(new Error(err));
    }

    // Open print window in the same user-gesture turn (critical for iPhone/Android).
    var printWin = openPrintWindowSync();
    var filename = reportFilename(data);
    setBusy(true);
    showStatus('Preparing your PDF…', 'info');

    function finishPrint() {
      return openPrintableReport(data, printWin);
    }

    function closePrepWindow() {
      try {
        if (printWin && !printWin.closed) printWin.close();
      } catch (e) {}
    }

    // Phones: print/share sheet is far more reliable than html2pdf file downloads.
    if (isLikelyMobileBrowser() || typeof html2pdf === 'undefined') {
      return finishPrint().finally(function () {
        setBusy(false);
      });
    }

    var source = null;
    try {
      source = buildPdfSource(data);
      if (!source.el) throw new Error('missing_report_document');
    } catch (e) {
      return finishPrint().finally(function () {
        setBusy(false);
      });
    }

    var timedOut = false;
    var watchdog = window.setTimeout(function () {
      timedOut = true;
    }, 20000);

    return html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.9 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(source.el)
      .outputPdf('blob')
      .then(function (blob) {
        window.clearTimeout(watchdog);
        source.cleanup();
        if (timedOut || !blob) {
          return finishPrint();
        }
        closePrepWindow();
        triggerBlobDownload(blob, filename);
        showStatus('PDF ready — check your Downloads folder (or browser download tray).', 'success');
        return { ok: true, mode: 'blob' };
      })
      .catch(function () {
        window.clearTimeout(watchdog);
        try {
          source.cleanup();
        } catch (e) {}
        showStatus('Direct download unavailable here — opening Print / Save as PDF…', 'info');
        return finishPrint();
      })
      .finally(function () {
        setBusy(false);
      });
  }

  function chunkText(text, maxLen) {
    var raw = String(text || '').trim();
    if (!raw) return [];
    if (raw.length <= maxLen) return [raw];
    var parts = [];
    var remaining = raw;
    while (remaining.length) {
      if (remaining.length <= maxLen) {
        parts.push(remaining);
        break;
      }
      var slice = remaining.slice(0, maxLen);
      var breakAt = Math.max(slice.lastIndexOf('\n'), slice.lastIndexOf('. '), slice.lastIndexOf(' '));
      if (breakAt < maxLen * 0.4) breakAt = maxLen;
      parts.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    return parts.filter(Boolean);
  }

  function getPptxCtor() {
    if (typeof PptxGenJS === 'function') return PptxGenJS;
    if (typeof pptxgenjs === 'function') return pptxgenjs;
    if (window.PptxGenJS) return window.PptxGenJS;
    return null;
  }

  function loadExternalScript(src) {
    var existing = document.querySelector('script[data-lazy-src="' + src + '"]');
    if (existing && existing.getAttribute('data-loaded') === '1') return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute('data-lazy-src', src);
      var timer = setTimeout(function () {
        reject(new Error('timeout'));
      }, 15000);
      s.onload = function () {
        clearTimeout(timer);
        s.setAttribute('data-loaded', '1');
        resolve();
      };
      s.onerror = function () {
        clearTimeout(timer);
        reject(new Error('load'));
      };
      document.head.appendChild(s);
    });
  }

  function downloadPptx(dataOverride, triedLoad) {
    var data = dataOverride || readForm();
    var err = dataOverride ? validateExportData(data) : validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return Promise.reject(new Error(err));
    }
    var Pptx = getPptxCtor();
    if (!Pptx && !triedLoad) {
      showStatus('Loading PowerPoint tools…', 'info');
      return loadExternalScript(
        'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
      )
        .then(function () {
          return downloadPptx(dataOverride, true);
        })
        .catch(function () {
          showStatus('PowerPoint tools could not load on this network. Try again, or use PDF.', 'error');
          return Promise.reject(new Error('pptx_unavailable'));
        });
    }
    if (!Pptx) {
      showStatus('PowerPoint tools still loading — refresh and try again.', 'error');
      return Promise.reject(new Error('pptx_unavailable'));
    }

    setBusy(true);
    showStatus('Preparing your PowerPoint…', 'info');

    try {
      var pptx = new Pptx();
      pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.333, height: 7.5 });
      pptx.layout = 'LAYOUT_16x9';
      pptx.author = data.reporterName || 'Dear Daughter Nigeria';
      pptx.title =
        'Unit Report — ' + (data.unitDisplay || 'Unit') + ' — ' + monthLabel(data.reportYear, data.reportMonth);

      var brand = '0F3D5C';
      var accent = '008751';
      var period = monthLabel(data.reportYear, data.reportMonth);

      // Title
      var title = pptx.addSlide();
      title.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
        fill: { color: brand },
      });
      title.addText('Dear Daughter Bible Study · Nigeria', {
        x: 0.7,
        y: 1.6,
        w: 12,
        h: 0.4,
        color: 'E2E8F0',
        fontSize: 14,
        bold: true,
      });
      title.addText('Monthly Unit Report', {
        x: 0.7,
        y: 2.2,
        w: 12,
        h: 0.8,
        color: 'FFFFFF',
        fontSize: 36,
        bold: true,
        fontFace: 'Georgia',
      });
      title.addText((data.unitDisplay || 'Unit') + '  ·  ' + period, {
        x: 0.7,
        y: 3.2,
        w: 12,
        h: 0.5,
        color: 'A7F3D0',
        fontSize: 20,
      });
      title.addText('Prepared by ' + (data.reporterName || ''), {
        x: 0.7,
        y: 6.4,
        w: 12,
        h: 0.35,
        color: 'CBD5E1',
        fontSize: 13,
      });

      // Overview
      var overview = pptx.addSlide();
      overview.addText('Overview', {
        x: 0.6,
        y: 0.35,
        w: 12,
        h: 0.5,
        color: brand,
        fontSize: 26,
        bold: true,
        fontFace: 'Georgia',
      });
      overview.addShape(pptx.ShapeType.rect, {
        x: 0.6,
        y: 1.1,
        w: 5.8,
        h: 2.2,
        fill: { color: 'F0FDF4' },
        line: { color: 'BBF7D0', width: 1 },
      });
      overview.addText('Meetings / gatherings', {
        x: 0.85,
        y: 1.3,
        w: 5.3,
        h: 0.35,
        color: accent,
        fontSize: 13,
        bold: true,
      });
      overview.addText(data.meetingsHeld || '—', {
        x: 0.85,
        y: 1.7,
        w: 5.3,
        h: 1.3,
        color: '0F172A',
        fontSize: 16,
        valign: 'top',
      });
      overview.addShape(pptx.ShapeType.rect, {
        x: 6.9,
        y: 1.1,
        w: 5.8,
        h: 2.2,
        fill: { color: 'F8FAFC' },
        line: { color: 'E2E8F0', width: 1 },
      });
      overview.addText('Attendance', {
        x: 7.15,
        y: 1.3,
        w: 5.3,
        h: 0.35,
        color: brand,
        fontSize: 13,
        bold: true,
      });
      overview.addText(data.attendance || '—', {
        x: 7.15,
        y: 1.7,
        w: 5.3,
        h: 1.3,
        color: '0F172A',
        fontSize: 15,
        valign: 'top',
      });
      overview.addText(
        'Submitted by: ' +
          (data.reporterName || '—') +
          '\nEmail: ' +
          (data.reporterEmail || '—') +
          (data.reporterPhone ? '\nPhone: ' + data.reporterPhone : ''),
        {
          x: 0.6,
          y: 3.7,
          w: 12,
          h: 1.5,
          color: '334155',
          fontSize: 15,
        }
      );

      function addContentSlides(heading, body) {
        var chunks = chunkText(body, 900);
        if (!chunks.length) return;
        chunks.forEach(function (chunk, idx) {
          var slide = pptx.addSlide();
          slide.addText(heading + (chunks.length > 1 ? ' (' + (idx + 1) + '/' + chunks.length + ')' : ''), {
            x: 0.6,
            y: 0.35,
            w: 12,
            h: 0.5,
            color: brand,
            fontSize: 24,
            bold: true,
            fontFace: 'Georgia',
          });
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.6,
            y: 1.0,
            w: 12.1,
            h: 5.8,
            fill: { color: 'F8FAFC' },
            line: { color: 'E2E8F0', width: 1 },
          });
          slide.addText(chunk, {
            x: 0.9,
            y: 1.25,
            w: 11.5,
            h: 5.3,
            color: '1E293B',
            fontSize: 16,
            valign: 'top',
          });
        });
      }

      addContentSlides('Meeting notes summary', data.meetingNotesSummary);
      addContentSlides('Activities & ministry', data.activities);
      addContentSlides('Highlights & wins', data.highlights);
      addContentSlides('Testimonies', data.testimonies);
      addContentSlides('Challenges & needs', data.challenges);
      addContentSlides('Prayer requests', data.prayerRequests);
      addContentSlides('Plans for next month', data.nextMonth);

      var photoUrls = (data.photos || [])
        .map(function (p) {
          return typeof p === 'string' ? p : p && p.url;
        })
        .filter(Boolean)
        .slice(0, 8);
      if (photoUrls.length) {
        var photoSlide = pptx.addSlide();
        photoSlide.addText('Photos from the month', {
          x: 0.6,
          y: 0.35,
          w: 12,
          h: 0.5,
          color: brand,
          fontSize: 24,
          bold: true,
          fontFace: 'Georgia',
        });
        photoSlide.addText(
          photoUrls
            .map(function (url, i) {
              return i + 1 + '. ' + url;
            })
            .join('\n'),
          {
            x: 0.6,
            y: 1.1,
            w: 12.1,
            h: 5.6,
            color: '334155',
            fontSize: 13,
            valign: 'top',
          }
        );
      }

      var closing = pptx.addSlide();
      closing.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
        fill: { color: accent },
      });
      closing.addText('Thank you', {
        x: 0.7,
        y: 2.6,
        w: 12,
        h: 0.7,
        color: 'FFFFFF',
        fontSize: 34,
        bold: true,
        fontFace: 'Georgia',
      });
      closing.addText('Dear Daughter Bible Study Group Nigeria\nprayercityhtx.com/ng', {
        x: 0.7,
        y: 3.5,
        w: 12,
        h: 0.9,
        color: 'ECFDF5',
        fontSize: 16,
      });

      var filename =
        'Prayer-City-Unit-Report-' +
        String(data.unitDisplay || 'Unit').replace(/[^\w\-]+/g, '-').replace(/-+/g, '-') +
        '-' +
        data.reportYear +
        '-' +
        String(data.reportMonth).padStart(2, '0') +
        '.pptx';

      return pptx
        .writeFile({ fileName: filename })
        .then(function () {
          showStatus('PowerPoint downloaded — check your Downloads folder.', 'success');
          return { ok: true, mode: 'pptx' };
        })
        .catch(function (e) {
          showStatus(
            'Could not save the PowerPoint on this device. Try another browser, or use Download / Save as PDF.',
            'error'
          );
          throw e;
        })
        .finally(function () {
          setBusy(false);
        });
    } catch (e) {
      setBusy(false);
      showStatus('Could not build the PowerPoint. Try Download / Save as PDF instead.', 'error');
      return Promise.reject(e);
    }
  }

  function buildPptPresenterSlides(data) {
    var period = monthLabel(data.reportYear, data.reportMonth);
    var unit = escapeHtml(data.unitDisplay || 'Unit');
    var slides = [];

    slides.push({
      kind: 'hero',
      label: 'Title',
      notes: '',
      builds: 0,
      html:
        '<div class="mur-slide mur-slide-hero">' +
        '<p class="mur-slide-eyebrow">Dear Daughter Bible Study · Nigeria</p>' +
        '<h2 class="mur-slide-hero-title">Monthly Unit Report</h2>' +
        '<p class="mur-slide-hero-meta">' +
        unit +
        ' · ' +
        escapeHtml(period) +
        '</p>' +
        '<p class="mur-slide-hero-by">Prepared by ' +
        escapeHtml(data.reporterName || '') +
        '</p></div>',
    });

    slides.push({
      kind: 'overview',
      label: 'Overview',
      notes: '',
      builds: 0,
      html:
        '<div class="mur-slide mur-slide-content">' +
        '<h2 class="mur-slide-heading">Overview</h2>' +
        '<div class="mur-slide-stat-grid">' +
        '<div class="mur-slide-stat mur-slide-stat-green">' +
        '<p class="mur-slide-stat-label">Meetings / gatherings</p>' +
        '<p class="mur-slide-stat-value">' +
        escapeHtml(data.meetingsHeld || '—') +
        '</p></div>' +
        '<div class="mur-slide-stat">' +
        '<p class="mur-slide-stat-label">Attendance</p>' +
        '<p class="mur-slide-stat-value">' +
        escapeHtml(data.attendance || '—') +
        '</p></div></div>' +
        '<p class="mur-slide-overview-meta">Submitted by: ' +
        escapeHtml(data.reporterName || '—') +
        '<br>Email: ' +
        escapeHtml(data.reporterEmail || '—') +
        (data.reporterPhone ? '<br>Phone: ' + escapeHtml(data.reporterPhone) : '') +
        '</p></div>',
    });

    function pushContent(heading, body) {
      var chunks = chunkText(body, 900);
      if (!chunks.length) return;
      chunks.forEach(function (chunk, idx) {
        var title =
          heading + (chunks.length > 1 ? ' (' + (idx + 1) + '/' + chunks.length + ')' : '');
        slides.push({
          kind: 'content',
          label: heading.length > 22 ? heading.slice(0, 20) + '…' : heading,
          notes: '',
          builds: 0,
          html:
            '<div class="mur-slide mur-slide-content">' +
            '<h2 class="mur-slide-heading">' +
            escapeHtml(title) +
            '</h2>' +
            '<div class="mur-slide-body-card"><p class="mur-slide-body">' +
            escapeHtml(chunk).replace(/\n/g, '<br>') +
            '</p></div></div>',
        });
      });
    }

    pushContent('Meeting notes summary', data.meetingNotesSummary);
    pushContent('Activities & ministry', data.activities);
    pushContent('Highlights & wins', data.highlights);
    pushContent('Testimonies', data.testimonies);
    pushContent('Challenges & needs', data.challenges);
    pushContent('Prayer requests', data.prayerRequests);
    pushContent('Plans for next month', data.nextMonth);

    var photoUrls = (data.photos || [])
      .map(function (p) {
        return typeof p === 'string' ? p : p && p.url;
      })
      .filter(Boolean)
      .slice(0, 8);
    if (photoUrls.length) {
      slides.push({
        kind: 'photos',
        label: 'Photos',
        notes: '',
        builds: 0,
        html:
          '<div class="mur-slide mur-slide-content">' +
          '<h2 class="mur-slide-heading">Photos from the month</h2>' +
          '<div class="mur-slide-photos">' +
          photoUrls
            .map(function (url) {
              return (
                '<figure class="mur-slide-photo"><img src="' +
                escapeHtml(url) +
                '" alt="Report photo" loading="lazy" /></figure>'
              );
            })
            .join('') +
          '</div></div>',
      });
    }

    slides.push({
      kind: 'closing',
      label: 'Close',
      notes: '',
      builds: 0,
      html:
        '<div class="mur-slide mur-slide-closing">' +
        '<h2 class="mur-slide-closing-title">Thank you</h2>' +
        '<p class="mur-slide-closing-sub">Dear Daughter Bible Study Group Nigeria<br>prayercityhtx.com/ng</p></div>',
    });

    return slides;
  }

  function buildBoltSlides(data) {
    var period = monthLabel(data.reportYear, data.reportMonth);
    var unitPlain = data.unitDisplay || 'Unit';
    var unit = escapeHtml(unitPlain);
    var slides = [];

    slides.push({
      kind: 'hero',
      label: 'Cover',
      notes: 'Open with the unit name and month.',
      builds: 1,
      html:
        '<div class="mur-slide bolt-cover">' +
        '<p class="bolt-kicker">Dear Daughter · Nigeria</p>' +
        '<h2 class="bolt-cover-title">Monthly<br><span class="bolt-accent">Unit Report</span></h2>' +
        '<p class="bolt-cover-meta mur-build" data-build="1">' +
        unit +
        '<span class="bolt-dot">·</span>' +
        escapeHtml(period) +
        '</p></div>',
    });

    slides.push({
      kind: 'bignumber',
      label: 'Meetings',
      notes: 'Lead with meetings held.',
      builds: 0,
      html:
        '<div class="mur-slide bolt-bignum">' +
        '<p class="bolt-kicker">This month</p>' +
        '<p class="bolt-bignum-value">' +
        escapeHtml(data.meetingsHeld || '—') +
        '</p>' +
        '<p class="bolt-bignum-label">Meetings / gatherings</p></div>',
    });

    (function () {
      var attendanceText = String(data.attendance || '').trim() || '—';
      // Keep the attendance slide readable when auto-fill dumps a multi-line narrative.
      var shortAttendance =
        attendanceText.length > 180 || attendanceText.indexOf('\n') >= 0
          ? attendanceText.split(/\n/)[0].slice(0, 140) + (attendanceText.length > 140 ? '…' : '')
          : attendanceText;
      slides.push({
        kind: 'bignumber',
        label: 'Attendance',
        notes: 'Share attendance.',
        builds: 0,
        html:
          '<div class="mur-slide bolt-bignum bolt-bignum-alt">' +
          '<p class="bolt-kicker">People</p>' +
          '<p class="bolt-bignum-value bolt-bignum-sm">' +
          escapeHtml(shortAttendance) +
          '</p>' +
          '<p class="bolt-bignum-label">Attendance</p></div>',
      });
    })();

    function pushBoltSection(heading, body, note) {
      var chunks = chunkText(body, 700);
      if (!chunks.length) return;
      chunks.forEach(function (chunk, idx) {
        var paras = String(chunk)
          .split(/\n+/)
          .map(function (p) {
            return p.trim();
          })
          .filter(Boolean);
        if (!paras.length) paras = [chunk];
        var buildHtml = paras
          .map(function (p, pi) {
            return (
              '<p class="bolt-line mur-build" data-build="' +
              (pi + 1) +
              '">' +
              escapeHtml(p) +
              '</p>'
            );
          })
          .join('');
        slides.push({
          kind: 'content',
          label: heading.length > 18 ? heading.slice(0, 16) + '…' : heading,
          notes: note || '',
          builds: paras.length,
          html:
            '<div class="mur-slide bolt-section">' +
            '<p class="bolt-kicker">' +
            escapeHtml(unitPlain) +
            (chunks.length > 1 ? ' · ' + (idx + 1) + '/' + chunks.length : '') +
            '</p>' +
            '<h2 class="bolt-section-title">' +
            escapeHtml(heading) +
            '</h2>' +
            '<div class="bolt-section-body">' +
            buildHtml +
            '</div></div>',
        });
      });
    }

    pushBoltSection('Meeting notes', data.meetingNotesSummary, 'Summarize the month.');
    pushBoltSection('Activities', data.activities, 'Walk key activities.');
    pushBoltSection('Highlights', data.highlights, 'Celebrate wins.');
    pushBoltSection('Testimonies', data.testimonies, 'Let one testimony land.');
    pushBoltSection('Challenges', data.challenges, 'Name the needs.');
    pushBoltSection('Prayer', data.prayerRequests, 'Invite prayer.');
    pushBoltSection('Next month', data.nextMonth, 'Close with next steps.');

    var photoUrls = (data.photos || [])
      .map(function (p) {
        return typeof p === 'string' ? p : p && p.url;
      })
      .filter(Boolean)
      .slice(0, 6);
    if (photoUrls.length) {
      slides.push({
        kind: 'photos',
        label: 'Photos',
        notes: 'Pause on the images.',
        builds: photoUrls.length,
        html:
          '<div class="mur-slide bolt-section">' +
          '<p class="bolt-kicker">Moments</p>' +
          '<h2 class="bolt-section-title">From the month</h2>' +
          '<div class="mur-slide-photos bolt-photos">' +
          photoUrls
            .map(function (url, i) {
              return (
                '<figure class="mur-slide-photo mur-build" data-build="' +
                (i + 1) +
                '"><img src="' +
                escapeHtml(url) +
                '" alt="Report photo" loading="lazy" /></figure>'
              );
            })
            .join('') +
          '</div></div>',
      });
    }

    slides.push({
      kind: 'closing',
      label: 'Close',
      notes: 'Thank the room.',
      builds: 0,
      html:
        '<div class="mur-slide bolt-cover bolt-closing">' +
        '<h2 class="bolt-cover-title">Thank you</h2>' +
        '<p class="bolt-cover-meta">Dear Daughter Bible Study Group Nigeria<br>prayercityhtx.com/ng</p></div>',
    });

    return slides;
  }

  var presenterState = null;

  function notesStorageKey(data, slideIndex) {
    return (
      'mur-notes:' +
      String((data && data.unitId) || 'unit') +
      ':' +
      String((data && data.reportYear) || '') +
      '-' +
      String((data && data.reportMonth) || '') +
      ':' +
      String(slideIndex)
    );
  }

  function loadSlideNotes(data, slide, slideIndex) {
    try {
      var saved = localStorage.getItem(notesStorageKey(data, slideIndex));
      if (saved != null && saved !== '') return saved;
    } catch (e) {}
    return (slide && slide.notes) || '';
  }

  function saveSlideNotes(data, slideIndex, text) {
    try {
      localStorage.setItem(notesStorageKey(data, slideIndex), text);
    } catch (e) {}
  }

  function broadcastPresenter(msg) {
    if (!presenterState || !presenterState.channel) return;
    try {
      presenterState.channel.postMessage(msg);
    } catch (e) {}
  }

  function closeSlidePresenter() {
    if (!presenterState) return;
    document.removeEventListener('keydown', presenterState.onKey);
    if (presenterState.onResize) window.removeEventListener('resize', presenterState.onResize);
    if (presenterState.timerId) clearInterval(presenterState.timerId);
    if (presenterState.channel) {
      try {
        presenterState.channel.postMessage({ type: 'close' });
        presenterState.channel.close();
      } catch (e) {}
    }
    if (presenterState.presenterWin && !presenterState.presenterWin.closed) {
      try {
        presenterState.presenterWin.close();
      } catch (e2) {}
    }
    if (presenterState.root && presenterState.root.parentNode) {
      presenterState.root.parentNode.removeChild(presenterState.root);
    }
    document.body.classList.remove('mur-presenter-open');
    presenterState = null;
  }

  function applyBuilds() {
    if (!presenterState || !presenterState.stage) return;
    var step = presenterState.buildStep || 0;
    presenterState.stage.querySelectorAll('.mur-build').forEach(function (el) {
      var n = parseInt(el.getAttribute('data-build') || '1', 10);
      el.classList.toggle('is-revealed', n <= step);
    });
  }

  function maxBuildsForSlide() {
    if (!presenterState) return 0;
    var slide = presenterState.slides[presenterState.index];
    return (slide && slide.builds) || 0;
  }

  function renderThumbnails() {
    if (!presenterState || !presenterState.thumbs) return;
    presenterState.thumbs.innerHTML = presenterState.slides
      .map(function (s, i) {
        return (
          '<button type="button" class="mur-thumb' +
          (i === presenterState.index ? ' is-active' : '') +
          '" data-mur-goto="' +
          i +
          '"><span class="mur-thumb-num">' +
          (i + 1) +
          '</span><span class="mur-thumb-label">' +
          escapeHtml(s.label || 'Slide') +
          '</span></button>'
        );
      })
      .join('');
  }

  function renderGrid() {
    if (!presenterState || !presenterState.grid) return;
    presenterState.grid.innerHTML = presenterState.slides
      .map(function (s, i) {
        return (
          '<button type="button" class="mur-grid-card' +
          (i === presenterState.index ? ' is-active' : '') +
          '" data-mur-goto="' +
          i +
          '"><span class="mur-grid-num">' +
          (i + 1) +
          '</span><span class="mur-grid-label">' +
          escapeHtml(s.label || 'Slide') +
          '</span></button>'
        );
      })
      .join('');
  }

  function syncAnnotationCanvas() {
    if (!presenterState) return;
    var canvas = presenterState.annotateCanvas;
    var stage = presenterState.stage;
    if (!canvas || !stage) return;
    var strokes = (presenterState.annotations && presenterState.annotations[presenterState.index]) || [];
    if (!strokes.length && !presenterState.annotateOpen) {
      canvas.setAttribute('hidden', '');
      return;
    }
    canvas.removeAttribute('hidden');
    var rect = stage.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    strokes.forEach(function (stroke) {
      if (!stroke || !stroke.points || stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.lineWidth = stroke.width || 3;
      ctx.strokeStyle = stroke.color || '#f97316';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      stroke.points.forEach(function (pt, i) {
        if (i === 0) ctx.moveTo(pt.x * rect.width, pt.y * rect.height);
        else ctx.lineTo(pt.x * rect.width, pt.y * rect.height);
      });
      ctx.stroke();
    });
  }

  function renderPresenterSlide() {
    if (!presenterState) return;
    var i = presenterState.index;
    var slides = presenterState.slides;
    var stage = presenterState.stage;
    var counter = presenterState.counter;
    var prevBtn = presenterState.prevBtn;
    var nextBtn = presenterState.nextBtn;
    if (!stage || !slides.length) return;
    stage.innerHTML = slides[i].html;
    if (presenterState.buildStep == null) presenterState.buildStep = maxBuildsForSlide();
    applyBuilds();
    if (counter) counter.textContent = i + 1 + ' / ' + slides.length;
    if (prevBtn) prevBtn.disabled = i <= 0 && (presenterState.buildStep || 0) <= 0;
    if (nextBtn) nextBtn.disabled = i >= slides.length - 1 && presenterState.buildStep >= maxBuildsForSlide();
    renderThumbnails();
    renderGrid();
    syncAnnotationCanvas();
    broadcastPresenter({
      type: 'state',
      index: i,
      buildStep: presenterState.buildStep,
      notes: loadSlideNotes(presenterState.data, slides[i], i),
      slideLabel: slides[i].label || '',
      nextHtml: slides[i + 1] ? slides[i + 1].html : '',
      nextLabel: slides[i + 1] ? slides[i + 1].label || '' : '',
      currentHtml: slides[i].html,
      total: slides.length,
    });
  }

  function gotoSlide(index, opts) {
    if (!presenterState) return;
    opts = opts || {};
    if (index < 0 || index >= presenterState.slides.length) return;
    presenterState.index = index;
    presenterState.buildStep = opts.revealAll === false ? 0 : maxBuildsForSlide();
    if (presenterState.gridOpen) setGridOpen(false);
    renderPresenterSlide();
  }

  function stepPresenter(delta) {
    if (!presenterState) return;
    var maxB = maxBuildsForSlide();
    if (delta > 0) {
      // Audience mode: slides open fully revealed. Progressive builds only run when
      // the current slide is intentionally collapsed (buildStep < max).
      if ((presenterState.buildStep || 0) < maxB) {
        presenterState.buildStep = (presenterState.buildStep || 0) + 1;
        applyBuilds();
        broadcastPresenter({ type: 'build', buildStep: presenterState.buildStep, index: presenterState.index });
        return;
      }
      if (presenterState.index >= presenterState.slides.length - 1) return;
      presenterState.index += 1;
      presenterState.buildStep = null; // reveal next slide fully on entry
      renderPresenterSlide();
      return;
    }
    if ((presenterState.buildStep || 0) > 0 && (presenterState.buildStep || 0) < maxB) {
      presenterState.buildStep -= 1;
      applyBuilds();
      broadcastPresenter({ type: 'build', buildStep: presenterState.buildStep, index: presenterState.index });
      return;
    }
    if (presenterState.index <= 0) return;
    presenterState.index -= 1;
    presenterState.buildStep = null; // reveal previous slide fully
    renderPresenterSlide();
  }

  function setSidebarOpen(open) {
    if (!presenterState || !presenterState.root) return;
    presenterState.sidebarOpen = !!open;
    presenterState.root.classList.toggle('mur-sidebar-open', !!open);
  }

  function setGridOpen(open) {
    if (!presenterState || !presenterState.root) return;
    presenterState.gridOpen = !!open;
    presenterState.root.classList.toggle('mur-grid-open', !!open);
    if (presenterState.grid) {
      if (open) {
        presenterState.grid.removeAttribute('hidden');
        renderGrid();
      } else {
        presenterState.grid.setAttribute('hidden', '');
      }
    }
  }

  function setAnnotateOpen(open) {
    if (!presenterState || !presenterState.root) return;
    presenterState.annotateOpen = !!open;
    presenterState.root.classList.toggle('mur-annotate-on', !!open);
    if (presenterState.annotateCanvas) {
      if (open) presenterState.annotateCanvas.removeAttribute('hidden');
      else if (!(presenterState.annotations[presenterState.index] || []).length) {
        presenterState.annotateCanvas.setAttribute('hidden', '');
      } else {
        presenterState.annotateCanvas.removeAttribute('hidden');
      }
    }
    if (open) syncAnnotationCanvas();
  }

  function setChromeHidden(hidden) {
    if (!presenterState || !presenterState.root) return;
    presenterState.chromeHidden = !!hidden;
    presenterState.root.classList.toggle('mur-chrome-hidden', !!hidden);
  }

  function openBoltPresenterWindow() {
    if (!presenterState) return;
    if (presenterState.presenterWin && !presenterState.presenterWin.closed) {
      presenterState.presenterWin.focus();
      renderPresenterSlide();
      return;
    }
    var win = window.open('', 'mur-bolt-presenter', 'width=1100,height=760');
    if (!win) {
      showStatus('Allow pop-ups to open Bolt presenter mode (notes + next slide).', 'error');
      return;
    }
    presenterState.presenterWin = win;
    var title = escapeHtml((presenterState.data && presenterState.data.unitDisplay) || 'Unit report');
    var channelName = presenterState.channelName;
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Presenter · ' +
        title +
        '</title><style>' +
        'body{margin:0;font-family:system-ui,sans-serif;background:#0b1220;color:#e2e8f0;}' +
        '.wrap{display:grid;grid-template-columns:1.1fr 0.9fr;gap:12px;height:100vh;padding:12px;box-sizing:border-box;}' +
        '.panel{background:#111827;border:1px solid #334155;border-radius:12px;padding:12px;overflow:auto;}' +
        'h1{margin:0 0 8px;font-size:16px;} .meta{font-size:12px;color:#94a3b8;margin-bottom:10px;}' +
        '.preview{background:#fff;color:#0f172a;border-radius:10px;aspect-ratio:16/9;overflow:hidden;}' +
        '.preview.small{max-height:220px;} textarea{width:100%;min-height:180px;border-radius:10px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;padding:10px;font:inherit;}' +
        '.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;} button{border:0;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;background:#008751;color:#fff;}' +
        'button.ghost{background:#1e293b;color:#e2e8f0;} .timer{font-size:28px;font-weight:800;letter-spacing:.04em;}' +
        '.empty{padding:16px;color:#64748b;font:14px system-ui,sans-serif;}' +
        '@media(max-width:900px){.wrap{grid-template-columns:1fr;height:auto;}}' +
        '</style></head><body>' +
        '<div class="wrap">' +
        '<div class="panel"><div class="meta" id="p-meta">Presenter mode</div>' +
        '<div class="timer" id="p-timer">00:00</div>' +
        '<div class="row"><button type="button" id="p-prev">Prev</button><button type="button" id="p-next">Next</button>' +
        '<button type="button" class="ghost" id="p-reset">Reset timer</button></div>' +
        '<h1 style="margin-top:16px">Speaker notes</h1>' +
        '<textarea id="p-notes" placeholder="Notes for this slide…"></textarea></div>' +
        '<div class="panel"><h1>Current</h1><div class="preview" id="p-current"></div>' +
        '<h1 style="margin-top:14px">Next</h1><div class="preview small" id="p-next-slide"></div></div>' +
        '</div></body></html>'
    );
    win.document.close();
    var boot = win.document.createElement('script');
    boot.textContent =
      '(function(){var ch=new BroadcastChannel(' +
      JSON.stringify(channelName) +
      ');var start=Date.now();var timerEl=document.getElementById("p-timer");' +
      'setInterval(function(){var ms=Date.now()-start;var s=Math.floor(ms/1000);var m=Math.floor(s/60);s=s%60;' +
      'timerEl.textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");},500);' +
      'document.getElementById("p-reset").onclick=function(){start=Date.now();};' +
      'document.getElementById("p-prev").onclick=function(){ch.postMessage({type:"nav",delta:-1});};' +
      'document.getElementById("p-next").onclick=function(){ch.postMessage({type:"nav",delta:1});};' +
      'var notes=document.getElementById("p-notes");var notesTimer=null;' +
      'notes.addEventListener("input",function(){clearTimeout(notesTimer);notesTimer=setTimeout(function(){' +
      'ch.postMessage({type:"notes",text:notes.value});},200);});' +
      'ch.onmessage=function(ev){var m=ev.data||{};if(m.type==="close"){window.close();return;}' +
      'if(m.type==="state"||m.type==="init"){' +
      'document.getElementById("p-meta").textContent=(m.slideLabel||"Slide")+" · "+((m.index||0)+1)+" / "+(m.total||"?");' +
      'document.getElementById("p-current").innerHTML=m.currentHtml||"";' +
      'document.getElementById("p-next-slide").innerHTML=m.nextHtml||"<p class=\\"empty\\">End of deck</p>";' +
      'if(typeof m.notes==="string") notes.value=m.notes;}};' +
      'ch.postMessage({type:"presenter-ready"});})();';
    win.document.body.appendChild(boot);
    renderPresenterSlide();
  }

  function presentSlides(dataOverride, options) {
    options = options || {};
    var mode = options.mode === 'bolt' ? 'bolt' : 'pptx';
    var data = dataOverride || readForm();
    var err = dataOverride ? validateExportData(data) : validateForm(data);
    if (err) {
      showStatus(err, 'error');
      return Promise.reject(new Error(err));
    }

    closeSlidePresenter();
    var slides = mode === 'bolt' ? buildBoltSlides(data) : buildPptPresenterSlides(data);
    if (!slides.length) {
      showStatus('Nothing to present for this report yet.', 'error');
      return Promise.reject(new Error('empty_deck'));
    }

    var channelName = 'mur-deck-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var channel = null;
    try {
      channel = new BroadcastChannel(channelName);
    } catch (e) {
      channel = null;
    }

    var root = document.createElement('div');
    root.id = 'mur-slide-presenter';
    root.className = mode === 'bolt' ? 'mur-presenter mur-bolt mur-bolt-deck' : 'mur-presenter mur-pptx-deck';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', mode === 'bolt' ? 'Bolt presentation' : 'PowerPoint-style presentation');
    var chromeHtml =
      mode === 'bolt'
        ? '<div class="mur-bolt-dock" data-mur-dock>' +
          '<div class="mur-bolt-dock-left">' +
          '<span class="mur-bolt-badge"><i class="fas fa-bolt"></i> Bolt</span>' +
          '<span class="mur-presenter-title">' +
          escapeHtml(data.unitDisplay || 'Unit') +
          '</span></div>' +
          '<div class="mur-bolt-dock-center">' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="prev" title="Previous (←)"><i class="fas fa-chevron-left"></i></button>' +
          '<span class="mur-presenter-counter" data-mur-counter>1 / ' +
          slides.length +
          '</span>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="next" title="Next (→)"><i class="fas fa-chevron-right"></i></button>' +
          '</div>' +
          '<div class="mur-bolt-dock-right">' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="sidebar" title="Thumbnails (S)"><i class="fas fa-table-columns"></i></button>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="grid" title="Grid (G)"><i class="fas fa-border-all"></i></button>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="presenter" title="Presenter (P)"><i class="fas fa-display"></i></button>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="annotate" title="Draw (A)"><i class="fas fa-pen"></i></button>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="fullscreen" title="Fullscreen (F)"><i class="fas fa-expand"></i></button>' +
          '<button type="button" class="mur-presenter-btn mur-presenter-btn-close" data-mur-action="close" title="Close (Esc)"><i class="fas fa-xmark"></i></button>' +
          '</div></div>'
        : '<div class="mur-presenter-chrome">' +
          '<div class="mur-presenter-meta">' +
          '<span class="mur-pptx-badge"><i class="fas fa-file-powerpoint"></i> PPT</span>' +
          '<span class="mur-presenter-title">' +
          escapeHtml(data.unitDisplay || 'Unit') +
          '</span>' +
          '<span class="mur-presenter-period">' +
          escapeHtml(monthLabel(data.reportYear, data.reportMonth)) +
          '</span></div>' +
          '<div class="mur-presenter-controls">' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="prev" title="Previous (←)"><i class="fas fa-chevron-left"></i></button>' +
          '<span class="mur-presenter-counter" data-mur-counter>1 / ' +
          slides.length +
          '</span>' +
          '<button type="button" class="mur-presenter-btn" data-mur-action="next" title="Next (→)"><i class="fas fa-chevron-right"></i></button>' +
          '<button type="button" class="mur-presenter-btn mur-presenter-btn-text" data-mur-action="fullscreen" title="Fullscreen (F)"><i class="fas fa-expand"></i><span>Full</span></button>' +
          '<button type="button" class="mur-presenter-btn mur-presenter-btn-text" data-mur-action="download" title="Download PowerPoint"><i class="fas fa-download"></i><span>Download</span></button>' +
          '<button type="button" class="mur-presenter-btn mur-presenter-btn-close" data-mur-action="close" title="Close (Esc)"><i class="fas fa-xmark"></i><span>Close</span></button>' +
          '</div></div>';

    root.innerHTML =
      chromeHtml +
      '<div class="mur-presenter-body">' +
      '<aside class="mur-presenter-sidebar" data-mur-thumbs aria-label="Slide thumbnails"></aside>' +
      '<div class="mur-presenter-stage-wrap">' +
      '<button type="button" class="mur-presenter-hit mur-presenter-hit-prev" data-mur-action="prev" aria-label="Previous slide"></button>' +
      '<div class="mur-presenter-stage-frame">' +
      '<div class="mur-presenter-stage" data-mur-stage tabindex="0"></div>' +
      '<canvas class="mur-annotate-canvas" data-mur-annotate hidden></canvas>' +
      '</div>' +
      '<button type="button" class="mur-presenter-hit mur-presenter-hit-next" data-mur-action="next" aria-label="Next slide"></button>' +
      '</div></div>' +
      '<div class="mur-presenter-grid" data-mur-grid hidden></div>';

    document.body.appendChild(root);
    document.body.classList.add('mur-presenter-open');

    var startedAt = Date.now();
    var onKey = function (e) {
      if (!presenterState) return;
      if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
      var key = e.key;
      if (key === 'Escape') {
        e.preventDefault();
        if (presenterState.gridOpen) setGridOpen(false);
        else if (presenterState.annotateOpen) setAnnotateOpen(false);
        else if (presenterState.sidebarOpen) setSidebarOpen(false);
        else if (presenterState.chromeHidden) setChromeHidden(false);
        else closeSlidePresenter();
      } else if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'ArrowDown') {
        e.preventDefault();
        stepPresenter(1);
      } else if (key === 'ArrowLeft' || key === 'PageUp' || key === 'ArrowUp') {
        e.preventDefault();
        stepPresenter(-1);
      } else if (key === 'f' || key === 'F') {
        e.preventDefault();
        if (!document.fullscreenElement && presenterState.root.requestFullscreen) {
          presenterState.root.requestFullscreen().catch(function () {});
        } else if (document.exitFullscreen) {
          document.exitFullscreen().catch(function () {});
        }
      } else if ((key === 's' || key === 'S') && presenterState.mode === 'bolt') {
        e.preventDefault();
        setSidebarOpen(!presenterState.sidebarOpen);
      } else if ((key === 'g' || key === 'G') && presenterState.mode === 'bolt') {
        e.preventDefault();
        setGridOpen(!presenterState.gridOpen);
      } else if ((key === 'p' || key === 'P') && presenterState.mode === 'bolt') {
        e.preventDefault();
        openBoltPresenterWindow();
      } else if ((key === 'a' || key === 'A') && presenterState.mode === 'bolt') {
        e.preventDefault();
        setAnnotateOpen(!presenterState.annotateOpen);
      } else if ((key === 'h' || key === 'H') && presenterState.mode === 'bolt') {
        e.preventDefault();
        setChromeHidden(!presenterState.chromeHidden);
      } else if (key === 'Home') {
        e.preventDefault();
        gotoSlide(0, { revealAll: false });
      } else if (key === 'End') {
        e.preventDefault();
        gotoSlide(presenterState.slides.length - 1);
      }
    };

    presenterState = {
      root: root,
      slides: slides,
      data: data,
      index: 0,
      // null → renderPresenterSlide reveals the full slide (Bolt used to start at 0
      // which left .mur-build content at opacity:0 and looked "broken").
      buildStep: null,
      annotations: {},
      channel: channel,
      channelName: channelName,
      presenterWin: null,
      sidebarOpen: false,
      gridOpen: false,
      annotateOpen: false,
      chromeHidden: false,
      startedAt: startedAt,
      stage: root.querySelector('[data-mur-stage]'),
      thumbs: root.querySelector('[data-mur-thumbs]'),
      grid: root.querySelector('[data-mur-grid]'),
      annotateCanvas: root.querySelector('[data-mur-annotate]'),
      counter: root.querySelector('[data-mur-counter]'),
      prevBtn:
        root.querySelector('.mur-presenter-controls [data-mur-action="prev"]') ||
        root.querySelector('.mur-bolt-dock [data-mur-action="prev"]'),
      nextBtn:
        root.querySelector('.mur-presenter-controls [data-mur-action="next"]') ||
        root.querySelector('.mur-bolt-dock [data-mur-action="next"]'),
      mode: mode,
      onKey: onKey,
    };

    if (channel) {
      channel.onmessage = function (ev) {
        var msg = ev.data || {};
        if (msg.type === 'nav') stepPresenter(msg.delta || 0);
        else if (msg.type === 'presenter-ready') renderPresenterSlide();
        else if (msg.type === 'notes') {
          saveSlideNotes(presenterState.data, presenterState.index, String(msg.text || ''));
        } else if (msg.type === 'goto' && typeof msg.index === 'number') {
          gotoSlide(msg.index);
        }
      };
    }

    root.addEventListener('click', function (e) {
      var gotoBtn = e.target.closest('[data-mur-goto]');
      if (gotoBtn) {
        e.preventDefault();
        gotoSlide(parseInt(gotoBtn.getAttribute('data-mur-goto'), 10));
        return;
      }
      var btn = e.target.closest('[data-mur-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-mur-action');
      if (action === 'prev') stepPresenter(-1);
      else if (action === 'next') stepPresenter(1);
      else if (action === 'close') closeSlidePresenter();
      else if (action === 'download') downloadPptx(presenterState.data).catch(function () {});
      else if (action === 'fullscreen') {
        if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(function () {});
        else if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      } else if (action === 'sidebar') setSidebarOpen(!presenterState.sidebarOpen);
      else if (action === 'grid') setGridOpen(!presenterState.gridOpen);
      else if (action === 'presenter') openBoltPresenterWindow();
      else if (action === 'annotate') setAnnotateOpen(!presenterState.annotateOpen);
    });

    var canvas = presenterState.annotateCanvas;
    var drawing = null;
    function pointerPos(ev) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: (ev.clientX - rect.left) / Math.max(rect.width, 1),
        y: (ev.clientY - rect.top) / Math.max(rect.height, 1),
      };
    }
    if (canvas) {
      canvas.addEventListener('pointerdown', function (ev) {
        if (!presenterState.annotateOpen) return;
        canvas.removeAttribute('hidden');
        drawing = { color: '#f97316', width: 3, points: [pointerPos(ev)] };
        canvas.setPointerCapture(ev.pointerId);
      });
      canvas.addEventListener('pointermove', function (ev) {
        if (!drawing) return;
        drawing.points.push(pointerPos(ev));
        if (!presenterState.annotations[presenterState.index]) presenterState.annotations[presenterState.index] = [];
        var list = presenterState.annotations[presenterState.index];
        if (list[list.length - 1] !== drawing) list.push(drawing);
        syncAnnotationCanvas();
      });
      canvas.addEventListener('pointerup', function () {
        drawing = null;
      });
    }

    var touchX = null;
    root.addEventListener(
      'touchstart',
      function (e) {
        if (presenterState.annotateOpen) return;
        if (e.changedTouches && e.changedTouches[0]) touchX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );
    root.addEventListener(
      'touchend',
      function (e) {
        if (presenterState.annotateOpen || touchX == null || !e.changedTouches || !e.changedTouches[0]) return;
        var dx = e.changedTouches[0].clientX - touchX;
        touchX = null;
        if (Math.abs(dx) < 50) return;
        stepPresenter(dx < 0 ? 1 : -1);
      },
      { passive: true }
    );

    window.addEventListener('resize', syncAnnotationCanvas);
    presenterState.onResize = syncAnnotationCanvas;

    document.addEventListener('keydown', onKey);
    renderPresenterSlide();
    if (presenterState.stage) presenterState.stage.focus();
    return Promise.resolve({ ok: true, mode: mode, slides: slides.length });
  }

  function presentPptSlides(dataOverride) {
    return presentSlides(dataOverride, { mode: 'pptx' });
  }

  function presentBoltSlides(dataOverride) {
    return presentSlides(dataOverride, { mode: 'bolt' });
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
    // Default to previous calendar month for monthly reports (current month is often unfinished).
    var defaultMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var defaultYear = defaultMonthDate.getFullYear();
    var defaultMonth = defaultMonthDate.getMonth();
    if (yearSel) yearSel.value = String(defaultYear);
    months.forEach(function (name, i) {
      var opt = document.createElement('option');
      opt.value = String(i + 1);
      opt.textContent = name;
      if (i === defaultMonth) opt.selected = true;
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
    if (data.meetingNotesSummary) fd.append('Meeting notes summary', data.meetingNotesSummary);
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
    ['activities', 'highlights', 'testimonies', 'challenges', 'prayer-requests', 'next-month', 'meetings-held', 'attendance', 'meeting-notes-summary'].forEach(
      function (id) {
        var el = $(id);
        if (el) el.addEventListener('input', updatePreview);
      }
    );

    var pdfBtn = $('btn-download-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', downloadPdf);
    var pptxFileBtn = $('btn-download-pptx-file');
    if (pptxFileBtn) {
      pptxFileBtn.addEventListener('click', function () {
        downloadPptx().catch(function () {});
      });
    }
    var pptxBtn = $('btn-download-pptx');
    if (pptxBtn) pptxBtn.addEventListener('click', presentPptSlides);
    var boltBtn = $('btn-present-bolt');
    if (boltBtn) boltBtn.addEventListener('click', presentBoltSlides);
    var printBtn = $('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        var data = readForm();
        var err = validateForm(data);
        if (err) {
          showStatus(err, 'error');
          return;
        }
        openPrintableReport(data);
      });
    }
    var emailBtn = $('btn-email-report');
    if (emailBtn) emailBtn.addEventListener('click', emailReport);
    var submitBtn = $('btn-submit-coordinator');
    if (submitBtn) submitBtn.addEventListener('click', submitToCoordinator);

    updatePreview();
  }

  var initialized = false;

  function resetInit() {
    initialized = false;
  }

  function init() {
    if (!$('report-month') && !$('unit-cards')) return;
    if (!initialized) {
      bind();
      initialized = true;
    }
    updatePreview();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.MonthlyUnitReport = {
    UNITS: UNITS,
    UNIT_CATEGORIES: UNIT_CATEGORIES,
    readForm: readForm,
    buildReportHtml: buildReportHtml,
    updatePreview: updatePreview,
    init: init,
    resetInit: resetInit,
    validateForm: validateForm,
    validateExportData: validateExportData,
    fromSubmittedReport: fromSubmittedReport,
    downloadPdf: downloadPdf,
    downloadPptx: downloadPptx,
    presentSlides: presentPptSlides,
    presentPptSlides: presentPptSlides,
    presentBoltSlides: presentBoltSlides,
    closeSlidePresenter: closeSlidePresenter,
    openPrintableReport: openPrintableReport,
    emailReport: emailReport,
    submitToCoordinator: submitToCoordinator,
    getPhotos: getPhotos,
    setPhotos: setPhotos,
    renderPhotoGrid: renderPhotoGrid,
  };
})(typeof window !== 'undefined' ? window : this);
