import { ToolDefinition } from '../types';
import { toolRegistry } from '../tool-registry';

export const helpTools: ToolDefinition[] = [
  {
    schema: {
      type: 'function',
      function: {
        name: 'help',
        description: 'Liệt kê tất cả khả năng hiện tại của Aura — trả lời khi user hỏi "em làm được gì", "có những chức năng gì"',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    },
    handler: async () => {
      return toolRegistry
        .list()
        .map((t) => `• ${t.name} — ${t.description}`)
        .join('\n');
    },
  },
];
