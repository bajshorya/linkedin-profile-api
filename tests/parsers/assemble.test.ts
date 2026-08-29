import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assembleProfile } from '../../src/linkedin/assemble.js';
import { ProfileSchema } from '../../src/schema/profile.schema.js';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'raw', 'williamhgates.fullprofile.json'), 'utf8'),
);

describe('assembleProfile (williamhgates fixture)', () => {
  // The fixture is the raw FullProfile response; wrap it as the bundle's main call.
  // Sections are marked as fetched-but-empty so they are not "unavailable".
  const { profile, sectionsUnavailable } = assembleProfile({
    main: fixture,
    skills: { included: [] },
    certifications: { included: [] },
    languages: { included: [] },
  });

  it('conforms to the public schema', () => {
    expect(() => ProfileSchema.parse(profile)).not.toThrow();
  });

  it('parses core identity', () => {
    expect(profile.firstName).toBe('Bill');
    expect(profile.lastName).toBe('Gates');
    expect(profile.fullName).toBe('Bill Gates');
    expect(profile.publicIdentifier).toBe('williamhgates');
    expect(profile.headline).toContain('Gates Foundation');
    expect(profile.about).toContain('Microsoft');
    expect(profile.urn).toMatch(/^urn:li:fsd_profile:/);
    expect(profile.memberUrn).toMatch(/^urn:li:member:/);
  });

  it('builds a profile picture URL that expires', () => {
    expect(profile.profilePicture?.url).toMatch(/^https:\/\/media\.licdn\.com\//);
    expect(profile.profilePicture?.expiresAt).toMatch(/^\d{4}-/);
    expect(profile.backgroundImage?.url).toMatch(/^https:\/\/media\.licdn\.com\//);
  });

  it('parses experience, most-recent first, with company links', () => {
    const companies = profile.experience.map((e) => e.company);
    expect(companies).toContain('Gates Foundation');
    expect(companies).toContain('Microsoft');
    expect(companies).toContain('Breakthrough Energy');
    const microsoft = profile.experience.find((e) => e.company === 'Microsoft');
    expect(microsoft?.startDate).toBe('1975');
    expect(microsoft?.isCurrent).toBe(true);
    expect(microsoft?.companyUrl).toContain('linkedin.com/company');
  });

  it('parses education', () => {
    const schools = profile.education.map((e) => e.school);
    expect(schools).toContain('Harvard University');
    expect(schools).toContain('Lakeside School');
  });

  it('reports no unavailable sections when all were fetched', () => {
    expect(sectionsUnavailable).toEqual([]);
  });

  it('keeps a stable shape with empty arrays for absent sections', () => {
    expect(profile.skills).toEqual([]);
    expect(profile.certifications).toEqual([]);
    expect(profile.languages).toEqual([]);
  });
});
