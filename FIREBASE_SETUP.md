# Firebase + Google Sheets — Volunteer invites & dashboard

This repository includes:

- **`dashboard.html`** — Firebase Auth (email link + optional password), Firestore profile, volunteer UI.
- **`firebase/functions`** — Cloud Function **`invVolunteer`**: stores Sheet row data and returns a **Firebase email sign-in link**. Callable **`mergeVolunteerProfile`**: copies onboarding data into the user’s profile after login.
- **`google-apps-script/InviteVolunteers.gs`** — Paste into your Google Sheet’s Apps Script project: reads rows, calls `invVolunteer`, emails each volunteer via **GmailApp**.
- **`firebase/firestore.rules`** — Locks down Firestore so users only see their own `volunteers/{uid}` document.

Your **public sign-up form** (`index.html`) can stay on **Formsubmit**; as long as submissions land in your **Google Sheet** (your existing script), the flow below works.

---

## Part 1 — Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project** (or use an existing one).
2. Enable **Google Analytics** only if you want it (optional).
3. **Build** → **Authentication** → **Sign-in method**:
   - Turn on **Email/Password**.
   - Under Email/Password, enable **Email link (passwordless sign-in)**.
4. **Authentication** → **Settings** → **Authorized domains**: add  
   `prayercityhtx.com` and `www.prayercityhtx.com` (if you use www), plus your Vercel preview host if you still use it,  
   (and `localhost` for local testing if needed).
5. **Build** → **Firestore Database** → **Create database** → start in **production mode** (you will deploy rules from this repo).
6. **Project settings** (gear) → **Your apps** → **Web** (`</>`) → register app → copy the `firebaseConfig` object into **`js/firebase-config.js`** (replace the `REPLACE_ME` values).

---

## Part 2 — Billing (required for Cloud Functions)

Cloud Functions need the **Blaze (pay-as-you-go)** plan. You still get generous free monthly allowances; for this use case costs are usually low unless traffic is huge. Enable billing in Firebase Console when prompted during first deploy.

---

## Part 3 — CLI: install tools and log in

On your computer:

```bash
npm install -g firebase-tools
firebase login
```

From the **repository root** (`WC Prayer City` folder, where `firebase.json` lives):

```bash
copy .firebaserc.example .firebaserc
```

Edit **`.firebaserc`**: set `YOUR_FIREBASE_PROJECT_ID` to your real Firebase project ID.

---

## Part 4 — Invite secret

Pick a long random string (password manager). Store it as a Firebase secret:

```bash
firebase functions:secrets:set INVITE_SECRET
```

Paste the same value into **`google-apps-script/InviteVolunteers.gs`** as `CONFIG.INVITE_SECRET`.

---

## Part 5 — Deploy Firestore rules and functions

```bash
cd firebase/functions
npm install
cd ../..
firebase deploy --only firestore:rules,functions
```

After deploy, note the **HTTPS URL** for `invVolunteer`, e.g.:

`https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/invVolunteer`

Put that URL into **`InviteVolunteers.gs`** as `CONFIG.INVITE_FUNCTION_URL`.

### IAM (if Apps Script gets 403)

In [Google Cloud Console](https://console.cloud.google.com/) → **Cloud Functions** → **invVolunteer** → **Permissions**, ensure **allUsers** has role **Cloud Functions Invoker** (public URL with secret header is still protected by `X-Invite-Secret`).

---

## Part 6 — Continue URL (email link)

The function **`firebase/functions/index.js`** sets **`SIGNIN_CONTINUE_URL`** to your live dashboard. If your production URL changes, edit that constant and run:

```bash
firebase deploy --only functions
```

---

## Part 7 — Google Apps Script

1. Open your **volunteer Google Sheet**.
2. **Extensions** → **Apps Script**.
3. Create a file and paste the contents of **`google-apps-script/InviteVolunteers.gs`**.
4. Update **`CONFIG`**: spreadsheet ID, column numbers to match **your** header row, `INVITE_FUNCTION_URL`, `INVITE_SECRET`.
5. Add a column **InviteSent** (or change `INVITE_FLAG_COLUMN`) to avoid duplicate emails.
6. Save. Run **`authorizeInviteSender`** once from the dropdown → accept approval for **Gmail**.
7. Reload the Sheet → menu **Prayer City** → **Send pending dashboard invites**.

### Gmail limits (~5,000 volunteers)

Consumer **Gmail** has low daily send limits. For thousands of invites, use **Google Workspace** or replace `GmailApp.sendEmail` with a transactional provider (SendGrid, Resend, etc.) and call it from Apps Script — same `signInLink` from the Cloud Function.

---

## Part 8 — Deploy the website (Vercel)

Deploy the whole repo so **`dashboard.html`**, **`js/firebase-config.js`**, and **`index.html`** are served. After changing **`js/firebase-config.js`**, redeploy.

---

## How it works end-to-end

1. Volunteer submits **`index.html`** → data eventually appears in your **Sheet** (your current automation).
2. You run **Send pending dashboard invites** (or schedule it): Apps Script POSTs row data to **`invVolunteer`**, which writes **`volunteer_onboarding/{email}`** and returns a **`signInLink`**.
3. Apps Script emails that link to the volunteer.
4. Volunteer opens **`dashboard.html`** via the link → completes email link sign-in.
5. Dashboard calls **`mergeVolunteerProfile`** → copies onboarding fields into **`volunteers/{uid}`**.
6. Volunteer can **set a password** on the dashboard, then return later with **email + password** or request a **new sign-in link**.

---

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| Dashboard says “Firebase is not configured” | Fill in **`js/firebase-config.js`** and redeploy. |
| Email link opens but sign-in fails | **Authorized domains**; **Email link** enabled in Firebase Auth. |
| `mergeVolunteerProfile` fails | Redeploy functions; ensure user is signed in; check browser console. |
| Apps Script HTTP error | Function URL, `INVITE_SECRET` header match, **Invoker** permission. |

---

## Files to customize

| File | Purpose |
|------|---------|
| `js/firebase-config.js` | Web app Firebase config (from console). |
| `firebase/functions/index.js` | `SIGNIN_CONTINUE_URL` for your live `dashboard.html`. |
| `google-apps-script/InviteVolunteers.gs` | Sheet ID, columns, function URL, secret. |
