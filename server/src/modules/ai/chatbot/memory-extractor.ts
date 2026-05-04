import OpenAI from 'openai';
import { config } from '../../../config';
import logger from '../../../utils/logger';
import { openai } from './openai-client';
import { addMemory, MemoryType } from './memory';

const EXTRACT_PROMPT = `Bạn là module trích xuất memory cho AI agent Aura của PackFlow CRM.
Đọc đoạn hội thoại giữa "anh" (chủ doanh nghiệp) và Aura, trả JSON các MEMORY đáng nhớ DÀI HẠN.

CHỈ trích xuất nếu:
- User nói preference cá nhân ("tôi thích...", "tôi luôn...", "đừng làm X", "luôn làm Y")
- User cho biết thông tin về 1 KH/NCC/SP cụ thể đáng nhớ ("KH X là VIP", "NCC Y hay giao trễ", "SP Z luôn nhập ở NCC W")
- User dạy 1 quy tắc chung ("đơn dưới 1tr không cần xác nhận", "luôn xuất Excel theo format VND")

KHÔNG trích xuất:
- Câu chào, tạm biệt
- Hành động đơn lẻ ("tạo đơn cho KH ABC") — đó là task, không phải memory
- Thông tin số liệu thay đổi theo thời gian (số dư công nợ, tổng đơn) — đã có DB
- Yêu cầu task ngắn hạn

Trả JSON dạng:
{"memories":[
  {"type":"user_pref|kh_note|sp_note|ncc_note|rule|fact","subject":"<label ngắn ≤50 ký tự>","content":"<nội dung đầy đủ>","importance":0.1-1}
]}

Nếu KHÔNG có gì đáng nhớ → {"memories":[]}.
JSON thuần, không markdown.`;

interface ExtractedMemory {
  type: MemoryType;
  subject: string;
  content: string;
  importance: number;
}

const VALID_TYPES: MemoryType[] = ['user_pref', 'kh_note', 'sp_note', 'ncc_note', 'rule', 'fact'];

/**
 * Fire-and-forget: scan the recent conversation tail and persist any durable memory.
 * Runs in background — never blocks the chat response.
 */
export function extractMemoriesAsync(
  userId: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  assistantReply: string,
): void {
  if (userId === 'anonymous') return;
  if (!userMessage.trim() || !assistantReply.trim()) return;

  void runExtraction(userId, history, userMessage, assistantReply).catch((err) => {
    logger.warn('extractMemoriesAsync failed:', err?.message || err);
  });
}

async function runExtraction(
  userId: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const tail = history.slice(-4);
  const transcript = [
    ...tail.map((h) => `${h.role === 'user' ? 'anh' : 'Aura'}: ${h.content}`),
    `anh: ${userMessage}`,
    `Aura: ${assistantReply.slice(0, 600)}`,
  ].join('\n');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: EXTRACT_PROMPT },
    { role: 'user', content: transcript.slice(0, 3000) },
  ];

  const response = await openai.chat.completions.create({
    model: config.openai.model || 'gpt-4o-mini',
    messages,
    temperature: 0.1,
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content || '{}';
  let parsed: { memories?: ExtractedMemory[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  const memories = Array.isArray(parsed.memories) ? parsed.memories : [];
  for (const m of memories) {
    if (!m || !m.subject || !m.content) continue;
    if (!VALID_TYPES.includes(m.type)) continue;
    const importance = Math.min(1, Math.max(0.1, Number(m.importance) || 0.5));
    await addMemory({
      userId,
      type: m.type,
      subject: m.subject,
      content: m.content,
      importance,
    });
  }

  if (memories.length) {
    logger.info(`Aura memory: extracted ${memories.length} item(s) for user ${userId}`);
  }
}
