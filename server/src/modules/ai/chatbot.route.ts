import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../../types';
import { ChatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

router.post('/chat', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const answer = await ChatbotService.chat(question, history || []);
    sendSuccess(res, { answer });
  } catch (err) { next(err); }
});

export default router;
