import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import logger from '../utils/logger';

export interface RequestContext {
  userId?: string | null;
  userName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

const SKIP_MODELS = new Set(['AuditLog']);
const WRITE_OPS = new Set(['create', 'update', 'delete', 'upsert']);
const SENSITIVE_KEYS = new Set(['password', 'password_hash', 'passwordHash', 'token', 'jwt', 'secret', 'refresh_token', 'access_token']);

function redact<T>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redact) as never;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    clone[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : (typeof v === 'object' ? redact(v) : v);
  }
  return clone as T;
}

function toCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

const prisma = baseClient.$extends({
  name: 'audit-log',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!WRITE_OPS.has(operation) || SKIP_MODELS.has(model)) {
          return query(args);
        }

        let oldData: unknown = null;
        const argsAny = args as { where?: unknown; include?: unknown; select?: unknown };
        if ((operation === 'update' || operation === 'delete') && argsAny.where) {
          try {
            const modelKey = toCamel(model) as keyof typeof baseClient;
            const delegate = baseClient[modelKey] as unknown as { findUnique: (a: unknown) => Promise<unknown> };
            // Match shape of update result so diff is accurate (same relations/fields)
            oldData = await delegate.findUnique({
              where: argsAny.where,
              ...(argsAny.include ? { include: argsAny.include } : {}),
              ...(argsAny.select ? { select: argsAny.select } : {}),
            });
          } catch {
            // best effort
          }
        }

        const result = await query(args);

        const ctx = requestContext.getStore();
        const action = operation === 'create' ? 'CREATE'
          : operation === 'delete' ? 'DELETE'
          : operation === 'upsert' ? 'UPSERT'
          : 'UPDATE';

        const recordId = (result as { id?: string } | null)?.id
          ?? (oldData as { id?: string } | null)?.id
          ?? null;

        // Skip audit log for no-op updates (nothing actually changed)
        if (action === 'UPDATE' && oldData && result) {
          try {
            if (JSON.stringify(redact(oldData)) === JSON.stringify(redact(result))) {
              return result;
            }
          } catch {
            // fall through — log anyway on stringify errors
          }
        }

        baseClient.auditLog.create({
          data: {
            user_id: ctx?.userId || null,
            user_name: ctx?.userName || null,
            action,
            model_name: model,
            record_id: recordId,
            old_data: oldData ? (redact(oldData) as never) : undefined,
            new_data: result ? (redact(result) as never) : undefined,
            ip_address: ctx?.ip || null,
          },
        }).catch((err: Error) => {
          logger.warn(`Audit log failed for ${model}.${operation}: ${err.message}`);
        });

        return result;
      },
    },
  },
});

export default prisma;
export { baseClient };
