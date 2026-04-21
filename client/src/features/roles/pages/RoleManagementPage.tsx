import React, { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Progress,
  Popconfirm,
  Tooltip,
  Input,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import { useAuthStore } from '@/stores/auth.store';
import { usePermission } from '@/contexts/AbilityContext';
import {
  useCreateRole,
  useDeleteRole,
  useRole,
  useRolePermissions,
  useRoles,
  useUpdateRole,
  useUpdateRolePermissions,
} from '../hooks';
import type { Role } from '../types';
import RoleFormModal from '../components/RoleFormModal';
import RoleStats from '../components/RoleStats';
import RolePermissionsDrawer from '../components/RolePermissionsDrawer';
import { getRoleVisual, CARD_RADIUS } from '../constants';
import { translateRoleName, translateRoleDescription } from '../i18n';

const { Text } = Typography;

const RoleManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = usePermission('role.manage');

  const [drawerRoleId, setDrawerRoleId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const rolesQuery = useRoles();
  const permissionsQuery = useRolePermissions();
  const roleDetailQuery = useRole(drawerRoleId);

  const updatePermissionsMutation = useUpdateRolePermissions();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const roles: Role[] = rolesQuery.data ?? [];
  const allPermissions = permissionsQuery.data ?? [];
  const totalPermissions = allPermissions.length;
  const drawerRole = roleDetailQuery.data;

  const filteredRoles = useMemo(() => {
    if (!search.trim()) return roles;
    const q = search.toLowerCase();
    return roles.filter(
      (r) =>
        translateRoleName(t, r).toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (translateRoleDescription(t, r) ?? '').toLowerCase().includes(q),
    );
  }, [roles, search, t]);

  const totalUsers = useMemo(
    () => roles.reduce((sum, r) => sum + (r.user_count || 0), 0),
    [roles],
  );
  const customRolesCount = useMemo(
    () => roles.filter((r) => !r.is_system).length,
    [roles],
  );

  const isAdminRole = !!(
    drawerRole && drawerRole.is_system && drawerRole.slug === 'admin'
  );
  const isReadOnly = isAdminRole || !canManage;
  const isEditingOwnRole = !!(
    drawerRole &&
    currentUser &&
    (currentUser.role_detail?.id === drawerRole.id ||
      currentUser.role_slug === drawerRole.slug ||
      currentUser.role === drawerRole.slug)
  );

  const handleCreateSubmit = (values: {
    slug: string;
    name: string;
    description?: string;
    permission_ids?: string[];
  }) => {
    createMutation.mutate(values, {
      onSuccess: () => setModalMode(null),
    });
  };

  const handleEditSubmit = (values: {
    slug: string;
    name: string;
    description?: string;
  }) => {
    if (!editRole) return;
    updateMutation.mutate(
      {
        id: editRole.id,
        data: { name: values.name, description: values.description },
      },
      {
        onSuccess: () => {
          setModalMode(null);
          setEditRole(null);
        },
      },
    );
  };

  const handleDelete = (role: Role) => {
    deleteMutation.mutate(role.id);
  };

  const handleSavePermissions = (permission_ids: string[]) => {
    if (!drawerRoleId) return;
    updatePermissionsMutation.mutate(
      { id: drawerRoleId, permission_ids },
      {
        onSuccess: () => setDrawerRoleId(null),
      },
    );
  };

  const columns: ColumnsType<Role> = [
    {
      title: 'STT',
      key: 'stt',
      width: 56,
      align: 'center',
      render: (_: unknown, __: Role, i: number) => (page - 1) * pageSize + i + 1,
    },
    {
      title: t('role.name'),
      key: 'name',
      render: (_: unknown, role: Role) => {
        const visual = getRoleVisual(role.slug);
        const Icon = visual.icon;
        const name = translateRoleName(t, role);
        return (
          <Space size={10}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: `${visual.solid}14`,
                color: visual.solid,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              <Icon />
            </div>
            <Space size={6} wrap>
              <Text strong style={{ fontSize: 14 }}>
                {name}
              </Text>
              {role.is_system && (
                <Tag
                  color="blue"
                  bordered={false}
                  style={{ borderRadius: 4, fontSize: 10, margin: 0, lineHeight: '16px' }}
                >
                  {t('role.systemTag')}
                </Tag>
              )}
            </Space>
          </Space>
        );
      },
    },
    {
      title: t('role.description'),
      key: 'description',
      ellipsis: true,
      responsive: ['lg'],
      render: (_: unknown, role: Role) => {
        const desc = translateRoleDescription(t, role);
        return desc ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            {desc}
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>—</Text>
        );
      },
    },
    {
      title: (
        <Space size={4}>
          <UserOutlined />
          <span>{t('common.quantity')}</span>
        </Space>
      ),
      key: 'users',
      width: 110,
      align: 'center',
      responsive: ['md'],
      render: (_: unknown, role: Role) => (
        <Tag
          bordered={false}
          style={{
            borderRadius: 12,
            background: role.user_count > 0 ? '#e6f4ff' : '#fafafa',
            color: role.user_count > 0 ? '#0958d9' : '#8c8c8c',
            fontWeight: 600,
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {role.user_count}
        </Tag>
      ),
    },
    {
      title: t('role.permissionsMatrix'),
      key: 'permissions',
      width: 200,
      render: (_: unknown, role: Role) => {
        const granted = role.permissions.length;
        const pct = totalPermissions > 0 ? Math.round((granted / totalPermissions) * 100) : 0;
        const visual = getRoleVisual(role.slug);
        return (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: '#595959' }}>
                {granted}/{totalPermissions}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                {pct}%
              </Text>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              size="small"
              strokeColor={visual.solid}
              trailColor="#f0f0f0"
              style={{ margin: 0 }}
            />
          </div>
        );
      },
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 200,
      align: 'center',
      render: (_: unknown, role: Role) => {
        const canEditMeta = canManage && !role.is_system;
        return (
          <Space size={4}>
            <Button
              type="primary"
              size="small"
              icon={<SafetyCertificateOutlined />}
              onClick={() => setDrawerRoleId(role.id)}
              style={{ borderRadius: 8 }}
            >
              {t('role.managePermissions')}
            </Button>
            {canEditMeta && (
              <Tooltip title={t('common.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditRole(role);
                    setModalMode('edit');
                  }}
                />
              </Tooltip>
            )}
            {canEditMeta && (
              <Popconfirm
                title={t('role.deleteRole')}
                description={t('role.deleteConfirm')}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(role)}
              >
                <Tooltip title={t('common.delete')}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('role.title')}
        subtitle={t('role.subtitle')}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => rolesQuery.refetch()}
              style={{ borderRadius: 8 }}
            >
              {t('common.refresh')}
            </Button>
            {canManage && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setModalMode('create')}
                style={{ borderRadius: 8 }}
              >
                {t('role.createRole')}
              </Button>
            )}
          </Space>
        }
      />

      <RoleStats
        totalRoles={roles.length}
        totalPermissions={totalPermissions}
        totalUsers={totalUsers}
        customRoles={customRolesCount}
        loading={rolesQuery.isLoading || permissionsQuery.isLoading}
      />

      <Card
        style={{ borderRadius: CARD_RADIUS, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: 16 } }}
      >
        <Input
          placeholder={t('common.search')}
          prefix={<SearchOutlined />}
          allowClear
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ marginBottom: 12, borderRadius: 8, maxWidth: 320 }}
        />
        <Table<Role>
          rowKey="id"
          columns={columns}
          dataSource={filteredRoles}
          loading={rolesQuery.isLoading}
          pagination={{
            current: page,
            pageSize,
            total: filteredRoles.length,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
          }}
          scroll={{ x: 'max-content' }}
          size="middle"
        />
      </Card>

      <RolePermissionsDrawer
        open={!!drawerRoleId}
        role={drawerRole}
        permissions={allPermissions}
        loading={roleDetailQuery.isLoading}
        saving={updatePermissionsMutation.isPending}
        permissionsLoading={permissionsQuery.isLoading}
        isReadOnly={isReadOnly}
        isAdminRole={isAdminRole}
        isEditingOwnRole={isEditingOwnRole}
        onClose={() => setDrawerRoleId(null)}
        onSave={handleSavePermissions}
      />

      <RoleFormModal
        open={modalMode === 'create'}
        mode="create"
        roles={roles}
        loading={createMutation.isPending}
        onCancel={() => setModalMode(null)}
        onSubmit={handleCreateSubmit}
      />
      <RoleFormModal
        open={modalMode === 'edit'}
        mode="edit"
        initialValues={editRole ?? undefined}
        roles={roles}
        loading={updateMutation.isPending}
        onCancel={() => {
          setModalMode(null);
          setEditRole(null);
        }}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
};

export default RoleManagementPage;
