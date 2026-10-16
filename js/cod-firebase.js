/**
 * Class of David — Firebase helpers (Auth + Firestore).
 */
(function (global) {
  var app = null;
  var auth = null;
  var db = null;

  function cfg() {
    return global.__FIREBASE_CONFIG__ || null;
  }

  function init() {
    if (db) return { app: app, auth: auth, db: db };
    var c = cfg();
    if (!c || !global.firebase) return null;
    if (!global.firebase.apps.length) {
      app = global.firebase.initializeApp(c);
    } else {
      app = global.firebase.app();
    }
    auth = global.firebase.auth();
    db = global.firebase.firestore();
    return { app: app, auth: auth, db: db };
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
    var cred = await fx.auth.createUserWithEmailAndPassword(email, password);
    var uid = cred.user.uid;
    await usersRef(uid).set({
      role: "pending_coordinator",
      coordinatorId: coordinatorId,
      email: email,
      first: String(payload.first || "").trim(),
      last: String(payload.last || "").trim(),
      phone: String(payload.phone || "").trim(),
      name: person ? person.name : String(payload.first || "") + " " + String(payload.last || ""),
      cohort: global.COD_DATA ? global.COD_DATA.COHORT_LABEL : "2026/2027",
      createdAt: global.firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { uid: uid, email: email, status: "pending_coordinator" };
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
    var studentId = "";
    await fx.db.runTransaction(async function (transaction) {
      var mSnap = await transaction.get(metaRef());
      var counter = (mSnap.exists && mSnap.data().studentCounter) || 0;
      var next = counter + 1;
      if (!mSnap.exists) {
        transaction.set(metaRef(), { studentCounter: next, cohort: "2027" });
      } else {
        transaction.update(metaRef(), { studentCounter: next });
      }
      studentId =
        "COD" + (global.COD_DATA ? global.COD_DATA.COHORT : "27") + "-" + String(next).padStart(4, "0");
    });

    await usersRef(uid).set({
      role: "student",
      studentId: studentId,
      email: email,
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

    return { uid: uid, studentId: studentId, email: email };
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
    return msg || String(err);
  }

  async function sendPasswordReset(email) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var e = String(email || "").trim();
    if (!e) throw new Error("Enter your email first.");
    await fx.auth.sendPasswordResetEmail(e);
    return e;
  }

  async function signInPresident(email, password) {
    var fx = init();
    if (!fx) throw new Error("Firebase is not configured.");
    var e = String(email || "").trim().toLowerCase();
    if (!(global.COD_DATA && global.COD_DATA.isAdminEmail(e))) {
      throw new Error("Use your president email: ddbs.htx@gmail.com or abuxberkeley@gmail.com");
    }
    var cred = await fx.auth.signInWithEmailAndPassword(e, password);
    await usersRef(cred.user.uid).set(
      {
        role: "admin",
        coordinatorId: "damilola",
        email: e,
        name: "Abe Damilola",
        updatedAt: global.firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return cred.user;
  }

  function publishedAssignmentsQuery(year) {
    return init()
      .db.collection("cod_assignments")
      .where("year", "==", Number(year))
      .where("status", "==", "published")
      .orderBy("seq", "asc");
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
    sendPasswordReset: sendPasswordReset,
    signInPresident: signInPresident,
    publishedAssignmentsQuery: publishedAssignmentsQuery,
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
