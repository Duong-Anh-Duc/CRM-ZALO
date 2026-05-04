import OpenAI from 'openai';
import { config } from '../../../config';
import prisma from '../../../lib/prisma';
import logger from '../../../utils/logger';
import { openai } from './openai-client';
import { sanitizeCustomerReply } from './text-utils';
import { CUSTOMER_REPLY_DEFAULT_PROMPT } from './prompts/customer-reply-system';
import { recordTelemetry, UsageCollector } from './telemetry';

const customerTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_product',
      description: 'Tra cứu sản phẩm. BẮT BUỘC gọi khi khách hỏi bất kỳ gì về SP: tên cụ thể, SKU, hoặc TỪ KHOÁ LOẠI ("túi PE", "chai PET", "nắp", "can"). Fuzzy match trên tên/SKU/mô tả. Trả về danh sách mẫu + giá + MOQ.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Tên SP, SKU, loại, hoặc mô tả. VD: "chai PET 500ml", "PET-500", "túi PE", "nắp 24", "can HDPE 5L"' },
        },
        required: ['query'],
      },
    },
  },
];

/** Safe product lookup for customer queries — read-only, no pricing secrets. */
async function customerLookupProduct(query: string): Promise<string> {
  try {
    const q = (query || '').trim();
    if (!q) return 'Không có từ khoá để tìm.';
    const products = await prisma.product.findMany({
      where: {
        is_active: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        sku: true, name: true, retail_price: true,
        material: true, capacity_ml: true, moq: true,
        height_mm: true, body_dia_mm: true,
      },
    });
    if (products.length === 0) return `Không tìm thấy sản phẩm khớp với "${q}".`;
    const lines = products.map((p) => {
      const parts: string[] = [`${p.name} (SKU ${p.sku})`];
      if (p.material) parts.push(p.material);
      if (p.capacity_ml) parts.push(`${p.capacity_ml}ml`);
      if (p.retail_price) parts.push(`giá tham khảo ${Math.round(p.retail_price as any).toLocaleString('vi-VN')}đ`);
      if (p.moq) parts.push(`MOQ ${p.moq}`);
      return parts.join(' — ');
    });
    return lines.join('\n');
  } catch (err) {
    logger.error('customerLookupProduct error:', err);
    return 'Lỗi khi tra cứu sản phẩm.';
  }
}

/**
 * Customer-facing reply for Zalo auto-reply.
 * No CRM tool calling (read-only, safe for external customers).
 * Uses a shop-assistant persona (not CRM internal assistant).
 */
export async function customerReply(
  question: string,
  history: Array<{ role: string; content: string }> = [],
  customSystemPrompt?: string,
  imageUrls: string[] = [],
): Promise<string> {
  const usage = new UsageCollector();
  const startedAt = Date.now();
  const hasImages = imageUrls.length > 0;
  const modelName = hasImages
    ? (config.openai.visionModel || config.openai.model || 'gpt-4o-mini')
    : (config.openai.model || 'gpt-4o-mini');
  let success = true;
  let errorMessage: string | undefined;

  try {
    const systemPrompt = (customSystemPrompt && customSystemPrompt.trim().length > 0)
      ? customSystemPrompt
      : CUSTOMER_REPLY_DEFAULT_PROMPT;

    const userContent: OpenAI.Chat.ChatCompletionUserMessageParam['content'] = hasImages
      ? [
          { type: 'text' as const, text: question || 'Em xem ảnh này giúp anh/chị' },
          ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
        ]
      : question;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((h) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: userContent },
    ];

    for (let round = 0; round < 2; round++) {
      usage.incRound();
      const response = await openai.chat.completions.create({
        model: modelName,
        messages, tools: customerTools, tool_choice: 'auto',
        temperature: 0.85, top_p: 0.9, presence_penalty: 0.3, frequency_penalty: 0.3,
        max_tokens: 300,
      });
      usage.add(response.usage);
      const choice = response.choices[0];

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
        return sanitizeCustomerReply(choice.message.content || '');
      }

      messages.push(choice.message);
      usage.incToolCalls(choice.message.tool_calls.length);
      for (const tc of choice.message.tool_calls) {
        const fn = (tc as any).function;
        let result: string;
        try {
          const args = JSON.parse(fn.arguments || '{}');
          if (fn.name === 'lookup_product') {
            result = await customerLookupProduct(args.query || '');
          } else {
            result = `Tool "${fn.name}" không hỗ trợ`;
          }
        } catch (err: any) {
          result = `Lỗi: ${err?.message || 'unknown'}`;
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }

    usage.incRound();
    const final = await openai.chat.completions.create({
      model: modelName,
      messages, temperature: 0.85, top_p: 0.9, presence_penalty: 0.3, frequency_penalty: 0.3,
      max_tokens: 300,
    });
    usage.add(final.usage);
    return sanitizeCustomerReply(final.choices[0]?.message?.content || '');
  } catch (err: any) {
    success = false;
    errorMessage = err?.message || 'unknown';
    logger.error('customerReply error:', err);
    return '';
  } finally {
    recordTelemetry({
      ctx: { user: { id: 'zalo_customer' } },
      channel: 'customer_reply',
      model: modelName,
      rounds: usage.rounds,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cachedTokens: usage.cachedTokens,
      totalTokens: usage.totalTokens,
      latencyMs: Date.now() - startedAt,
      toolCalls: usage.toolCalls,
      success,
      error: errorMessage,
    });
  }
}
