import { ToolDefinition } from '../types';
import { addMemory, forgetMemory, listMemories, MemoryType } from '../memory';

const VALID_TYPES: MemoryType[] = ['user_pref', 'kh_note', 'sp_note', 'ncc_note', 'rule', 'fact'];

export const memoryTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'remember',
        description:
          'Lưu 1 ghi nhớ DÀI HẠN cho user. Dùng khi user nói preference, rule, hoặc thông tin đáng nhớ về KH/NCC/SP. KHÔNG dùng cho task ngắn hạn.',
        parameters: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              description: 'Label ngắn ≤50 ký tự, dùng để dedup. VD "KH ABC - VIP", "Định dạng tiền".',
            },
            content: { type: 'string', description: 'Nội dung đầy đủ cần nhớ.' },
            type: {
              type: 'string',
              enum: VALID_TYPES,
              description:
                'Loại memory: user_pref (sở thích cá nhân), kh_note (về KH), sp_note (về SP), ncc_note (về NCC), rule (quy tắc kinh doanh), fact (sự kiện).',
            },
            importance: {
              type: 'number',
              description: '0.1-1, độ quan trọng. Default 0.5.',
            },
          },
          required: ['subject', 'content', 'type'],
        },
      },
    },
    handler: async (args, ctx) => {
      const userId = ctx.user?.id;
      if (!userId || userId === 'anonymous') return '❌ Cần đăng nhập để lưu ghi nhớ.';
      const subject = String(args.subject || '').trim();
      const content = String(args.content || '').trim();
      const type = String(args.type || '') as MemoryType;
      if (!subject || !content) return '❌ Cần subject và content.';
      if (!VALID_TYPES.includes(type)) return `❌ type phải là 1 trong: ${VALID_TYPES.join(', ')}`;
      await addMemory({
        userId,
        type,
        subject,
        content,
        importance: typeof args.importance === 'number' ? args.importance : 0.5,
      });
      return `✅ Đã ghi nhớ: ${subject}`;
    },
  },

  {
    schema: {
      type: 'function',
      function: {
        name: 'forget',
        description: 'Xoá 1 ghi nhớ dài hạn theo subject (match contains). Dùng khi user nói "quên đi", "đừng nhớ X nữa".',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Subject hoặc phần subject muốn xoá.' },
          },
          required: ['subject'],
        },
      },
    },
    handler: async (args, ctx) => {
      const userId = ctx.user?.id;
      if (!userId || userId === 'anonymous') return '❌ Cần đăng nhập.';
      const ok = await forgetMemory(userId, String(args.subject || ''));
      return ok ? `✅ Đã quên: ${args.subject}` : '❌ Không tìm thấy ghi nhớ phù hợp.';
    },
  },

  {
    schema: {
      type: 'function',
      function: {
        name: 'list_memories',
        description: 'Liệt kê các ghi nhớ dài hạn đang có cho user. Dùng khi user hỏi "em nhớ gì về tôi", "list memory".',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: VALID_TYPES, description: 'Lọc theo loại. Bỏ trống = tất cả.' },
          },
        },
      },
    },
    handler: async (args, ctx) => {
      const userId = ctx.user?.id;
      if (!userId || userId === 'anonymous') return '❌ Cần đăng nhập.';
      const type = args.type && VALID_TYPES.includes(args.type) ? (args.type as MemoryType) : undefined;
      const items = await listMemories(userId, type);
      if (!items.length) return 'Chưa có ghi nhớ nào.';
      return items
        .slice(0, 50)
        .map((m) => `[${m.type}] ${m.subject}: ${m.content} (×${m.mention_count})`)
        .join('\n');
    },
  },
];
