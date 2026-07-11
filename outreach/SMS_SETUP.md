# Twilio SMS setup — Prayer City

## 1. Twilio Console

1. Sign in at [twilio.com/console](https://www.twilio.com/console)
2. Note **Account SID** and **Auth Token**
3. **Phone Numbers** → buy or use a US number with **SMS** enabled
4. (Recommended) Enable **Messaging Service** or verify your use case for bulk SMS

## 2. Apps Script credentials (never commit these)

In your Apps Script project → **Project Settings** → **Script properties**, add:

| Property | Example |
|----------|---------|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | your auth token |
| `TWILIO_FROM_NUMBER` | `+18325551234` (your Twilio number, E.164) |
| `TEST_SMS_PHONE` | `+13466648066` (your phone for test sends) |

Paste **`PastContactsSMS.gs`** into the same Apps Script project as `PastContactsOutreach.gs`.

## 3. Google Sheet tabs

Same spreadsheet as `PastLeads`. Create two tabs and import:

| Tab | Import file | Rows (approx.) |
|-----|-------------|----------------|
| **SmsMembers** | `outreach/sms-registered-update.csv` | ~20 registered volunteers with phone |
| **SmsInvite** | `outreach/sms-invite-not-registered.csv` | ~190 past contacts with phone |

**Column headers (row 1):**

`Email | First Name | Phone | Segment | SmsSent | LastSms`

Map CSV columns: `PhoneE164` → **Phone**, `FirstName` → **First Name**.

## 4. Test before bulk send

1. Sheet menu → **🙏 Prayer City** → **SMS — Twilio setup instructions**
2. **SMS — send test to my phone** (uses `TEST_SMS_PHONE`)
3. **SMS — send to members now** (small batch, max 50/run)

## 5. Daily automation

| Menu item | Who | Time (Chicago) |
|-----------|-----|----------------|
| **Turn ON daily members (10am)** | `SmsMembers` — signed-up volunteers | 10:00 |
| **Turn ON daily invite list (11am)** | `SmsInvite` — not yet registered | 11:00 |

One SMS per person per day max. Status tracked in **SmsSent** / **LastSms**.

## 6. Message content (current)

**Members:** Thanks for serving + virtual session Thu Jun 11 6pm CT + Zoom link + T-shirt size reply + optional Zeffy donation link.

**Invite list:** Virtual session + Zoom + volunteer signup link.

## 7. Compliance

- Recipients can reply **STOP** (Twilio handles opt-out → row marked `Skip — opt out`)
- Only text people who gave you their number through Prayer City / Dear Daughter
- US numbers only (`+1` ten-digit format)

## 8. Refresh lists after new signups

```bash
python scripts/build_sms_lists.py
```

Re-import CSVs into `SmsMembers` / `SmsInvite`.
