import prisma from '../../lib/prisma';
import type { AuditLogFilters } from './audit-log.types';

async function attachFullName<T extends { user_id: string | null }>(logs: T[]) {
  const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter((x): x is string => !!x)));
  if (userIds.length === 0) return logs.map((l) => ({ ...l, user_full_name: null }));

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, full_name: true },
  });
  const map = new Map(users.map((u) => [u.id, u.full_name]));
  return logs.map((l) => ({ ...l, user_full_name: l.user_id ? map.get(l.user_id) ?? null : null }));
}

export class AuditLogService {
  static async list(filters: AuditLogFilters) {
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 50;

    const where: Record<string, unknown> = {};
    if (filters.action) where.action = filters.action;
    if (filters.model_name) where.model_name = filters.model_name;
    if (filters.user_id) where.user_id = filters.user_id;

    if (filters.search) {
      where.OR = [
        { user_name: { contains: filters.search, mode: 'insensitive' } },
        { record_id: { contains: filters.search, mode: 'insensitive' } },
        { model_name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.from_date || filters.to_date) {
      where.created_at = {
        ...(filters.from_date && { gte: new Date(filters.from_date) }),
        ...(filters.to_date && { lte: new Date(`${filters.to_date}T23:59:59.999Z`) }),
      };
    }

    const [rawLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const logs = await attachFullName(rawLogs);
    return { logs, total, page, limit };
  }

  static async getById(id: string) {
    const log = await prisma.auditLog.findUnique({ where: { id } });
    if (!log) return null;
    const [withName] = await attachFullName([log]);
    return withName;
  }

  static async distinctModels() {
    const rows = await prisma.auditLog.findMany({
      distinct: ['model_name'],
      select: { model_name: true },
      orderBy: { model_name: 'asc' },
    });
    return rows.map((r) => r.model_name);
  }

  static async distinctUsers() {
    const rows = await prisma.auditLog.findMany({
      distinct: ['user_id'],
      select: { user_id: true, user_name: true },
      where: { user_id: { not: null } },
      orderBy: { user_name: 'asc' },
    });

    const userIds = rows.map((r) => r.user_id).filter((x): x is string => !!x);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, full_name: true },
    });
    const map = new Map(users.map((u) => [u.id, u.full_name]));

    return rows.map((r) => ({
      user_id: r.user_id,
      user_name: r.user_name,
      user_full_name: r.user_id ? map.get(r.user_id) ?? null : null,
    }));
  }
}
