#!/usr/bin/env python3
"""Rename the legacy JSON key 'dominionWord' -> 'texasLtcCertification' across all 10 locales.
This is cosmetic cleanup; values were already rewritten in an earlier commit."""
import json
from pathlib import Path

MESSAGES = Path(__file__).parent.parent / "messages"
OLD = "dominionWord"
NEW = "texasLtcCertification"

for f in sorted(MESSAGES.glob("*.json")):
    data = json.loads(f.read_text(encoding="utf-8"))
    changed = False

    # home.courses.dominionWord -> texasLtcCertification
    courses = data.get("home", {}).get("courses", {})
    if OLD in courses:
        courses[NEW] = courses.pop(OLD)
        changed = True

    # home.offerings.dominionWord -> texasLtcCertification
    offerings = data.get("home", {}).get("offerings", {})
    if OLD in offerings:
        offerings[NEW] = offerings.pop(OLD)
        changed = True

    if changed:
        # Preserve insertion order naturally; Python dicts keep order.
        f.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"updated {f.name}")
    else:
        print(f"no change {f.name}")
