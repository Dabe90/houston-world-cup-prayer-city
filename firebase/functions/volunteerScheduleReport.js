'use strict';

const DATE_ORDER = [
  'June 14, 2026',
  'June 17, 2026',
  'June 20, 2026',
  'June 23, 2026',
  'June 26, 2026',
  'June 29, 2026',
  'July 4, 2026',
];

const DAY_LABEL = {
  'June 14, 2026': 'Sunday',
  'June 17, 2026': 'Wednesday',
  'June 20, 2026': 'Saturday',
  'June 23, 2026': 'Tuesday',
  'June 26, 2026': 'Friday',
  'June 29, 2026': 'Monday',
  'July 4, 2026': 'Saturday',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseShiftLine(line) {
  const parts = String(line || '')
    .trim()
    .split(/\s*—\s*/);
  if (parts.length < 2) return null;
  const date = parts[0].trim();
  if (parts.length >= 3) {
    return { date, time: parts[1].trim(), role: parts.slice(2).join(' — ').trim() };
  }
  return { date, time: '', role: parts.slice(1).join(' — ').trim() };
}

function parseShiftsText(shiftsText) {
  const slots = [];
  String(shiftsText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const slot = parseShiftLine(line);
      if (slot && slot.date) slots.push(slot);
    });
  return slots;
}

function timeSortKey(timeStr) {
  const m = String(timeStr || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return 9999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/**
 * @param {Array<{ name, email, phone, tent, shifts }>} volunteers
 */
function buildScheduleGrid(volunteers) {
  /** @type {Map<string, Map<string, Array>>} */
  const byDate = new Map();
  const unscheduled = [];

  for (const vol of volunteers) {
    const slots = parseShiftsText(vol.shifts);
    if (!slots.length) {
      if (String(vol.name || vol.email || '').trim()) {
        unscheduled.push(vol);
      }
      continue;
    }
    for (const slot of slots) {
      if (!byDate.has(slot.date)) byDate.set(slot.date, new Map());
      const byTime = byDate.get(slot.date);
      const timeKey = slot.time || '(time TBD)';
      if (!byTime.has(timeKey)) byTime.set(timeKey, []);
      byTime.get(timeKey).push({
        name: vol.name || vol.email,
        email: vol.email || '',
        phone: vol.phone || '',
        tent: vol.tent || '',
        role: slot.role || vol.position || '',
      });
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => {
    const ai = DATE_ORDER.indexOf(a);
    const bi = DATE_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return { dates, byDate, unscheduled };
}

function formatPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(phone || '').trim();
}

/**
 * @param {{ dates, byDate, unscheduled }} grid
 * @param {{ generatedAt?: string, filterDate?: string }} opts
 */
function buildScheduleEmail(grid, opts = {}) {
  const generatedAt =
    opts.generatedAt ||
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'short' });
  const filterDate = opts.filterDate ? String(opts.filterDate).trim() : '';

  let dates = grid.dates;
  if (filterDate) {
    dates = dates.filter((d) => d === filterDate);
  }

  const subject = filterDate
    ? `Prayer City volunteer schedule — ${filterDate}`
    : 'Prayer City volunteer schedule — all serve days';

  const plainLines = [
    'Houston World Cup Prayer City — Volunteer schedule',
    `Generated ${generatedAt} (Central Time)`,
    '',
  ];

  const htmlParts = [
    '<div style="font-family:system-ui,sans-serif;max-width:720px;color:#0f172a;line-height:1.45">',
    '<h1 style="font-size:20px;margin:0 0 4px">Houston World Cup Prayer City</h1>',
    '<p style="margin:0 0 16px;color:#475569;font-size:14px">Volunteer schedule · ',
    escapeHtml(generatedAt),
    ' Central</p>',
  ];

  let totalSlots = 0;

  for (const date of dates) {
    const byTime = grid.byDate.get(date);
    if (!byTime) continue;
    const dayName = DAY_LABEL[date] || '';
    const heading = dayName ? `${date} (${dayName})` : date;

    plainLines.push('='.repeat(heading.length));
    plainLines.push(heading);
    plainLines.push('='.repeat(heading.length));
    plainLines.push('');

    htmlParts.push(
      `<h2 style="font-size:17px;margin:24px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px">${escapeHtml(heading)}</h2>`
    );

    const times = [...byTime.keys()].sort((a, b) => timeSortKey(a) - timeSortKey(b));
    for (const time of times) {
      const people = byTime.get(time) || [];
      people.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      totalSlots += people.length;

      plainLines.push(`  ${time}`);
      plainLines.push(`  ${'-'.repeat(Math.max(time.length, 8))}`);

      htmlParts.push(
        `<h3 style="font-size:14px;margin:14px 0 6px;color:#334155">${escapeHtml(time)}</h3>`,
        '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px">',
        '<thead><tr style="background:#f1f5f9;text-align:left">',
        '<th style="padding:6px 8px;border:1px solid #e2e8f0">Name</th>',
        '<th style="padding:6px 8px;border:1px solid #e2e8f0">Role</th>',
        '<th style="padding:6px 8px;border:1px solid #e2e8f0">Tent</th>',
        '<th style="padding:6px 8px;border:1px solid #e2e8f0">Phone</th>',
        '</tr></thead><tbody>'
      );

      for (const p of people) {
        const phone = formatPhone(p.phone);
        const tent = p.tent || '—';
        plainLines.push(`    • ${p.name} · ${p.role || '—'} · ${tent}${phone ? ` · ${phone}` : ''}`);
        htmlParts.push(
          '<tr>',
          `<td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(p.name)}</td>`,
          `<td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(p.role || '—')}</td>`,
          `<td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(tent)}</td>`,
          `<td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(phone || '—')}</td>`,
          '</tr>'
        );
      }
      plainLines.push('');
      htmlParts.push('</tbody></table>');
    }
  }

  if (!filterDate && grid.unscheduled.length) {
    plainLines.push('— Volunteers with no shifts saved —');
    htmlParts.push(
      '<h2 style="font-size:15px;margin:24px 0 8px;color:#64748b">No shifts saved yet</h2>',
      '<ul style="font-size:13px;color:#475569">'
    );
    grid.unscheduled
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .forEach((v) => {
        plainLines.push(`  • ${v.name || v.email}${v.email ? ` (${v.email})` : ''}`);
        htmlParts.push(`<li>${escapeHtml(v.name || v.email)}</li>`);
      });
    htmlParts.push('</ul>');
  }

  plainLines.push('');
  plainLines.push(`Total shift assignments listed: ${totalSlots}`);
  plainLines.push('Parking: free street parking near 1325 La Concha Lane · Day-of: Tricia 832-277-3831');

  htmlParts.push(
    `<p style="font-size:12px;color:#64748b;margin-top:20px">${totalSlots} shift assignment(s) · Free street parking near 1325 La Concha Lane · Day-of Tricia 832-277-3831</p>`,
    '</div>'
  );

  return {
    subject,
    plainBody: plainLines.join('\n'),
    htmlBody: htmlParts.join(''),
    stats: { dates: dates.length, assignments: totalSlots, unscheduled: grid.unscheduled.length },
  };
}

module.exports = {
  parseShiftsText,
  buildScheduleGrid,
  buildScheduleEmail,
  DATE_ORDER,
};
