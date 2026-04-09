import OpenAI from 'openai';
import { config } from '../../config';
import { t } from '../../locales';
import logger from '../../utils/logger';
import prisma from '../../lib/prisma';
import { AiTrainingService } from './ai-training.service';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL,
});

async function getCustomPrompts() {
  try {
    const cfg = await prisma.zaloConfig.findFirst({ where: { is_active: true } });
    return {
      chat: cfg?.ai_chat_prompt || null,
      summary: cfg?.ai_summary_prompt || null,
      order: cfg?.ai_order_prompt || null,
    };
  } catch {
    return { chat: null, summary: null, order: null };
  }
}

export interface ExtractedOrderItem {
  product_name: string;
  quantity: number;
  unit_price?: number;
  note?: string;
}

export interface ExtractedOrder {
  is_order: boolean;
  customer_name?: string;
  customer_phone?: string;
  items: ExtractedOrderItem[];
  delivery_note?: string;
  raw_summary?: string;
}

const CHAT_SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh cho hệ thống CRM bao bì nhựa PackFlow.
Bạn có khả năng đọc và phân tích tin nhắn Zalo từ khách hàng.

Nhiệm vụ:
- Trả lời câu hỏi của nhân viên về tin nhắn Zalo gần đây
- Tóm tắt nội dung tin nhắn, phát hiện đơn hàng tiềm năng
- Phân tích xu hướng, khách hàng nào đang quan tâm sản phẩm gì
- Trả lời bằng tiếng Việt, ngắn gọn, rõ ràng
- Nếu được hỏi về đơn hàng, liệt kê rõ: tên khách, sản phẩm, số lượng
- Format đẹp với bullet points khi cần

QUAN TRỌNG:
- Mỗi tin nhắn có kèm ngày giờ. Khi người dùng hỏi "hôm nay" → CHỈ phân tích tin nhắn có ngày trùng với ngày hiện tại.
- Khi hỏi "tuần này" → chỉ lấy tin trong 7 ngày gần nhất.
- KHÔNG trộn lẫn tin nhắn cũ với tin nhắn mới. Phân biệt rõ thời gian.
- Nếu không có tin nhắn nào trong khoảng thời gian được hỏi, hãy nói rõ.

QUY TẮC TÓM TẮT:
- Khi tóm tắt tin nhắn, PHẢI nhóm theo từng người (từng khách hàng/người gửi).
- Format: liệt kê tên người → bên dưới là tất cả nội dung của người đó.
- KHÔNG xen kẽ tin nhắn giữa các người với nhau.

QUY TẮC TRÌNH BÀY:
- KHÔNG dùng markdown (không dùng dấu sao, dấu thăng, backtick, v.v.)
- Trình bày dạng plain text chuyên nghiệp, dễ đọc.
- Dùng dấu gạch ngang (-) cho danh sách, thụt đầu dòng rõ ràng.
- Tên người viết HOA hoặc kèm dấu hai chấm, không bold.
- Dùng dấu ngoặc kép "" khi trích dẫn nội dung gốc.
- Cuối cùng có phần ghi chú ngắn gọn nếu cần.
- Ví dụ:

NGUYỄN VĂN A:
  - Hỏi giá chai PET 500ml
  - Muốn đặt 1000 cái, giao cuối tuần

TRẦN THỊ B:
  - Hỏi tiến độ đơn hàng SO-20260407-001
  - Xác nhận địa chỉ giao hàng mới

Ghi chú: Không có đơn hàng mới phát sinh hôm nay.`;

const SUMMARY_SYSTEM_PROMPT = `Bạn là trợ lý AI phân tích tin nhắn Zalo cho CRM bao bì nhựa.

Nhiệm vụ: Tóm tắt tin nhắn Zalo gần đây và phát hiện:
1. **Đơn hàng mới**: Tin nhắn đặt hàng (tên SP, số lượng, khách hàng)
2. **Yêu cầu báo giá**: Khách hỏi giá sản phẩm
3. **Khiếu nại/Vấn đề**: Phản hồi tiêu cực, khiếu nại
4. **Tin nhắn quan trọng**: Cần phản hồi gấp

Trả về JSON:
{
  "summary": "tóm tắt tổng quan ngắn gọn",
  "potential_orders": [{ "customer": "tên", "products": "SP", "quantity": "SL", "message": "nội dung gốc" }],
  "quote_requests": [{ "customer": "tên", "products": "SP hỏi giá", "message": "nội dung gốc" }],
  "issues": [{ "customer": "tên", "issue": "mô tả vấn đề", "message": "nội dung gốc" }],
  "needs_reply": [{ "customer": "tên", "reason": "lý do cần trả lời", "message": "nội dung gốc" }],
  "stats": { "total_messages": 0, "incoming": 0, "outgoing": 0 }
}`;

const SYSTEM_PROMPT = `Bạn là trợ lý AI chuyên phân tích tin nhắn Zalo để trích xuất thông tin đơn hàng cho công ty bao bì nhựa.

Nhiệm vụ: Đọc tin nhắn và xác định xem đây có phải là tin nhắn đặt hàng không. Nếu có, trích xuất thông tin đơn hàng.

