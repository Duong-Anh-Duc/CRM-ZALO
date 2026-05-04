import prisma from '../../../lib/prisma';
import logger from '../../../utils/logger';
import { ToolContext } from './types';

const RESULT_MAX = 1000;

interface RecordParams {
  ctx: ToolContext;
  toolName: string;
  args: Record<string, any>;
  result?: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Fire-and-forget audit log write. Errors are swallowed (logged) so that AI
 * response is never blocked or failed by audit issues.
 */
export function recordAudit(params: RecordParams): void {
  const { ctx, toolName, args, result, success, error, durationMs } = params;
  const truncated = result && result.length > RESULT_MAX
    ? result.slice(0, RESULT_MAX) + '…[truncated]'
    : result;

  prisma.aiAuditLog
    .create({
      data: {
        user_id: ctx.user?.id || null,
        user_email: ctx.user?.email || null,
        tool_name: toolName,
        args: args as any,
        result: truncated || null,
        success,
        error: error || null,
        duration_ms: Math.max(0, Math.round(durationMs)),
      },
    })
    .catch((err) => {
      logger.error(`Audit log write failed for ${toolName}:`, err);
    });
}
