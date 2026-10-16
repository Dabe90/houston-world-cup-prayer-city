/**
 * Ensure president emails exist in Firebase Auth (email/password).
 * Then use Forgot password on /cod/president-login.html to set your password.
 */
const path = require("path");
const admin = require("firebase-admin");

const serviceAccountPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "bible-study-dashboard-99f2d-firebase-adminsdk-fbsvc-acf38364bd.json"
);

const PRESIDENT_EMAILS = ["ddbs.htx@gmail.com", "abuxberkeley@gmail.com"];

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

async function ensureEmail(email) {
  const normalized = String(email).trim().toLowerCase();
  try {
    const user = await admin.auth().getUserByEmail(normalized);
    console.log("OK exists:", normalized, "uid=", user.uid);
    return { email: normalized, created: false, uid: user.uid };
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    const temp = admin.firestore().collection("_bootstrap").doc().id + "Aa1!";
    const created = await admin.auth().createUser({
      email: normalized,
      password: temp,
      emailVerified: false,
      displayName: "Class of David President",
    });
    console.log("CREATED:", normalized, "uid=", created.uid);
    console.log("  → Open https://prayercityhtx.com/cod/president-login.html and use Forgot password.");
    return { email: normalized, created: true, uid: created.uid };
  }
}

async function main() {
  for (const email of PRESIDENT_EMAILS) {
    await ensureEmail(email);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
