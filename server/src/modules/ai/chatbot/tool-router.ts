import OpenAI from 'openai';
import { config } from '../../../config';
import logger from '../../../utils/logger';
import { openai } from './openai-client';
import { DOMAINS, DomainKey } from './tool-domains';

const ROUTER_PROMPT = `Bạn là ROUTER chọn DOMAIN tools cho AI agent CRM bao bì nhựa.
Đọc câu hỏi user + lịch sử ngắn + có ảnh hay không, chọn 1-3 domain TỐI THIỂU mà agent CẦN để xử lý.

DANH SÁCH DOMAIN:
${Object.entries(DOMAINS)
  .map(([k, v]) => `• ${k}: ${v.label}`)
  .join('\n')}

QUY TẮC:
- Mặc định LUÔN có meta tools (search KH/NCC/SP, help, memory) → KHÔNG cần liệt kê.
- Câu đọc/báo cáo → READ
- Câu có ảnh + hỏi sản phẩm → VISION + READ (để search nếu cần)
- Câu thao tác KH/NCC/SP → CUSTOMER/SUPPLIER/PRODUCT (chọn ĐÚNG cái cần)
- Câu tạo/sửa đơn → ORDER (+ READ nếu cần xem giá)
- Câu hoá đơn → INVOICE
- Câu thanh toán/công nợ → PAYMENT (+ READ)
- Câu trả hàng → RETURN
- Câu sổ quỹ/chi phí vận hành → CASH
- Câu lương → PAYROLL
- Câu Zalo → ZALO
- Câu xuất Excel → EXPORT
- Câu mơ hồ / chào → [] (rỗng, dùng meta tools đủ)

Trả JSON: {"domains":["KEY1","KEY2"]}. JSON thuần, không markdown.`;

const VALID_KEYS = new Set(Object.keys(DOMAINS));

/**
 * Pick domain keys from user question. Cheap call (small model, max 50 tokens out).
 * On error, returns null → caller should fall back to all domains.
 */
export async function selectDomains(
  question: string,
  history: Array<{ role: string; content: string }>,
  hasImages: boolean,
): Promise<DomainKey[] | null> {
  const tail = history.slice(-2);
  const transcript = [
    ...tail.map((h) => `${h.role}: ${h.content.slice(0, 200)}`),
    `user: ${question}`,
    hasImages ? '(có ảnh đính kèm)' : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ROUTER_PROMPT },
        { role: 'user', content: transcript.slice(0, 1500) },
      ] as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: 0.1,
      max_tokens: 100,
    });
    if (!response.choices || response.choices.length === 0) {
      logger.warn('selectDomains: empty choices', { response });
      return null;
    }
    const raw = response.choices[0]?.message?.content || '{}';
    // Extract JSON object even if model wrapped it in text/markdown
    const match = raw.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : '{}';
    let parsed: { domains?: string[] };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.warn('selectDomains: JSON parse failed', { raw: raw.slice(0, 200) });
      return null;
    }
    const list = Array.isArray(parsed.domains) ? parsed.domains : [];
    const filtered = list.filter((k) => VALID_KEYS.has(k)) as DomainKey[];
    if (hasImages && !filtered.includes('VISION')) filtered.push('VISION');
    return filtered;
  } catch (err) {
    logger.warn('selectDomains failed:', err);
    return null;
  }
}
