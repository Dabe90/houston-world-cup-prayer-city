/**
 * Class of David (COD) — cohort 2026/2027 curriculum & roles.
 * Each academic "year" runs one calendar month (9 months total).
 * Assignment naming: Y{year}-A{seq}-{slug} (see assignmentTemplate).
 */
(function (global) {
  var COHORT = "2027";
  var COHORT_LABEL = "2026/2027";

  var YEARS = [
    {
      year: 1,
      title: "The Sanctified Life",
      monthLabel: "Month 1",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 2,
      title: "Holy Spirit baptism",
      monthLabel: "Month 2",
      teachers: [{ id: "cecilia", name: "Cecilia Alabede" }],
    },
    {
      year: 3,
      title: "The Disciple of Christ 1 — Basics",
      monthLabel: "Month 3",
      teachers: [
        { id: "veronica", name: "Veronica Ekoja" },
        { id: "amarachi", name: "Nnodum Amarachi" },
      ],
    },
    {
      year: 4,
      title: "Disciple of Christ 2 — Greater works",
      monthLabel: "Month 4",
      teachers: [{ id: "elizabeth", name: "Ojenor Elizabeth" }],
    },
    {
      year: 5,
      title: "The Anointing — Essentials of service",
      monthLabel: "Month 5",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 6,
      title: "The Anointing — How to sustain it",
      monthLabel: "Month 6",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 7,
      title: "MountainTop experience",
      monthLabel: "Month 7",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 8,
      title: "Practicals",
      monthLabel: "Month 8",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
    {
      year: 9,
      title: "Spiritual offices and roles",
      monthLabel: "Month 9",
      teachers: [{ id: "damilola", name: "Abe Damilola" }],
    },
  ];

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
    cecilia: "",
    veronica: "",
    amarachi: "",
    elizabeth: "",
  };

  var assignmentTemplate = {
    codePattern: "Y{year}-A{seq}-{slug}",
    sections: [
      "Assignment title",
      "Year / month",
      "Objective",
      "Scripture references",
      "Instructions",
      "Deliverables",
      "Due date",
      "Submission format (PDF / written / video link)",
      "Grading notes (coordinator only)",
    ],
    studentVisibleSections: [
      "Assignment title",
      "Objective",
      "Scripture references",
      "Instructions",
      "Deliverables",
      "Due date",
      "Submission format (PDF / written / video link)",
    ],
  };

  function yearByNumber(n) {
    return YEARS.filter(function (y) {
      return y.year === n;
    })[0];
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
    YEARS: YEARS,
    ASSIGNMENT_OWNERS: ASSIGNMENT_OWNERS,
    PEOPLE: PEOPLE,
    ADMIN_EMAILS: ADMIN_EMAILS,
    DEFAULT_COORDINATOR_EMAILS: DEFAULT_COORDINATOR_EMAILS,
    assignmentTemplate: assignmentTemplate,
    yearByNumber: yearByNumber,
    assignmentQuotaForCoordinator: assignmentQuotaForCoordinator,
    isAdminEmail: function (email) {
      return ADMIN_EMAILS.indexOf(String(email || "").toLowerCase()) >= 0;
    },
    formatAssignmentCode: function (year, seq, slug) {
      return (
        "Y" +
        year +
        "-A" +
        String(seq).padStart(2, "0") +
        "-" +
        String(slug || "task")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 32)
      );
    },
  };
})(typeof window !== "undefined" ? window : global);
