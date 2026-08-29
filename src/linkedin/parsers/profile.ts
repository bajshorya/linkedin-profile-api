import type { Entity, EntityIndex } from '../normalize.js';
import { parseImage, type ParsedImage } from './images.js';
import { str } from '../../utils/str.js';

export interface ParsedLocation {
  raw: string | null;
  countryCode: string | null;
}

export interface ParsedProfileCore {
  publicIdentifier: string | null;
  urn: string | null;
  memberUrn: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  headline: string | null;
  about: string | null;
  location: ParsedLocation;
  industry: string | null;
  profilePicture: ParsedImage | null;
  backgroundImage: ParsedImage | null;
}

/** Parse the core Profile entity: identity, headline, about, location, images. */
export function parseProfileCore(profile: Entity, index: EntityIndex): ParsedProfileCore {
  const firstName = str(profile.firstName);
  const lastName = str(profile.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

  // Location: countryCode is on the profile; the human-readable place name comes
  // from the linked Geo entity (defaultLocalizedName).
  const loc = (profile.location ?? {}) as Record<string, unknown>;
  const geoLoc = (profile.geoLocation ?? {}) as Record<string, unknown>;
  const geo = index.resolveOne(geoLoc['*geo'] as string | undefined);
  const location: ParsedLocation = {
    raw: str(geo?.defaultLocalizedName) ?? str(loc.postalCode) ?? null,
    countryCode: str(loc.countryCode),
  };

  const industry = index.resolveOne(profile['*industry'] as string | undefined);

  return {
    publicIdentifier: str(profile.publicIdentifier),
    urn: str(profile.entityUrn),
    memberUrn: str(profile.objectUrn),
    firstName,
    lastName,
    fullName,
    headline: str(profile.headline),
    about: str(profile.summary),
    location,
    industry: str(industry?.name),
    profilePicture: parseImage(profile.profilePicture),
    backgroundImage: parseImage(profile.backgroundPicture),
  };
}
