import React, { useState } from 'react';
import {
  Tabs, Card, Form, Input, Button, Table, Tag, Space, Modal, Select,
  Tree, Popconfirm, Row, Col, Spin, Empty, List,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, PhoneOutlined, MailOutlined,
  BankOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useUsers, useCreateUser, useDeactivateUser } from '@/features/auth/hooks';
import { useCostCategories, useCreateCostCategory } from '@/features/operating-costs/hooks';
import { productApi } from '@/features/products/api';
import { AuthUser, CreateUserInput, UserRole, OperatingCostCategory, Category } from '@/types';

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

/* ---- Company Info Tab ---- */
const CompanyInfoTab: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card style={cardStyle}>
      <Row gutter={[24, 16]}>
        <Col xs={24} md={12}>
          <Form layout="vertical" initialValues={{
            name: 'CÔNG TY TNHH TECHLA AI',
            address: 'Tầng 8, Tòa Licogi, số 164 Khuất Duy Tiến, Hà Nội',
            phone: '0868287651',
            email: 'admin@techlaai.com',
          }}>
            <Form.Item label={t('settings.companyName')} name="name">
              <Input prefix={<BankOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item label={t('settings.address')} name="address">
              <Input prefix={<EnvironmentOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item label={t('settings.phone')} name="phone">
              <Input prefix={<PhoneOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item label={t('settings.email')} name="email">
              <Input prefix={<MailOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
            <Button type="primary" style={{ borderRadius: 8 }}>{t('settings.saveInfo')}</Button>
          </Form>
        </Col>
        <Col xs={24} md={12}>
          <div style={{ textAlign: 'center', padding: 40, border: '2px dashed #d9d9d9', borderRadius: 12 }}>
            <BankOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
            <p style={{ marginTop: 12, color: '#8c8c8c' }}>{t('settings.companyLogo')}</p>
          </div>
        </Col>
      </Row>
    </Card>
  );
};

/* ---- User Management Tab ---- */
const UserManagementTab: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useUsers();

  const createMutation = useCreateUser();
  const deactivateMutation = useDeactivateUser();

  const roleLabels: Record<UserRole, string> = { ADMIN: t('user.roleAdmin'), STAFF: t('user.roleStaff'), VIEWER: t('user.roleViewer') };
  const roleColors: Record<UserRole, string> = { ADMIN: 'red', STAFF: 'blue', VIEWER: 'default' };

  const columns = [
    { title: t('user.fullName'), dataIndex: 'full_name', key: 'full_name' },
    { title: t('settings.email'), dataIndex: 'email', key: 'email' },
    { title: t('user.role'), dataIndex: 'role', key: 'role', render: (r: UserRole) => <Tag color={roleColors[r]} style={{ borderRadius: 8 }}>{roleLabels[r]}</Tag> },
    { title: t('common.status'), dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'default'} style={{ borderRadius: 8 }}>{v ? t('common.active') : t('common.disabled')}</Tag> },
    {
      title: t('common.actions'), key: 'actions',
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
    <>
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ borderRadius: 8 }}>{t('user.addUser')}</Button>
      </Row>
      {isLoading ? <Spin /> : (
        <Table dataSource={data?.data ?? []} columns={columns} rowKey="id" size="small" pagination={{ pageSize: 10 }} locale={{ emptyText: <Empty description={t('user.noUsers')} /> }} />
      )}
      <Modal open={modalOpen} title={t('user.addUser')} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} okText={t('common.create')} cancelText={t('common.cancel')} confirmLoading={createMutation.isPending} style={{ borderRadius: 12 }}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v as CreateUserInput, { onSuccess: () => { setModalOpen(false); form.resetFields(); } })}>
          <Form.Item name="full_name" label={t('user.fullName')} rules={[{ required: true, message: t('user.fullNameRequired') }]}><Input style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="email" label={t('settings.email')} rules={[{ required: true, type: 'email', message: t('user.emailValidRequired') }]}><Input style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, min: 6, message: t('user.passwordMin') }]}><Input.Password style={{ borderRadius: 8 }} /></Form.Item>
          <Form.Item name="role" label={t('user.role')} rules={[{ required: true, message: t('user.roleRequired') }]}>
            <Select style={{ borderRadius: 8 }} options={[{ label: t('user.roleAdmin'), value: 'ADMIN' }, { label: t('user.roleStaff'), value: 'STAFF' }, { label: t('user.roleViewer'), value: 'VIEWER' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

/* ---- Product Categories Tab ---- */
const ProductCategoriesTab: React.FC = () => {
  const { t } = useTranslation();
  const [newCat, setNewCat] = useState('');

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['product-categories'],
    queryFn: () => productApi.list({ type: 'categories' }).then((r) => r.data.data ?? []),
  });

  const toTreeData = (cats: Category[]): { title: string; key: string; children?: { title: string; key: string }[] }[] =>
    cats.map((c) => ({
      title: c.name,
      key: c.id,
      children: c.children ? toTreeData(c.children) : undefined,
    }));

  return (
    <Card style={cardStyle}>
      <Space style={{ marginBottom: 16 }}>
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('settings.newCategoryName')} style={{ borderRadius: 8, width: 240 }} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!newCat.trim()} style={{ borderRadius: 8 }}>{t('common.add')}</Button>
      </Space>
      {isLoading ? <Spin /> : (categories ?? []).length > 0 ? (
        <Tree treeData={toTreeData(categories!)} defaultExpandAll showLine blockNode />
      ) : (
        <Empty description={t('settings.noProductCategories')} />
      )}
    </Card>
  );
};

