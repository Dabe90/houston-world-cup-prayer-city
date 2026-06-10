#!/usr/bin/env python3
"""
Build SMS lists from:
  - contacts (4).xlsx (older database: Email 1, First Name, Phone 1/2)
  - prayercity-signups.csv (current registrations: email, phone, name)

Segmentation uses PHONE NUMBER match (E.164 +1XXXXXXXXXX), not email.

Outputs under outreach/:
  - sms-invite-not-registered.csv   — past contacts with phone, not in signups by phone
  - sms-registered-update.csv     — signups with phone (+ past contacts whose phone matched)
  - sms-skipped-no-phone.csv        — signups without a valid US phone
  - sms-report.txt
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
CONTACTS_XLSX = ROOT / "contacts (4).xlsx"
SIGNUPS_CSV = ROOT / "prayercity-signups.csv"
OUT_DIR = ROOT / "outreach"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def norm_email(v) -> str:
    return str(v or "").strip().lower()


def norm_first_name(v) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    return (s.split()[:1][0]).strip(" ,.")


def norm_phone_us_e164(v) -> str:
    s = str(v or "").strip()
    if not s:
        return ""
    s = s.replace('"', "").replace("'", "")
    digits = re.sub(r"\D", "", s)
    if digits.startswith("1") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return "+1" + digits
    return ""


def load_signups_by_phone() -> tuple[set[str], dict[str, dict]]:
    """Returns registered_phones set and phone -> {email, name, first_name}."""
    phones: set[str] = set()
    by_phone: dict[str, dict] = {}
    if not SIGNUPS_CSV.is_file():
        return phones, by_phone

    with SIGNUPS_CSV.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        for row in r:
            e = norm_email(row.get("email"))
            if not e or not EMAIL_RE.match(e):
                continue
            p = norm_phone_us_e164(row.get("phone"))
            if not p:
                continue
            phones.add(p)
            name = str(row.get("name") or "").strip()
            fn = norm_first_name(name) or norm_first_name(e.split("@")[0])
            # Keep first signup row per phone
            if p not in by_phone:
                by_phone[p] = {
                    "email": e,
                    "name": name,
                    "first_name": fn,
                    "phone_e164": p,
                }
    return phones, by_phone


def load_contacts_by_phone() -> dict[str, dict]:
    """phone -> {email, first_name, phone_e164} — first row wins per phone."""
    wb = openpyxl.load_workbook(CONTACTS_XLSX, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return {}

    headers = [str(h or "").strip() for h in rows[0]]

    def idx(name: str) -> int:
        return headers.index(name)

    ix_email = idx("Email 1")
    ix_fn = idx("First Name")
    ix_p1 = idx("Phone 1")
    ix_p2 = idx("Phone 2")

    by_phone: dict[str, dict] = {}
    for r in rows[1:]:
        e = norm_email(r[ix_email])
        if not e or not EMAIL_RE.match(e):
            continue
        p = norm_phone_us_e164(r[ix_p1]) or norm_phone_us_e164(r[ix_p2])
        if not p or p in by_phone:
            continue
        by_phone[p] = {
            "email": e,
            "first_name": norm_first_name(r[ix_fn]),
            "phone_e164": p,
        }
    return by_phone


def load_signups_missing_phone() -> list[dict]:
    out = []
    if not SIGNUPS_CSV.is_file():
        return out
    with SIGNUPS_CSV.open(newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        for row in r:
            e = norm_email(row.get("email"))
            if not e or not EMAIL_RE.match(e):
                continue
            if norm_phone_us_e164(row.get("phone")):
                continue
            out.append(
                {
                    "Email": e,
                    "Name": str(row.get("name") or "").strip(),
                    "Reason": "no_valid_phone_in_signups",
                }
            )
    return out


def write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    registered_phones, signups_by_phone = load_signups_by_phone()
    contacts_by_phone = load_contacts_by_phone()

    invite: list[dict] = []
    reg_from_contacts: list[dict] = []
    phones_in_registered_list: set[str] = set()

    for phone, c in sorted(contacts_by_phone.items(), key=lambda x: x[0]):
        row_base = {
            "Email": c["email"],
            "FirstName": c["first_name"],
            "PhoneE164": phone,
        }
        if phone in registered_phones:
            su = signups_by_phone.get(phone, {})
            reg_from_contacts.append(
                {
                    **row_base,
                    "FirstName": su.get("first_name") or c["first_name"],
                    "Email": su.get("email") or c["email"],
                    "Segment": "registered_phone_match",
                    "Source": "contacts+signups",
                }
            )
            phones_in_registered_list.add(phone)
        else:
            invite.append({**row_base, "Segment": "invite", "Source": "contacts"})

    # All signups with phone (includes people not in old contacts file)
    reg_all: list[dict] = []
    for phone, su in sorted(signups_by_phone.items(), key=lambda x: x[0]):
        reg_all.append(
            {
                "Email": su["email"],
                "FirstName": su["first_name"],
                "PhoneE164": phone,
                "Segment": "registered",
                "Source": "signups",
            }
        )

    fields = ["Email", "FirstName", "PhoneE164", "Segment", "Source"]
    write_csv(OUT_DIR / "sms-invite-not-registered.csv", fields, invite)
    write_csv(OUT_DIR / "sms-registered-update.csv", fields, reg_all)

    skipped = load_signups_missing_phone()
    write_csv(
        OUT_DIR / "sms-skipped-no-phone.csv",
        ["Email", "Name", "Reason"],
        skipped,
    )

    overlap = len(phones_in_registered_list)
    signups_only_phones = len(reg_all) - overlap  # approximate

    report = "\n".join(
        [
            "SMS segmentation report (PHONE match)",
            f"Registered phones in signups: {len(registered_phones)}",
            f"Past contacts with valid phone: {len(contacts_by_phone)}",
            f"sms_invite_not_registered: {len(invite)}",
            f"sms_registered_update (all signups w/ phone): {len(reg_all)}",
            f"  — contacts whose phone matched a signup: {overlap}",
            f"signups_without_sms_phone (email only): {len(skipped)}",
            "",
            "Invite SMS: signup link — https://prayercityhtx.com/volunteer/",
            "Registered SMS: countdown + June 7 prayer/training (Market Square Park).",
            "",
            "Import into Google Sheet tabs, then send via Twilio Apps Script.",
        ]
    )
    (OUT_DIR / "sms-report.txt").write_text(report, encoding="utf-8")
    print(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
