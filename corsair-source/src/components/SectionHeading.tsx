interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centered = true,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={`mb-12 ${centered ? 'text-center' : ''}`}>
      {eyebrow && (
        <span className={`text-xs font-bold uppercase tracking-widest ${light ? 'text-corsair-red-400' : 'text-corsair-red-500'}`}>
          {eyebrow}
        </span>
      )}
      {eyebrow && (
        <div className={`mt-2 ${centered ? 'section-divider' : 'section-divider-left'}`} />
      )}
      <h2
        className={`text-3xl md:text-4xl font-black leading-tight ${
          light ? 'text-white' : 'text-corsair-blue-900'
        } ${eyebrow ? 'mt-0' : 'mt-0'}`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-base md:text-lg max-w-2xl leading-relaxed ${centered ? 'mx-auto' : ''} ${light ? 'text-corsair-gray-300' : 'text-corsair-gray-600'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
}