/* ---- Cost Categories Tab ---- */
const CostCategoriesTab: React.FC = () => {
  const { t } = useTranslation();
  const [newCat, setNewCat] = useState('');

  const { data: categoriesData, isLoading } = useCostCategories();
  const categories = (categoriesData?.data ?? []) as OperatingCostCategory[];

  const createMutation = useCreateCostCategory();

  return (
    <Card style={cardStyle}>
      <Space style={{ marginBottom: 16 }}>
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder={t('settings.newCostCategoryName')} style={{ borderRadius: 8, width: 240 }} onPressEnter={() => newCat.trim() && createMutation.mutate(newCat.trim(), { onSuccess: () => setNewCat('') })} />
        <Button type="primary" icon={<PlusOutlined />} loading={createMutation.isPending} disabled={!newCat.trim()} onClick={() => createMutation.mutate(newCat.trim(), { onSuccess: () => setNewCat('') })} style={{ borderRadius: 8 }}>{t('common.add')}</Button>
      </Space>
      {isLoading ? <Spin /> : (
        <List
          dataSource={categories ?? []}
          renderItem={(item) => (
            <List.Item actions={[<Button size="small" icon={<EditOutlined />} style={{ borderRadius: 8 }}>{t('common.edit')}</Button>]}>
              <List.Item.Meta title={item.name} description={item.is_active ? t('common.activeStatus') : t('common.inactiveStatus')} />
            </List.Item>
          )}
          locale={{ emptyText: <Empty description={t('settings.noCategories')} /> }}
        />
      )}
    </Card>
  );
};

/* ---- Main Settings Page ---- */
const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const tabItems = [
    { key: 'company', label: t('settings.companyInfo'), children: <CompanyInfoTab /> },
    { key: 'users', label: t('settings.userManagement'), children: <UserManagementTab /> },
    { key: 'product-cats', label: t('settings.productCategories'), children: <ProductCategoriesTab /> },
    { key: 'cost-cats', label: t('settings.costCategories'), children: <CostCategoriesTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20 }}>{t('settings.title')}</h2>
      <Tabs items={tabItems} defaultActiveKey="company" />
    </div>
  );
};

export default SettingsPage;
