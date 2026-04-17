import logger from '../utils/logger';

/**
 * Audit Trail — Simple logging utility
 * Call auditLog(prisma, ...) after important operations
 */

let currentUserId: string | null = null;
let currentUserName: string | null = null;

export function setAuditUser(userId: string | null, userName: string | null) {
  currentUserId = userId;
  currentUserName = userName;
}

export function auditLog(
  prismaClient: any,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  modelName: string,
  recordId?: string | null,
  oldData?: any,
  newData?: any,
) {
  prismaClient.auditLog.create({
    data: {
      user_id: currentUserId,
      user_name: currentUserName,
      action,
      model_name: modelName,
      record_id: recordId || null,
      old_data: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      new_data: newData ? JSON.parse(JSON.stringify(newData)) : null,
    },
  }).catch((err: Error) => {
    logger.warn(`Audit log failed: ${err.message}`);
  });
}
