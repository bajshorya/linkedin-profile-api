import 'dotenv/config';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, sessionConfigured: config.hasSession },
    'linkedin-profile-api listening',
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
  // Force-exit if connections don't drain promptly.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
