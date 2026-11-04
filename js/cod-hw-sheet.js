/**
 * Class of David homework sheet — matches the uploaded Sample HW layout.
 * Working title: DearDaughter_COD07_HW{n}
 */
(function (global) {
  var WORDS = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function nl(s) {
    return esc(s).replace(/\n/g, "<br/>");
  }

  function seqNum(seq) {
    var n = Number(seq) || 1;
    if (n < 1) n = 1;
    return n;
  }

  function assignmentWord(seq) {
    var n = seqNum(seq);
    return WORDS[n] || String(n);
  }

  function workingTitle(seq) {
    return "DearDaughter_COD07_HW" + seqNum(seq);
  }

  function defaultInstructions() {
    return "Assignment must be submitted in word document or pdf format. Email assignment to the Class coordinator at ddbs.comms@gmail.com";
  }

  function fieldsFromForm() {
    return {
      year: Number((document.getElementById("draft-year") || {}).value) || 1,
      seq: seqNum((document.getElementById("draft-seq") || {}).value),
      issueDate: (document.getElementById("draft-issue") || {}).value || "",
      dueDate: (document.getElementById("draft-due") || {}).value || "",
      timeLabel: (document.getElementById("draft-time") || {}).value || "11:59pm",
      instructions:
        (document.getElementById("draft-instructions") || {}).value || defaultInstructions(),
      questions: (document.getElementById("draft-questions") || {}).value || "",
    };
  }

  function htmlToPlain(html) {
    return String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
  }

  function questionsFromDraft(d) {
    d = d || {};
    var q = d.questions || d.rawBody || d.question || "";
    if (typeof q !== "string") q = String(q || "");
    if (q.trim()) return q;
    var html = String(d.bodyHtml || "");
    var marker = 'class="hw-questions">';
    var idx = html.indexOf(marker);
    if (idx >= 0) {
      var rest = html.slice(idx + marker.length);
      var end = rest.indexOf("</div>");
      if (end >= 0) return htmlToPlain(rest.slice(0, end));
    }
    return q;
  }

  function fieldsFromDraft(d) {
    d = d || {};
    return {
      year: Number(d.year) || 1,
      seq: seqNum(d.seq),
      issueDate: d.issueDate || "",
      dueDate: d.dueDate || "",
      timeLabel: d.timeLabel || "11:59pm",
      instructions: d.instructions || defaultInstructions(),
      questions: questionsFromDraft(d),
    };
  }

  function formatLong(iso) {
    if (!iso) return "";
    var p = String(iso).split("-");
    if (p.length !== 3) return iso;
    var dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function yearTitle(year) {
    var D = global.COD_DATA;
    var y = D && D.yearByNumber ? D.yearByNumber(year) : null;
    return y ? y.title : "";
  }

  function renderHtml(fields) {
    fields = fields || {};
    var seq = seqNum(fields.seq);
    var cohort = (global.COD_DATA && global.COD_DATA.COHORT_LABEL) || "2026/2027";
    var yTitle = yearTitle(fields.year);
    return (
      '<article class="hw-sheet">' +
      '<p class="hw-org">Dear Daughter Bible Study Group</p>' +
      '<p class="hw-cohort">Class of David ' +
      esc(cohort) +
      "</p>" +
      '<p class="hw-asg">Assignment ' +
      esc(assignmentWord(seq)) +
      "</p>" +
      (yTitle
        ? '<p class="hw-year">Year ' + seqNum(fields.year) + " — " + esc(yTitle) + "</p>"
        : "") +
      '<p class="hw-meta"><strong>Issue Date:</strong> ' +
      esc(formatLong(fields.issueDate) || "TBA") +
      "</p>" +
      '<p class="hw-meta"><strong>Submission Deadline:</strong> ' +
      esc(formatLong(fields.dueDate) || "TBA") +
      "</p>" +
      '<p class="hw-meta"><strong>Time:</strong> ' +
      esc(fields.timeLabel || "11:59pm") +
      "</p>" +
      '<p class="hw-meta"><strong>Instructions:</strong> ' +
      nl(fields.instructions || defaultInstructions()) +
      "</p>" +
      '<p class="hw-q-label">Question:</p>' +
      '<div class="hw-questions">' +
      nl(fields.questions || "") +
      "</div></article>"
    );
  }

  function paintPreview(host, fields) {
    if (!host) return;
    host.innerHTML = renderHtml(fields);
  }

  function wrapLines(doc, text, maxWidth) {
    return doc.splitTextToSize(String(text || ""), maxWidth);
  }

  function toPdfBlob(fields) {
    if (!global.jspdf || !global.jspdf.jsPDF) {
      throw new Error("PDF library failed to load.");
    }
    fields = fields || {};
    var seq = seqNum(fields.seq);
    var cohort = (global.COD_DATA && global.COD_DATA.COHORT_LABEL) || "2026/2027";
    var doc = new global.jspdf.jsPDF({ unit: "pt", format: "letter" });
    var x = 72;
    var y = 72;
    var max = 468;
    var lh = 16;

    function center(text, size, gap) {
      doc.setFont("times", "bold");
      doc.setFontSize(size || 14);
      doc.text(String(text || ""), 306, y, { align: "center" });
      y += gap || 22;
    }
    function para(label, value, italic) {
      doc.setFont("times", italic ? "italic" : "normal");
      doc.setFontSize(12);
      var block = label ? label + " " + (value || "") : value || "";
      wrapLines(doc, block, max).forEach(function (line) {
        if (y > 720) {
          doc.addPage();
          y = 72;
        }
        doc.text(line, x, y);
        y += lh;
      });
      y += 6;
    }

    center("Dear Daughter Bible Study Group", 13, 20);
    center("Class of David " + cohort, 16, 22);
    center("Assignment " + assignmentWord(seq), 14, 20);
    var yTitle = yearTitle(fields.year);
    if (yTitle) center("Year " + seqNum(fields.year) + " — " + yTitle, 12, 24);
    y += 8;
    para("Issue Date:", formatLong(fields.issueDate) || "TBA");
    para("Submission Deadline:", formatLong(fields.dueDate) || "TBA");
    para("Time:", fields.timeLabel || "11:59pm");
    para("Instructions:", fields.instructions || defaultInstructions());
    y += 8;
    para("Question:", "", false);
    para("", fields.questions || "");
    return doc.output("blob");
  }

  global.COD_HW_SHEET = {
    workingTitle: workingTitle,
    assignmentWord: assignmentWord,
    defaultInstructions: defaultInstructions,
    fieldsFromForm: fieldsFromForm,
    fieldsFromDraft: fieldsFromDraft,
    questionsFromDraft: questionsFromDraft,
    renderHtml: renderHtml,
    paintPreview: paintPreview,
    toPdfBlob: toPdfBlob,
    seqNum: seqNum,
  };
})(typeof window !== "undefined" ? window : global);
