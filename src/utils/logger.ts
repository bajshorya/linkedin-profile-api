import pino from 'pino';

// Logging must not depend on the full config (which requires API_KEY etc.), so it
// reads only its own two vars directly — this keeps `import logger` side-effect free
// for tests that construct config explicitly.
const level = process.env.LOG_LEVEL ?? 'info';
const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

export const logger = pino({
  level,
  // Redact anything that could leak the session cookie into logs.
  redact: {
    paths: ['req.headers.cookie', 'req.headers["csrf-token"]', 'req.headers["x-api-key"]'],
    censor: '[redacted]',
  },
  ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
});
