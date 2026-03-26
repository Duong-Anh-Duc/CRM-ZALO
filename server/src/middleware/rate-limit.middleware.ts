import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { t } from '../locales';

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.global.windowMs,
  max: config.rateLimit.global.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: t('errors.tooManyRequests') },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: t('errors.tooManyRequests') },
});

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: t('errors.tooManyRequests') },
});

export const heavyLimiter = rateLimit({
  windowMs: config.rateLimit.heavy.windowMs,
  max: config.rateLimit.heavy.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: t('errors.tooManyRequests') },
});
