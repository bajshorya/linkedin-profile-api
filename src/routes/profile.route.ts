import { Router } from 'express';
import { z } from 'zod';
import type { ProfileService } from '../linkedin/profileService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { InvalidProfileUrlError } from '../utils/url.js';

const QuerySchema = z.object({
  url: z.string().min(1, 'url query parameter is required'),
  refresh: z
    .union([z.literal('true'), z.literal('false'), z.undefined()])
    .transform((v) => v === 'true'),
});

const BodySchema = z.object({
  url: z.string().min(1, 'url is required'),
  refresh: z.boolean().optional(),
});

/** GET|POST /api/v1/profile */
export function profileRoute(service: ProfileService): Router {
  const router = Router();

  router.get(
    '/profile',
    asyncHandler(async (req, res) => {
      const parsed = QuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new InvalidProfileUrlError(parsed.error.issues[0]?.message ?? 'Invalid query');
      }
      await handle(service, res, parsed.data.url, parsed.data.refresh);
    }),
  );

  router.post(
    '/profile',
    asyncHandler(async (req, res) => {
      const parsed = BodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new InvalidProfileUrlError(parsed.error.issues[0]?.message ?? 'Invalid body');
      }
      await handle(service, res, parsed.data.url, parsed.data.refresh ?? false);
    }),
  );

  return router;
}

async function handle(
  service: ProfileService,
  res: import('express').Response,
  url: string,
  refresh: boolean,
): Promise<void> {
  const result = await service.getProfile(url, { refresh });
  res.setHeader('x-cache', result.cacheStatus);
  res.json(result.response);
}
