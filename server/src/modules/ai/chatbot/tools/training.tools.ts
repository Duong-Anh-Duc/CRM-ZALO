import { ToolDefinition } from '../types';
import { invalidateSystemContext } from '../system-context';

export const trainingTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'list_ai_training',
        description: 'Liệt kê tất cả kiến thức đã huấn luyện cho Aura (business rules, product aliases, order examples, customer info). Dùng khi user hỏi "em đã được dạy những gì", "xem kiến thức đã học".',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Lọc theo category: PRODUCT_ALIAS, ORDER_EXAMPLE, CORRECTION, BUSINESS_RULE, CUSTOMER_INFO' },
          },
        },
      },
    },
    handler: async (args) => {
      const { AiTrainingService } = await import('../../ai-training.service');
      const list = await AiTrainingService.list(args.category);
      if (list.length === 0) return 'Chưa có kiến thức nào được huấn luyện.';
      return list.map((e, i) => `${i + 1}. [${e.category}] ${e.title} [id:${e.id}]\n   ${e.content.slice(0, 200)}`).join('\n');
    },
  },
  {
    audit: true,
    schema: {
      type: 'function',
      function: {
        name: 'add_ai_training',
        description: 'Thêm 1 kiến thức mới vào cơ sở huấn luyện Aura. Dùng khi user nói "nhớ cho anh là...", "từ giờ nếu KH nói X thì Y", "sản phẩm ABC còn được gọi là XYZ".',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['PRODUCT_ALIAS', 'ORDER_EXAMPLE', 'CORRECTION', 'BUSINESS_RULE', 'CUSTOMER_INFO'], description: 'Loại kiến thức' },
            title: { type: 'string', description: 'Tiêu đề ngắn' },
            content: { type: 'string', description: 'Nội dung chi tiết' },
          },
          required: ['category', 'title', 'content'],
        },
      },
    },
    handler: async (args) => {
      if (!args.category || !args.title || !args.content) return '❌ Thiếu category/title/content';
      const { AiTrainingService } = await import('../../ai-training.service');
      const e = await AiTrainingService.create({ category: args.category, title: args.title, content: args.content });
      invalidateSystemContext();
      return `✅ Đã thêm kiến thức "${e.title}" vào [${e.category}] [id:${e.id}]`;
    },
  },
  {
    audit: true,
    schema: {
      type: 'function',
      function: {
        name: 'delete_ai_training',
        description: 'Xoá 1 kiến thức khỏi huấn luyện. Dùng khi user nói "quên cái X đi", "xoá rule về Y".',
        parameters: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    handler: async (args) => {
      if (!args.id) return '❌ Thiếu id';
      const { AiTrainingService } = await import('../../ai-training.service');
      await AiTrainingService.remove(args.id);
      invalidateSystemContext();
      return `✅ Đã xoá kiến thức [id:${args.id}]`;
    },
  },
];
