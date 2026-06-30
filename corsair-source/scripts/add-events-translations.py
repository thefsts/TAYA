#!/usr/bin/env python3
"""Propagate Events translations to every locale."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'messages'

# Per-locale translations for the Events block.
# Also ensures nav.events and footer.events are set.
LOCALIZED = {
    'es': {
        'nav.events': 'Eventos',
        'footer.events': 'Eventos',
        'events': {
            'hero': {
                'badge': 'Eventos y Comunidad',
                'title1': 'Próximos Eventos y',
                'title2': 'Entrenamiento Comunitario',
                'subtitle': 'Vea los próximos eventos de Corsair Tactical Solutions, oportunidades especiales de entrenamiento, carteles y fotos de programas anteriores.',
                'imageAlt': 'Evento comunitario de entrenamiento de Corsair Tactical Solutions',
                'breadcrumb': 'Eventos',
                'cta1': 'Ver Próximos Eventos',
                'cta2': 'Contactar a Corsair',
            },
            'toggle': {'upcoming': 'Próximos', 'past': 'Eventos Pasados'},
            'filters': {'all': 'Todas las Categorías'},
            'upcoming': {
                'label': 'Qué Sigue',
                'title': 'Próximos Eventos',
                'description': 'Clases especiales, días de tiro, talleres de seguridad para iglesias y eventos de entrenamiento para mujeres organizados por Corsair Tactical Solutions. Reserve su lugar con anticipación — se llenan rápido.',
            },
            'past': {
                'title': 'Eventos Pasados',
                'description': 'Una mirada a las clases, talleres y eventos comunitarios recientes de Corsair.',
            },
            'flyers': {
                'label': 'Promocionando Ahora',
                'title': 'Carteles de Eventos',
                'description': 'Toque cualquier cartel para verlo en pantalla completa. Guarde o comparta para invitar a alguien a unirse.',
                'viewCta': 'Ver cartel',
            },
            'photos': {
                'label': 'Recuerdos',
                'title': 'Fotos de Eventos',
                'description': 'Fotos de sesiones de entrenamiento, clases y eventos comunitarios anteriores de Corsair.',
            },
            'cta': {
                'title': '¿Desea organizar un evento privado?',
                'description': 'Corsair organiza clases privadas, entrenamientos corporativos, talleres de seguridad para iglesias y eventos comunitarios en todo Texas. Comuníquese con nosotros y diseñaremos un día adaptado a su grupo.',
                'contact': 'Contactar a Corsair',
                'courses': 'Ver Cursos',
                'register': 'Registrarse',
                'contactToRsvp': 'Contactar para RSVP',
                'viewDetails': 'Ver Detalles',
            },
            'emptyState': 'Ningún evento coincide con este filtro aún. Pruebe otra categoría.',
        },
    },
    'fr': {
        'nav.events': 'Événements',
        'footer.events': 'Événements',
        'events': {
            'hero': {
                'badge': 'Événements et Communauté',
                'title1': 'Événements à Venir et',
                'title2': 'Formation Communautaire',
                'subtitle': "Consultez les prochains événements de Corsair Tactical Solutions, les opportunités de formation spéciales, les affiches et les photos des programmes passés.",
                'imageAlt': "Événement de formation communautaire Corsair Tactical Solutions",
                'breadcrumb': 'Événements',
                'cta1': 'Voir les Événements',
                'cta2': 'Contacter Corsair',
            },
            'toggle': {'upcoming': 'À venir', 'past': 'Événements Passés'},
            'filters': {'all': 'Toutes les Catégories'},
            'upcoming': {
                'label': 'À Venir',
                'title': 'Événements à Venir',
                'description': "Classes spéciales, journées au stand, ateliers de sécurité pour églises et événements de formation pour femmes organisés par Corsair Tactical Solutions. Réservez tôt — les places partent vite.",
            },
            'past': {
                'title': 'Événements Passés',
                'description': "Un aperçu des récents cours, ateliers et événements communautaires de Corsair.",
            },
            'flyers': {
                'label': 'Promotion en Cours',
                'title': "Affiches d'Événements",
                'description': "Touchez une affiche pour l'ouvrir en plein écran. Enregistrez ou partagez pour inviter quelqu'un.",
                'viewCta': "Voir l'affiche",
            },
            'photos': {
                'label': 'Souvenirs',
                'title': "Photos d'Événements",
                'description': "Photos de sessions de formation, de cours et d'événements communautaires Corsair passés.",
            },
            'cta': {
                'title': 'Vous souhaitez organiser un événement privé ?',
                'description': "Corsair organise des cours privés, des formations d'entreprise, des ateliers de sécurité pour églises et des événements communautaires dans tout le Texas. Contactez-nous et nous créerons une journée sur mesure.",
                'contact': 'Contacter Corsair',
                'courses': 'Voir les Cours',
                'register': 'S\'inscrire',
                'contactToRsvp': 'Contacter pour RSVP',
                'viewDetails': 'Voir les Détails',
            },
            'emptyState': "Aucun événement ne correspond à ce filtre. Essayez une autre catégorie.",
        },
    },
    'de': {
        'nav.events': 'Veranstaltungen',
        'footer.events': 'Veranstaltungen',
        'events': {
            'hero': {
                'badge': 'Veranstaltungen & Gemeinschaft',
                'title1': 'Kommende Veranstaltungen &',
                'title2': 'Gemeinschaftstraining',
                'subtitle': 'Sehen Sie sich kommende Veranstaltungen, besondere Trainingsmöglichkeiten, Flyer und Fotos vergangener Programme von Corsair Tactical Solutions an.',
                'imageAlt': 'Corsair Tactical Solutions Gemeinschaftstraining',
                'breadcrumb': 'Veranstaltungen',
                'cta1': 'Kommende Veranstaltungen',
                'cta2': 'Corsair Kontaktieren',
            },
            'toggle': {'upcoming': 'Bevorstehend', 'past': 'Vergangene'},
            'filters': {'all': 'Alle Kategorien'},
            'upcoming': {
                'label': 'Was als Nächstes',
                'title': 'Kommende Veranstaltungen',
                'description': 'Spezialkurse, Schießtage, Kirchensicherheits-Workshops und Frauen-Trainingsveranstaltungen von Corsair Tactical Solutions. Sichern Sie sich früh Ihren Platz — sie sind schnell ausgebucht.',
            },
            'past': {
                'title': 'Vergangene Veranstaltungen',
                'description': 'Ein Rückblick auf kürzliche Corsair-Kurse, Workshops und Gemeinschaftsveranstaltungen.',
            },
            'flyers': {
                'label': 'Jetzt Verfügbar',
                'title': 'Veranstaltungs-Flyer',
                'description': 'Tippen Sie auf einen Flyer, um ihn im Vollbild zu sehen. Speichern oder teilen Sie ihn, um jemanden einzuladen.',
                'viewCta': 'Flyer ansehen',
            },
            'photos': {
                'label': 'Erinnerungen',
                'title': 'Veranstaltungsfotos',
                'description': 'Fotos von vergangenen Corsair-Trainings, Kursen und Gemeinschaftsveranstaltungen.',
            },
            'cta': {
                'title': 'Möchten Sie eine private Veranstaltung ausrichten?',
                'description': 'Corsair organisiert private Kurse, Firmenschulungen, Kirchensicherheits-Workshops und Gemeinschaftsveranstaltungen in ganz Texas. Kontaktieren Sie uns und wir gestalten einen maßgeschneiderten Tag für Ihre Gruppe.',
                'contact': 'Corsair Kontaktieren',
                'courses': 'Kurse Ansehen',
                'register': 'Anmelden',
                'contactToRsvp': 'Für RSVP Kontaktieren',
                'viewDetails': 'Details Ansehen',
            },
            'emptyState': 'Keine Veranstaltungen entsprechen diesem Filter. Versuchen Sie eine andere Kategorie.',
        },
    },
    'pt': {
        'nav.events': 'Eventos',
        'footer.events': 'Eventos',
        'events': {
            'hero': {
                'badge': 'Eventos e Comunidade',
                'title1': 'Próximos Eventos e',
                'title2': 'Treinamento Comunitário',
                'subtitle': 'Veja os próximos eventos da Corsair Tactical Solutions, oportunidades especiais de treinamento, panfletos e fotos de programas anteriores.',
                'imageAlt': 'Evento comunitário de treinamento Corsair Tactical Solutions',
                'breadcrumb': 'Eventos',
                'cta1': 'Ver Próximos Eventos',
                'cta2': 'Contatar Corsair',
            },
            'toggle': {'upcoming': 'Próximos', 'past': 'Eventos Passados'},
            'filters': {'all': 'Todas as Categorias'},
            'upcoming': {
                'label': 'O Que Vem',
                'title': 'Próximos Eventos',
                'description': 'Aulas especiais, dias de tiro, oficinas de segurança para igrejas e eventos de treinamento feminino organizados pela Corsair Tactical Solutions. Reserve cedo — lotam rápido.',
            },
            'past': {
                'title': 'Eventos Passados',
                'description': 'Um olhar para as aulas, oficinas e eventos comunitários recentes da Corsair.',
            },
            'flyers': {
                'label': 'Em Destaque',
                'title': 'Panfletos de Eventos',
                'description': 'Toque em qualquer panfleto para vê-lo em tela cheia. Salve ou compartilhe para convidar alguém.',
                'viewCta': 'Ver panfleto',
            },
            'photos': {
                'label': 'Lembranças',
                'title': 'Fotos de Eventos',
                'description': 'Fotos de treinamentos, aulas e eventos comunitários anteriores da Corsair.',
            },
            'cta': {
                'title': 'Quer organizar um evento privado?',
                'description': 'A Corsair organiza aulas particulares, treinamentos corporativos, oficinas de segurança para igrejas e eventos comunitários em todo o Texas. Entre em contato e vamos criar um dia sob medida.',
                'contact': 'Contatar Corsair',
                'courses': 'Ver Cursos',
                'register': 'Inscrever-se',
                'contactToRsvp': 'Contatar para RSVP',
                'viewDetails': 'Ver Detalhes',
            },
            'emptyState': 'Nenhum evento corresponde a este filtro ainda. Tente outra categoria.',
        },
    },
    'ar': {
        'nav.events': 'الفعاليات',
        'footer.events': 'الفعاليات',
        'events': {
            'hero': {
                'badge': 'الفعاليات والمجتمع',
                'title1': 'الفعاليات القادمة و',
                'title2': 'التدريب المجتمعي',
                'subtitle': 'اطلع على فعاليات Corsair Tactical Solutions القادمة، وفرص التدريب الخاصة، والملصقات، وصور من البرامج السابقة.',
                'imageAlt': 'فعالية تدريب مجتمعي لشركة Corsair Tactical Solutions',
                'breadcrumb': 'الفعاليات',
                'cta1': 'عرض الفعاليات القادمة',
                'cta2': 'تواصل مع Corsair',
            },
            'toggle': {'upcoming': 'القادمة', 'past': 'الفعاليات السابقة'},
            'filters': {'all': 'جميع الفئات'},
            'upcoming': {
                'label': 'ما هو التالي',
                'title': 'الفعاليات القادمة',
                'description': 'فصول خاصة، وأيام في ميدان الرماية، وورش عمل لسلامة الكنائس، وفعاليات تدريبية للنساء تستضيفها Corsair Tactical Solutions. احجز مكانك مبكراً — تمتلئ بسرعة.',
            },
            'past': {
                'title': 'الفعاليات السابقة',
                'description': 'نظرة على فصول وورش وفعاليات Corsair المجتمعية الأخيرة.',
            },
            'flyers': {
                'label': 'قيد الترويج الآن',
                'title': 'ملصقات الفعاليات',
                'description': 'اضغط على أي ملصق لعرضه بحجم كامل. احفظه أو شاركه لدعوة شخص ما.',
                'viewCta': 'عرض الملصق',
            },
            'photos': {
                'label': 'ذكريات',
                'title': 'صور الفعاليات',
                'description': 'صور من جلسات التدريب والفصول والفعاليات المجتمعية السابقة لـ Corsair.',
            },
            'cta': {
                'title': 'هل ترغب في استضافة فعالية خاصة؟',
                'description': 'تستضيف Corsair فصولاً خاصة وتدريباً للشركات وورش عمل لسلامة الكنائس وفعاليات مجتمعية في جميع أنحاء تكساس. تواصل معنا ولنبني يوماً مصمماً خصيصاً لمجموعتك.',
                'contact': 'تواصل مع Corsair',
                'courses': 'تصفح الدورات',
                'register': 'التسجيل',
                'contactToRsvp': 'تواصل للحجز',
                'viewDetails': 'عرض التفاصيل',
            },
            'emptyState': 'لا توجد فعاليات تطابق هذا الفلتر بعد. جرب فئة أخرى.',
        },
    },
    'zh': {
        'nav.events': '活动',
        'footer.events': '活动',
        'events': {
            'hero': {
                'badge': '活动与社区',
                'title1': '即将举办的活动与',
                'title2': '社区培训',
                'subtitle': '查看 Corsair Tactical Solutions 即将举办的活动、特殊培训机会、海报以及过往项目的照片。',
                'imageAlt': 'Corsair Tactical Solutions 社区培训活动',
                'breadcrumb': '活动',
                'cta1': '查看即将举办的活动',
                'cta2': '联系 Corsair',
            },
            'toggle': {'upcoming': '即将举办', 'past': '过往活动'},
            'filters': {'all': '所有类别'},
            'upcoming': {
                'label': '接下来',
                'title': '即将举办的活动',
                'description': '由 Corsair Tactical Solutions 主办的特殊课程、射击日、教堂安全研讨会和女性培训活动。请尽早预订名额 — 名额很快就会报满。',
            },
            'past': {
                'title': '过往活动',
                'description': '回顾近期的 Corsair 课程、研讨会和社区活动。',
            },
            'flyers': {
                'label': '正在推广',
                'title': '活动海报',
                'description': '点击任何海报以全屏查看。保存或分享以邀请他人参加。',
                'viewCta': '查看海报',
            },
            'photos': {
                'label': '回忆',
                'title': '活动照片',
                'description': '过往 Corsair 培训、课程和社区活动的照片。',
            },
            'cta': {
                'title': '想举办私人活动吗？',
                'description': 'Corsair 在德克萨斯州各地举办私人课程、企业培训、教堂安全研讨会和社区活动。联系我们,为您的团队量身定制一天。',
                'contact': '联系 Corsair',
                'courses': '浏览课程',
                'register': '注册',
                'contactToRsvp': '联系预约',
                'viewDetails': '查看详情',
            },
            'emptyState': '目前没有活动符合此筛选条件。请尝试其他类别。',
        },
    },
    'vi': {
        'nav.events': 'Sự Kiện',
        'footer.events': 'Sự Kiện',
        'events': {
            'hero': {
                'badge': 'Sự Kiện & Cộng Đồng',
                'title1': 'Sự Kiện Sắp Tới &',
                'title2': 'Đào Tạo Cộng Đồng',
                'subtitle': 'Xem các sự kiện sắp tới của Corsair Tactical Solutions, cơ hội đào tạo đặc biệt, tờ rơi và ảnh từ các chương trình trước.',
                'imageAlt': 'Sự kiện đào tạo cộng đồng Corsair Tactical Solutions',
                'breadcrumb': 'Sự Kiện',
                'cta1': 'Xem Sự Kiện Sắp Tới',
                'cta2': 'Liên Hệ Corsair',
            },
            'toggle': {'upcoming': 'Sắp Tới', 'past': 'Sự Kiện Đã Qua'},
            'filters': {'all': 'Tất Cả Danh Mục'},
            'upcoming': {
                'label': 'Sắp Tới',
                'title': 'Sự Kiện Sắp Tới',
                'description': 'Các lớp học đặc biệt, ngày tập bắn, hội thảo an toàn nhà thờ và sự kiện đào tạo cho phụ nữ do Corsair Tactical Solutions tổ chức. Đặt chỗ sớm — hết chỗ rất nhanh.',
            },
            'past': {
                'title': 'Sự Kiện Đã Qua',
                'description': 'Nhìn lại các lớp học, hội thảo và sự kiện cộng đồng gần đây của Corsair.',
            },
            'flyers': {
                'label': 'Đang Quảng Bá',
                'title': 'Tờ Rơi Sự Kiện',
                'description': 'Chạm vào bất kỳ tờ rơi nào để xem toàn màn hình. Lưu hoặc chia sẻ để mời người khác tham gia.',
                'viewCta': 'Xem tờ rơi',
            },
            'photos': {
                'label': 'Kỷ Niệm',
                'title': 'Ảnh Sự Kiện',
                'description': 'Ảnh từ các buổi đào tạo, lớp học và sự kiện cộng đồng trước đây của Corsair.',
            },
            'cta': {
                'title': 'Bạn muốn tổ chức sự kiện riêng?',
                'description': 'Corsair tổ chức các lớp học riêng, đào tạo doanh nghiệp, hội thảo an toàn nhà thờ và sự kiện cộng đồng trên khắp Texas. Hãy liên hệ và chúng tôi sẽ tạo ra một ngày phù hợp với nhóm của bạn.',
                'contact': 'Liên Hệ Corsair',
                'courses': 'Xem Khóa Học',
                'register': 'Đăng Ký',
                'contactToRsvp': 'Liên Hệ Để Đặt Chỗ',
                'viewDetails': 'Xem Chi Tiết',
            },
            'emptyState': 'Không có sự kiện nào khớp với bộ lọc này. Hãy thử danh mục khác.',
        },
    },
    'ko': {
        'nav.events': '이벤트',
        'footer.events': '이벤트',
        'events': {
            'hero': {
                'badge': '이벤트 및 커뮤니티',
                'title1': '예정된 이벤트 및',
                'title2': '커뮤니티 훈련',
                'subtitle': 'Corsair Tactical Solutions의 예정된 이벤트, 특별 훈련 기회, 전단지 및 과거 프로그램의 사진을 확인하세요.',
                'imageAlt': 'Corsair Tactical Solutions 커뮤니티 훈련 이벤트',
                'breadcrumb': '이벤트',
                'cta1': '예정된 이벤트 보기',
                'cta2': 'Corsair에 문의',
            },
            'toggle': {'upcoming': '예정', 'past': '지난 이벤트'},
            'filters': {'all': '모든 카테고리'},
            'upcoming': {
                'label': '다음',
                'title': '예정된 이벤트',
                'description': 'Corsair Tactical Solutions이 주최하는 특별 수업, 사격 훈련일, 교회 안전 워크숍 및 여성 훈련 이벤트. 빨리 예약하세요 — 금방 마감됩니다.',
            },
            'past': {
                'title': '지난 이벤트',
                'description': '최근 Corsair 수업, 워크숍 및 커뮤니티 이벤트를 되돌아봅니다.',
            },
            'flyers': {
                'label': '현재 홍보 중',
                'title': '이벤트 전단지',
                'description': '아무 전단지나 눌러서 전체 화면으로 보세요. 저장하거나 공유하여 다른 사람을 초대하세요.',
                'viewCta': '전단지 보기',
            },
            'photos': {
                'label': '추억',
                'title': '이벤트 사진',
                'description': '과거 Corsair 훈련, 수업 및 커뮤니티 이벤트의 사진들.',
            },
            'cta': {
                'title': '프라이빗 이벤트를 주최하고 싶으신가요?',
                'description': 'Corsair는 텍사스 전역에서 프라이빗 수업, 기업 훈련, 교회 안전 워크숍 및 커뮤니티 이벤트를 주최합니다. 연락주시면 귀하의 그룹에 맞춘 하루를 만들어 드립니다.',
                'contact': 'Corsair에 문의',
                'courses': '코스 보기',
                'register': '등록',
                'contactToRsvp': '예약 문의',
                'viewDetails': '자세히 보기',
            },
            'emptyState': '이 필터와 일치하는 이벤트가 없습니다. 다른 카테고리를 시도해 보세요.',
        },
    },
    'tl': {
        'nav.events': 'Mga Kaganapan',
        'footer.events': 'Mga Kaganapan',
        'events': {
            'hero': {
                'badge': 'Mga Kaganapan at Komunidad',
                'title1': 'Mga Paparating na Kaganapan at',
                'title2': 'Pagsasanay sa Komunidad',
                'subtitle': 'Tingnan ang mga paparating na kaganapan ng Corsair Tactical Solutions, espesyal na pagsasanay, mga flyer, at mga larawan mula sa mga nakaraang programa.',
                'imageAlt': 'Corsair Tactical Solutions na pagsasanay sa komunidad',
                'breadcrumb': 'Mga Kaganapan',
                'cta1': 'Tingnan ang mga Kaganapan',
                'cta2': 'Makipag-ugnayan sa Corsair',
            },
            'toggle': {'upcoming': 'Paparating', 'past': 'Nakaraan'},
            'filters': {'all': 'Lahat ng Kategorya'},
            'upcoming': {
                'label': 'Susunod',
                'title': 'Mga Paparating na Kaganapan',
                'description': 'Mga espesyal na klase, range day, church safety workshop, at pagsasanay para sa kababaihan na hino-host ng Corsair Tactical Solutions. Mag-reserba nang maaga — mabilis mapuno ang mga ito.',
            },
            'past': {
                'title': 'Mga Nakaraang Kaganapan',
                'description': 'Balikan ang mga kamakailang klase, workshop, at kaganapan ng Corsair.',
            },
            'flyers': {
                'label': 'Kasalukuyang Pino-promote',
                'title': 'Mga Flyer ng Kaganapan',
                'description': 'I-tap ang anumang flyer upang makita nang full-screen. I-save o ibahagi upang magkaroon ng kasama.',
                'viewCta': 'Tingnan ang flyer',
            },
            'photos': {
                'label': 'Mga Alaala',
                'title': 'Mga Larawan ng Kaganapan',
                'description': 'Mga larawan mula sa mga nakaraang pagsasanay, klase, at kaganapan sa komunidad ng Corsair.',
            },
            'cta': {
                'title': 'Gusto mo bang mag-host ng private na kaganapan?',
                'description': 'Nag-ho-host ang Corsair ng mga private na klase, corporate training, church safety workshops, at mga kaganapan sa komunidad sa buong Texas. Makipag-ugnayan at gagawa kami ng araw na angkop sa inyong grupo.',
                'contact': 'Makipag-ugnayan sa Corsair',
                'courses': 'Mga Kurso',
                'register': 'Magparehistro',
                'contactToRsvp': 'Makipag-ugnayan para sa RSVP',
                'viewDetails': 'Tingnan ang Detalye',
            },
            'emptyState': 'Wala pang kaganapan na tumutugma sa filter na ito. Subukan ang ibang kategorya.',
        },
    },
}


def set_nested(obj, dotted_key, value):
    parts = dotted_key.split('.')
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def reorder_nav_keys(nav):
    """Keep nav keys in a consistent order including events."""
    desired = [
        'corsair', 'about', 'courses', 'services', 'contact', 'faq',
        'instructors', 'securityServices', 'propertyManagerServices',
        'churchSafety', 'privateInvestigations', 'securityTraining',
        'events', 'viewCourses', 'contactUs', 'mainNavigation',
        'mobileNavigation', 'home',
    ]
    out = {}
    for k in desired:
        if k in nav:
            out[k] = nav[k]
    # Append any unexpected extras to preserve data
    for k, v in nav.items():
        if k not in out:
            out[k] = v
    return out


def reorder_footer_keys(footer):
    desired = [
        'quickLinks', 'ourCourses', 'whyCorsair', 'legalCompliance',
        'readyToTrain', 'contactToStart', 'viewAllCourses', 'description',
        'home', 'about', 'allCourses', 'events', 'contact',
        'privacy', 'terms', 'cookies', 'accessibility', 'designedBy',
    ]
    out = {}
    for k in desired:
        if k in footer:
            out[k] = footer[k]
    for k, v in footer.items():
        if k not in out:
            out[k] = v
    return out


for locale, payload in LOCALIZED.items():
    path = ROOT / f'{locale}.json'
    if not path.exists():
        print(f'SKIP {locale}: file missing')
        continue
    data = json.loads(path.read_text(encoding='utf-8'))

    # nav.events
    data.setdefault('nav', {})
    data['nav']['events'] = payload['nav.events']
    data['nav'] = reorder_nav_keys(data['nav'])

    # footer.events
    data.setdefault('footer', {})
    data['footer']['events'] = payload['footer.events']
    data['footer'] = reorder_footer_keys(data['footer'])

    # events block (full replacement)
    data['events'] = payload['events']

    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    print(f'OK {locale}')

print('\nDone.')
