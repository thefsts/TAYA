#!/usr/bin/env python3
"""Add metaTitle + metaDescription to courses, events, trainingWaiver sections
for all 10 locales."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'messages'

META = {
    'en': {
        'courses': {
            'metaTitle': 'Firearms Training Courses in Texas',
            'metaDescription': 'Browse all Corsair Tactical Solutions courses: Texas License to Carry certification, beginner handgun, defensive shooting, and Texas security guard training (Level II, III, IV).',
        },
        'events': {
            'metaTitle': 'Upcoming Events & Community Training',
            'metaDescription': 'See upcoming Corsair Tactical Solutions events, LTC classes, community training days, and past event photos from Texas firearms and security training sessions.',
        },
        'trainingWaiver': {
            'metaTitle': 'Training Waiver',
            'metaDescription': 'Electronic liability waiver for Corsair Tactical Solutions training courses. Required before participating in firearms or security training.',
        },
    },
    'es': {
        'courses': {
            'metaTitle': 'Cursos de Entrenamiento de Armas en Texas',
            'metaDescription': 'Explora todos los cursos de Corsair Tactical Solutions: Certificaci\u00f3n LTC de Texas, manejo b\u00e1sico de pistola, tiro defensivo y entrenamiento de seguridad (Nivel II, III, IV).',
        },
        'events': {
            'metaTitle': 'Pr\u00f3ximos Eventos y Entrenamiento Comunitario',
            'metaDescription': 'Consulta los pr\u00f3ximos eventos de Corsair Tactical Solutions, clases LTC, d\u00edas de entrenamiento comunitario y fotos de eventos pasados.',
        },
        'trainingWaiver': {
            'metaTitle': 'Exenci\u00f3n de Entrenamiento',
            'metaDescription': 'Exenci\u00f3n de responsabilidad electr\u00f3nica para los cursos de Corsair Tactical Solutions. Requerida antes de participar.',
        },
    },
    'fr': {
        'courses': {
            'metaTitle': 'Cours de formation aux armes \u00e0 feu au Texas',
            'metaDescription': 'Parcourez tous les cours Corsair Tactical Solutions\u00a0: certification Texas LTC, tir de base, tir d\u00e9fensif et formation des agents de s\u00e9curit\u00e9 (niveau II, III, IV).',
        },
        'events': {
            'metaTitle': '\u00c9v\u00e9nements \u00e0 venir & formation communautaire',
            'metaDescription': 'Consultez les \u00e9v\u00e9nements \u00e0 venir, les cours LTC, les journ\u00e9es de formation communautaire et les photos d\u2019\u00e9v\u00e9nements pass\u00e9s de Corsair Tactical Solutions.',
        },
        'trainingWaiver': {
            'metaTitle': 'D\u00e9charge de formation',
            'metaDescription': 'D\u00e9charge de responsabilit\u00e9 \u00e9lectronique pour les cours Corsair Tactical Solutions. Requise avant toute participation.',
        },
    },
    'de': {
        'courses': {
            'metaTitle': 'Schusswaffen-Trainingskurse in Texas',
            'metaDescription': 'Alle Kurse von Corsair Tactical Solutions: Texas LTC Zertifizierung, Einsteiger-Handfeuerwaffentraining, defensives Schie\u00dfen und Sicherheitsausbildung (Level II, III, IV).',
        },
        'events': {
            'metaTitle': 'Bevorstehende Events & Community-Training',
            'metaDescription': 'Entdecken Sie bevorstehende Events, LTC-Kurse, Community-Trainings und Fotos vergangener Events von Corsair Tactical Solutions.',
        },
        'trainingWaiver': {
            'metaTitle': 'Trainings-Haftungsausschluss',
            'metaDescription': 'Elektronischer Haftungsausschluss f\u00fcr Corsair Tactical Solutions Kurse. Vor der Teilnahme erforderlich.',
        },
    },
    'pt': {
        'courses': {
            'metaTitle': 'Cursos de Treinamento com Armas no Texas',
            'metaDescription': 'Explore todos os cursos da Corsair Tactical Solutions: Certifica\u00e7\u00e3o LTC do Texas, manuseio b\u00e1sico de pistola, tiro defensivo e treinamento de seguran\u00e7a (N\u00edvel II, III, IV).',
        },
        'events': {
            'metaTitle': 'Pr\u00f3ximos Eventos e Treinamento Comunit\u00e1rio',
            'metaDescription': 'Veja os pr\u00f3ximos eventos, cursos LTC, dias de treinamento comunit\u00e1rio e fotos de eventos passados da Corsair Tactical Solutions.',
        },
        'trainingWaiver': {
            'metaTitle': 'Termo de Treinamento',
            'metaDescription': 'Termo de responsabilidade eletr\u00f4nico para os cursos da Corsair Tactical Solutions. Necess\u00e1rio antes da participa\u00e7\u00e3o.',
        },
    },
    'ar': {
        'courses': {
            'metaTitle': '\u062f\u0648\u0631\u0627\u062a \u062a\u062f\u0631\u064a\u0628 \u0639\u0644\u0649 \u0627\u0644\u0623\u0633\u0644\u062d\u0629 \u0641\u064a \u062a\u0643\u0633\u0627\u0633',
            'metaDescription': '\u062a\u0635\u0641\u062d \u062c\u0645\u064a\u0639 \u062f\u0648\u0631\u0627\u062a \u0643\u0648\u0631\u0633\u064a\u0631 \u062a\u0627\u0643\u062a\u064a\u0643\u0627\u0644 \u0633\u0648\u0644\u0648\u0634\u0646\u0632: \u0634\u0647\u0627\u062f\u0629 LTC \u062a\u0643\u0633\u0627\u0633\u060c \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064a \u0644\u0644\u0645\u0633\u062f\u0633\u060c \u0627\u0644\u0631\u0645\u0627\u064a\u0629 \u0627\u0644\u062f\u0641\u0627\u0639\u064a\u0629 \u0648\u062a\u062f\u0631\u064a\u0628 \u062d\u0631\u0627\u0633 \u0627\u0644\u0623\u0645\u0646 (\u0627\u0644\u0645\u0633\u062a\u0648\u0649 II \u0648III \u0648IV).',
        },
        'events': {
            'metaTitle': '\u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0627\u0644\u0642\u0627\u062f\u0645\u0629 \u0648\u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0645\u062c\u062a\u0645\u0639\u064a',
            'metaDescription': '\u062a\u0639\u0631\u0651\u0641 \u0639\u0644\u0649 \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0627\u0644\u0642\u0627\u062f\u0645\u0629 \u0648\u062f\u0648\u0631\u0627\u062a LTC \u0648\u0623\u064a\u0627\u0645 \u0627\u0644\u062a\u062f\u0631\u064a\u0628 \u0627\u0644\u0645\u062c\u062a\u0645\u0639\u064a \u0648\u0635\u0648\u0631 \u0627\u0644\u0641\u0639\u0627\u0644\u064a\u0627\u062a \u0627\u0644\u0633\u0627\u0628\u0642\u0629.',
        },
        'trainingWaiver': {
            'metaTitle': '\u0625\u062e\u0644\u0627\u0621 \u0637\u0631\u0641 \u0627\u0644\u062a\u062f\u0631\u064a\u0628',
            'metaDescription': '\u0625\u062e\u0644\u0627\u0621 \u0637\u0631\u0641 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0645\u0637\u0644\u0648\u0628 \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0641\u064a \u062f\u0648\u0631\u0627\u062a \u0643\u0648\u0631\u0633\u064a\u0631 \u062a\u0627\u0643\u062a\u064a\u0643\u0627\u0644 \u0633\u0648\u0644\u0648\u0634\u0646\u0632.',
        },
    },
    'zh': {
        'courses': {
            'metaTitle': '\u5fb7\u5dde\u67aa\u68b0\u8bad\u7ec3\u8bfe\u7a0b',
            'metaDescription': '\u6d4f\u89c8 Corsair Tactical Solutions \u7684\u6240\u6709\u8bfe\u7a0b\uff1a\u5fb7\u5dde LTC \u8ba4\u8bc1\u3001\u521d\u5b66\u624b\u67aa\u8bad\u7ec3\u3001\u9632\u5fa1\u5c04\u51fb\u4ee5\u53ca\u5fb7\u5dde\u5b89\u4fdd\u57f9\u8bad (II\u3001III\u3001IV \u7ea7)\u3002',
        },
        'events': {
            'metaTitle': '\u5373\u5c06\u4e3e\u529e\u7684\u6d3b\u52a8\u4e0e\u793e\u533a\u57f9\u8bad',
            'metaDescription': '\u67e5\u770b Corsair Tactical Solutions \u5373\u5c06\u4e3e\u529e\u7684\u6d3b\u52a8\u3001LTC \u8bfe\u7a0b\u3001\u793e\u533a\u57f9\u8bad\u65e5\u4ee5\u53ca\u8fc7\u5f80\u6d3b\u52a8\u7167\u7247\u3002',
        },
        'trainingWaiver': {
            'metaTitle': '\u57f9\u8bad\u514d\u8d23\u58f0\u660e',
            'metaDescription': '\u53c2\u52a0 Corsair Tactical Solutions \u8bfe\u7a0b\u524d\u9700\u7b7e\u7f72\u7684\u7535\u5b50\u8d23\u4efb\u514d\u9664\u58f0\u660e\u3002',
        },
    },
    'vi': {
        'courses': {
            'metaTitle': 'C\u00e1c kh\u00f3a hu\u1ea5n luy\u1ec7n s\u00fang t\u1ea1i Texas',
            'metaDescription': 'Duy\u1ec7t t\u1ea5t c\u1ea3 c\u00e1c kh\u00f3a h\u1ecdc c\u1ee7a Corsair Tactical Solutions: Ch\u1ee9ng nh\u1eadn LTC Texas, hu\u1ea5n luy\u1ec7n s\u00fang ng\u1eafn c\u01a1 b\u1ea3n, b\u1eafn ph\u00f2ng th\u1ee7 v\u00e0 hu\u1ea5n luy\u1ec7n an ninh (C\u1ea5p II, III, IV).',
        },
        'events': {
            'metaTitle': 'S\u1ef1 ki\u1ec7n s\u1eafp t\u1edbi v\u00e0 hu\u1ea5n luy\u1ec7n c\u1ed9ng \u0111\u1ed3ng',
            'metaDescription': 'Xem c\u00e1c s\u1ef1 ki\u1ec7n s\u1eafp t\u1edbi, l\u1edbp LTC, ng\u00e0y hu\u1ea5n luy\u1ec7n c\u1ed9ng \u0111\u1ed3ng v\u00e0 \u1ea3nh c\u1ee7a c\u00e1c s\u1ef1 ki\u1ec7n \u0111\u00e3 qua c\u1ee7a Corsair Tactical Solutions.',
        },
        'trainingWaiver': {
            'metaTitle': 'Mi\u1ec5n tr\u1eeb hu\u1ea5n luy\u1ec7n',
            'metaDescription': 'Mi\u1ec5n tr\u1eeb tr\u00e1ch nhi\u1ec7m \u0111i\u1ec7n t\u1eed cho c\u00e1c kh\u00f3a h\u1ecdc c\u1ee7a Corsair Tactical Solutions. B\u1eaft bu\u1ed9c tr\u01b0\u1edbc khi tham gia.',
        },
    },
    'ko': {
        'courses': {
            'metaTitle': '\ud14d\uc0ac\uc2a4 \ucd1d\uae30 \ud6c8\ub828 \uacfc\uc815',
            'metaDescription': 'Corsair Tactical Solutions\uc758 \ubaa8\ub4e0 \uacfc\uc815\uc744 \ub458\ub7ec\ubcf4\uc138\uc694: \ud14d\uc0ac\uc2a4 LTC \uc778\uc99d, \ucd08\uae09 \uad8c\ucd1d \ud6c8\ub828, \ubc29\uc5b4 \uc0ac\uaca9, \ud14d\uc0ac\uc2a4 \uacbd\ube44 \uad50\uc721 (II, III, IV \ub4f1\uae09).',
        },
        'events': {
            'metaTitle': '\uc608\uc815\ub41c \uc774\ubca4\ud2b8 \ubc0f \ucee4\ubba4\ub2c8\ud2f0 \ud6c8\ub828',
            'metaDescription': 'Corsair Tactical Solutions\uc758 \uc608\uc815\ub41c \uc774\ubca4\ud2b8, LTC \uc218\uc5c5, \ucee4\ubba4\ub2c8\ud2f0 \ud6c8\ub828\uc77c \ubc0f \uacfc\uac70 \uc774\ubca4\ud2b8 \uc0ac\uc9c4\uc744 \ud655\uc778\ud558\uc138\uc694.',
        },
        'trainingWaiver': {
            'metaTitle': '\ud6c8\ub828 \uba74\ucc45 \ub3d9\uc758\uc11c',
            'metaDescription': 'Corsair Tactical Solutions \uacfc\uc815\uc5d0 \ucc38\uc5ec\ud558\uae30 \uc804\uc5d0 \ud544\uc694\ud55c \uc804\uc790 \ucc45\uc784 \uba74\uc81c \ub3d9\uc758\uc11c.',
        },
    },
    'tl': {
        'courses': {
            'metaTitle': 'Mga Kurso sa Firearms Training sa Texas',
            'metaDescription': 'Tingnan ang lahat ng kurso ng Corsair Tactical Solutions: Texas LTC certification, beginner handgun, defensive shooting, at Texas security guard training (Level II, III, IV).',
        },
        'events': {
            'metaTitle': 'Mga Paparating na Event at Community Training',
            'metaDescription': 'Tingnan ang mga paparating na event, LTC classes, community training days, at mga larawan mula sa nakaraang events ng Corsair Tactical Solutions.',
        },
        'trainingWaiver': {
            'metaTitle': 'Training Waiver',
            'metaDescription': 'Electronic liability waiver para sa mga kurso ng Corsair Tactical Solutions. Kinakailangan bago lumahok.',
        },
    },
}

for locale, sections in META.items():
    fp = ROOT / f'{locale}.json'
    if not fp.exists():
        print(f'SKIP {locale}')
        continue
    data = json.loads(fp.read_text(encoding='utf-8'))
    for section, meta in sections.items():
        if section not in data:
            data[section] = {}
        for k, v in meta.items():
            data[section][k] = v
    fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'OK {locale}')
