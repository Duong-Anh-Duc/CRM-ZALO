import { Response } from 'express';
import { PaginationMeta } from '../types';

interface SuccessOptions {
  message?: string;
  meta?: PaginationMeta | (PaginationMeta & Record<string, unknown>);
  statusCode?: number;
}

export function sendSuccess(res: Response, data: unknown = null, options: SuccessOptions = {}) {
  const { message, meta, statusCode = 200 } = options;
  const body: Record<string, unknown> = { success: true };
  if (data !== null) body.data = data;
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated(res: Response, data: unknown, message?: string) {
  return sendSuccess(res, data, { statusCode: 201, message });
}

export function sendPaginated(
  res: Response,
  data: unknown,
  pagination: { total: number; page: number; limit: number },
  extraMeta?: Record<string, unknown>,
) {
  return sendSuccess(res, data, {
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      total_pages: Math.ceil(pagination.total / pagination.limit),
      ...extraMeta,
    } as PaginationMeta,
  });
}

export function sendMessage(res: Response, message: string) {
  return sendSuccess(res, null, { message });
}
