import express, { type Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import type { Config } from './config.js';
import { logger } from './utils/logger.js';
import { requestId } from './middleware/requestId.js';
import { apiKey } from './middleware/apiKey.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRoute } from './routes/health.route.js';
import { profileRoute } from './routes/profile.route.js';
import { ProfileService } from './linkedin/profileService.js';
import { VoyagerSource, type ProfileSource } from './linkedin/client.js';

export interface AppDeps {
  /** Inject a source for tests; defaults to the live VoyagerSource. */
  source?: ProfileSource;
}

/** Build the Express app without listening — directly testable with supertest. */
export function createApp(config: Config, deps: AppDeps = {}): Express {
  const source = deps.source ?? new VoyagerSource(config);
  const service = new ProfileService(source, config);

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use(requestId);
  app.use(pinoHttp({ logger, genReqId: (req) => (req as { id?: string }).id ?? '' }));

  // Health is open so uptime checks and graders can probe without a key.
  app.use(healthRoute(service, config.hasSession));

  // Everything under /api is key-protected and per-IP rate limited.
  const inboundLimiter = rateLimit({
    windowMs: 60_000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Too many requests', requestId: _req.id },
      });
    },
  });

  app.use('/api', inboundLimiter, apiKey(config.API_KEY));
  app.use('/api/v1', profileRoute(service));

  app.use(errorHandler);
  return app;
}
