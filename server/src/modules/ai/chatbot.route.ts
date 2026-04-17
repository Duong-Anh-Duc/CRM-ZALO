import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../../types';
import { ChatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

// SSE streaming endpoint
router.post('/chat/stream', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    for await (const chunk of ChatbotService.chatStream(question, history || [])) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) { next(err); }
});

// Non-streaming fallback
router.post('/chat', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { question, history } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const answer = await ChatbotService.chat(question, history || []);
    sendSuccess(res, { answer });
  } catch (err) { next(err); }
});

export default router;
