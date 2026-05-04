import crypto from 'crypto';
import { ToolContext, ToolHandler } from './types';

export interface PendingAction {
  toolName: string;
  args: Record<string, any>;
  handler: ToolHandler;
  ctx: ToolContext;
  audit: boolean;
  expiresAt: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const store = new Map<string, PendingAction>();

function gc(): void {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt < now) store.delete(k);
  }
}

export function storePending(p: Omit<PendingAction, 'expiresAt'>): string {
  gc();
  const id = crypto.randomBytes(8).toString('hex');
  store.set(id, { ...p, expiresAt: Date.now() + TTL_MS });
  return id;
}

export function consumePending(id: string): PendingAction | null {
  const p = store.get(id);
  if (!p) return null;
  store.delete(id);
  if (p.expiresAt < Date.now()) return null;
  return p;
}

/**
 * Find (without consuming) the most recent pending action for a user.
 * Used as a fallback when the AI lost the confirm_id from the prior round
 * (history flatten removes tool messages).
 */
export function findLatestPendingByUser(userId: string): { id: string; pending: PendingAction } | null {
  const now = Date.now();
  let latest: { id: string; pending: PendingAction } | null = null;
  for (const [id, p] of store.entries()) {
    if (p.expiresAt < now) continue;
    if (p.ctx.user?.id !== userId) continue;
    if (!latest || p.expiresAt > latest.pending.expiresAt) latest = { id, pending: p };
  }
  return latest;
}
