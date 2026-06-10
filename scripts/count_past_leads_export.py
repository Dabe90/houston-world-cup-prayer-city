#!/usr/bin/env python3
"""Count OutreachSent statuses from a tab-export of PastLeads (paste from Sheet)."""
import sys
from collections import Counter
from pathlib import Path

def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("outreach/_sheet_export.tsv")
    text = path.read_text(encoding="utf-8")
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    if not lines:
        print("No data")
        return
    header = lines[0]
    data = lines[1:]
    statuses = Counter()
    blank = 0
    failed = 0
    undeliverable = 0
    dup_emails = []
    seen = {}
    bad_emails = []
    for ln in data:
        parts = ln.split("\t")
        if len(parts) < 5:
            parts = ln.split(",")  # csv fallback
        email = parts[0].strip().lower() if parts else ""
        status = parts[4].strip() if len(parts) > 4 else ""
        if email:
            seen[email] = seen.get(email, 0) + 1
        if not status:
            blank += 1
            statuses["(blank)"] += 1
        elif status.lower().startswith("failed"):
            failed += 1
            statuses[status] += 1
        elif "undeliverable" in status.lower():
            undeliverable += 1
            statuses[status] += 1
        else:
            statuses[status] += 1
        if ".con" in email or ".jet" in email or ".comi" in email or ".comw" in email or "iclou.com" in email:
            bad_emails.append((email, status))

    dups = {e: c for e, c in seen.items() if c > 1}
    print(f"Total rows (excl. header): {len(data)}")
    print(f"Unique emails: {len(seen)}")
    print()
    print("By OutreachSent:")
    for k, v in sorted(statuses.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {v:4d}  {k}")
    print()
    print(f"Blank status: {blank}")
    print(f"Failed (any): {failed}")
    print(f"Skip undeliverable: {undeliverable}")
    if dups:
        print(f"\nDuplicate emails ({len(dups)}):")
        for e, c in sorted(dups.items(), key=lambda x: -x[1])[:20]:
            print(f"  {c}x  {e}")
    if bad_emails:
        print(f"\nLikely typo addresses ({len(bad_emails)}):")
        for e, s in bad_emails[:15]:
            print(f"  {e}  [{s}]")

if __name__ == "__main__":
    main()
