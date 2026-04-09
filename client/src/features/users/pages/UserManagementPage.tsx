import React, { useState } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Form, Input, Select, Popconfirm, Empty } from 'antd';
import { PlusOutlined, StopOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useUsers, useCreateUser, useDeactivateUser } from '@/features/auth/hooks';
import { PageHeader } from '@/components/common';
import { AuthUser, CreateUserInput, UserRole } from '@/types';

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [form] = Form.useForm();

  const { data, isLoading } = useUsers({ search, page, limit: pageSize });
  const createMutation = useCreateUser();
  const deactivateMutation = useDeactivateUser();

  const users: AuthUser[] = data?.data ?? [];
  const meta = data?.meta;

  const roleLabels: Record<UserRole, string> = { ADMIN: t('user.roleAdmin'), STAFF: t('user.roleStaff'), VIEWER: t('user.roleViewer') };
  const roleColors: Record<UserRole, string> = { ADMIN: 'red', STAFF: 'blue', VIEWER: 'default' };

  const columns: ColumnsType<AuthUser> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center', render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1 },
    { title: t('user.fullName'), dataIndex: 'full_name', key: 'full_name', ellipsis: true },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: t('user.role'), dataIndex: 'role', key: 'role', width: 120, align: 'center',
      render: (r: UserRole) => <Tag color={roleColors[r]} style={{ borderRadius: 8 }}>{roleLabels[r]}</Tag>,
    },
    {
      title: t('common.status'), dataIndex: 'is_active', key: 'is_active', width: 120, align: 'center',
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 8 }}>{v ? t('common.active') : t('common.disabled')}</Tag>,
    },
    {
      title: t('common.actions'), key: 'actions', width: 120, align: 'center',
      render: (_: unknown, record: AuthUser) => (
        <Space>
          {record.is_active && (
            <Popconfirm title={t('user.deactivateConfirm')} onConfirm={() => deactivateMutation.mutate(record.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
              <Button size="small" danger icon={<StopOutlined />} style={{ borderRadius: 8 }}>{t('common.disabled')}</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ borderRadius: 12, margin: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <PageHeader
        title={t('settings.userManagement')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ borderRadius: 8 }}>
            {t('user.addUser')}
          </Button>
        }
      />

      <Input
        placeholder={t('common.search')}
        prefix={<SearchOutlined />}
        allowClear
        style={{ marginBottom: 16, borderRadius: 8, maxWidth: 400 }}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      <Table<AuthUser>
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={isLoading}
        style={{ borderRadius: 12 }}
        pagination={{
          current: page,
          pageSize,
          total: meta?.total ?? users.length,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t('user.noUsers')} /> }}
      />

      <Modal open={modalOpen} title={t('user.addUser')} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText={t('common.create')} cancelText={t('common.cancel')} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v as CreateUserInput, { onSuccess: () => { setModalOpen(false); form.resetFields(); } })}>
          <Form.Item name="full_name" label={t('user.fullName')} rules={[{ required: true, message: t('user.fullNameRequired') }]}><Input style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: t('user.emailValidRequired') }]}><Input style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, min: 6, message: t('user.passwordMin') }]}><Input.Password style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="role" label={t('user.role')} rules={[{ required: true, message: t('user.roleRequired') }]}>
            <Select style={{ borderRadius: 8 }} options={[{ label: t('user.roleAdmin'), value: 'ADMIN' }, { label: t('user.roleStaff'), value: 'STAFF' }, { label: t('user.roleViewer'), value: 'VIEWER' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default UserManagementPage;
