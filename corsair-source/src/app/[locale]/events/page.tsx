/**
 * Events page — server component wrapper.
 *
 * Fetches published events from the Convex CMS and passes them as initial
 * props to the interactive client component. Falls back gracefully to the
 * static events data if Convex is unreachable.
 */
import { getCmsEvents, cmsEventToCorsairEvent } from '@/lib/cms';
import EventsPageClient from './EventsPageClient';

export default async function EventsPage() {
  const cmsEvents = await getCmsEvents();

  const cmsUpcoming = cmsEvents
    .filter((e) => new Date(e.startAt).getTime() > Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .map(cmsEventToCorsairEvent);

  return (
    <EventsPageClient
      cmsUpcomingEvents={cmsUpcoming.length > 0 ? cmsUpcoming : undefined}
    />
  );
}
