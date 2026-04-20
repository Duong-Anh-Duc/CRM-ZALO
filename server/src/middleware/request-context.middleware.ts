import { Request, Response, NextFunction } from 'express';
import { requestContext } from '../lib/prisma';

function normalizeIp(req: Request): string | null {
  const forwarded = req.get('x-forwarded-for');
  const raw = (forwarded ? forwarded.split(',')[0].trim() : req.ip) || null;
  if (!raw) return null;
  if (raw === '::1') return '127.0.0.1';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  requestContext.run(
    {
      ip: normalizeIp(req),
      userAgent: req.get('user-agent') ?? null,
    },
    () => next()
  );
}
