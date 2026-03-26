import Redis from 'ioredis';
import { config } from '../config';
import logger from '../utils/logger';

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.warn('Redis error (cache disabled):', err.message));

let isConnected = false;

export async function connectRedis() {
  try {
    await redis.connect();
    isConnected = true;
    logger.info('Redis ready');
  } catch {
    isConnected = false;
    logger.warn('Redis unavailable — running without cache');
  }
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (!isConnected) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function setCache(key: string, value: unknown, ttlSeconds: number = config.redis.defaultTTL): Promise<void> {
  if (!isConnected) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // silent fail
  }
}

export async function delCache(...patterns: string[]): Promise<void> {
  if (!isConnected) return;
  try {
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) await redis.del(...keys);
      } else {
        await redis.del(pattern);
      }
    }
  } catch {
    // silent fail
  }
}

export default redis;
