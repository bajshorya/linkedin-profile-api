import pino from 'pino';

// Plain JSON logging in every environment — no pino-pretty transport, so the
// production image (which installs --omit=dev) can never crash trying to load a
// dev-only dependency. For readable local logs, pipe through pino-pretty:
//   npm run dev | npx pino-pretty
const level = process.env.LOG_LEVEL ?? 'info';

export const logger = pino({
  level,
  // Redact anything that could leak the session cookie into logs.
  redact: {
    paths: ['req.headers.cookie', 'req.headers["csrf-token"]', 'req.headers["x-api-key"]'],
    censor: '[redacted]',
  },
});
