import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, RateLimitedError } from '../linkedin/errors.js';
import { InvalidProfileUrlError } from '../utils/url.js';
import { logger } from '../utils/logger.js';

interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

/** Maps every thrown error to the documented `{ error: { code, message, requestId } }`. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = String(req.id ?? 'unknown');

  if (err instanceof InvalidProfileUrlError) {
    respond(res, 400, 'INVALID_URL', err.message, requestId);
    return;
  }

  if (err instanceof RateLimitedError) {
    if (err.retryAfterSeconds) res.setHeader('retry-after', String(err.retryAfterSeconds));
    respond(res, err.status, err.code, err.message, requestId);
    return;
  }

  if (err instanceof AppError) {
    // Log LinkedIn-side (5xx) failures at error level; client mistakes at info.
    const level = err.status >= 500 ? 'error' : 'info';
    logger[level]({ requestId, code: err.code, status: err.status }, err.message);
    respond(res, err.status, err.code, err.message, requestId);
    return;
  }

  if (err instanceof ZodError) {
    logger.error({ requestId, issues: err.issues }, 'response failed schema validation');
    respond(res, 502, 'UPSTREAM_ERROR', 'Parsed profile failed schema validation', requestId);
    return;
  }

  logger.error({ requestId, err }, 'unhandled error');
  respond(res, 500, 'INTERNAL_ERROR', 'Internal server error', requestId);
}

function respond(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId: string,
): void {
  const body: ErrorBody = { error: { code, message, requestId } };
  res.status(status).json(body);
}
