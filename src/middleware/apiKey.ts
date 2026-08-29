import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../linkedin/errors.js';

/**
 * Require a valid `x-api-key` on protected routes. The API is public but backed by
 * a single personal LinkedIn session, so unauthenticated access = anyone can burn
 * the account. Compared in constant time to avoid leaking the key via timing.
 */
export function apiKey(expectedKey: string) {
  const expected = Buffer.from(expectedKey);
  return (req: Request, _res: Response, next: NextFunction): void => {
    const provided = req.header('x-api-key') ?? '';
    const providedBuf = Buffer.from(provided);
    const ok =
      providedBuf.length === expected.length && timingSafeEqual(providedBuf, expected);
    if (!ok) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid x-api-key');
    }
    next();
  };
}
