---
name: Corsair TypeScript unicode in source file
description: How unicode is stored in the courses.ts source file
---

## Rule
TypeScript string literal escape sequences (`\u2014`, `\u2019`, etc.) are stored
in the .ts source file as LITERAL 6-character text sequences, NOT as the actual
unicode character.

Example: `description: 'Complete LTC certification \u2014 classroom + range'`
- The file bytes for `\u2014` are: backslash, u, 2, 0, 1, 4 (6 chars)
- Python `repr()` shows: `'\\u2014'` (double backslash in repr = one literal backslash)
- Python's `\u2014` in a string literal = em dash character (DOES NOT MATCH the file)

## Fix
For anchors touching TypeScript string content, avoid the unicode escape entirely.
Use surrounding ASCII context lines as the anchor instead.

## Exception
Characters in COMMENTS (/* ═══ */) are actual unicode characters.
Python `\u2550` (═) DOES match them correctly.

**Why:** Caused 1 of 3 anchor failures in Task #23 (wichita pricing option anchor).
