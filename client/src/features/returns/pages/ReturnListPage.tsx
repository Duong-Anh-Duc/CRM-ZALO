import React, { useState, useMemo } from 'react';
import { Card, Tabs, Table, Button, Input, Select, Space, Empty, Tooltip, Popconfirm, Row, Col, Statistic } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, RollbackOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '@/contexts/AbilityContext';
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

const cardSm: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

const SalesReturnTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = usePermission('return.create');
  const canDelete = usePermission('return.delete');
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

  // Summary from all (fetch without pagination for stats)
  const { data: allData } = useSalesReturns({ limit: 500 });
  const allList: any[] = allData?.data ?? [];
  const summary = useMemo(() => ({
    total: allList.length,
    totalAmount: allList.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
    completed: allList.filter((r: any) => r.status === 'COMPLETED').length,
    pending: allList.filter((r: any) => r.status === 'PENDING').length,
  }), [allList]);

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('return.returnCode'), dataIndex: 'return_code', key: 'code', width: 160 },
    { title: t('customer.name'), key: 'customer', ellipsis: true, render: (_: any, rec: any) => rec.customer?.company_name || rec.customer?.contact_name || '-' },
    { title: t('order.orderCode'), key: 'order', width: 170, responsive: ['md'] as any, render: (_: any, rec: any) => rec.sales_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${rec.sales_order.id}`)}>{rec.sales_order.order_code}</Button> : '-' },
    { title: t('return.returnDate'), dataIndex: 'return_date', key: 'date', width: 110, responsive: ['lg'] as any, render: formatDate },
    { title: t('return.totalAmount'), dataIndex: 'total_amount', key: 'amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('product.status'), key: 'status', width: 140, responsive: ['lg'] as any, render: (_: any, rec: any) => <StatusTag status={rec.status} type="return" /> },
    {
      title: t('common.actions'), key: 'actions', width: 90, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}><Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setDetailId(rec.id)} /></Tooltip>
          {canDelete && (rec.status === 'PENDING' || rec.status === 'REJECTED') && (
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
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('return.totalReturns')} value={summary.total} prefix={<RollbackOutlined />} valueStyle={{ color: '#1890ff', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('return.totalAmount')} value={summary.totalAmount} formatter={(v) => formatVND(v as number)} prefix={<DollarOutlined />} valueStyle={{ color: '#fa541c', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('returnStatusLabels.COMPLETED')} value={summary.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('returnStatusLabels.PENDING')} value={summary.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16', fontSize: 18 }} /></Card></Col>
      </Row>

      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input placeholder={t('return.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ maxWidth: 240, flex: '1 1 180px', borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select placeholder={t('debt.filterStatus')} allowClear style={{ maxWidth: 180, flex: '1 1 140px', borderRadius: 8 }} value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Space>
        {canCreate && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setFormOpen(true)}>{t('return.createSalesReturn')}</Button>}
      </Space>

      <Table dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading} scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }} />

      <SalesReturnFormModal open={formOpen} onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); refetch(); }} />
      <ReturnDetailModal open={!!detailId} returnId={detailId} type="sales" onClose={() => { setDetailId(undefined); refetch(); }} />
    </>
  );
};

const PurchaseReturnTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = usePermission('return.create');
  const canDelete = usePermission('return.delete');
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

  const { data: allData } = usePurchaseReturns({ limit: 500 });
  const allList: any[] = allData?.data ?? [];
  const summary = useMemo(() => ({
    total: allList.length,
    totalAmount: allList.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0),
    completed: allList.filter((r: any) => r.status === 'COMPLETED').length,
    pending: allList.filter((r: any) => r.status === 'PENDING').length,
  }), [allList]);

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('return.returnCode'), dataIndex: 'return_code', key: 'code', width: 160 },
    { title: t('supplier.name'), key: 'supplier', ellipsis: true, render: (_: any, rec: any) => rec.supplier?.company_name || '-' },
    { title: t('order.orderCode'), key: 'order', width: 170, responsive: ['md'] as any, render: (_: any, rec: any) => rec.purchase_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${rec.purchase_order.id}`)}>{rec.purchase_order.order_code}</Button> : '-' },
    { title: t('return.returnDate'), dataIndex: 'return_date', key: 'date', width: 110, responsive: ['lg'] as any, render: formatDate },
    { title: t('return.totalAmount'), dataIndex: 'total_amount', key: 'amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('product.status'), key: 'status', width: 140, responsive: ['lg'] as any, render: (_: any, rec: any) => <StatusTag status={rec.status} type="return" /> },
    {
      title: t('common.actions'), key: 'actions', width: 90, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          <Tooltip title={t('common.viewDetail')}><Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setDetailId(rec.id)} /></Tooltip>
          {canDelete && (rec.status === 'PENDING' || rec.status === 'REJECTED') && (
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
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('return.totalReturns')} value={summary.total} prefix={<RollbackOutlined />} valueStyle={{ color: '#1890ff', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('return.totalAmount')} value={summary.totalAmount} formatter={(v) => formatVND(v as number)} prefix={<DollarOutlined />} valueStyle={{ color: '#fa541c', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('returnStatusLabels.COMPLETED')} value={summary.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={cardSm}><Statistic title={t('returnStatusLabels.PENDING')} value={summary.pending} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16', fontSize: 18 }} /></Card></Col>
      </Row>

      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input placeholder={t('return.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ maxWidth: 240, flex: '1 1 180px', borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select placeholder={t('debt.filterStatus')} allowClear style={{ maxWidth: 180, flex: '1 1 140px', borderRadius: 8 }} value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={statusOptions.map((o) => ({ value: o.value, label: t(o.labelKey) }))} />
        </Space>
        {canCreate && <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setFormOpen(true)}>{t('return.createPurchaseReturn')}</Button>}
      </Space>

      <Table dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading} scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }} />

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
      <Tabs items={[
        { key: 'sales', label: t('return.salesReturns'), children: <SalesReturnTab /> },
        { key: 'purchase', label: t('return.purchaseReturns'), children: <PurchaseReturnTab /> },
      ]} />
    </Card>
  );
};

export default ReturnListPage;
