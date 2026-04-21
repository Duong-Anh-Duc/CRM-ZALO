import React, { useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Popconfirm, Empty, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser } from '@/features/auth/hooks';
import { PageHeader } from '@/components/common';
import { AuthUser, CreateUserInput } from '@/types';
import { usePermission } from '@/contexts/AbilityContext';
import { useAuthStore } from '@/stores/auth.store';

// Hardcoded role options — backend does not yet expose a roles list endpoint.
// These slugs must match the seeded roles on the backend (admin/manager/accountant/sales/viewer).
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'admin', label: 'Quản trị viên' },
  { value: 'manager', label: 'Quản lý' },
  { value: 'accountant', label: 'Kế toán' },
  { value: 'sales', label: 'Nhân viên kinh doanh' },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'red',
  manager: 'purple',
  accountant: 'gold',
  sales: 'blue',
};

function roleLabelFromSlug(slug?: string): string {
  if (!slug) return '';
  const match = ROLE_OPTIONS.find((o) => o.value === slug);
  if (match) return match.label;
  // Fallback: title-case the slug (e.g. "custom_role" -> "Custom Role")
  return slug
    .split(/[_-]/g)
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join(' ');
}

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  const canCreate = usePermission('user.create');
  const canUpdate = usePermission('user.update');
  const canDelete = usePermission('user.delete');
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data, isLoading } = useUsers({ search, page, limit: pageSize });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deactivateMutation = useDeactivateUser();

  const users: AuthUser[] = data?.data ?? [];

  const handleEdit = (user: AuthUser) => {
    setEditingUser(user);
    const roleObj = typeof user.role === 'object' && user.role !== null
      ? (user.role as unknown as { slug?: string })
      : null;
    form.setFieldsValue({
      full_name: user.full_name,
      email: user.email,
      role_slug: user.role_slug || user.role_detail?.slug || roleObj?.slug,
    });
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = (values: CreateUserInput & { is_active?: boolean }) => {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: values }, {
        onSuccess: () => { setModalOpen(false); setEditingUser(null); form.resetFields(); },
      });
    } else {
      createMutation.mutate(values as CreateUserInput, {
        onSuccess: () => { setModalOpen(false); form.resetFields(); },
      });
    }
  };

  const columns: ColumnsType<AuthUser> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center', render: (_: unknown, __: unknown, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('user.fullName'), dataIndex: 'full_name', key: 'full_name', ellipsis: true },
    { title: t('auth.email'), dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: t('user.role'),
      key: 'role',
      width: 160,
      align: 'center',
      render: (_: unknown, record: AuthUser) => {
        const roleObj = typeof record.role === 'object' && record.role !== null
          ? (record.role as unknown as { slug?: string; name?: string })
          : null;
        const slug = record.role_slug || record.role_detail?.slug || roleObj?.slug;
        const name =
          record.role_detail?.name ||
          roleObj?.name ||
          roleLabelFromSlug(slug) ||
          (typeof record.role === 'string' ? record.role : '');
        const color = (slug && ROLE_COLORS[slug]) || 'default';
        return <Tag color={color} style={{ borderRadius: 8 }}>{name}</Tag>;
      },
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 8 }}>{v ? t('common.active') : t('common.disabled')}</Tag>,
    },
    {
      title: t('common.actions'), key: 'actions', width: 150, align: 'center',
      render: (_: unknown, record: AuthUser) => {
        const isSelf = record.id === currentUserId;
        return (
          <Space size={4}>
            {canUpdate && (
              <Tooltip title={t('common.edit')}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
              </Tooltip>
            )}
            {canDelete && record.is_active && !isSelf && (
              <Popconfirm title={t('user.deactivateConfirm')} onConfirm={() => deactivateMutation.mutate(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                <Tooltip title={t('common.delete')}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
            {isSelf && (
              <Tooltip title={t('user.selfRowHint')}>
                <Tag color="blue" style={{ borderRadius: 8, fontSize: 11 }}>{t('user.you')}</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader
        title={t('menu.users')}
        extra={
          canCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ borderRadius: 8 }}>
              {t('user.addUser')}
            </Button>
          ) : undefined
        }
      />

      <Input placeholder={t('common.search')} prefix={<SearchOutlined />} allowClear
        style={{ marginBottom: 16, borderRadius: 8, maxWidth: 400 }}
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />

      <Table<AuthUser> rowKey="id" columns={columns} dataSource={users} loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total: users.length, onChange: (p, ps) => { setPage(p); setPageSize(ps); }, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
        locale={{ emptyText: <Empty description={t('user.noUsers')} /> }}
      />

      <Modal open={modalOpen} title={editingUser ? t('user.editUser') : t('user.addUser')}
        onCancel={() => { setModalOpen(false); setEditingUser(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={editingUser ? t('common.save') : t('common.create')}
        cancelText={t('common.cancel')}
        confirmLoading={createMutation.isPending || updateMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="full_name" label={t('user.fullName')} rules={[{ required: true, message: t('user.fullNameRequired') }]}>
            <Input style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: t('user.emailValidRequired') }]}>
            <Input style={{ borderRadius: 8 }} disabled={!!editingUser} />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, min: 6, message: t('user.passwordMin') }]}>
              <Input.Password style={{ borderRadius: 8 }} />
            </Form.Item>
          )}
          <Form.Item name="role_slug" label={t('user.role')} rules={[{ required: true, message: t('user.roleRequired') }]}>
            <Select style={{ borderRadius: 8 }} options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagementPage;
