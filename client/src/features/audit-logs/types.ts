export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_full_name: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPSERT';
  model_name: string;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  model_name?: string;
  user_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}

export interface DistinctUser {
  user_id: string | null;
  user_name: string | null;
  user_full_name: string | null;
}