Quy tắc:
1. Tin nhắn đặt hàng thường chứa: tên sản phẩm, số lượng, đôi khi có giá và ghi chú giao hàng
2. Tin nhắn hỏi thăm, chào hỏi, hỏi giá (chưa đặt) → is_order = false
3. Số lượng có thể viết: "1000 cái", "5 thùng", "2k" (=2000), "500c" (=500 cái)
4. Tên sản phẩm có thể viết tắt hoặc không chính xác, hãy giữ nguyên
5. Nếu tin nhắn nhắc đến nhiều sản phẩm, tách thành nhiều items

Trả về JSON duy nhất, không giải thích thêm:
{
  "is_order": true/false,
  "customer_name": "tên khách nếu có",
  "customer_phone": "SĐT nếu có",
  "items": [
    { "product_name": "tên SP", "quantity": 1000, "unit_price": null, "note": "ghi chú nếu có" }
  ],
  "delivery_note": "ghi chú giao hàng nếu có",
  "raw_summary": "tóm tắt ngắn gọn nội dung tin nhắn"
}`;

export class AIService {
  static getDefaultPrompts() {
    return {
      ai_chat_prompt: CHAT_SYSTEM_PROMPT,
      ai_summary_prompt: SUMMARY_SYSTEM_PROMPT,
      ai_order_prompt: SYSTEM_PROMPT,
    };
  }

  static async extractOrderFromMessage(
    message: string,
    productList: string[],
  ): Promise<ExtractedOrder> {
    try {
      if (!config.openai.apiKey) {
        logger.warn('OpenAI API key not configured, skipping AI extraction');
        return { is_order: false, items: [], raw_summary: t('ai.apiKeyNotSet') };
      }

      const customPrompts = await getCustomPrompts();
      const orderPrompt = customPrompts.order || SYSTEM_PROMPT;
      const trainingContext = await AiTrainingService.buildTrainingContext();

      const productContext = productList.length > 0
        ? `\n\nDanh sách sản phẩm hiện có:\n${productList.join('\n')}`
        : '';

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: orderPrompt + trainingContext + productContext },
          { role: 'user', content: message },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { is_order: false, items: [], raw_summary: t('ai.emptyResponse') };
      }

      const parsed = JSON.parse(content) as ExtractedOrder;
      logger.info('AI order extraction result:', { is_order: parsed.is_order, items_count: parsed.items?.length });
      return parsed;
    } catch (err: any) {
      logger.error('AI extraction error:', err.message);
      return { is_order: false, items: [], raw_summary: `${t('ai.error')}: ${err.message}` };
    }
  }

  /**
   * Chat with AI about Zalo messages. User asks a question, AI answers based on message context.
   */
  static async chatAboutMessages(
    question: string,
    messages: Array<{ sender_name: string | null; content: string | null; direction: string; created_at: Date }>,
  ): Promise<string> {
    try {
      if (!config.openai.apiKey) return t('ai.apiKeyNotConfigured');

      const customPrompts = await getCustomPrompts();
      const systemPrompt = customPrompts.chat || CHAT_SYSTEM_PROMPT;
      const trainingContext = await AiTrainingService.buildTrainingContext();

      const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

      const msgContext = messages
        .map((m) => {
          const time = new Date(m.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
          return `[${time}] [${m.direction === 'INCOMING' ? 'Nhận' : 'Gửi'}] ${m.sender_name || 'Unknown'}: ${m.content || ''}`;
        })
        .join('\n');

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt + trainingContext + `\n\nNgày giờ hiện tại: ${now}\nHôm nay là: ${today}\n\n--- TIN NHẮN ZALO ---\n${msgContext}\n--- HẾT ---` },
          { role: 'user', content: question },
        ],
      });

      return response.choices[0]?.message?.content || t('ai.noResponse');
    } catch (err: any) {
      logger.error('AI chat error:', err.message);
      return `${t('ai.error')}: ${err.message}`;
    }
  }

  /**
   * Auto-summarize recent Zalo messages: detect orders, issues, quote requests.
   */
  static async summarizeMessages(
    messages: Array<{ sender_name: string | null; content: string | null; direction: string; created_at: Date }>,
  ): Promise<Record<string, unknown>> {
    try {
      if (!config.openai.apiKey) return { error: t('ai.apiKeyNotConfigured') };

      const customPrompts = await getCustomPrompts();
      const summaryPrompt = customPrompts.summary || SUMMARY_SYSTEM_PROMPT;
      const trainingContext = await AiTrainingService.buildTrainingContext();

      const msgContext = messages
        .map((m) => `[${m.direction === 'INCOMING' ? 'Nhận' : 'Gửi'}] ${m.sender_name || 'Unknown'}: ${m.content || ''} (${new Date(m.created_at).toLocaleString('vi-VN')})`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        max_tokens: config.openai.maxTokens,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: summaryPrompt + trainingContext },
          { role: 'user', content: `Phân tích ${messages.length} tin nhắn Zalo sau:\n\n${msgContext}` },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return { error: t('ai.noResponse') };
      return JSON.parse(content);
    } catch (err: any) {
      logger.error('AI summary error:', err.message);
      return { error: `${t('ai.error')}: ${err.message}` };
    }
  }
}
