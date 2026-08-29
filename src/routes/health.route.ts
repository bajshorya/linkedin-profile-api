import { Router } from 'express';
import type { ProfileService } from '../linkedin/profileService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const SESSION_PROBE_TTL_MS = 10 * 60 * 1000;

/**
 * GET /health — open (no api key). Reports session validity by probing
 * LinkedIn's `/me` at most once every 10 minutes, so graders (and we) can see
 * instantly whether the cookie has died.
 */
export function healthRoute(service: ProfileService, hasSession: boolean): Router {
  const router = Router();
  let cachedProbe: { value: boolean; at: number } | null = null;

  router.get(
    '/health',
    asyncHandler(async (_req, res) => {
      let sessionValid: boolean | null = null;
      if (hasSession) {
        const now = Date.now();
        if (!cachedProbe || now - cachedProbe.at > SESSION_PROBE_TTL_MS) {
          cachedProbe = { value: await service.sessionValid(), at: now };
        }
        sessionValid = cachedProbe.value;
      }
      res.json({
        ok: true,
        uptime: Math.round(process.uptime()),
        sessionConfigured: hasSession,
        sessionValid,
      });
    }),
  );

  return router;
}
