/** Regenerate docs/example-response.json from the committed fixture (offline). */
import { readFileSync, writeFileSync } from 'node:fs';
import { assembleProfile } from '../src/linkedin/assemble.js';

const fixture = JSON.parse(
  readFileSync('tests/fixtures/raw/williamhgates.fullprofile.json', 'utf8'),
);
const { profile, sectionsUnavailable } = assembleProfile({
  main: fixture,
  skills: { included: [] },
  certifications: { included: [] },
  languages: { included: [] },
});
const response = {
  data: profile,
  meta: {
    scrapedAt: new Date().toISOString(),
    cached: false,
    durationMs: 1840,
    source: 'voyager',
    sectionsUnavailable,
  },
};
writeFileSync('docs/example-response.json', JSON.stringify(response, null, 2));
console.log('wrote docs/example-response.json');
