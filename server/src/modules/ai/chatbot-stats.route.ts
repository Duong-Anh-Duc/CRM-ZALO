import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';
import { StatsService } from './chatbot/stats.service';

const router = Router();
router.use(authenticate);
router.use(requireAbility('read', 'AuditLog'));

function parseDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 7;
  return Math.min(Math.floor(n), 365);
}

router.get('/summary', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseDays(req.query.days);
    const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
    const user_id = typeof req.query.user_id === 'string' ? req.query.user_id : undefined;
    const data = await StatsService.summary({ days, channel, user_id });
    sendSuccess(res, { days, ...data });
  } catch (err) { next(err); }
});

router.get('/daily', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseDays(req.query.days);
    const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
    const user_id = typeof req.query.user_id === 'string' ? req.query.user_id : undefined;
    const data = await StatsService.daily({ days, channel, user_id });
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

router.get('/tools', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseDays(req.query.days);
    const user_id = typeof req.query.user_id === 'string' ? req.query.user_id : undefined;
    const data = await StatsService.tools({ days, user_id });
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

export default router;
