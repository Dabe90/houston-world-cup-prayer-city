/**
 * Class of David — Firebase helpers (Auth + Firestore).
 */
(function (global) {
  var app = null;
  var auth = null;
  var db = null;
  var storage = null;

  function cfg() {
    return global.__FIREBASE_CONFIG__ || null;
  }

  function init() {
    if (db) return { app: app, auth: auth, db: db, storage: storage };
    var c = cfg();
    if (!c || !global.firebase) return null;
    if (!global.firebase.apps.length) {
      app = global.firebase.initializeApp(c);
    } else {
      app = global.firebase.app();
    }
    auth = global.firebase.auth();
    db = global.firebase.firestore();
    storage = global.firebase.storage ? global.firebase.storage() : null;
    if (auth.setPersistence && global.firebase.auth.Auth) {
      auth.setPersistence(global.firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
    }
    return { app: app, auth: auth, db: db, storage: storage };
  }

  function usersRef(uid) {
    return init().db.collection("cod_users").doc(uid);
  }

  function metaRef() {
    return init().db.collection("cod_meta").doc("cohort_2027");
  }

  function settingsRef() {
    return init().db.collection("cod_settings").doc("config");
  }

  async function getSettings() {
    var snap = await settingsRef().get();
    return snap.exists ? snap.data() : { coordinatorEmails: [] };
  }

  async function ensureSettingsSeed() {
    var snap = await settingsRef().get();
    if (snap.exists) return snap.data();
    var seed = {
      coordinatorEmails: [],
      updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
    };
    await settingsRef().set(seed, { merge: true });
    return seed;
  }

  async function isCoordinatorEmail(email) {
    var e = String(email || "").toLowerCase();
    if (!e) return false;
    var settings = await getSettings();
    var list = settings.coordinatorEmails || [];
    if (list.indexOf(e) >= 0) return true;
    var defaults = global.COD_DATA && global.COD_DATA.DEFAULT_COORDINATOR_EMAILS;
    if (defaults) {
      return Object.keys(defaults).some(function (k) {
        return String(defaults[k] || "").toLowerCase() === e;
      });
    }
    return false;
  }

  async function resolveRole(user) {
    if (!user) return null;
    var email = String(user.email || "").toLowerCase();
    if (global.COD_DATA && global.COD_DATA.isAdminEmail(email)) return "admin";
    var doc = await usersRef(user.uid).get();
    if (doc.exists && doc.data().role) {
      if (doc.data().role === "pending_coordinator") return "pending_coordinator";
      if (doc.data().role === "coordinator") return "coordinator";
      return doc.data().role || "student";
    }
    if (await isCoordinatorEmail(email)) return "coordinator";
    if (doc.exists) return doc.data().role || "student";
    return "student";
  }

  function coordinatorProfilePayload(payload, person, authEmail, extra) {
    extra = extra || {};
    var body = {
      coordinatorId: String(payload.coordinatorId || "").trim(),
      email: authEmail,
      first: String(payload.first || "").trim(),
      last: String(payload.last || "").trim(),
      phone: String(payload.phone || "").trim(),
      name: person ? person.name : String(payload.first || "") + " " + String(payload.last || ""),
      cohort: global.COD_DATA ? global.COD_DATA.COHORT_LABEL : "2026/2027",
      updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
    };
    Object.keys(extra).forEach(function (k) {
      body[k] = extra[k];
    });
    return body;
  }

  async function registerCoordinator(payload) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "");
    var coordinatorId = String(payload.coordinatorId || "").trim();
    if (!email || password.length < 8) {
      throw new Error("Use a valid email and password (8+ characters).");
    }
    if (!coordinatorId) throw new Error("Select which coordinator you are.");
    var person =
      global.COD_DATA && global.COD_DATA.PEOPLE[coordinatorId]
        ? global.COD_DATA.PEOPLE[coordinatorId]
        : null;
    var cred;
    try {
      cred = await fx.auth.createUserWithEmailAndPassword(email, password);
    } catch (err) {
      if (!err || err.code !== "auth/email-already-in-use") throw err;
      try {
        cred = await fx.auth.signInWithEmailAndPassword(email, password);
      } catch (signErr) {
        var already = new Error(
          "This email already has a login. Use Coordinator login, or tap Forgot password there."
        );
        already.code = "auth/email-already-in-use";
        throw already;
      }
    }
    var uid = cred.user.uid;
    var authEmail = String(cred.user.email || email).toLowerCase();
    var existing = await usersRef(uid).get();
    if (existing.exists) {
      var role = existing.data().role;
      if (role === "coordinator" || role === "admin") {
        var loginErr = new Error(
          "This email is already a coordinator account. Use Coordinator login."
        );
        loginErr.code = "auth/email-already-in-use";
        throw loginErr;
      }
      if (role === "student") {
        throw new Error(
          "This email is already registered as a student. Ask the President to convert it to a coordinator account."
        );
      }
    }
    try {
      var extra = existing.exists
        ? {}
        : { createdAt: global.firebase.firestore.FieldValue.serverTimestamp() };
      extra.role = "pending_coordinator";
      await usersRef(uid).set(coordinatorProfilePayload(payload, person, authEmail, extra), {
        merge: true,
      });
    } catch (err) {
      err.message =
        "Account was created but the coordinator profile could not be saved. " +
        (err.message || "");
      throw err;
    }
    if (await isCoordinatorEmail(authEmail)) {
      try {
        await ensureCoordinatorProfile(cred.user, coordinatorId);
        return { uid: uid, email: authEmail, status: "coordinator" };
      } catch (upgradeErr) {}
    }
    return { uid: uid, email: authEmail, status: "pending_coordinator" };
  }

  async function registerStudent(payload) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "");
    if (!email || password.length < 8) {
      throw new Error("Use a valid email and password (8+ characters).");
    }
    var cred = await fx.auth.createUserWithEmailAndPassword(email, password);
    var uid = cred.user.uid;
    var authEmail = String(cred.user.email || email).toLowerCase();
    var studentId = "";
    try {
      await fx.db.runTransaction(async function (transaction) {
        var mSnap = await transaction.get(metaRef());
        var counter = (mSnap.exists && mSnap.data().studentCounter) || 0;
        var next = counter + 1;
        studentId =
          "COD" +
          (global.COD_DATA ? global.COD_DATA.COHORT : "2027") +
          "-" +
          String(next).padStart(4, "0");
        if (!mSnap.exists) {
          transaction.set(metaRef(), { studentCounter: next, cohort: "2027" });
        } else {
          transaction.update(metaRef(), { studentCounter: next });
        }
        transaction.set(usersRef(uid), {
          role: "student",
          studentId: studentId,
          email: authEmail,
          first: String(payload.first || "").trim(),
          last: String(payload.last || "").trim(),
          phone: String(payload.phone || "").trim(),
          country: String(payload.country || "").trim(),
          state: String(payload.state || "").trim(),
          expectations: String(payload.expectations || "").trim(),
          emergencyName: String(payload.emergencyName || "").trim(),
          emergencyPhone: String(payload.emergencyPhone || "").trim(),
          currentYear: 1,
          cohort: global.COD_DATA ? global.COD_DATA.COHORT_LABEL : "2026/2027",
          createdAt: global.firebase.firestore.FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      err.message =
        "Account was created but the student profile could not be saved. " +
        (err.message || "");
      throw err;
    }

    return { uid: uid, studentId: studentId, email: authEmail };
  }

  async function ensureCoordinatorProfile(user, coordinatorId) {
    var email = String(user.email || "").toLowerCase();
    var isAdmin = global.COD_DATA && global.COD_DATA.isAdminEmail(email);
    var ok = isAdmin || (await isCoordinatorEmail(email));
    if (!ok) throw new Error("This account is not on the coordinator allowlist.");
    if (isAdmin && coordinatorId === "damilola") {
      await usersRef(user.uid).set(
        {
          role: "admin",
          coordinatorId: "damilola",
          email: email,
          name: "Abe Damilola",
          updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }
    var person =
      (global.COD_DATA && global.COD_DATA.PEOPLE[coordinatorId]) || null;
    await usersRef(user.uid).set(
      {
        role: "coordinator",
        coordinatorId: coordinatorId || "",
        email: email,
        name: person ? person.name : email,
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function getProfile(uid) {
    var snap = await usersRef(uid).get();
    return snap.exists ? snap.data() : null;
  }

  function friendlyAuthError(err) {
    var code = err && err.code;
    var msg = err && err.message;
    if (code === "auth/user-not-found") {
      return "No password login exists for this email yet. Use Forgot password below (after we enable your account), or email ddbs.htx@gmail.com for help.";
    }
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      return "Wrong email or password. Use Forgot password to set a new one.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many tries. Wait a few minutes, then use Forgot password.";
    }
    if (code === "auth/invalid-email") return "That email address looks invalid.";
    if (code === "auth/email-already-in-use") {
      return "This email already has a login. Use Coordinator login, or tap Forgot password there.";
    }
    return msg || String(err);
  }

  var COD_PASSWORD_RESET_URL =
    "https://us-central1-bible-study-dashboard-99f2d.cloudfunctions.net/volunteerSelfServePasswordResetMail";

  function parseAuthActionParams(loc) {
    loc = loc || (typeof location !== "undefined" ? location : null);
    if (!loc) return { mode: "", oobCode: "" };
    var q = loc.search || "";
    if (loc.hash && /mode=|oobCode=/i.test(loc.hash)) {
      q = loc.hash.charAt(0) === "#" ? loc.hash.slice(1) : loc.hash;
    }
    var params = new URLSearchParams(q);
    return {
      mode: params.get("mode") || "",
      oobCode: params.get("oobCode") || params.get("oobcode") || "",
    };
  }

  async function verifyPasswordResetCode(oobCode) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var code = String(oobCode || "").trim();
    if (!code) throw new Error("Missing reset code. Request a new link from Forgot password.");
    return fx.auth.verifyPasswordResetCode(code);
  }

  async function confirmPasswordResetWithCode(oobCode, newPassword) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var code = String(oobCode || "").trim();
    var pass = String(newPassword || "");
    if (!code) throw new Error("Missing reset code.");
    if (pass.length < 6) throw new Error("Use at least 6 characters for your password.");
    await fx.auth.confirmPasswordReset(code, pass);
    return code;
  }

  async function sendPasswordReset(email, opts) {
    opts = opts || {};
    var e = String(email || "").trim().toLowerCase();
    if (!e) throw new Error("Enter your email first.");

    // Firebase noreply often lands in spam or is blocked; use same Gmail path as main dashboard.
    var continueUrl =
      opts.continueUrl ||
      (typeof location !== "undefined"
        ? location.origin + "/cod/president-login.html"
        : "https://prayercityhtx.com/cod/president-login.html");

    var res = await fetch(COD_PASSWORD_RESET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, continueUrl: continueUrl }),
    });
    var text = await res.text();
    var parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (err) {}

    if (!res.ok) {
      var detail =
        (parsed && (parsed.message || parsed.detail || parsed.error)) ||
        text.slice(0, 200);
      if (parsed && parsed.error === "not_found") {
        throw new Error(
          "No login exists for this email yet. Contact the President to enable your account."
        );
      }
      if (parsed && parsed.error === "too_fast") {
        throw new Error(parsed.message || "Wait a minute before requesting again.");
      }
      throw new Error(detail || "Could not send reset email.");
    }
    if (parsed && parsed.ok === false) {
      throw new Error(parsed.error || "Mail failed.");
    }
    return e;
  }

  async function signInPresident(email, password) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var e = String(email || "").trim().toLowerCase();
    if (!(global.COD_DATA && global.COD_DATA.isAdminEmail(e))) {
      throw new Error("Use your president email: ddbs.htx@gmail.com or abuxberkeley@gmail.com");
    }
    // Admin role is resolved from ADMIN_EMAILS — no cod_users doc required (create would fail rules).
    return fx.auth.signInWithEmailAndPassword(e, password).then(function (cred) {
      return cred.user;
    });
  }

  function publishedAssignmentsQuery(year) {
    return init()
      .db.collection("cod_assignments")
      .where("year", "==", Number(year))
      .where("status", "==", "published")
      .orderBy("seq", "asc");
  }

  function announcementsRef() {
    return init().db.collection("cod_announcements");
  }

  function attendanceRef(sessionId) {
    return init().db.collection("cod_class_attendance").doc(String(sessionId || ""));
  }

  function parseAudience(audience, targetCoordinatorId) {
    var a = String(audience || "all").trim();
    var target = String(targetCoordinatorId || "").trim();
    var studentUid = "";
    if (a.indexOf("coordinator:") === 0) {
      target = a.slice("coordinator:".length);
      a = "coordinator";
    }
    if (a.indexOf("student:") === 0) {
      studentUid = a.slice("student:".length);
      a = "student";
    }
    if (["all", "students", "coordinators", "coordinator", "student"].indexOf(a) < 0) {
      a = "all";
    }
    if (a !== "coordinator") target = "";
    if (a !== "student") studentUid = "";
    if (a === "coordinator" && !target) {
      throw new Error("Choose which coordinator should receive this.");
    }
    if (a === "student" && !studentUid) {
      throw new Error("Choose which student should receive this.");
    }
    return { audience: a, targetCoordinatorId: target, targetStudentUid: studentUid };
  }

  function isAnnouncementVisible(msg, viewer) {
    if (!msg) return false;
    viewer = viewer || {};
    var role = viewer.role || "";
    var coordId = viewer.coordinatorId || "";
    if (role === "admin") return true;
    if (msg.createdByUid && viewer.uid && msg.createdByUid === viewer.uid) return true;
    var a = msg.audience || "all";
    if (a === "all") return true;
    if (a === "students") return role === "student";
    if (a === "coordinators") return role === "coordinator" || role === "admin";
    if (a === "coordinator") {
      return role === "admin" || coordId === msg.targetCoordinatorId;
    }
    if (a === "student") {
      return role === "admin" || (viewer.uid && viewer.uid === msg.targetStudentUid);
    }
    return false;
  }

  async function postAnnouncement(subject, bodyHtml, audience, targetCoordinatorId) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var user = fx.auth.currentUser;
    if (!user) throw new Error("Sign in first.");
    var subj = String(subject || "").trim();
    var body = String(bodyHtml || "").trim();
    if (!subj || !body) throw new Error("Subject and message are required.");
    var dest = parseAudience(audience, targetCoordinatorId);
    var profile = (await getProfile(user.uid)) || {};
    var email = String(user.email || "").toLowerCase();
    var isAdmin = global.COD_DATA && global.COD_DATA.isAdminEmail(email);
    var role = isAdmin ? "admin" : profile.role || "";
    if (role !== "admin" && role !== "coordinator") {
      throw new Error("Only the President and coordinators can send messages.");
    }
    var people = global.COD_DATA && global.COD_DATA.PEOPLE;
    var targetPerson = dest.targetCoordinatorId && people ? people[dest.targetCoordinatorId] : null;
    await announcementsRef().add({
      subject: subj,
      body: body,
      audience: dest.audience,
      targetCoordinatorId: dest.targetCoordinatorId || "",
      targetCoordinatorName: targetPerson ? targetPerson.name : "",
      targetStudentUid: dest.targetStudentUid || "",
      createdAt: global.firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: user.email || user.uid,
      createdByUid: user.uid,
      createdByName: isAdmin
        ? "Abe Damilola"
        : profile.name || user.email || "Staff",
      createdByRole: role,
    });
  }

  function listenAnnouncements(viewer, onData, onErr) {
    var fx = init();
    if (!fx) return function () {};
    if (typeof viewer === "function") {
      onErr = onData;
      onData = viewer;
      viewer = { role: "admin" };
    }
    return announcementsRef()
      .orderBy("createdAt", "desc")
      .limit(80)
      .onSnapshot(
        function (snap) {
          var list = [];
          snap.forEach(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            if (isAnnouncementVisible(d, viewer)) list.push(d);
          });
          onData(list);
        },
        onErr || function () {}
      );
  }

  async function listStudents() {
    var snap = await init().db.collection("cod_users").where("role", "==", "student").get();
    var users = [];
    snap.forEach(function (doc) {
      var d = doc.data();
      d.uid = doc.id;
      users.push(d);
    });
    users.sort(function (a, b) {
      return String(a.studentId || "").localeCompare(String(b.studentId || ""));
    });
    return users;
  }

  async function saveClassAttendance(sessionId, academicYear, presentUids) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var user = fx.auth.currentUser;
    if (!user) throw new Error("Sign in first.");
    var profile = await getProfile(user.uid);
    var officerId =
      global.COD_DATA && global.COD_DATA.ATTENDANCE_OFFICER_ID
        ? global.COD_DATA.ATTENDANCE_OFFICER_ID
        : "amarachi";
    if (!profile || profile.coordinatorId !== officerId || profile.role !== "coordinator") {
      throw new Error("Only Amarachi can mark class attendance.");
    }
    var sid = String(sessionId || "").trim();
    if (!sid) throw new Error("Pick a class session.");
    var present = presentUids || {};
    await attendanceRef(sid).set(
      {
        sessionId: sid,
        academicYear: Number(academicYear) || 0,
        present: present,
        presentCount: Object.keys(present).filter(function (k) {
          return present[k];
        }).length,
        markedByUid: user.uid,
        markedByEmail: user.email || "",
        markedByName: profile.name || "Nnodum Amarachi",
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function getClassAttendance(sessionId) {
    var snap = await attendanceRef(sessionId).get();
    return snap.exists ? snap.data() : null;
  }

  async function listClassAttendance() {
    var snap = await init().db.collection("cod_class_attendance").get();
    var rows = [];
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      d.id = doc.id;
      rows.push(d);
    });
    rows.sort(function (a, b) {
      return String(a.sessionId || a.id).localeCompare(String(b.sessionId || b.id));
    });
    return rows;
  }

  async function staffFileUrl(storagePath) {
    var fx = init();
    if (!fx || !fx.storage) throw new Error("Staff files are not available.");
    if (!fx.auth.currentUser) throw new Error("Sign in first.");
    try {
      await fx.auth.currentUser.getIdToken(true);
    } catch (err) {}
    var role = await resolveRole(fx.auth.currentUser);
    if (role !== "admin" && role !== "coordinator") {
      throw new Error("Only coordinators and the President can open these files.");
    }
    return fx.storage.ref(storagePath).getDownloadURL();
  }

  global.COD_FIREBASE = {
    init: init,
    auth: function () {
      return init() && init().auth;
    },
    db: function () {
      return init() && init().db;
    },
    usersRef: usersRef,
    settingsRef: settingsRef,
    getSettings: getSettings,
    ensureSettingsSeed: ensureSettingsSeed,
    isCoordinatorEmail: isCoordinatorEmail,
    resolveRole: resolveRole,
    registerStudent: registerStudent,
    registerCoordinator: registerCoordinator,
    ensureCoordinatorProfile: ensureCoordinatorProfile,
    getProfile: getProfile,
    friendlyAuthError: friendlyAuthError,
    parseAuthActionParams: parseAuthActionParams,
    verifyPasswordResetCode: verifyPasswordResetCode,
    confirmPasswordResetWithCode: confirmPasswordResetWithCode,
    sendPasswordReset: sendPasswordReset,
    signInPresident: signInPresident,
    publishedAssignmentsQuery: publishedAssignmentsQuery,
    parseAudience: parseAudience,
    isAnnouncementVisible: isAnnouncementVisible,
    postAnnouncement: postAnnouncement,
    listenAnnouncements: listenAnnouncements,
    listStudents: listStudents,
    saveClassAttendance: saveClassAttendance,
    getClassAttendance: getClassAttendance,
    listClassAttendance: listClassAttendance,
    staffFileUrl: staffFileUrl,
    announcementsRef: announcementsRef,
    attendanceRef: attendanceRef,
    collections: {
      drafts: function () {
        return init().db.collection("cod_assignment_drafts");
      },
      assignments: function () {
        return init().db.collection("cod_assignments");
      },
      submissions: function () {
        return init().db.collection("cod_submissions");
      },
      adminInbox: function () {
        return init().db.collection("cod_admin_inbox");
      },
    },
  };
})(typeof window !== "undefined" ? window : global);
