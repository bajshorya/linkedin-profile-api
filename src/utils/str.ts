/** Coerce to a trimmed non-empty string, or null. LinkedIn data often has stray
 * leading/trailing whitespace (e.g. "Breakthrough Energy "), so we normalise it. */
export function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}
