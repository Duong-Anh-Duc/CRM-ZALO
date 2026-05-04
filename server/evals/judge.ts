import OpenAI from 'openai';
import { config } from '../src/config';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
});

export interface JudgeInput {
  input: string;
  reply: string;
  toolsUsed: string[];
  toolCalls?: Array<{ name: string; args: Record<string, any> }>;
  criteria: string[];
}

export interface JudgeResult {
  scores: Array<{ criterion: string; pass: boolean; reason: string }>;
  passCount: number;
  total: number;
  overall: 'pass' | 'fail';
}

const JUDGE_PROMPT = `Bạn là JUDGE đánh giá AI agent Aura (CRM bao bì nhựa).
Cho INPUT (câu user), REPLY (câu trả lời của Aura), TOOL_CALLS (tool đã gọi + args), và CRITERIA.

QUY TẮC ĐÁNH GIÁ:
- Đánh giá KHÁCH QUAN dựa TRỰC TIẾP vào REPLY và TOOL_CALLS.
- "Ngắn gọn" = không quá 5 dòng main content (không tính bullet points). Bullet list dài vẫn OK nếu cần thiết.
- Nếu tiêu chí về tool, dựa vào TOOL_CALLS (tên + args) không đoán.
- Nếu REPLY cho thấy không tìm thấy đối tượng, KHÔNG cần xác nhận xoá.
- Cho tiêu chí ngữ nghĩa, miễn ý đúng là pass.

Mỗi tiêu chí trả pass=true/false + reason ngắn (≤25 từ).

Trả JSON: {"scores":[{"criterion":"...","pass":true|false,"reason":"..."}]}
JSON thuần, không markdown.`;

export async function judge(input: JudgeInput): Promise<JudgeResult> {
  const toolsDetail = input.toolCalls && input.toolCalls.length
    ? input.toolCalls.map((t) => `${t.name}(${JSON.stringify(t.args)})`).join('; ')
    : '(none)';

  const userMsg = `INPUT: ${input.input}

REPLY: ${input.reply}

TOOL_CALLS: ${toolsDetail}

CRITERIA:
${input.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;

  let raw = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: JUDGE_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      });
      if (response.choices && response.choices.length > 0) {
        raw = response.choices[0]?.message?.content || '';
        if (raw.trim()) break;
      }
    } catch {
      // retry
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: { scores?: Array<{ criterion: string; pass: boolean; reason: string }> } = { scores: [] };
  if (match) {
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      // leave default
    }
  }

  const scores = (parsed.scores || []).map((s) => ({
    criterion: String(s.criterion || ''),
    pass: Boolean(s.pass),
    reason: String(s.reason || ''),
  }));
  const passCount = scores.filter((s) => s.pass).length;
  const total = input.criteria.length;
  const overall: 'pass' | 'fail' = passCount === total && total > 0 ? 'pass' : 'fail';
  return { scores, passCount, total, overall };
}
