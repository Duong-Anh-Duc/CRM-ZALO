import dayjs from 'dayjs';
import prisma from '../../../lib/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

interface RangeOpts {
  days: number;
  channel?: string;
  user_id?: string;
}

function rangeWhere({ days, channel, user_id }: RangeOpts): {
  created_at: { gte: Date };
  channel?: string;
  user_id?: string;
} {
  const where: any = { created_at: { gte: new Date(Date.now() - days * DAY_MS) } };
  if (channel) where.channel = channel;
  if (user_id) where.user_id = user_id;
  return where;
}

export const StatsService = {
  /** Per-day rollup of telemetry: tokens, latency, conversation count. */
  async daily(opts: RangeOpts) {
    const where = rangeWhere(opts);
    const rows = await prisma.aiTelemetry.findMany({
      where,
      select: {
        created_at: true, prompt_tokens: true, completion_tokens: true,
        cached_tokens: true, total_tokens: true, latency_ms: true,
        tool_calls: true, success: true, model: true,
      },
    });

    const byDay = new Map<string, {
      day: string;
      conversations: number;
      success: number;
      failed: number;
      prompt_tokens: number;
      completion_tokens: number;
      cached_tokens: number;
      total_tokens: number;
      tool_calls: number;
      avg_latency_ms: number;
      _latency_sum: number;
    }>();

    for (const r of rows) {
      const day = dayjs(r.created_at).format('YYYY-MM-DD');
      let e = byDay.get(day);
      if (!e) {
        e = {
          day, conversations: 0, success: 0, failed: 0,
          prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0,
          total_tokens: 0, tool_calls: 0, avg_latency_ms: 0, _latency_sum: 0,
        };
        byDay.set(day, e);
      }
      e.conversations++;
      if (r.success) e.success++; else e.failed++;
      e.prompt_tokens += r.prompt_tokens;
      e.completion_tokens += r.completion_tokens;
      e.cached_tokens += r.cached_tokens;
      e.total_tokens += r.total_tokens;
      e.tool_calls += r.tool_calls;
      e._latency_sum += r.latency_ms;
    }

    return Array.from(byDay.values())
      .map((e) => ({
        ...e,
        avg_latency_ms: e.conversations > 0 ? Math.round(e._latency_sum / e.conversations) : 0,
        _latency_sum: undefined,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  },

  /** Top tools (write tools only — from ai_audit_logs) by call count + latency. */
  async tools(opts: { days: number; user_id?: string }) {
    const where: any = { created_at: { gte: new Date(Date.now() - opts.days * DAY_MS) } };
    if (opts.user_id) where.user_id = opts.user_id;
    const rows = await prisma.aiAuditLog.findMany({
      where,
      select: { tool_name: true, success: true, duration_ms: true },
    });

    const byTool = new Map<string, { tool: string; calls: number; success: number; failed: number; total_ms: number }>();
    for (const r of rows) {
      let e = byTool.get(r.tool_name);
      if (!e) { e = { tool: r.tool_name, calls: 0, success: 0, failed: 0, total_ms: 0 }; byTool.set(r.tool_name, e); }
      e.calls++;
      if (r.success) e.success++; else e.failed++;
      e.total_ms += r.duration_ms;
    }
    return Array.from(byTool.values())
      .map((e) => ({
        tool: e.tool, calls: e.calls, success: e.success, failed: e.failed,
        avg_duration_ms: e.calls > 0 ? Math.round(e.total_ms / e.calls) : 0,
        success_rate: e.calls > 0 ? Math.round((e.success / e.calls) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.calls - a.calls);
  },

  /** Total summary across the requested range. */
  async summary(opts: RangeOpts) {
    const where = rangeWhere(opts);
    const agg = await prisma.aiTelemetry.aggregate({
      where,
      _count: { _all: true },
      _sum: {
        prompt_tokens: true, completion_tokens: true, cached_tokens: true,
        total_tokens: true, tool_calls: true, latency_ms: true,
      },
    });
    const failed = await prisma.aiTelemetry.count({ where: { ...where, success: false } });
    const conversations = agg._count._all;
    return {
      conversations,
      success: conversations - failed,
      failed,
      prompt_tokens: agg._sum.prompt_tokens || 0,
      completion_tokens: agg._sum.completion_tokens || 0,
      cached_tokens: agg._sum.cached_tokens || 0,
      total_tokens: agg._sum.total_tokens || 0,
      tool_calls: agg._sum.tool_calls || 0,
      avg_latency_ms: conversations > 0 ? Math.round((agg._sum.latency_ms || 0) / conversations) : 0,
      cache_hit_rate: (agg._sum.prompt_tokens || 0) > 0
        ? Math.round(((agg._sum.cached_tokens || 0) / (agg._sum.prompt_tokens || 1)) * 1000) / 10
        : 0,
    };
  },
};
