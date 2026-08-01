/** Shared image preset configuration for the Smart Image Editor.
 *  Import from here — never hard-code dimensions per module. */

export type AspectPreset = {
  /** Display label shown in the preset grid */
  label: string;
  /** width / height ratio, or null for "free" / "original" */
  ratio: number | null;
  /** Canonical output dimensions (informational; enforced during export) */
  width?: number;
  height?: number;
  /** True for site-specific presets shown in the second section */
  isSitePreset?: boolean;
};

/** Standard geometric presets */
export const ASPECT_PRESETS: AspectPreset[] = [
  { label: "Original", ratio: null },
  { label: "Free",     ratio: null },
  { label: "1:1",      ratio: 1 },
  { label: "4:3",      ratio: 4 / 3 },
  { label: "16:9",     ratio: 16 / 9 },
  { label: "3:4",      ratio: 3 / 4 },
  { label: "4:5",      ratio: 4 / 5 },
];

/** Site-specific presets for FSTS websites */
export const SITE_PRESETS: AspectPreset[] = [
  { label: "Hero Banner",           ratio: 1920 / 600,  width: 1920, height: 600,  isSitePreset: true },
  { label: "Service Card",          ratio: 4 / 3,       width: 800,  height: 600,  isSitePreset: true },
  { label: "Article Thumbnail",     ratio: 16 / 9,      width: 1200, height: 675,  isSitePreset: true },
  { label: "Course/Event Thumb",    ratio: 16 / 9,      width: 800,  height: 450,  isSitePreset: true },
  { label: "Team Photo",            ratio: 3 / 4,       width: 600,  height: 800,  isSitePreset: true },
  { label: "Testimonial Photo",     ratio: 1,           width: 200,  height: 200,  isSitePreset: true },
  { label: "Logo",                  ratio: 3 / 1,       width: 300,  height: 100,  isSitePreset: true },
  { label: "Favicon",               ratio: 1,           width: 64,   height: 64,   isSitePreset: true },
];

/** All presets in one flat list */
export const ALL_PRESETS: AspectPreset[] = [...ASPECT_PRESETS, ...SITE_PRESETS];
