/**
 * Dev tool: dump raw Voyager JSON for a public identifier into tests/fixtures/raw/.
 * Build the parser against these offline instead of hammering LinkedIn.
 *
 *   npm run capture -- williamhgates
 *
 * Uses the same session + pacing as production. Keep volume tiny; this hits the
 * live account. NEVER run against an account you care about.
 */
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { VoyagerSource } from '../src/linkedin/client.js';

async function main(): Promise<void> {
  const publicId = process.argv[2];
  if (!publicId) {
    console.error('usage: npm run capture -- <publicId>');
    process.exit(1);
  }
  const config = loadConfig();
  if (!config.hasSession) {
    console.error('LI_AT / JSESSIONID not set in .env');
    process.exit(1);
  }

  const source = new VoyagerSource(config);
  const bundle = await source.fetchProfileBundle(publicId);

  const dir = join(process.cwd(), 'tests', 'fixtures', 'raw');
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${publicId}.bundle.json`);
  await writeFile(file, JSON.stringify(bundle, null, 2));
  console.log(`wrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
