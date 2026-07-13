/**
 * Nigeria DDBS unit meeting schedules (Africa/Lagos — WAT).
 * Times are local Nigeria time; end may cross midnight (prayer team).
 */
(function (global) {
  var TZ = 'Africa/Lagos';

  /** @type {Array<{id:string,label:string,summary:string,icon:string,gradient:string,day:number,start:string,end:string,endNextDay?:boolean,enlistHidden?:boolean}>} */
  var NIGERIA_UNITS = [
    {
      id: 'moderators-presenters',
      label: 'Moderators & Presenters',
      summary: 'Host and present our weekly virtual Bible study — guide the flow, welcome participants, and keep sessions engaging.',
      icon: 'fa-microphone-lines',
      gradient: 'from-violet-500 to-purple-700',
      day: 1,
      start: '21:30',
      end: '22:30',
    },
    {
      id: 'bible-study',
      label: 'Bible Study Team',
      summary: 'Prepare and teach the Word — lesson plans, discussion questions, and solid biblical content for each meeting.',
      icon: 'fa-book-bible',
      gradient: 'from-slate-700 to-blue-800',
      day: 2,
      start: '20:30',
      end: '21:30',
    },
    {
      id: 'prayer',
      label: 'Prayer Team',
      summary: 'Cover the ministry in prayer — lead intercession, pray over members and requests, and stand in the gap for Nigeria.',
      icon: 'fa-hands-praying',
      gradient: 'from-violet-500 to-indigo-700',
      day: 2,
      start: '23:15',
      end: '00:30',
      endNextDay: true,
    },
    {
      id: 'welcome-hospitality',
      label: 'Welcome & Hospitality',
      summary: 'Greet and care for people — welcome newcomers, follow up, and help everyone feel at home in Dear Daughter.',
      icon: 'fa-door-open',
      gradient: 'from-amber-400 to-yellow-600',
      day: 3,
      start: '22:00',
      end: '22:30',
    },
    {
      id: 'creative',
      label: 'Creative Unit',
      summary: 'Design visuals and creative assets — flyers, slides, branding, and artwork that carry our message with excellence.',
      icon: 'fa-palette',
      gradient: 'from-rose-400 to-pink-600',
      day: 4,
      start: '20:00',
      end: '21:00',
    },
    {
      id: 'choir',
      label: 'Choir',
      summary: 'Lead worship in song — rehearse, minister musically, and help the congregation encounter God through praise.',
      icon: 'fa-music',
      gradient: 'from-amber-400 to-orange-600',
      day: 0,
      start: '20:30',
      end: '21:30',
    },
    {
      id: 'growth-retention',
      label: 'Growth & Retention',
      summary: 'Help members grow and stay connected — follow up, encourage participation, and nurture long-term engagement.',
      icon: 'fa-seedling',
      gradient: 'from-emerald-500 to-teal-700',
      day: 6,
      start: '20:00',
      end: '21:00',
    },
    {
      id: 'communications-social',
      label: 'Communications & Social Media',
      summary: 'Tell our story online — posts, announcements, and social content that keep the community informed and inspired.',
      icon: 'fa-hashtag',
      gradient: 'from-sky-500 to-blue-700',
      day: 1,
      start: '20:00',
      end: '20:30',
    },
    {
      id: 'media',
      label: 'Media Team',
      summary: 'Run production behind the scenes — live stream, video, audio, and tech so every meeting is clear and reliable.',
      icon: 'fa-video',
      gradient: 'from-slate-600 to-slate-900',
      day: 6,
      start: '19:00',
      end: '20:00',
    },
    {
      id: 'group1',
      label: 'Group 1',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-indigo-500 to-indigo-700',
      day: 1,
      start: '21:00',
      end: '21:15',
    },
    {
      id: 'group2',
      label: 'Group 2',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-blue-500 to-blue-700',
      day: 0,
      start: '17:00',
      end: '17:15',
    },
    {
      id: 'group3',
      label: 'Group 3',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-cyan-500 to-cyan-700',
      day: 3,
      start: '21:00',
      end: '21:15',
    },
    {
      id: 'group4',
      label: 'Group 4',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-lime-500 to-green-600',
      day: 4,
      start: '20:30',
      end: '20:45',
    },
    {
      id: 'group5',
      label: 'Group 5',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-orange-500 to-orange-700',
      day: 1,
      start: '21:00',
      end: '21:15',
    },
    {
      id: 'group6',
      label: 'Group 6',
      summary: 'A DDBS small group — gather weekly to study the Word, pray, and grow together.',
      icon: 'fa-users',
      gradient: 'from-fuchsia-500 to-fuchsia-700',
      day: 1,
      start: '21:00',
      end: '21:15',
    },
    {
      id: 'workers-coordinator',
      label: 'Workers Coordinator',
      summary: 'Oversee worker onboarding — Workers Training Class, placement, and clearing workers for hub access.',
      icon: 'fa-user-shield',
      gradient: 'from-indigo-600 to-violet-800',
      day: 3,
      start: '21:00',
      end: '21:30',
      enlistHidden: true,
    },
  ];

  var WORKFORCE_ENLIST_EXCLUDE = { 'workers-coordinator': true };

  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function getUnit(id) {
    return NIGERIA_UNITS.find(function (u) {
      return u.id === id;
    });
  }

  function parseHm(hm) {
    var p = String(hm).split(':');
    return { h: parseInt(p[0], 10), m: parseInt(p[1], 10) };
  }

  /** YYYY-MM-DD in Lagos */
  function ymdInLagos(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  function lagosParts(d) {
    var fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    var parts = {};
    fmt.formatToParts(d).forEach(function (p) {
      if (p.type !== 'literal') parts[p.type] = p.value;
    });
    return parts;
  }

  function lagosWeekday(d) {
    var w = lagosParts(d).weekday;
    return DAY_NAMES.indexOf(w) >= 0
      ? DAY_NAMES.indexOf(w)
      : { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[w.slice(0, 3)];
  }

  /** Build Date (UTC instant) for a Lagos local datetime on dateYmd */
  function lagosLocalToDate(dateYmd, hm) {
    var t = parseHm(hm);
    var iso = dateYmd + 'T' + String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0') + ':00';
    var guess = new Date(iso + '+01:00');
    return guess;
  }

  function formatTime12(hm) {
    var t = parseHm(hm);
    var h = t.h;
    var ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return h + ':' + String(t.m).padStart(2, '0') + ' ' + ampm;
  }

  function meetingScheduleLabel(unit) {
    return (
      DAY_NAMES[unit.day] +
      ' · ' +
      formatTime12(unit.start) +
      ' – ' +
      formatTime12(unit.end) +
      ' WAT'
    );
  }

  /**
   * Meeting key for a specific occurrence date (start date in Lagos YMD).
   */
  function meetingKey(unitId, dateYmd) {
    return unitId + '_' + dateYmd;
  }

  /**
   * Get meeting window { start, end, dateYmd, key } for unit on or after fromDate.
   */
  function getNextMeeting(unit, fromDate) {
    fromDate = fromDate || new Date();
    var now = fromDate;
    for (var i = 0; i < 14; i++) {
      var d = new Date(now.getTime() + i * 86400000);
      if (lagosWeekday(d) !== unit.day) continue;
      var dateYmd = ymdInLagos(d);
      var start = lagosLocalToDate(dateYmd, unit.start);
      var endYmd = dateYmd;
      if (unit.endNextDay) {
        var next = new Date(d.getTime() + 86400000);
        endYmd = ymdInLagos(next);
      }
      var end = lagosLocalToDate(endYmd, unit.end);
      if (end <= start) end = new Date(end.getTime() + 86400000);
      if (i === 0 && now > end) continue;
      return {
        unitId: unit.id,
        dateYmd: dateYmd,
        key: meetingKey(unit.id, dateYmd),
        start: start,
        end: end,
        scheduleLabel: meetingScheduleLabel(unit),
        dayName: DAY_NAMES[unit.day],
      };
    }
    return null;
  }

  /** Check-in opens 20 min before start, closes 45 min after end */
  var CHECK_IN_OPEN_MIN_BEFORE = 15;
  var CHECK_IN_CLOSE_MIN_AFTER = 10;

  function isWithinCheckInWindow(meeting, now) {
    now = now || new Date();
    var open = new Date(meeting.start.getTime() - CHECK_IN_OPEN_MIN_BEFORE * 60000);
    var close = new Date(meeting.end.getTime() + CHECK_IN_CLOSE_MIN_AFTER * 60000);
    return now >= open && now <= close;
  }

  /** All scheduled meeting keys in a calendar month (Lagos) */
  function meetingsInMonth(unit, year, month) {
    var out = [];
    var d = new Date(Date.UTC(year, month - 1, 1));
    var end = new Date(Date.UTC(year, month, 0));
    while (d <= end) {
      if (lagosWeekday(d) === unit.day) {
        var dateYmd = ymdInLagos(d);
        var start = lagosLocalToDate(dateYmd, unit.start);
        var endYmd = dateYmd;
        if (unit.endNextDay) {
          endYmd = ymdInLagos(new Date(d.getTime() + 86400000));
        }
        var endDt = lagosLocalToDate(endYmd, unit.end);
        if (endDt <= start) endDt = new Date(endDt.getTime() + 86400000);
        out.push({
          key: meetingKey(unit.id, dateYmd),
          dateYmd: dateYmd,
          start: start,
          end: endDt,
          dayName: DAY_NAMES[unit.day],
          scheduleLabel: meetingScheduleLabel(unit),
        });
      }
      d = new Date(d.getTime() + 86400000);
    }
    return out;
  }

  function normalizeNigeriaPhone(input) {
    var digits = String(input || '').replace(/\D/g, '');
    if (digits.startsWith('234')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length < 9 || digits.length > 11) return null;
    return '+234' + digits;
  }

  function isNigeriaPhone(phone) {
    var raw = String(phone || '').replace(/\s/g, '');
    if (/^\+234\d{9,11}$/.test(raw)) return true;
    if (/^234\d{9,11}$/.test(raw)) return true;
    if (/^0[789]\d{9}$/.test(raw)) return true;
    return false;
  }

  function phoneFromRegistration(phone) {
    var norm = normalizeNigeriaPhone(phone);
    if (norm) return norm;
    var raw = String(phone || '').replace(/\s/g, '');
    if (/^234\d{9,11}$/.test(raw)) return '+' + raw;
    return null;
  }

  /** Recent + upcoming occurrences for shared meeting notes picker */
  function meetingsForNotes(unit, windowSize) {
    windowSize = windowSize || 8;
    var now = new Date();
    var parts = lagosParts(now);
    var year = parseInt(parts.year, 10);
    var month = parseInt(parts.month, 10);
    var meetings = [];
    var m;
    for (m = month - 2; m <= month + 2; m++) {
      var y = year;
      var mo = m;
      if (mo < 1) {
        mo += 12;
        y -= 1;
      } else if (mo > 12) {
        mo -= 12;
        y += 1;
      }
      meetings = meetings.concat(meetingsInMonth(unit, y, mo));
    }
    meetings.sort(function (a, b) {
      return a.start - b.start;
    });
    var nowMs = now.getTime();
    var pivot = 0;
    for (var i = 0; i < meetings.length; i++) {
      if (meetings[i].end >= nowMs) {
        pivot = i;
        break;
      }
      pivot = i + 1;
    }
    var start = Math.max(0, pivot - 3);
    return meetings.slice(start, start + windowSize);
  }

  global.NigeriaUnits = {
    TZ: TZ,
    NIGERIA_UNITS: NIGERIA_UNITS,
    WORKFORCE_ENLIST_EXCLUDE: WORKFORCE_ENLIST_EXCLUDE,
    enlistableUnits: function () {
      return NIGERIA_UNITS.filter(function (u) {
        return !WORKFORCE_ENLIST_EXCLUDE[u.id] && !u.enlistHidden;
      });
    },
    DAY_NAMES: DAY_NAMES,
    getUnit: getUnit,
    meetingScheduleLabel: meetingScheduleLabel,
    meetingKey: meetingKey,
    getNextMeeting: getNextMeeting,
    meetingsForNotes: meetingsForNotes,
    isWithinCheckInWindow: isWithinCheckInWindow,
    meetingsInMonth: meetingsInMonth,
    ymdInLagos: ymdInLagos,
    normalizeNigeriaPhone: normalizeNigeriaPhone,
    isNigeriaPhone: isNigeriaPhone,
    phoneFromRegistration: phoneFromRegistration,
    formatTime12: formatTime12,
  };
})(typeof window !== 'undefined' ? window : this);
