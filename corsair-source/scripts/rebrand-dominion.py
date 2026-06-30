#!/usr/bin/env python3
"""Rebrand Dominion Word LTC → Texas License to Carry Certification across all locales.
Keeps the JSON key `dominionWord` for backward compatibility (homepage still references it),
but rewrites title/description/offerings text with localized content."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'messages'

# Localized rewrites for the featured card (home.courses.dominionWord.*)
FEATURED = {
    'en': {
        'title': 'Texas License to Carry Certification',
        'description': 'State-approved Texas LTC certification with classroom instruction, legal education, and live-fire qualification.',
    },
    'es': {
        'title': 'Certificaci\u00f3n Licencia para Portar de Texas',
        'description': 'Certificaci\u00f3n LTC de Texas aprobada por el estado con instrucci\u00f3n en aula, educaci\u00f3n legal y calificaci\u00f3n con fuego real.',
    },
    'fr': {
        'title': 'Certification Texas License to Carry',
        'description': 'Certification LTC du Texas approuv\u00e9e par l\u2019\u00c9tat avec cours en salle, formation juridique et qualification au tir r\u00e9el.',
    },
    'de': {
        'title': 'Texas License to Carry Zertifizierung',
        'description': 'Staatlich anerkannte Texas-LTC-Zertifizierung mit Klassenraumunterricht, rechtlicher Ausbildung und scharfem Schie\u00dfen.',
    },
    'pt': {
        'title': 'Certifica\u00e7\u00e3o Texas License to Carry',
        'description': 'Certifica\u00e7\u00e3o LTC do Texas aprovada pelo estado com instru\u00e7\u00e3o em sala, educa\u00e7\u00e3o jur\u00eddica e qualifica\u00e7\u00e3o com tiro real.',
    },
    'ar': {
        'title': '\u0634\u0647\u0627\u062f\u0629 \u0631\u062e\u0635\u0629 \u062d\u0645\u0644 \u0627\u0644\u0633\u0644\u0627\u062d \u0641\u064a \u062a\u0643\u0633\u0627\u0633',
        'description': '\u0634\u0647\u0627\u062f\u0629 LTC \u0645\u0639\u062a\u0645\u062f\u0629 \u0645\u0646 \u0648\u0644\u0627\u064a\u0629 \u062a\u0643\u0633\u0627\u0633 \u062a\u0634\u0645\u0644 \u062a\u062f\u0631\u064a\u0628\u064b\u0627 \u0646\u0638\u0631\u064a\u064b\u0627 \u0648\u062a\u0639\u0644\u064a\u0645\u064b\u0627 \u0642\u0627\u0646\u0648\u0646\u064a\u064b\u0627 \u0648\u062a\u0623\u0647\u064a\u0644\u064b\u0627 \u0628\u0627\u0644\u0630\u062e\u064a\u0631\u0629 \u0627\u0644\u062d\u064a\u0629.',
    },
    'zh': {
        'title': '\u5fb7\u5dde\u6301\u67aa\u8bc1\u8ba4\u8bc1',
        'description': '\u7ecf\u5fb7\u5dde\u5dde\u653f\u5e9c\u6279\u51c6\u7684 LTC \u8ba4\u8bc1\uff0c\u5305\u542b\u8bfe\u5802\u6559\u5b66\u3001\u6cd5\u5f8b\u6559\u80b2\u548c\u5b9e\u5f39\u5c04\u51fb\u8d44\u683c\u8ba4\u8bc1\u3002',
    },
    'vi': {
        'title': 'Ch\u1ee9ng nh\u1eadn Gi\u1ea5y ph\u00e9p Mang theo S\u00fang Texas',
        'description': 'Ch\u1ee9ng nh\u1eadn LTC c\u1ee7a ti\u1ec3u bang Texas \u0111\u01b0\u1ee3c ch\u1ea5p thu\u1eadn v\u1edbi gi\u1ea3ng d\u1ea1y trong l\u1edbp, gi\u00e1o d\u1ee5c ph\u00e1p l\u00fd v\u00e0 s\u00e1t h\u1ea1ch b\u1eafn \u0111\u1ea1n th\u1eadt.',
    },
    'ko': {
        'title': '\ud14d\uc0ac\uc2a4 \uc18c\uc9c0 \ud5c8\uac00 \uc778\uc99d',
        'description': '\uad50\uc2e4 \uad50\uc721, \ubc95\ub960 \uad50\uc721 \ubc0f \uc2e4\ud0c4 \uc0ac\uaca9 \uc790\uaca9 \uc2ec\uc0ac\ub97c \ud3ec\ud568\ud558\ub294 \ud14d\uc0ac\uc2a4 \uc8fc \uc2b9\uc778 LTC \uc778\uc99d.',
    },
    'tl': {
        'title': 'Texas License to Carry Certification',
        'description': 'Sertipikasyong LTC ng Texas na inaprubahan ng estado kasama ang pagtuturo sa silid-aralan, legal na edukasyon, at live-fire qualification.',
    },
}

# Localized rewrites for offerings.dominionWord (short label)
OFFERING = {
    'en': 'Texas License to Carry (LTC) Certification',
    'es': 'Certificaci\u00f3n Licencia para Portar de Texas (LTC)',
    'fr': 'Certification Texas License to Carry (LTC)',
    'de': 'Texas License to Carry (LTC) Zertifizierung',
    'pt': 'Certifica\u00e7\u00e3o Texas License to Carry (LTC)',
    'ar': '\u0634\u0647\u0627\u062f\u0629 \u0631\u062e\u0635\u0629 \u062d\u0645\u0644 \u0627\u0644\u0633\u0644\u0627\u062d \u0641\u064a \u062a\u0643\u0633\u0627\u0633 (LTC)',
    'zh': '\u5fb7\u5dde\u6301\u67aa\u8bc1 (LTC) \u8ba4\u8bc1',
    'vi': 'Ch\u1ee9ng nh\u1eadn Gi\u1ea5y ph\u00e9p Mang theo S\u00fang Texas (LTC)',
    'ko': '\ud14d\uc0ac\uc2a4 \uc18c\uc9c0 \ud5c8\uac00(LTC) \uc778\uc99d',
    'tl': 'Texas License to Carry (LTC) Certification',
}

for locale, featured in FEATURED.items():
    fp = ROOT / f'{locale}.json'
    if not fp.exists():
        print(f'SKIP {locale}: missing')
        continue
    data = json.loads(fp.read_text(encoding='utf-8'))
    home = data.get('home', {})
    dw = home.get('courses', {}).get('dominionWord')
    if dw:
        dw['title'] = featured['title']
        dw['description'] = featured['description']
    offerings = home.get('offerings')
    if offerings and 'dominionWord' in offerings:
        # Remove dup — an `ltc` entry already covers Texas LTC.
        # Instead, rename the value so it appears as the "certification" variant.
        offerings['dominionWord'] = OFFERING[locale]
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'OK {locale}')
