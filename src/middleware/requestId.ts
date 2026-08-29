import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/** Attach a request id (honouring an inbound `x-request-id`) for correlation. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.id = incoming && incoming.length <= 200 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
