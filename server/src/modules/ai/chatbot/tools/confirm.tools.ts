import { ToolDefinition } from '../types';
import { consumePending, findLatestPendingByUser } from '../pending-actions';
import { runHandler } from '../tool-registry';

export const confirmTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'confirm_action',
        description: 'Xác nhận và thực thi 1 hành động đã được preview ở round trước. CHỈ gọi sau khi USER đã rõ ràng đồng ý ("ok", "đồng ý", "xác nhận", "làm đi"). Nếu không có confirmation_id (history mất context) thì gọi tool này KHÔNG kèm tham số — server sẽ tự lấy hành động pending mới nhất của user.',
        parameters: {
          type: 'object',
          properties: {
            confirmation_id: { type: 'string', description: 'Mã confirm_id nếu còn nhớ; bỏ qua nếu không có để dùng pending mới nhất.' },
          },
        },
      },
    },
    handler: async (args, ctx) => {
      const explicitId = String(args.confirmation_id || '').trim();

      // Path 1: explicit id provided
      if (explicitId) {
        const pending = consumePending(explicitId);
        if (!pending) {
          return '❌ Confirmation ID không hợp lệ hoặc đã hết hạn (10 phút). Hãy gọi lại tool gốc để tạo confirm_id mới.';
        }
        if (pending.ctx.user?.id !== ctx.user?.id) {
          return '❌ Confirmation ID này không thuộc về user hiện tại.';
        }
        return runHandler(pending.handler, pending.toolName, pending.args, pending.ctx, pending.audit);
      }

      // Path 2: fallback to latest pending for this user
      const latest = findLatestPendingByUser(ctx.user?.id || 'anonymous');
      if (!latest) {
        return '❌ Không có hành động nào đang chờ xác nhận cho user này (hoặc đã hết hạn 10 phút). Em hãy gọi lại tool gốc.';
      }
      const pending = consumePending(latest.id);
      if (!pending) return '❌ Pending action vừa hết hạn.';
      return runHandler(pending.handler, pending.toolName, pending.args, pending.ctx, pending.audit);
    },
  },
];
