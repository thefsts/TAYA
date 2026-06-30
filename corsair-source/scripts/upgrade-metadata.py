#!/usr/bin/env python3
"""Upgrade every page's generateMetadata to use the buildPageMetadata helper.
Adds canonical URLs, hreflang alternates, OG + Twitter cards."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'src/app/[locale]'

# Map file path → (namespace, url path, optional extras)
PAGES = {
    'about/page.tsx':                       ('about', '/about', {}),
    'security-services/page.tsx':           ('securityServices', '/security-services', {}),
    'property-manager-services/page.tsx':   ('propertyManagerServices', '/property-manager-services', {}),
    'church-safety/page.tsx':               ('churchSafety', '/church-safety', {}),
    'private-investigations/page.tsx':      ('privateInvestigations', '/private-investigations', {}),
    'security-training/page.tsx':           ('securityTraining', '/security-training', {}),
    'policies/page.tsx':                    ('policies', '/policies', {'noIndex': False}),
    'confirmation/page.tsx':                ('confirmation', '/confirmation', {'noIndex': True}),
    'privacy-policy/page.tsx':              ('legalPages.privacyPolicy', '/privacy-policy', {}),
    'terms-and-conditions/page.tsx':        ('legalPages.termsAndConditions', '/terms-and-conditions', {}),
    'cookie-policy/page.tsx':               ('legalPages.cookiePolicy', '/cookie-policy', {}),
    'refund-cancellation-policy/page.tsx':  ('legalPages.refundCancellationPolicy', '/refund-cancellation-policy', {}),
    'sms-email-consent-policy/page.tsx':    ('legalPages.smsEmailConsentPolicy', '/sms-email-consent-policy', {}),
    'media-release-policy/page.tsx':        ('legalPages.mediaReleasePolicy', '/media-release-policy', {}),
    'safety-disclaimer/page.tsx':           ('legalPages.safetyDisclaimer', '/safety-disclaimer', {}),
    'accessibility-statement/page.tsx':     ('legalPages.accessibilityStatement', '/accessibility-statement', {}),
}

# Regex for the existing bare metadata fn, in two shapes:
# 1) Without params:     `export async function generateMetadata() { ... return {title:t(...),description:t(...)}; }`
# 2) With params:        `export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) { ... }`
PATTERN_NO_PARAMS = re.compile(
    r"export async function generateMetadata\(\)\s*\{\s*"
    r"const t = await getTranslations\('([^']+)'\);\s*"
    r"return\s*\{\s*"
    r"title:\s*t\('metaTitle'\),\s*"
    r"description:\s*t\('metaDescription'\),\s*"
    r"\};\s*\}",
    re.MULTILINE,
)

PATTERN_WITH_PARAMS = re.compile(
    r"export async function generateMetadata\(\{ params \}:\s*\{\s*params:\s*Promise<\{\s*locale:\s*string\s*\}>\s*\}\)\s*\{\s*"
    r"const t = await getTranslations\('([^']+)'\);\s*"
    r"return\s*\{\s*"
    r"title:\s*t\('metaTitle'\),\s*"
    r"description:\s*t\('metaDescription'\),\s*"
    r"\};\s*\}",
    re.MULTILINE,
)


def new_block(namespace: str, url_path: str, no_index: bool) -> str:
    extras = ",\n    noIndex: true" if no_index else ""
    return (
        "export async function generateMetadata({\n"
        "  params,\n"
        "}: {\n"
        "  params: Promise<{ locale: string }>;\n"
        "}) {\n"
        "  const { locale } = await params;\n"
        f"  const t = await getTranslations({{ locale, namespace: '{namespace}' }});\n"
        "  return buildPageMetadata({\n"
        f"    path: '{url_path}',\n"
        "    title: t('metaTitle'),\n"
        "    description: t('metaDescription'),\n"
        f"    locale{extras},\n"
        "  });\n"
        "}"
    )


for rel, (ns, url_path, extras) in PAGES.items():
    fp = ROOT / rel
    if not fp.exists():
        print(f'SKIP {rel}')
        continue
    txt = fp.read_text(encoding='utf-8')
    original = txt
    no_index = bool(extras.get('noIndex'))
    replacement = new_block(ns, url_path, no_index)

    m = PATTERN_NO_PARAMS.search(txt)
    if not m:
        m = PATTERN_WITH_PARAMS.search(txt)
    if not m:
        print(f'! NO MATCH {rel}')
        continue

    # confirm namespace matches what we expect
    found_ns = m.group(1)
    if found_ns != ns:
        print(f'! namespace mismatch {rel}: expected {ns} got {found_ns}')
        # still replace but preserve found namespace
        replacement = new_block(found_ns, url_path, no_index)

    txt = txt[:m.start()] + replacement + txt[m.end():]

    # Ensure import of buildPageMetadata
    if "from '@/lib/seo'" not in txt:
        # Insert after the last import line
        lines = txt.splitlines()
        last_import = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import = i
        lines.insert(last_import + 1, "import { buildPageMetadata } from '@/lib/seo';")
        txt = '\n'.join(lines)

    fp.write_text(txt, encoding='utf-8')
    if txt != original:
        print(f'OK {rel}')
