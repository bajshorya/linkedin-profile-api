/**
 * Parse and validate a LinkedIn profile URL, extracting the public identifier
 * (the vanity slug in `/in/<slug>`).
 *
 * Accepts the many shapes users paste:
 *   - https://www.linkedin.com/in/john-doe
 *   - linkedin.com/in/john-doe/           (no scheme, trailing slash)
 *   - http://in.linkedin.com/in/john-doe  (locale subdomain, http)
 *   - .../in/john-doe?originalSubdomain=fr (query string / fragment)
 *   - .../in/jos%C3%A9                     (percent-encoded unicode vanity)
 *   - bare "john-doe"                      (convenience)
 *
 * Rejects anything that is not an `/in/` profile: /company/, /school/, /posts/, etc.
 */

export class InvalidProfileUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProfileUrlError';
  }
}

// Core matcher: optional scheme, optional locale subdomain, linkedin.com, /in/<slug>.
const PROFILE_URL_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/in\/([^/?#]+)\/?(?:[?#].*)?$/i;

// A bare vanity slug (no dots, no slashes) — allow as a convenience.
const BARE_SLUG_RE = /^[^/?#\s.]+$/;

export function parseLinkedInProfileUrl(input: string): string {
  if (typeof input !== 'string') {
    throw new InvalidProfileUrlError('URL must be a string');
  }
  const raw = input.trim();
  if (!raw) {
    throw new InvalidProfileUrlError('URL is required');
  }

  const match = PROFILE_URL_RE.exec(raw);
  let slug: string | undefined;

  if (match) {
    slug = match[1];
  } else if (!raw.includes('/') && !raw.includes('.') && BARE_SLUG_RE.test(raw)) {
    // bare vanity name like "john-doe"
    slug = raw;
  }

  if (!slug) {
    throw new InvalidProfileUrlError(
      `Not a LinkedIn profile URL. Expected https://www.linkedin.com/in/<name>, got: ${input}`,
    );
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // Malformed percent-encoding — fall back to the raw slug rather than throwing.
    decoded = slug;
  }

  decoded = decoded.trim();
  if (!decoded) {
    throw new InvalidProfileUrlError('Empty profile identifier');
  }
  return decoded;
}

/** Canonical profile URL for a public identifier, for echoing back in responses. */
export function canonicalProfileUrl(publicId: string): string {
  return `https://www.linkedin.com/in/${encodeURIComponent(publicId)}`;
}
