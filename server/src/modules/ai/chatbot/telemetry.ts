import prisma from '../../../lib/prisma';
import logger from '../../../utils/logger';
import { ToolContext } from './types';

export interface TelemetryRecord {
  ctx: ToolContext;
  channel: string;
  model: string;
  rounds: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  latencyMs: number;
  toolCalls: number;
  success: boolean;
  error?: string;
}

/** Fire-and-forget telemetry write. Errors are logged but never propagated. */
export function recordTelemetry(record: TelemetryRecord): void {
  prisma.aiTelemetry
    .create({
      data: {
        user_id: record.ctx.user?.id || null,
        user_email: record.ctx.user?.email || null,
        channel: record.channel,
        model: record.model,
        rounds: record.rounds,
        prompt_tokens: record.promptTokens,
        completion_tokens: record.completionTokens,
        cached_tokens: record.cachedTokens,
        total_tokens: record.totalTokens,
        latency_ms: Math.max(0, Math.round(record.latencyMs)),
        tool_calls: record.toolCalls,
        success: record.success,
        error: record.error || null,
      },
    })
    .catch((err) => {
      logger.error('Telemetry write failed:', err);
    });
}

/** Aggregator passed around the chatStream loop. */
export class UsageCollector {
  promptTokens = 0;
  completionTokens = 0;
  cachedTokens = 0;
  totalTokens = 0;
  rounds = 0;
  toolCalls = 0;

  add(usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } | null } | null | undefined): void {
    if (!usage) return;
    this.promptTokens += usage.prompt_tokens || 0;
    this.completionTokens += usage.completion_tokens || 0;
    this.totalTokens += usage.total_tokens || 0;
    this.cachedTokens += usage.prompt_tokens_details?.cached_tokens || 0;
  }

  incRound(): void { this.rounds++; }
  incToolCalls(n: number): void { this.toolCalls += n; }
}
