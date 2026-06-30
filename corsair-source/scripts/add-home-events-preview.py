#!/usr/bin/env python3
"""Add home.eventsPreview block to every locale."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'messages'

PREVIEW = {
    'en': {'label': 'Join Us', 'title': 'Upcoming Events', 'description': 'Classes, community range days, and special training events hosted by Corsair Tactical Solutions.', 'viewAll': 'View All Events', 'cardCta': 'Learn more'},
    'es': {'label': 'Únase', 'title': 'Próximos Eventos', 'description': 'Clases, días de tiro comunitarios y eventos de entrenamiento especiales organizados por Corsair Tactical Solutions.', 'viewAll': 'Ver Todos', 'cardCta': 'Más información'},
    'fr': {'label': 'Rejoignez-Nous', 'title': 'Événements à Venir', 'description': "Cours, journées au stand communautaires et événements de formation spéciaux organisés par Corsair Tactical Solutions.", 'viewAll': 'Voir Tout', 'cardCta': 'En savoir plus'},
    'de': {'label': 'Mitmachen', 'title': 'Kommende Veranstaltungen', 'description': 'Kurse, Gemeinschafts-Schießtage und spezielle Trainings-Events von Corsair Tactical Solutions.', 'viewAll': 'Alle Anzeigen', 'cardCta': 'Mehr erfahren'},
    'pt': {'label': 'Participe', 'title': 'Próximos Eventos', 'description': 'Aulas, dias de tiro comunitários e eventos especiais de treinamento organizados pela Corsair Tactical Solutions.', 'viewAll': 'Ver Todos', 'cardCta': 'Saiba mais'},
    'ar': {'label': 'انضم إلينا', 'title': 'الفعاليات القادمة', 'description': 'دروس وأيام ميدان رماية مجتمعية وفعاليات تدريبية خاصة تستضيفها Corsair Tactical Solutions.', 'viewAll': 'عرض الكل', 'cardCta': 'اعرف المزيد'},
    'zh': {'label': '加入我们', 'title': '即将举办的活动', 'description': 'Corsair Tactical Solutions 主办的课程、社区射击日和特殊培训活动。', 'viewAll': '查看全部', 'cardCta': '了解更多'},
    'vi': {'label': 'Tham Gia', 'title': 'Sự Kiện Sắp Tới', 'description': 'Các lớp học, ngày tập bắn cộng đồng và sự kiện đào tạo đặc biệt do Corsair Tactical Solutions tổ chức.', 'viewAll': 'Xem Tất Cả', 'cardCta': 'Tìm hiểu thêm'},
    'ko': {'label': '참여하세요', 'title': '예정된 이벤트', 'description': 'Corsair Tactical Solutions이 주최하는 수업, 커뮤니티 사격 훈련일 및 특별 훈련 이벤트.', 'viewAll': '모두 보기', 'cardCta': '더 알아보기'},
    'tl': {'label': 'Sumali sa Amin', 'title': 'Mga Paparating na Kaganapan', 'description': 'Mga klase, community range day, at mga espesyal na pagsasanay na hino-host ng Corsair Tactical Solutions.', 'viewAll': 'Tingnan Lahat', 'cardCta': 'Alamin pa'},
}

for locale, block in PREVIEW.items():
    path = ROOT / f'{locale}.json'
    if not path.exists():
        print(f'SKIP {locale}')
        continue
    data = json.loads(path.read_text(encoding='utf-8'))
    data.setdefault('home', {})
    data['home']['eventsPreview'] = block
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'OK {locale}')
