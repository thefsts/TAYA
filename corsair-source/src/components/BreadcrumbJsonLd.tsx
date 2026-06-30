import JsonLd from './JsonLd';
import { breadcrumbSchema } from '@/lib/schema';

interface BreadcrumbJsonLdProps {
  locale: string;
  items: { name: string; path: string }[];
}

/**
 * Server component that emits a BreadcrumbList JSON-LD block.
 * `path` is the locale-less path (e.g. '/about'); the locale prefix
 * is added automatically.
 */
export default function BreadcrumbJsonLd({ locale, items }: BreadcrumbJsonLdProps) {
  const schema = breadcrumbSchema(
    items.map((i) => ({
      name: i.name,
      url: `/${locale}${i.path === '/' ? '' : i.path}`,
    }))
  );
  return <JsonLd data={schema} />;
}
