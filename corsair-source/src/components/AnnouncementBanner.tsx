import Link from 'next/link';
import { getCmsAnnouncement } from '@/lib/cms';

export default async function AnnouncementBanner() {
  const announcement = await getCmsAnnouncement();

  if (!announcement || !announcement.isEnabled || !announcement.text) {
    return null;
  }

  const bg = announcement.bgColor ?? '#be123c';

  return (
    <div
      className="w-full py-2.5 px-4 text-center text-sm font-semibold relative z-50"
      style={{ backgroundColor: bg, color: '#ffffff' }}
    >
      <span>{announcement.text}</span>
      {announcement.link && (
        <>
          {' '}
          <Link
            href={announcement.link}
            className="underline underline-offset-2 font-bold hover:opacity-80 transition-opacity"
            style={{ color: '#ffffff' }}
          >
            Learn more →
          </Link>
        </>
      )}
    </div>
  );
}
