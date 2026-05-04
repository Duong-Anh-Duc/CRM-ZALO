import OpenAI from 'openai';
import { ToolContext, ToolDefinition, ToolHandler } from './types';
import { recordAudit } from './audit';
import { storePending } from './pending-actions';

type ToolCallListener = (info: { name: string; args: Record<string, any> }) => void;

class ToolRegistry {
  private map = new Map<string, ToolDefinition>();
  private listeners = new Set<ToolCallListener>();

  onCall(listener: ToolCallListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(name: string, args: Record<string, any>): void {
    for (const l of this.listeners) {
      try { l({ name, args }); } catch { /* ignore listener errors */ }
    }
  }

  register(def: ToolDefinition): void {
    const name = def.schema.function.name;
    if (this.map.has(name)) {
      throw new Error(`Tool already registered: ${name}`);
    }
    this.map.set(name, def);
  }

  registerAll(defs: ToolDefinition[]): void {
    for (const d of defs) this.register(d);
  }

  schemas(allowList?: Set<string>): OpenAI.Chat.ChatCompletionFunctionTool[] {
    const all = Array.from(this.map.values()).map((d) => d.schema);
    if (!allowList) return all;
    return all.filter((s) => allowList.has(s.function.name));
  }

  list(): { name: string; description: string }[] {
    return Array.from(this.map.values()).map((d) => ({
      name: d.schema.function.name,
      description: d.schema.function.description || '',
    }));
  }

  has(name: string): boolean {
    return this.map.has(name);
  }

  async execute(name: string, args: Record<string, any>, ctx: ToolContext): Promise<string> {
    const def = this.map.get(name);
    if (!def) return 'Không hỗ trợ công cụ này.';
    this.emit(name, args);

    if (def.requiresConfirmation) {
      const id = storePending({
        toolName: name,
        args,
        handler: def.handler,
        ctx,
        audit: !!def.audit,
      });
      return [
        `🛑 CẦN XÁC NHẬN trước khi thực hiện hành động này.`,
        `Tool: ${name}`,
        `Tham số: ${JSON.stringify(args)}`,
        `[confirm_id:${id}]`,
        `→ Em phải tóm tắt rõ ràng cho user (ngôn ngữ tự nhiên, không đọc raw JSON) rồi HỎI user xác nhận.`,
        `→ Khi user trả lời xác nhận ("ok", "đồng ý", "xác nhận"), gọi confirm_action(confirmation_id="${id}").`,
        `→ Nếu user hủy → KHÔNG gọi confirm_action, báo "đã hủy" cho user.`,
      ].join('\n');
    }

    return runHandler(def.handler, name, args, ctx, !!def.audit);
  }
}

export async function runHandler(
  handler: ToolHandler,
  toolName: string,
  args: Record<string, any>,
  ctx: ToolContext,
  audit: boolean,
): Promise<string> {
  if (!audit) {
    return handler(args, ctx);
  }
  const startedAt = Date.now();
  try {
    const result = await handler(args, ctx);
    recordAudit({
      ctx, toolName, args, result,
      success: true,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (err: any) {
    recordAudit({
      ctx, toolName, args,
      success: false,
      error: err?.message || 'unknown',
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

export const toolRegistry = new ToolRegistry();
