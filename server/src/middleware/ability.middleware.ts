import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { buildAbilityFor, AppAbility } from '../lib/ability';
import { t } from '../locales';

// Attach the resolved ability on the request for reuse within a single req.
declare module '../types/common.types' {
  interface AuthenticatedRequest {
    ability?: AppAbility;
  }
}

/**
 * Middleware factory — blocks requests that lack the given (action, subject)
 * CASL permission. Must run AFTER `authenticate`.
 *
 * Example:
 *   router.post('/', authenticate, requireAbility('create', 'Customer'), handler);
 */
export const requireAbility = (action: string, subject: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: t('auth.notLoggedIn') });
      return;
    }
    try {
      const ability = req.ability ?? (await buildAbilityFor(req.user.userId));
      req.ability = ability;
      if (!ability.can(action, subject)) {
        res.status(403).json({ success: false, message: t('auth.noPermission') });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
