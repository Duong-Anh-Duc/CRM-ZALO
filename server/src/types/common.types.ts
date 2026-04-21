import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  /**
   * @deprecated Legacy uppercase role label. Kept for one more release because
   * the frontend may still read `user.role` as a string. Backend route guards
   * have migrated to `requireAbility(action, subject)` — this field is no
   * longer consulted server-side. Remove after FE migration (Phase 3 cleanup).
   *
   * Mapping: admin → 'ADMIN', viewer → 'VIEWER', everything else → 'STAFF'.
   */
  role: string;
  /** Canonical role slug (e.g. "admin", "sales"). New code should use this. */
  roleSlug: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
