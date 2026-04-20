export interface AuditLogFilters {
  page?: string | number;
  limit?: string | number;
  action?: string;
  model_name?: string;
  user_id?: string;
  search?: string;
  from_date?: string;
  to_date?: string;
}
