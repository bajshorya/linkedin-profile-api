/**
 * Live smoke test: fetch + assemble one real profile end-to-end and print the JSON.
 *   npm run smoke -- williamhgates
 * Hits the live LinkedIn session — use sparingly.
 */
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { VoyagerSource } from '../src/linkedin/client.js';
import { ProfileService } from '../src/linkedin/profileService.js';

async function main(): Promise<void> {
  const arg = process.argv[2] ?? 'williamhgates';
  const config = loadConfig();
  const service = new ProfileService(new VoyagerSource(config), config);
  const url = arg.startsWith('http') ? arg : `https://www.linkedin.com/in/${arg}`;
  const result = await service.getProfile(url);
  console.log(JSON.stringify(result.response, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
