import React, { useState } from 'react';
import { Card, Tabs, Table, Button, Input, Select, Space, Empty, Tooltip, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { useSalesReturns, usePurchaseReturns, useDeleteSalesReturn, useDeletePurchaseReturn } from '../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag, PageHeader } from '@/components/common';
import SalesReturnFormModal from '../components/SalesReturnFormModal';
import PurchaseReturnFormModal from '../components/PurchaseReturnFormModal';
import ReturnDetailModal from '../components/ReturnDetailModal';

const statusOptions = [
  { value: 'PENDING', labelKey: 'returnStatusLabels.PENDING' },
  { value: 'APPROVED', labelKey: 'returnStatusLabels.APPROVED' },
  { value: 'RECEIVING', labelKey: 'returnStatusLabels.RECEIVING' },
  { value: 'SHIPPING', labelKey: 'returnStatusLabels.SHIPPING' },
  { value: 'COMPLETED', labelKey: 'returnStatusLabels.COMPLETED' },
  { value: 'REJECTED', labelKey: 'returnStatusLabels.REJECTED' },
  { value: 'CANCELLED', labelKey: 'returnStatusLabels.CANCELLED' },
];

const SalesReturnTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('ADMIN', 'STAFF');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | undefined>();
  const deleteMutation = useDeleteSalesReturn();

  const { data, isLoading, refetch } = useSalesReturns({ search, status, page, limit: pageSize });
  const list = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('return.returnCode'), dataIndex: 'return_code', key: 'code', width: 160 },
    {
      title: t('customer.name'), key: 'customer', ellipsis: true,
      render: (_: any, rec: any) => rec.customer?.company_name || rec.customer?.contact_name || '-',
    },
    {
      title: t('order.orderCode'), key: 'order', width: 170, responsive: ['md'] as any,
      render: (_: any, rec: any) => rec.sales_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${rec.sales_order.id}`)}>{rec.sales_order.order_code}</Button> : '-',
    },
    { title: t('return.returnDate'), dataIndex: 'return_date', key: 'date', width: 110, render: formatDate },
    { title: t('return.totalAmount'), dataIndex: 'total_amount', key: 'amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('product.status'), key: 'status', width: 140,
      render: (_: any, rec: any) => <StatusTag status={rec.status} type="return" />,
    },
    {
      title: t('common.actions'), key: 'actions', width: 90, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setDetailId(rec.id)} />
          </Tooltip>
          {canManage && (rec.status === 'PENDING' || rec.status === 'REJECTED') && (
            <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => deleteMutation.mutate(rec.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
              <Tooltip title={t('common.deleteRecord')}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input placeholder={t('return.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select placeholder={t('debt.filterStatus')} allowClear style={{ width: 170, borderRadius: 8 }} value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Space>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setFormOpen(true)}>
            {t('return.createSalesReturn')}
          </Button>
        )}
      </Space>

      <Table
        dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
      />

      <SalesReturnFormModal open={formOpen} onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); refetch(); }} />
      <ReturnDetailModal open={!!detailId} returnId={detailId} type="sales" onClose={() => { setDetailId(undefined); refetch(); }} />
    </>
  );
};

const PurchaseReturnTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('ADMIN', 'STAFF');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | undefined>();
  const deleteMutation = useDeletePurchaseReturn();

  const { data, isLoading, refetch } = usePurchaseReturns({ search, status, page, limit: pageSize });
  const list = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('return.returnCode'), dataIndex: 'return_code', key: 'code', width: 160 },
    {
      title: t('supplier.name'), key: 'supplier', ellipsis: true,
      render: (_: any, rec: any) => rec.supplier?.company_name || '-',
    },
    {
      title: t('order.orderCode'), key: 'order', width: 170, responsive: ['md'] as any,
      render: (_: any, rec: any) => rec.purchase_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${rec.purchase_order.id}`)}>{rec.purchase_order.order_code}</Button> : '-',
    },
    { title: t('return.returnDate'), dataIndex: 'return_date', key: 'date', width: 110, render: formatDate },
    { title: t('return.totalAmount'), dataIndex: 'total_amount', key: 'amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('product.status'), key: 'status', width: 140,
      render: (_: any, rec: any) => <StatusTag status={rec.status} type="return" />,
    },
    {
      title: t('common.actions'), key: 'actions', width: 90, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setDetailId(rec.id)} />
          </Tooltip>
          {canManage && (rec.status === 'PENDING' || rec.status === 'REJECTED') && (
            <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => deleteMutation.mutate(rec.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
              <Tooltip title={t('common.deleteRecord')}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input placeholder={t('return.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select placeholder={t('debt.filterStatus')} allowClear style={{ width: 170, borderRadius: 8 }} value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Space>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setFormOpen(true)}>
            {t('return.createPurchaseReturn')}
          </Button>
        )}
      </Space>

      <Table
        dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading}
        scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
      />

      <PurchaseReturnFormModal open={formOpen} onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); refetch(); }} />
      <ReturnDetailModal open={!!detailId} returnId={detailId} type="purchase" onClose={() => { setDetailId(undefined); refetch(); }} />
    </>
  );
};

const ReturnListPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader title={t('return.title')} />
      <Tabs
        items={[
          { key: 'sales', label: t('return.salesReturns'), children: <SalesReturnTab /> },
          { key: 'purchase', label: t('return.purchaseReturns'), children: <PurchaseReturnTab /> },
        ]}
      />
    </Card>
  );
};

export default ReturnListPage;
