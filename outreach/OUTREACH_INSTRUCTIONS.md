# Past contacts outreach

## 1. Dedupe lists (on your computer)

1. Place **`prayercity-signups.csv`** in the project root (export from your volunteer Google Sheet).
2. Run:

```bash
python scripts/build_past_contacts_outreach.py
```

Outputs:

| File | Purpose |
|------|---------|
| `outreach/past-contacts-to-email.csv` | **Send these** — not already registered |
| `outreach/past-contacts-skipped-registered.csv` | Already signed up — do not email |
| `outreach/outreach-report.txt` | Counts summary |

## 2. Import into Google Sheet

1. Open your volunteer Google Sheet.
2. Add a tab **`PastLeads`**.
3. **File → Import** → upload `past-contacts-to-email.csv` → **Insert new sheet** or replace `PastLeads`.

Columns: `Email | First Name | Last Name | Greeting | OutreachSent | LastOutreach`

## 3. Send emails (Gmail via Apps Script)

1. In the Sheet: **Extensions → Apps Script**.
2. Add **`google-apps-script/PastContactsOutreach.gs`** (same project as `PrayerCityFormPipeline.gs`).
3. Run **`authorizePastOutreachSender`** once (approve Gmail send).
4. Reload the Sheet → **🙏 Prayer City → Send past-contact outreach** (first batch).

5. Turn on automatic daily reminders:

   **🙏 Prayer City → Turn ON daily past-contact follow-up**

   - Runs once per day (~9:00 AM — set Apps Script **Project Settings → Timezone** to `America/Chicago`).
   - Emails anyone with status `Sent` or `Follow-up N` who is **still not** in volunteer sign-ups.
   - **Stops** when they sign up (email appears in column C) — row marked `Skip — registered`.
   - At most **one email per person per day** (tracked in column **LastOutreach**).

The script:

- Skips anyone whose email is already in **volunteer sign-ups (column C)**.
- Skips rows where **OutreachSent** is already `Sent` / `Follow-up` (for initial batch only).
- Sends up to **80 per run** (change `MAX_SEND_PER_RUN` in the script). Run again for the next batch.

## Email content

- Personalized greeting: **Dear {FirstName},** or **Dear Beloved,**
- Vision + excitement + YouTube video + sign-up link + June 7 prayer/training night
- HTML + plain text

Preview one message locally: open `outreach/outreach-email-preview.html` after running the preview script (optional).
