/**
 * Class of David (COD) — cohort 2026/2027 curriculum & roles.
 * Each academic "year" runs one calendar month (9 months total).
 * Assignment naming: Y{year}-A{seq}-{slug} (see assignmentTemplate).
 */
(function (global) {
  var COHORT = "2027";
  var COHORT_LABEL = "2026/2027";
  /** First academic month begins October 2026 (Year 1). */
  var COHORT_START_YEAR = 2026;
  var COHORT_START_MONTH = 9;
  var TIMEZONE = "Africa/Lagos";
  var CLASS_RHYTHM = "Third Saturday of each month";
  var DEFAULT_CLASS_TIME = "10:00 AM WAT";
  var TUESDAY_PRAYER_LABEL = "Tuesday prayer · 10:00 PM WAT";
  var ATTENDANCE_OFFICER_ID = "amarachi";
  var DEFAULT_CLASS_FORMAT =
    "Monthly live class on the third Saturday (WAT), Tuesday prayer at 10:00 PM WAT, plus assignments between sessions.";

  var CALENDAR_MONTHS = [
    "October",
    "November",
    "December",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
  ];

  var YEARS = [
    {
      year: 1,
      title: "The Sanctified Life",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 2,
      title: "Holy Spirit baptism",
      teachers: [{ id: "cecilia", name: "Cecilia Alabede" }],
    },
    {
      year: 3,
      title: "The Disciple of Christ 1 — Basics",
      teachers: [
        { id: "veronica", name: "Veronica Ekoja" },
        { id: "amarachi", name: "Nnodum Amarachi" },
      ],
    },
    {
      year: 4,
      title: "Disciple of Christ 2 — Greater works",
      teachers: [{ id: "elizabeth", name: "Ojenor Elizabeth" }],
    },
    {
      year: 5,
      title: "The Anointing — Essentials of service",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 6,
      title: "The Anointing — How to sustain it",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 7,
      title: "MountainTop experience",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 8,
      title: "Practicals",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 9,
      title: "Spiritual offices and roles",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
  ];

  YEARS.forEach(function (y, idx) {
    y.calendarMonth = CALENDAR_MONTHS[idx] || "";
    y.leadTeacherId = y.teachers[0] ? y.teachers[0].id : "";
  });

  /** Who authors assignments (may differ from teaching lead). */
  var ASSIGNMENT_OWNERS = {
    1: [{ id: "cecilia", name: "Cecilia Alabede", count: 1 }],
    2: [
      { id: "veronica", name: "Veronica Ekoja", count: 1 },
      { id: "amarachi", name: "Nnodum Amarachi", count: 1 },
    ],
    3: [],
    4: [
      { id: "veronica", name: "Veronica Ekoja", count: 1 },
      { id: "amarachi", name: "Nnodum Amarachi", count: 1 },
    ],
    5: [{ id: "elizabeth", name: "Ojenor Elizabeth", count: 2 }],
    6: [{ id: "cecilia", name: "Cecilia Alabede", count: 2 }],
    7: [{ id: "elizabeth", name: "Ojenor Elizabeth", count: 2 }],
    8: [
      { id: "veronica", name: "Veronica Ekoja", count: 1 },
      { id: "amarachi", name: "Nnodum Amarachi", count: 1 },
    ],
    9: [
      { id: "veronica", name: "Veronica Ekoja", count: 1 },
      { id: "amarachi", name: "Nnodum Amarachi", count: 1 },
    ],
  };

  var PEOPLE = {
    damilola: {
      id: "damilola",
      name: "Abe Damilola",
      role: "President / Instructor",
      image: "/cod/abe.png",
    },
    cecilia: {
      id: "cecilia",
      name: "Cecilia Alabede",
      role: "Coordinator",
      image: "/cod/cecilia.jpeg",
    },
    veronica: {
      id: "veronica",
      name: "Veronica Ekoja",
      role: "Coordinator",
      image: "/cod/veronica.jpeg",
    },
    amarachi: {
      id: "amarachi",
      name: "Nnodum Amarachi",
      role: "Coordinator",
      image: "/cod/amarachi.jpeg",
    },
    elizabeth: {
      id: "elizabeth",
      name: "Ojenor Elizabeth",
      role: "Coordinator",
      image: "/cod/elizabeth.jpeg",
    },
  };

  var ADMIN_EMAILS = ["ddbs.htx@gmail.com", "abuxberkeley@gmail.com"];

  /** Emails coordinators use to sign in (extend in Admin → Settings). */
  var DEFAULT_COORDINATOR_EMAILS = {
    cecilia: "cissydupsy@gmail.com",
    veronica: "",
    amarachi: "",
    elizabeth: "",
  };

  var assignmentTemplate = {
    codePattern: "DearDaughter_COD07_HW{n}",
    sections: [
      "Working title (DearDaughter_COD07_HWn)",
      "Issue date",
      "Submission deadline",
      "Time",
      "Instructions",
      "Questions",
    ],
    studentVisibleSections: [
      "Assignment title",
      "Issue date",
      "Submission deadline",
      "Time",
      "Instructions",
      "Questions",
    ],
  };

  function yearByNumber(n) {
    return YEARS.filter(function (y) {
      return y.year === n;
    })[0];
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function thirdSaturday(year, monthIndex) {
    var d = new Date(year, monthIndex, 1);
    var count = 0;
    while (d.getMonth() === monthIndex) {
      if (d.getDay() === 6) {
        count++;
        if (count === 3) return new Date(d.getTime());
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  function nextClassSession(from) {
    from = from || new Date();
    var probe = new Date(from.getFullYear(), from.getMonth(), 1);
    for (var i = 0; i < 18; i++) {
      var sat = thirdSaturday(probe.getFullYear(), probe.getMonth());
      if (sat && startOfDay(sat) >= startOfDay(from)) return sat;
      probe.setMonth(probe.getMonth() + 1);
    }
    return null;
  }

  function upcomingClassSessions(count, from) {
    count = count || 6;
    from = from || new Date();
    var out = [];
    var cursor = startOfDay(from);
    while (out.length < count) {
      var next = nextClassSession(cursor);
      if (!next) break;
      out.push(new Date(next.getTime()));
      cursor = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1);
    }
    return out;
  }

  function academicMonthsSinceStart(date) {
    date = date || new Date();
    return (
      (date.getFullYear() - COHORT_START_YEAR) * 12 +
      (date.getMonth() - COHORT_START_MONTH)
    );
  }

  function academicYearForSessionDate(sessionDate) {
    var months = academicMonthsSinceStart(sessionDate);
    var y = months + 1;
    if (y < 1) y = 1;
    if (y > 9) y = 9;
    return y;
  }

  function currentAcademicYear(date) {
    date = date || new Date();
    var months = academicMonthsSinceStart(date);
    var sat = thirdSaturday(date.getFullYear(), date.getMonth());
    if (sat && startOfDay(date) < startOfDay(sat) && months >= 0) months -= 1;
    var y = months + 1;
    if (y < 1) y = 1;
    if (y > 9) y = 9;
    return y;
  }

  function formatLongDate(d) {
    if (!d) return "";
    return d.toLocaleDateString("en-NG", {
      timeZone: TIMEZONE,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function sessionIdFromDate(d) {
    if (!d) return "";
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function classSessionDateForAcademicYear(academicYear) {
    var idx = Number(academicYear) - 1;
    if (idx < 0 || idx > 8) return null;
    var monthIndex = COHORT_START_MONTH + idx;
    var year = COHORT_START_YEAR;
    while (monthIndex > 11) {
      monthIndex -= 12;
      year += 1;
    }
    return thirdSaturday(year, monthIndex);
  }

  function materialsForYear(academicYear) {
    var links = [
      {
        label: "Course outline (this month)",
        href: "/cod/course-outline.html#year-" + academicYear,
      },
      {
        label: "Student portal (assignments)",
        href: "/cod/student.html",
      },
    ];
    if (academicYear === 1) {
      links.push({
        label: "Reference: 2024 cohort yearbook (Arise)",
        href: "/cod/yearbook/2024/",
      });
    }
    return links;
  }

  function sessionBrief(academicYear, settings) {
    settings = settings || {};
    var y = yearByNumber(academicYear);
    if (!y) return null;
    var date = classSessionDateForAcademicYear(academicYear);
    var lead = y.leadTeacherId && PEOPLE[y.leadTeacherId] ? PEOPLE[y.leadTeacherId] : null;
    return {
      academicYear: academicYear,
      title: y.title,
      calendarMonth: y.calendarMonth,
      classDate: date,
      classDateLabel: date ? formatLongDate(date) : "",
      classTime: settings.classSessionTime || DEFAULT_CLASS_TIME,
      tuesdayPrayer: TUESDAY_PRAYER_LABEL,
      teachers: y.teachers,
      lead: lead,
      materials: materialsForYear(academicYear),
    };
  }

  function daysUntil(d) {
    var ms = startOfDay(d).getTime() - startOfDay(new Date()).getTime();
    return Math.round(ms / 86400000);
  }

  function coordinatorRoster() {
    return Object.keys(PEOPLE)
      .filter(function (id) {
        return id !== "damilola";
      })
      .map(function (id) {
        return PEOPLE[id];
      });
  }

  function teachingYearsForPerson(personId) {
    return YEARS.filter(function (y) {
      return (y.teachers || []).some(function (t) {
        return t.id === personId;
      });
    });
  }

  function assignmentQuotaForCoordinator(coordinatorId) {
    var out = [];
    Object.keys(ASSIGNMENT_OWNERS).forEach(function (y) {
      var year = Number(y);
      (ASSIGNMENT_OWNERS[y] || []).forEach(function (row, idx) {
        if (row.id === coordinatorId) {
          out.push({
            year: year,
            yearTitle: yearByNumber(year).title,
            slot: idx + 1,
            expectedCount: row.count,
          });
        }
      });
    });
    return out;
  }

  global.COD_DATA = {
    COHORT: COHORT,
    COHORT_LABEL: COHORT_LABEL,
    COHORT_START_YEAR: COHORT_START_YEAR,
    COHORT_START_MONTH: COHORT_START_MONTH,
    TIMEZONE: TIMEZONE,
    CLASS_RHYTHM: CLASS_RHYTHM,
    DEFAULT_CLASS_TIME: DEFAULT_CLASS_TIME,
    TUESDAY_PRAYER_LABEL: TUESDAY_PRAYER_LABEL,
    ATTENDANCE_OFFICER_ID: ATTENDANCE_OFFICER_ID,
    isAttendanceOfficer: function (profile) {
      return !!(
        profile &&
        profile.coordinatorId === ATTENDANCE_OFFICER_ID &&
        profile.role === "coordinator"
      );
    },
    DEFAULT_CLASS_FORMAT: DEFAULT_CLASS_FORMAT,
    CALENDAR_MONTHS: CALENDAR_MONTHS,
    YEARS: YEARS,
    ASSIGNMENT_OWNERS: ASSIGNMENT_OWNERS,
    PEOPLE: PEOPLE,
    ADMIN_EMAILS: ADMIN_EMAILS,
    DEFAULT_COORDINATOR_EMAILS: DEFAULT_COORDINATOR_EMAILS,
    assignmentTemplate: assignmentTemplate,
    yearByNumber: yearByNumber,
    thirdSaturday: thirdSaturday,
    nextClassSession: nextClassSession,
    upcomingClassSessions: upcomingClassSessions,
    academicYearForSessionDate: academicYearForSessionDate,
    currentAcademicYear: currentAcademicYear,
    formatLongDate: formatLongDate,
    sessionIdFromDate: sessionIdFromDate,
    classSessionDateForAcademicYear: classSessionDateForAcademicYear,
    sessionBrief: sessionBrief,
    materialsForYear: materialsForYear,
    daysUntil: daysUntil,
    coordinatorRoster: coordinatorRoster,
    teachingYearsForPerson: teachingYearsForPerson,
    assignmentQuotaForCoordinator: assignmentQuotaForCoordinator,
    isAdminEmail: function (email) {
      return ADMIN_EMAILS.indexOf(String(email || "").toLowerCase()) >= 0;
    },
    formatAssignmentCode: function (year, seq) {
      var n = Number(seq) || 1;
      if (n < 1) n = 1;
      return "DearDaughter_COD07_HW" + n;
    },
  };
})(typeof window !== "undefined" ? window : global);
