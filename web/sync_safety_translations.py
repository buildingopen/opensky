#!/usr/bin/env python3
"""
Sync the expanded 'safety' section from en.json to all locale files.
"""

import json
from pathlib import Path

# Path to messages directory
messages_dir = Path("/root/opensky-app/web/messages")

# List of all locale files to update
locales = ["de", "es", "fr", "it", "pt", "zh", "ar", "hi", "ja", "ko", "tr"]

# Read the English safety section
en_file = messages_dir / "en.json"
with open(en_file, "r", encoding="utf-8") as f:
    en_data = json.load(f)

# Extract the expanded safety section
expanded_safety = en_data["safety"]

print(f"Loaded expanded safety section from en.json")
print(f"Safety object keys: {list(expanded_safety.keys())}")

# Update each locale file
for locale in locales:
    locale_file = messages_dir / f"{locale}.json"

    if not locale_file.exists():
        print(f"WARNING: {locale_file} does not exist, skipping")
        continue

    # Read the locale file
    with open(locale_file, "r", encoding="utf-8") as f:
        locale_data = json.load(f)

    # Replace the safety section
    locale_data["safety"] = expanded_safety

    # Write back to file
    with open(locale_file, "w", encoding="utf-8") as f:
        json.dump(locale_data, f, ensure_ascii=False, indent=2)

    print(f"✓ Updated {locale}.json")

print("\nDone! All locale files have been updated with the expanded safety section.")
