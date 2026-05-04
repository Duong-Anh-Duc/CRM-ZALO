import OpenAI from 'openai';

export interface ToolContext {
  user: {
    id: string;
    email?: string;
    role?: string;
    roleSlug?: string;
  };
}

export type ToolHandler = (args: Record<string, any>, ctx: ToolContext) => Promise<string>;

export interface ToolDefinition {
  schema: OpenAI.Chat.ChatCompletionFunctionTool;
  handler: ToolHandler;
  /** When true, every call is recorded in ai_audit_logs (use for write/destructive tools). */
  audit?: boolean;
  /**
   * When true, the first call returns a preview + confirmation_id instead of running.
   * Aura must show the preview to the user, get explicit confirmation, then call
   * confirm_action(confirmation_id="...") to actually execute.
   */
  requiresConfirmation?: boolean;
}
