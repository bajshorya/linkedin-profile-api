import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async handler so rejected promises reach the error middleware (Express 4). */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
