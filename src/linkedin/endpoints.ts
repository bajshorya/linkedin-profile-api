/**
 * LinkedIn Voyager endpoint builders.
 *
 * The decorationId / queryId hashes below rotate when LinkedIn ships changes.
 * They are isolated here (and overridable via env) so a break is a one-line fix,
 * not a code change. Verified working 2026-08-28.
 */
const BASE = 'https://www.linkedin.com/voyager/api';

// The decoration that inlines core profile + experience + education in one call.
export const FULL_PROFILE_DECORATION =
  process.env.LI_FULL_PROFILE_DECORATION ??
  'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101';

export const endpoints = {
  /**
   * Primary call: resolves a public vanity name to the full profile bundle
   * (core identity, experience, education, companies, schools, industries).
   */
  fullProfile(publicId: string): string {
    const params = new URLSearchParams({
      q: 'memberIdentity',
      memberIdentity: publicId,
      decorationId: FULL_PROFILE_DECORATION,
    });
    return `${BASE}/identity/dash/profiles?${params.toString()}`;
  },

  /** Section finders (best-effort; may need a ProfileCards queryId on some accounts). */
  profileSkills(profileUrn: string): string {
    return sectionUrl('profileSkills', profileUrn);
  },
  profileCertifications(profileUrn: string): string {
    return sectionUrl('profileCertifications', profileUrn);
  },
  profileLanguages(profileUrn: string): string {
    return sectionUrl('profileLanguages', profileUrn);
  },

  /** Cheap liveness probe for the session cookie. */
  me(): string {
    return `${BASE}/me`;
  },
};

function sectionUrl(section: string, profileUrn: string): string {
  const params = new URLSearchParams({
    q: 'viewee',
    profileUrn,
    count: '100',
  });
  return `${BASE}/identity/dash/${section}?${params.toString()}`;
}
