#!/usr/bin/env python3
"""Inject BreadcrumbJsonLd component into server pages.
We only target pages where the locale is already destructured and where PageHero is used."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src/app/[locale]'

# page path => (breadcrumb label key, nav key)
PAGES = {
    'about/page.tsx':                     ('/about',                     'about'),
    'security-services/page.tsx':         ('/security-services',         'securityServices'),
    'property-manager-services/page.tsx': ('/property-manager-services', 'propertyManagerServices'),
    'church-safety/page.tsx':             ('/church-safety',             'churchSafety'),
    'private-investigations/page.tsx':    ('/private-investigations',    'privateInvestigations'),
    'security-training/page.tsx':         ('/security-training',         'securityTraining'),
}

for rel, (url_path, nav_key) in PAGES.items():
    fp = ROOT / rel
    if not fp.exists():
        print(f'SKIP {rel}')
        continue
    txt = fp.read_text(encoding='utf-8')
    if 'BreadcrumbJsonLd' in txt:
        print(f'already {rel}')
        continue

    # 1. Add import
    # Find last import line
    import_lines = list(re.finditer(r"^import .*;$", txt, re.MULTILINE))
    if not import_lines:
        print(f'! no imports {rel}')
        continue
    last = import_lines[-1]
    txt = txt[:last.end()] + "\nimport BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';" + txt[last.end():]

    # 2. Ensure `locale` is destructured. If function signature is `export default async function XxxPage()`
    # (no params), we need to convert it to use params.
    sig_pattern = re.compile(r"export default async function (\w+)\(\)\s*\{")
    sig_match = sig_pattern.search(txt)
    if sig_match:
        fn_name = sig_match.group(1)
        new_sig = (
            f"export default async function {fn_name}({{ params }}: "
            "{ params: Promise<{ locale: string }> }) {\n"
            "  const { locale } = await params;"
        )
        txt = txt[:sig_match.start()] + new_sig + txt[sig_match.end():]

    # Ensure tn('nav') exists. If it doesn't, we'll add.
    if "await getTranslations('nav')" not in txt and "namespace: 'nav'" not in txt:
        # Insert `const tn = await getTranslations('nav');` after first getTranslations line
        m = re.search(r"(const \w+ = await getTranslations\([^)]+\);)", txt)
        if m:
            txt = txt[:m.end()] + f"\n  const tn = await getTranslations('nav');" + txt[m.end():]

    # 3. Find `return (` inside the default function and inject BreadcrumbJsonLd at the top.
    # We'll target the *first* `return (` after the default function declaration.
    ret_match = re.search(r"(\n  return \(\n)", txt)
    if ret_match:
        injected = (
            "\n  return (\n"
            "    <>\n"
            f"      <BreadcrumbJsonLd locale={{locale}} items={{[\n"
            f"        {{ name: tn('home'), path: '/' }},\n"
            f"        {{ name: tn('{nav_key}'), path: '{url_path}' }},\n"
            "      ]}} />\n"
        )
        txt = txt[:ret_match.start()] + injected + txt[ret_match.end():]

        # Close the React fragment at the END of the return.
        # Find the matching `);` that closes the top-level JSX.
        # Simpler: replace last `\n  );\n}` with `\n    </>\n  );\n}`
        # (these pages end like `  );\n}`)
        # We do this conservatively — only if we injected the fragment.
        # Find "\n  );\n}" at end of file
        end_pattern = re.compile(r"\n  \);\s*\n}\s*$", re.MULTILINE)
        m2 = end_pattern.search(txt)
        if m2:
            txt = txt[:m2.start()] + "\n    </>\n  );\n}\n" + txt[m2.end():]

    fp.write_text(txt, encoding='utf-8')
    print(f'OK {rel}')
