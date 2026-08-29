import { describe, it, expect } from 'vitest';
import { buildIndex, rootProfile } from '../src/linkedin/normalize.js';

const response = {
  data: { '*elements': ['urn:li:fsd_profile:ABC'] },
  included: [
    { entityUrn: 'urn:li:fsd_profile:ABC', $type: 'com.linkedin.voyager.dash.identity.profile.Profile', firstName: 'Jane' },
    {
      entityUrn: 'urn:li:collectionResponse:POS',
      $type: 'com.linkedin.restli.common.CollectionResponse',
      '*elements': ['urn:li:fsd_position:1', 'urn:li:fsd_position:missing'],
    },
    { entityUrn: 'urn:li:fsd_position:1', $type: 'com.linkedin.voyager.dash.identity.profile.Position', title: 'Engineer' },
    { entityUrn: 'urn:li:fsd_company:9', $type: 'com.linkedin.voyager.dash.organization.Company', name: 'Acme' },
  ],
};

describe('EntityIndex', () => {
  const index = buildIndex(response);

  it('resolves the root profile via data.*elements', () => {
    expect(rootProfile(response, index)?.firstName).toBe('Jane');
  });

  it('resolves a direct pointer', () => {
    expect(index.resolveOne('urn:li:fsd_company:9')?.name).toBe('Acme');
  });

  it('follows a CollectionResponse wrapper and skips missing entities', () => {
    const positions = index.resolveCollection('urn:li:collectionResponse:POS');
    expect(positions).toHaveLength(1);
    expect(positions[0]?.title).toBe('Engineer');
  });

  it('byType matches on $type suffix', () => {
    expect(index.byType('profile.Position')).toHaveLength(1);
  });

  it('returns null for unknown urns', () => {
    expect(index.resolveOne('urn:li:nope')).toBeNull();
    expect(index.get(undefined)).toBeNull();
  });
});
