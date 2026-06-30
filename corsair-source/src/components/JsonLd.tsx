/**
 * Render a JSON-LD script tag. Use server-side.
 *
 * Usage:
 *   <JsonLd data={organizationSchema()} />
 *   <JsonLd data={[organizationSchema(), websiteSchema()]} />
 */
interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
  id?: string;
}

export default function JsonLd({ data, id }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <>
      {payload.map((entry, i) => (
        <script
          key={i}
          id={id ? `${id}-${i}` : undefined}
          type="application/ld+json"
          // Schema.org JSON needs to render exactly as JSON, not escaped.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
    </>
  );
}
