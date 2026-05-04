import prisma from '../../../lib/prisma';
import logger from '../../../utils/logger';

export type MemoryType = 'user_pref' | 'kh_note' | 'sp_note' | 'ncc_note' | 'rule' | 'fact';

export interface MemoryInput {
  userId: string;
  type: MemoryType;
  subject: string;
  content: string;
  refId?: string;
  importance?: number;
}

const MAX_PER_USER = 200;
const MAX_LOAD = 20;

/**
 * Add or upsert a memory. Subject is the dedup key per user — re-saving the
 * same subject increments mention_count and refreshes last_used_at instead of
 * creating a duplicate row.
 */
export async function addMemory(input: MemoryInput): Promise<void> {
  const subject = input.subject.trim().slice(0, 200);
  if (!subject || !input.content.trim()) return;
  try {
    await prisma.aiMemory.upsert({
      where: { user_id_subject: { user_id: input.userId, subject } },
      update: {
        content: input.content.trim().slice(0, 1000),
        type: input.type,
        ref_id: input.refId,
        importance: input.importance ?? undefined,
        mention_count: { increment: 1 },
        last_used_at: new Date(),
      },
      create: {
        user_id: input.userId,
        type: input.type,
        subject,
        content: input.content.trim().slice(0, 1000),
        ref_id: input.refId,
        importance: input.importance ?? 0.5,
      },
    });
    void capUser(input.userId);
  } catch (err) {
    logger.warn('addMemory failed:', err);
  }
}

/**
 * Forget by subject (preferred — agent uses subject not id).
 */
export async function forgetMemory(userId: string, subject: string): Promise<boolean> {
  try {
    const r = await prisma.aiMemory.deleteMany({
      where: { user_id: userId, subject: { contains: subject.trim() } },
    });
    return r.count > 0;
  } catch (err) {
    logger.warn('forgetMemory failed:', err);
    return false;
  }
}

/**
 * Return up to MAX_LOAD memories for prompt injection. Strategy:
 *  1. Recently used (boost recency)
 *  2. High importance (boost permanence)
 * For now we order by importance DESC then last_used_at DESC. Embedding-based
 * retrieval can be added later by ranking subject+content similarity to query.
 */
export async function loadRelevantMemories(userId: string, _query?: string): Promise<string> {
  try {
    const rows = await prisma.aiMemory.findMany({
      where: { user_id: userId },
      orderBy: [{ importance: 'desc' }, { last_used_at: 'desc' }],
      take: MAX_LOAD,
    });
    if (!rows.length) return '';
    const lines = rows.map((m) => `• [${m.type}] ${m.subject}: ${m.content}`);
    // Best-effort touch: bump last_used_at for the loaded set (non-blocking)
    void prisma.aiMemory
      .updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { last_used_at: new Date() },
      })
      .catch(() => {});
    return `=== GHI NHỚ DÀI HẠN VỀ ANH ===\n${lines.join('\n')}`;
  } catch (err) {
    logger.warn('loadRelevantMemories failed:', err);
    return '';
  }
}

export async function listMemories(
  userId: string,
  type?: MemoryType,
): Promise<Array<{ subject: string; content: string; type: string; mention_count: number }>> {
  const rows = await prisma.aiMemory.findMany({
    where: { user_id: userId, ...(type ? { type } : {}) },
    orderBy: [{ importance: 'desc' }, { last_used_at: 'desc' }],
    take: 100,
  });
  return rows.map((r) => ({
    subject: r.subject,
    content: r.content,
    type: r.type,
    mention_count: r.mention_count,
  }));
}

/**
 * Cap memories per user to MAX_PER_USER. Drop lowest-importance, oldest-used first.
 */
async function capUser(userId: string): Promise<void> {
  try {
    const count = await prisma.aiMemory.count({ where: { user_id: userId } });
    if (count <= MAX_PER_USER) return;
    const excess = count - MAX_PER_USER;
    const toDelete = await prisma.aiMemory.findMany({
      where: { user_id: userId },
      orderBy: [{ importance: 'asc' }, { last_used_at: 'asc' }],
      take: excess,
      select: { id: true },
    });
    if (toDelete.length) {
      await prisma.aiMemory.deleteMany({
        where: { id: { in: toDelete.map((r) => r.id) } },
      });
    }
  } catch (err) {
    logger.warn('capUser failed:', err);
  }
}
