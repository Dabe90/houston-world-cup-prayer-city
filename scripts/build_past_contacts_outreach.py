#!/usr/bin/env python3
"""
Build past-contact outreach lists from contacts (4).xlsx vs prayercity-signups.csv.

Outputs under outreach/:
  - past-contacts-to-email.csv      (not registered — ready to import / send)
  - past-contacts-skipped-registered.csv
  - past-contacts-skipped-invalid.csv
  - past-contacts-import-all-valid.csv (all valid emails from xlsx; use if signups CSV missing)
  - outreach-report.txt
"""

from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Install openpyxl: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
CONTACTS_XLSX = ROOT / "contacts (4).xlsx"
SIGNUPS_CSV = ROOT / "prayercity-signups.csv"
OUT_DIR = ROOT / "outreach"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def norm_email(value) -> str:
    return str(value or "").strip().lower()


def pick_email_column(headers: list[str]) -> str | None:
    for h in headers:
        hl = h.lower()
        if hl in ("email", "email 1", "email address", "e-mail"):
            return h
        if "email" in hl:
            return h
    return None


def pick_name_columns(headers: list[str]) -> tuple[str | None, str | None]:
    first = last = None
    for h in headers:
        hl = h.lower()
        if hl in ("first name", "firstname", "first"):
            first = h
        if hl in ("last name", "lastname", "last"):
            last = h
    return first, last


def first_name_from_row(first_col: str | None, last_col: str | None, row: dict) -> str:
    raw = str(row.get(first_col or "", "") or "").strip()
    if raw:
        return raw.split()[0].strip(" ,.")
    return ""


def greeting(first: str) -> str:
    if first:
        return f"Dear {first},"
    return "Dear Beloved,"


def load_signup_emails(path: Path) -> set[str]:
    if not path.is_file():
        return set()
    emails: set[str] = set()
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return emails
        col = pick_email_column([c.strip() for c in reader.fieldnames if c])
        if not col:
            # fallback: column C index if no header match
            f.seek(0)
            rows = list(csv.reader(f))
            if not rows:
                return emails
            start = 1 if rows and "@" not in str(rows[0][0]) else 0
            idx = 2 if len(rows[0]) > 2 else 0
            for r in rows[start:]:
                if len(r) > idx:
                    e = norm_email(r[idx])
                    if e and EMAIL_RE.match(e):
                        emails.add(e)
            return emails
        for row in reader:
            e = norm_email(row.get(col))
            if e and EMAIL_RE.match(e):
                emails.add(e)
    return emails


def load_contacts(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return []
    headers = [str(h or "").strip() for h in rows[0]]
    email_col = pick_email_column(headers)
    first_col, last_col = pick_name_columns(headers)
    if not email_col:
        raise SystemExit(f"No email column in {path.name}. Headers: {headers}")

    out = []
    seen: set[str] = set()
    for r in rows[1:]:
        row = dict(zip(headers, r))
        email = norm_email(row.get(email_col))
        if not email or not EMAIL_RE.match(email):
            continue
        if email in seen:
            continue
        seen.add(email)
        fn = first_name_from_row(first_col, last_col, row)
        ln = str(row.get(last_col or "", "") or "").strip()
        out.append(
            {
                "email": email,
                "first_name": fn,
                "last_name": ln,
                "greeting": greeting(fn),
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
    if not CONTACTS_XLSX.is_file():
        print(f"Missing {CONTACTS_XLSX}", file=sys.stderr)
        return 1

    contacts = load_contacts(CONTACTS_XLSX)
    signups_path = SIGNUPS_CSV
    registered = load_signup_emails(signups_path) if signups_path.is_file() else set()
    deduped = bool(registered)

    to_email: list[dict] = []
    skipped_reg: list[dict] = []
    skipped_invalid = []

    for c in contacts:
        row = {
            "Email": c["email"],
            "First Name": c["first_name"],
            "Last Name": c["last_name"],
            "Greeting": c["greeting"],
            "OutreachSent": "",
            "LastOutreach": "",
        }
        if deduped and c["email"] in registered:
            skipped_reg.append({**row, "Reason": "already_registered"})
        else:
            to_email.append(row)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fields = ["Email", "First Name", "Last Name", "Greeting", "OutreachSent", "LastOutreach"]

    write_csv(OUT_DIR / "past-contacts-to-email.csv", fields, to_email)
    write_csv(OUT_DIR / "past-contacts-skipped-registered.csv", fields + ["Reason"], skipped_reg)
    write_csv(OUT_DIR / "past-contacts-import-all-valid.csv", fields, [
        {
            "Email": c["email"],
            "First Name": c["first_name"],
            "Last Name": c["last_name"],
            "Greeting": c["greeting"],
            "OutreachSent": "",
        }
        for c in contacts
    ])

    lines = [
        "Past contacts outreach report",
        f"Contacts file: {CONTACTS_XLSX.name}",
        f"Signups file: {signups_path.name} ({'found' if signups_path.is_file() else 'NOT FOUND'})",
        f"Valid unique emails in contacts: {len(contacts)}",
        f"Registered emails in signups: {len(registered)}",
        f"To email (after dedupe): {len(to_email)}",
        f"Skipped (already registered): {len(skipped_reg)}",
        "",
    ]
    if not signups_path.is_file():
        lines.extend([
            "WARNING: prayercity-signups.csv was not found.",
            "Copy your Google Sheet export to the project root as prayercity-signups.csv and re-run.",
            "Until then, use past-contacts-import-all-valid.csv only if you will dedupe in Apps Script.",
            "",
        ])
    else:
        lines.append("Use outreach/past-contacts-to-email.csv for Google Sheet tab PastLeads.")

    (OUT_DIR / "outreach-report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    return 0 if signups_path.is_file() else 2


if __name__ == "__main__":
    raise SystemExit(main())
