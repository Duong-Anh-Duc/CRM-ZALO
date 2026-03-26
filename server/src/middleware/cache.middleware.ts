import { Request, Response, NextFunction } from 'express';
import { getCache, setCache } from '../lib/redis';

export function cache(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = `cache:${req.originalUrl}`;
    const cached = await getCache<{ statusCode: number; body: unknown }>(key);

    if (cached) {
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(key, { statusCode: res.statusCode, body }, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}

export function cacheByUser(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const userId = (req as any).user?.userId || 'anonymous';
    const key = `cache:${userId}:${req.originalUrl}`;
    const cached = await getCache<{ statusCode: number; body: unknown }>(key);

    if (cached) {
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(key, { statusCode: res.statusCode, body }, ttlSeconds);
      }
      return originalJson(body);
    };

    next();
  };
}
