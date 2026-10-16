/**
 * Seed Class of David Firestore docs (meta + settings).
 * Usage (from firebase/functions):
 *   node scripts/seedCodAcademy.js
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

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
}

const db = admin.firestore();

async function main() {
  const metaRef = db.collection("cod_meta").doc("cohort_2027");
  const metaSnap = await metaRef.get();
  if (!metaSnap.exists) {
    await metaRef.set({ studentCounter: 0, cohort: "2027" });
    console.log("Created cod_meta/cohort_2027");
  } else {
    console.log("cod_meta/cohort_2027 already exists", metaSnap.data());
  }

  const settingsRef = db.collection("cod_settings").doc("config");
  const settingsSnap = await settingsRef.get();
  const base = {
    coordinatorEmails: [],
    coordinatorSelfRegister: true,
    cohortLabel: "2026/2027",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    seededBy: "seedCodAcademy.js",
  };
  if (!settingsSnap.exists) {
    await settingsRef.set(base);
    console.log("Created cod_settings/config");
  } else {
    await settingsRef.set(
      {
        coordinatorSelfRegister: true,
        cohortLabel: settingsSnap.data().cohortLabel || "2026/2027",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log("Updated cod_settings/config (kept existing coordinatorEmails)");
    console.log("coordinatorEmails:", settingsSnap.data().coordinatorEmails || []);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
