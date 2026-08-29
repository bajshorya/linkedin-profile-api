import { buildIndex, rootProfile, type NormalizedResponse } from './normalize.js';
import { parseProfileCore } from './parsers/profile.js';
import { parseExperience } from './parsers/experience.js';
import { parseEducation } from './parsers/education.js';
import { parseSkills } from './parsers/skills.js';
import { parseCertifications } from './parsers/certifications.js';
import { parseLanguages } from './parsers/languages.js';
import { canonicalProfileUrl } from '../utils/url.js';
import { ProfileSchema, type Profile } from '../schema/profile.schema.js';
import { ProfileParseError } from './errors.js';

/**
 * A bundle of raw Voyager responses for one profile. The main FullProfile call is
 * required; the section calls are optional (they may be missing if a detail
 * request failed — we degrade to partial data rather than error out).
 */
export interface RawProfileBundle {
  main: NormalizedResponse;
  skills?: NormalizedResponse | null;
  certifications?: NormalizedResponse | null;
  languages?: NormalizedResponse | null;
}

export interface AssembleResult {
  profile: Profile;
  sectionsUnavailable: string[];
}

/**
 * Merge all `included` pools into one index so parsers can resolve cross-references
 * regardless of which call an entity arrived in.
 */
function mergedIndex(bundle: RawProfileBundle) {
  const included = [
    ...(bundle.main.included ?? []),
    ...(bundle.skills?.included ?? []),
    ...(bundle.certifications?.included ?? []),
    ...(bundle.languages?.included ?? []),
  ];
  return buildIndex({ included });
}

export function assembleProfile(bundle: RawProfileBundle, publicIdHint?: string): AssembleResult {
  const index = mergedIndex(bundle);
  const profileEntity = rootProfile(bundle.main, index);
  if (!profileEntity) {
    throw new ProfileParseError('No Profile entity found in Voyager response');
  }

  const core = parseProfileCore(profileEntity, index);
  const sectionsUnavailable: string[] = [];
  if (bundle.skills === undefined) sectionsUnavailable.push('skills');
  if (bundle.certifications === undefined) sectionsUnavailable.push('certifications');
  if (bundle.languages === undefined) sectionsUnavailable.push('languages');

  const publicId = core.publicIdentifier ?? publicIdHint ?? '';

  const assembled = {
    profileUrl: publicId ? canonicalProfileUrl(publicId) : '',
    publicIdentifier: core.publicIdentifier,
    urn: core.urn,
    memberUrn: core.memberUrn,
    firstName: core.firstName,
    lastName: core.lastName,
    fullName: core.fullName,
    headline: core.headline,
    location: core.location,
    about: core.about,
    industry: core.industry,
    profilePicture: core.profilePicture,
    backgroundImage: core.backgroundImage,
    experience: parseExperience(index),
    education: parseEducation(index),
    skills: parseSkills(index),
    certifications: parseCertifications(index),
    languages: parseLanguages(index),
  };

  // Validate against the public contract before it can leave the service.
  const profile = ProfileSchema.parse(assembled);
  return { profile, sectionsUnavailable };
}
