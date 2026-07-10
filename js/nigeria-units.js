/**
 * Nigeria DDBS unit meeting schedules (Africa/Lagos — WAT).
 * Times are local Nigeria time; end may cross midnight (prayer team).
 */
(function (global) {
  var TZ = 'Africa/Lagos';

  /** @type {Array<{id:string,label:string,icon:string,gradient:string,day:number,start:string,end:string,endNextDay?:boolean}>} */
  var NIGERIA_UNITS = [
    {
      id: 'moderators-presenters',
      label: 'Moderators & Presenters',
      icon: 'fa-microphone-lines',
      gradient: 'from-violet-500 to-purple-700',
      day: 1,
      start: '21:30',
      end: '22:30',
    },
    {
      id: 'bible-study',
      label: 'Bible Study Team',
      icon: 'fa-book-bible',
      gradient: 'from-slate-700 to-blue-800',
      day: 2,
      start: '20:30',
      end: '21:30',
    },
    {
      id: 'prayer',
      label: 'Prayer Team',
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
      icon: 'fa-door-open',
      gradient: 'from-amber-400 to-yellow-600',
      day: 3,
      start: '22:00',
      end: '22:30',
    },
    {
      id: 'creative',
      label: 'Creative Unit',
      icon: 'fa-palette',
      gradient: 'from-rose-400 to-pink-600',
      day: 4,
      start: '20:00',
      end: '21:00',
    },
    {
      id: 'choir',
      label: 'Choir',
      icon: 'fa-music',
      gradient: 'from-amber-400 to-orange-600',
      day: 0,
      start: '20:30',
      end: '21:30',
    },
  ];

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
  function isWithinCheckInWindow(meeting, now) {
    now = now || new Date();
    var open = new Date(meeting.start.getTime() - 20 * 60000);
    var close = new Date(meeting.end.getTime() + 45 * 60000);
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

  global.NigeriaUnits = {
    TZ: TZ,
    NIGERIA_UNITS: NIGERIA_UNITS,
    DAY_NAMES: DAY_NAMES,
    getUnit: getUnit,
    meetingScheduleLabel: meetingScheduleLabel,
    meetingKey: meetingKey,
    getNextMeeting: getNextMeeting,
    isWithinCheckInWindow: isWithinCheckInWindow,
    meetingsInMonth: meetingsInMonth,
    ymdInLagos: ymdInLagos,
    normalizeNigeriaPhone: normalizeNigeriaPhone,
    isNigeriaPhone: isNigeriaPhone,
    phoneFromRegistration: phoneFromRegistration,
    formatTime12: formatTime12,
  };
})(typeof window !== 'undefined' ? window : this);
