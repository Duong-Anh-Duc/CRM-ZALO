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

/**
 * Build a RFC 5987-compliant Content-Disposition header value safe for non-ASCII filenames.
 * HTTP headers only accept ASCII — Vietnamese diacritics must be stripped for filename=
 * and the full Unicode name goes in filename*= (UTF-8 percent-encoded).
 */
export function buildContentDisposition(
  disposition: 'inline' | 'attachment',
  filename: string,
): string {
  const asciiFallback = filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, '_');
  const encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
