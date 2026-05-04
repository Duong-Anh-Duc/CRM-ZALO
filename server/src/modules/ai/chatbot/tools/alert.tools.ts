import { ToolDefinition } from '../types';

export const alertTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'mark_alert_read',
        description: 'Đánh dấu alert đã đọc',
        parameters: { type: 'object', properties: { alert_id: { type: 'string' } }, required: ['alert_id'] },
      },
    },
    handler: async (args) => {
      const { AlertService } = await import('../../../alert/alert.service');
      await AlertService.markAsRead(args.alert_id);
      return `✅ Đã đánh dấu alert đã đọc [id:${args.alert_id}]`;
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'take_alert_action',
        description: 'Ghi nhận action đã thực hiện với alert (VD: ACKNOWLEDGED, RESCHEDULED)',
        parameters: {
          type: 'object',
          properties: {
            alert_id: { type: 'string' }, action: { type: 'string' },
            new_expected_date: { type: 'string', description: 'YYYY-MM-DD nếu action = RESCHEDULED' },
          },
          required: ['alert_id', 'action'],
        },
      },
    },
    handler: async (args) => {
      const { AlertService } = await import('../../../alert/alert.service');
      await AlertService.takeAction(args.alert_id, args.action, args.new_expected_date);
      return `✅ Đã ghi nhận action "${args.action}" cho alert [id:${args.alert_id}]`;
    },
  },
];
