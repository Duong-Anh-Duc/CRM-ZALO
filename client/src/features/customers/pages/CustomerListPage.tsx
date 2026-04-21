import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Table, Tag, Card, Space, Tooltip, Popconfirm, Tabs, Modal } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { useCustomers, useDeleteCustomer } from '../hooks';
import apiClient from '@/lib/api-client';
import { usePermission } from '@/contexts/AbilityContext';
import { Customer } from '@/types';
import { formatVND, formatDate, customerTypeLabels } from '@/utils/format';
import { PageHeader } from '@/components/common';
import CustomerFormModal from '../components/CustomerFormModal';

const CustomerListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = usePermission('customer.create');
  const canUpdate = usePermission('customer.update');
  const canDelete = usePermission('customer.delete');
  const canApprove = usePermission('customer.approve');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>(undefined);

  const { data, isLoading, refetch } = useCustomers({
    search, page, limit: pageSize,
    ...(typeFilter === 'PENDING' ? { approval_status: 'PENDING' } : {}),
    ...(typeFilter !== 'ALL' && typeFilter !== 'PENDING' ? { customer_type: typeFilter } : {}),
  });
  const deleteMutation = useDeleteCustomer();

  const customers: Customer[] = data?.data ?? [];
  const meta = data?.meta;

  // Counts per type
  const { data: countAll } = useQuery({ queryKey: ['customers-count-all'], queryFn: () => apiClient.get('/customers', { params: { limit: 1 } }).then(r => r.data.meta?.total ?? 0) });
  const { data: countIndividual } = useQuery({ queryKey: ['customers-count-individual'], queryFn: () => apiClient.get('/customers', { params: { limit: 1, customer_type: 'INDIVIDUAL' } }).then(r => r.data.meta?.total ?? 0) });
  const { data: countBusiness } = useQuery({ queryKey: ['customers-count-business'], queryFn: () => apiClient.get('/customers', { params: { limit: 1, customer_type: 'BUSINESS' } }).then(r => r.data.meta?.total ?? 0) });
  const { data: countPending } = useQuery({ queryKey: ['customers-count-pending'], queryFn: () => apiClient.get('/customers', { params: { limit: 1, approval_status: 'PENDING' } }).then(r => r.data.meta?.total ?? 0) });

  const columns: ColumnsType<Customer> = [
    {
      title: 'STT', key: 'stt', width: 50, align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('customer.name'), key: 'name', ellipsis: true,
      render: (_: unknown, record: any) => record.company_name || record.contact_name || '-',
    },
    {
      title: t('customer.customerTypeShort'), dataIndex: 'customer_type', key: 'type', width: 110, responsive: ['md'] as any,
      render: (type: string) => (
        <Tag color={type === 'INDIVIDUAL' ? 'blue' : 'purple'} style={{ borderRadius: 8 }}>
          {customerTypeLabels[type] ?? type}
        </Tag>
      ),
    },
    {
      title: t('customer.contactName'), dataIndex: 'contact_name', key: 'contact', ellipsis: true, responsive: ['md'] as any,
    },
    {
      title: t('customer.phoneShort'), dataIndex: 'phone', key: 'phone', width: 120, responsive: ['md'] as any,
    },
    {
      title: t('customer.totalReceivable'), dataIndex: 'total_receivable', key: 'receivable', width: 140, responsive: ['lg'] as any, align: 'right',
      render: (val: number) => formatVND(val),
    },
    {
      title: t('customer.overdue'), dataIndex: 'overdue_amount', key: 'overdue', width: 140, responsive: ['lg'] as any, align: 'right',
      render: (val: number) => <span style={{ color: val ? '#ff4d4f' : undefined, fontWeight: val ? 600 : 400 }}>{formatVND(val)}</span>,
    },
    {
      title: t('customer.lastOrderDate'), dataIndex: 'last_order_date', key: 'last_order', width: 120, responsive: ['lg'] as any,
      render: (val: string) => formatDate(val),
    },
    {
      title: t('common.actions'), key: 'actions', width: 110, fixed: 'right' as const,
      render: (_: unknown, record: any) => (
        <Space size="small">
          {canApprove && record.approval_status === 'PENDING' && (
            <Tooltip title={t('customer.approve')}>
              <Button type="text" size="small" icon={<CheckOutlined />} style={{ color: '#52c41a' }}
                onClick={() => {
                  Modal.confirm({
                    title: t('customer.approveConfirm'),
                    content: record.company_name || record.contact_name,
                    okText: t('common.confirm'), cancelText: t('common.cancel'),
                    onOk: async () => { await apiClient.patch(`/customers/${record.id}/approve`); refetch(); },
                  });
                }} />
            </Tooltip>
          )}
          <Tooltip title={t('common.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => navigate(`/customers/${record.id}`)} />
          </Tooltip>
          {canUpdate && (
            <Tooltip title={t('common.editRecord')}>
              <Button type="text" size="small" icon={<EditOutlined />} style={{ color: '#faad14' }} onClick={() => { setEditCustomer(record); setModalOpen(true); }} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => deleteMutation.mutate(record.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
              <Tooltip title={t('common.deleteRecord')}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const handleTabChange = (key: string) => {
    setTypeFilter(key);
    setPage(1);
  };

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('customer.title')}
          extra={
            canCreate ? (
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setModalOpen(true)}>
                {t('customer.addCustomer')}
              </Button>
            ) : undefined
          }
        />

        <Tabs
          activeKey={typeFilter}
          onChange={handleTabChange}
          items={[
            { key: 'ALL', label: `${t('common.all')} (${countAll ?? 0})` },
            { key: 'INDIVIDUAL', label: `${t('customerTypeLabels.INDIVIDUAL')} (${countIndividual ?? 0})` },
            { key: 'BUSINESS', label: `${t('customerTypeLabels.BUSINESS')} (${countBusiness ?? 0})` },
            { key: 'PENDING', label: `${t('customer.pendingApproval')} (${countPending ?? 0})` },
          ]}
          style={{ marginBottom: 4 }}
        />

        <Input
          placeholder={t('customer.searchPlaceholder')}
          prefix={<SearchOutlined />}
          allowClear
          style={{ marginBottom: 16, borderRadius: 8, maxWidth: 400 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />

        <Table<Customer>
          rowKey="id"
          columns={columns}
          dataSource={customers}
          loading={isLoading}
          size="small"
          pagination={{
            current: page, pageSize, total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => t('customer.totalCustomers', { count: total }),
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <CustomerFormModal
        open={modalOpen}
        customer={editCustomer}
        onClose={() => { setModalOpen(false); setEditCustomer(undefined); }}
        onSuccess={() => { setModalOpen(false); setEditCustomer(undefined); refetch(); }}
      />
    </>
  );
};

export default CustomerListPage;
