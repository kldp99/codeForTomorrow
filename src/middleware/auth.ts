import { Request, Response, NextFunction } from 'express';

/**
 * Authentication-ready middleware stub.
 *
 * Currently: extracts `x-user-id` header and attaches it to `req.user`.
 *
 * To enable real JWT auth later, replace the header logic with:
 *   const token = req.headers.authorization?.split(' ')[1];
 *   const payload = jwt.verify(token, config.jwt.secret);
 *   req.user = payload;
 *
 * The pattern is already in place so controllers are auth-aware.
 */

// Extend Express Request to include `user`
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

/**
 * Soft auth: reads `x-user-id` header and attaches it to `req.user`.
 * Does NOT block unauthenticated requests — useful during development.
 */
export function softAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'];
  if (typeof userId === 'string' && userId.trim()) {
    req.user = { id: userId.trim() };
  }
  next();
}

/**
 * Strict auth: same as softAuth but returns 401 if no user header is present.
 * Enable this on routes that require an authenticated user.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'];
  if (typeof userId !== 'string' || !userId.trim()) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing x-user-id header. Provide a valid user ID to authenticate.',
        status: 401,
      },
    });
    return;
  }
  req.user = { id: userId.trim() };
  next();
}
