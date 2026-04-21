export interface Permission {
  id: string;
  key: string;
  action: string;
  subject: string;
  module: string;
  description?: string | null;
}

export interface Role {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  user_count: number;
  permissions: Permission[];
}

export interface CreateRoleInput {
  slug: string;
  name: string;
  description?: string;
  permission_ids?: string[];
}

export interface UpdateRoleMetaInput {
  name: string;
  description?: string;
}

export interface UpdateRolePermissionsInput {
  id: string;
  permission_ids: string[];
}
