import OpenAI from 'openai';
import logger from '../../../utils/logger';
import { openai } from './openai-client';

const SUMMARIZE_THRESHOLD = 20;
const KEEP_RECENT = 10;

export type RawMessage = { role: string; content: string };

/**
 * Compress conversation history when it exceeds SUMMARIZE_THRESHOLD turns.
 * Keeps the most recent KEEP_RECENT messages verbatim and replaces the older
 * ones with a single summary sent as a system message.
 */
export async function compressHistory(
  history: RawMessage[],
  modelName: string,
): Promise<OpenAI.Chat.ChatCompletionMessageParam[]> {
  const recent = history.slice(-KEEP_RECENT);
  const recentMapped: OpenAI.Chat.ChatCompletionMessageParam[] = recent.map((h) => ({
    role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: h.content,
  }));

  if (history.length <= SUMMARIZE_THRESHOLD) {
    return recentMapped;
  }

  const older = history.slice(0, history.length - KEEP_RECENT);
  const transcript = older
    .map((h) => `${h.role === 'user' ? 'User' : 'Aura'}: ${h.content}`)
    .join('\n')
    .slice(0, 8000); // hard cap to avoid runaway token cost

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'system',
          content: 'Tóm tắt cuộc hội thoại sau ngắn gọn (3-5 câu, plain text, không markdown). Giữ lại các fact quan trọng (tên KH/NCC/SP, mã đơn, số tiền, id UUID đã đề cập). Bỏ chi tiết vụn vặt. Ngôi thứ ba.',
        },
        { role: 'user', content: transcript },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });
    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) return recentMapped;

    return [
      { role: 'system', content: `[Tóm tắt hội thoại trước đó]\n${summary}` },
      ...recentMapped,
    ];
  } catch (err) {
    logger.error('History summarization failed:', err);
    return recentMapped;
  }
}
