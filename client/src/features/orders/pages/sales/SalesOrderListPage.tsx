import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Card, Select, Space, Tooltip, Dropdown, Input, DatePicker, Row, Col, Statistic, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { PlusOutlined, EyeOutlined, EditOutlined, SwapOutlined, SearchOutlined, ShoppingCartOutlined, CheckCircleOutlined, DollarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSalesOrders, useUpdateSalesOrderStatus } from '../../hooks';
import { usePermission } from '@/contexts/AbilityContext';
import { SalesOrder, SalesOrderStatus } from '@/types';
import { formatVND, formatDate, salesStatusLabels } from '@/utils/format';
import { PageHeader, StatusTag } from '@/components/common';

const { RangePicker } = DatePicker;
const PIE_COLORS = ['#8c8c8c', '#1890ff', '#fa8c16', '#52c41a', '#ff4d4f'];

const SalesOrderListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canCreate = usePermission('sales_order.create');
  const canUpdate = usePermission('sales_order.update');
  const canManageStatus = usePermission('sales_order.manage_status');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('salesStatusLabels.DRAFT'), value: 'DRAFT' },
    { label: t('salesStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
    { label: t('salesStatusLabels.SHIPPING'), value: 'SHIPPING' },
    { label: t('salesStatusLabels.COMPLETED'), value: 'COMPLETED' },
    { label: t('salesStatusLabels.CANCELLED'), value: 'CANCELLED' },
  ];

  const { data, isLoading } = useSalesOrders({
    status: status || undefined,
    search: search || undefined,
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    page, limit: pageSize,
  });
  // Also fetch all for summary (no pagination)
  const { data: allData } = useSalesOrders({
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    limit: 500,
  });
  const statusMutation = useUpdateSalesOrderStatus();

  const orders: SalesOrder[] = data?.data ?? [];
  const meta = data?.meta;
  const allOrders: any[] = allData?.data ?? [];

  // Summary computed from all orders
  const summary = useMemo(() => {
    const totalValue = allOrders.reduce((s, o) => s + Number(o.grand_total || 0), 0);
    const completed = allOrders.filter((o) => o.status === 'COMPLETED').length;
    const shipping = allOrders.filter((o) => o.status === 'SHIPPING').length;
    return { total: allOrders.length, totalValue, completed, shipping };
  }, [allOrders]);

  // Chart: orders by status
  const chartData = useMemo(() => {
    const map: Record<string, number> = {};
    allOrders.forEach((o) => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([k, v]) => ({ name: salesStatusLabels[k] || k, value: v })).filter(d => d.value > 0);
  }, [allOrders]);

  const NEXT_STATUS: Record<string, string[]> = {
    DRAFT: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['COMPLETED'],
  };

  const columns: ColumnsType<SalesOrder> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1 },
    { title: t('order.orderCode'), dataIndex: 'order_code', key: 'order_code', width: 150 },
    { title: t('order.customer'), key: 'customer', ellipsis: true, render: (_: unknown, record: any) => record.customer?.company_name || record.customer?.contact_name || '-' },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'order_date', width: 120, responsive: ['md'], render: (val: string) => formatDate(val) },
    { title: t('order.grandTotal'), dataIndex: 'grand_total', key: 'grand_total', width: 160, align: 'right', render: (val: number) => formatVND(val) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 140, responsive: ['lg'] as any, render: (val: SalesOrderStatus) => <StatusTag status={val} type="sales" /> },
    { title: t('order.expectedDelivery'), dataIndex: 'expected_delivery', key: 'expected_delivery', width: 160, responsive: ['md'], render: (val: string) => formatDate(val) },
    {
      title: t('common.actions'), key: 'actions', width: 100, fixed: 'right' as const,
      render: (_: unknown, record: SalesOrder) => {
        const nextStatuses = NEXT_STATUS[record.status] ?? [];
        return (
          <Space size="small">
            <Tooltip title={t('common.viewDetail')}><Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => navigate(`/sales-orders/${record.id}`)} /></Tooltip>
            {canUpdate && record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
              <Tooltip title={t('common.edit')}><Button type="text" size="small" icon={<EditOutlined />} onClick={() => navigate(`/sales-orders/${record.id}?edit=1`)} /></Tooltip>
            )}
            {canManageStatus && nextStatuses.length > 0 && (
              <Dropdown menu={{ items: nextStatuses.map((s) => ({ key: s, label: salesStatusLabels[s], danger: s === 'CANCELLED' })), onClick: ({ key }) => {
                Modal.confirm({
                  title: t('order.confirmStatusChange'),
                  icon: <ExclamationCircleOutlined />,
                  content: `${record.order_code}: ${salesStatusLabels[record.status]} → ${salesStatusLabels[key]}`,
                  okText: t('common.confirm'),
                  cancelText: t('common.cancel'),
                  okButtonProps: { danger: key === 'CANCELLED' },
                  onOk: () => statusMutation.mutate({ id: record.id, status: key }),
                });
              }}} trigger={['click']}>
                <Tooltip title={t('common.changeStatus')}><Button type="text" size="small" icon={<SwapOutlined />} style={{ color: '#52c41a' }} /></Tooltip>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader title={t('order.salesOrders')} extra={
        canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => navigate('/sales-orders/create')}>{t('order.createOrder')}</Button>
        ) : undefined
      } />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('order.orderCount')} value={summary.total} prefix={<ShoppingCartOutlined />} valueStyle={{ color: '#1890ff', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('order.grandTotal')} value={summary.totalValue} formatter={(v) => formatVND(v as number)} prefix={<DollarOutlined />} valueStyle={{ color: '#fa541c', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('salesStatusLabels.COMPLETED')} value={summary.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a', fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('salesStatusLabels.SHIPPING')} value={summary.shipping} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#fa8c16', fontSize: 18 }} /></Card></Col>
      </Row>

      {chartData.length > 1 && (
        <Card size="small" title={t('dashboard.ordersByStatus')} style={{ borderRadius: 12, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={50} outerRadius={90}
                label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`} labelLine={{ stroke: '#ccc', strokeWidth: 1 }}>
                {chartData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <RTooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input prefix={<SearchOutlined />} placeholder={t('order.searchPlaceholder')} allowClear value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 360, flex: '1 1 200px', borderRadius: 8 }} />
        <Select popupMatchSelectWidth={false} value={status} options={statusOptions} onChange={(val) => { setStatus(val); setPage(1); }} style={{ maxWidth: 220, flex: '1 1 160px' }} />
        <RangePicker format="DD/MM/YYYY" onChange={(dates) => { setDateRange(dates as any); setPage(1); }}
          style={{ borderRadius: 8 }} placeholder={[t('common.fromDate'), t('common.toDate')]} />
      </Space>

      <Table<SalesOrder> rowKey="id" columns={columns} dataSource={orders} loading={isLoading}
        style={{ borderRadius: 12 }} scroll={{ x: 'max-content' }}
        pagination={{ current: page, pageSize, total: meta?.total ?? 0, onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"], showTotal: (total) => t('order.totalOrders', { count: total }) }}
      />
    </Card>
  );
};

export default SalesOrderListPage;
