export interface CreateRoleInput {
  slug: string;
  name: string;
  description?: string;
  permission_ids?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
}

export interface UpdateRolePermissionsInput {
  permission_ids: string[];
}
