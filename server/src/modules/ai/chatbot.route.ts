import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAbility } from '../../middleware/ability.middleware';
import { AuthenticatedRequest } from '../../types';
import { ChatbotService } from './chatbot.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);
router.use(requireAbility('use', 'AiChat'));

type Attachment = { url: string; type: 'image' | 'file' };

function parseAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Attachment =>
      !!a && typeof (a as any).url === 'string' && ((a as any).type === 'image' || (a as any).type === 'file'),
    )
    .slice(0, 4);
}

// SSE streaming endpoint
router.post('/chat/stream', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { question, history } = req.body;
    const attachments = parseAttachments(req.body?.attachments);
    if (!question && attachments.length === 0) {
      return res.status(400).json({ error: 'question or attachments is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    for await (const chunk of ChatbotService.chatStream(question || '', history || [], attachments)) {
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
    const attachments = parseAttachments(req.body?.attachments);
    if (!question && attachments.length === 0) {
      return res.status(400).json({ error: 'question or attachments is required' });
    }
    const answer = await ChatbotService.chat(question || '', history || [], attachments);
    sendSuccess(res, { answer });
  } catch (err) { next(err); }
});

export default router;
