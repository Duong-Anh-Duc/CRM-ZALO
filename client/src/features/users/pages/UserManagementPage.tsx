import React, { useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Popconfirm, Empty, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser } from '@/features/auth/hooks';
import { PageHeader } from '@/components/common';
import { AuthUser, CreateUserInput, UserRole } from '@/types';

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  const { data, isLoading } = useUsers({ search, page, limit: pageSize });
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deactivateMutation = useDeactivateUser();

  // Filter out ADMIN users — only show STAFF and VIEWER
  const allUsers: AuthUser[] = data?.data ?? [];
  const users = allUsers.filter((u) => u.role !== 'ADMIN');

  const roleLabels: Record<UserRole, string> = { ADMIN: t('user.roleAdmin'), STAFF: t('user.roleStaff'), VIEWER: t('user.roleViewer') };
  const roleColors: Record<UserRole, string> = { ADMIN: 'red', STAFF: 'blue', VIEWER: 'default' };

  const handleEdit = (user: AuthUser) => {
    setEditingUser(user);
    form.setFieldsValue({ full_name: user.full_name, email: user.email, role: user.role });
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = (values: any) => {
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
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: t('user.role'), dataIndex: 'role', key: 'role', width: 130, align: 'center',
      render: (r: UserRole) => <Tag color={roleColors[r]} style={{ borderRadius: 8 }}>{roleLabels[r]}</Tag>,
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 8 }}>{v ? t('common.active') : t('common.disabled')}</Tag>,
    },
    {
      title: t('common.actions'), key: 'actions', width: 150, align: 'center',
      render: (_: unknown, record: AuthUser) => (
        <Space size={4}>
          <Tooltip title={t('common.edit')}>
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          {record.is_active && (
            <Popconfirm title={t('user.deactivateConfirm')} onConfirm={() => deactivateMutation.mutate(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
              <Tooltip title={t('common.delete')}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader
        title={t('menu.users')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ borderRadius: 8 }}>
            {t('user.addUser')}
          </Button>
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
          <Form.Item name="role" label={t('user.role')} rules={[{ required: true, message: t('user.roleRequired') }]}>
            <Select style={{ borderRadius: 8 }} options={[
              { label: t('user.roleStaff'), value: 'STAFF' },
              { label: t('user.roleViewer'), value: 'VIEWER' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagementPage;
