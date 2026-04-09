import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Card, Select, Space, Tooltip, Dropdown, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, SwapOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSalesOrders, useUpdateSalesOrderStatus } from '../../hooks';
import { SalesOrder, SalesOrderStatus } from '@/types';
import { formatVND, formatDate, salesStatusLabels } from '@/utils/format';
import { PageHeader, StatusTag } from '@/components/common';
import SalesOrderFormModal from '../../components/SalesOrderFormModal';

const { RangePicker } = DatePicker;

const SalesOrderListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('salesStatusLabels.NEW'), value: 'NEW' },
    { label: t('salesStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
    { label: t('salesStatusLabels.PREPARING'), value: 'PREPARING' },
    { label: t('salesStatusLabels.SHIPPING'), value: 'SHIPPING' },
    { label: t('salesStatusLabels.COMPLETED'), value: 'COMPLETED' },
    { label: t('salesStatusLabels.CANCELLED'), value: 'CANCELLED' },
  ];

  const { data, isLoading } = useSalesOrders({
    status: status || undefined,
    search: search || undefined,
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    page,
    limit: pageSize,
  });
  const statusMutation = useUpdateSalesOrderStatus();

  const NEXT_STATUS: Record<string, string[]> = {
    NEW: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['COMPLETED'],
  };

  const orders: SalesOrder[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnsType<SalesOrder> = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: unknown, index: number) => (page - 1) * pageSize + index + 1,
    },
    {
      title: t('order.orderCode'),
      dataIndex: 'order_code',
      key: 'order_code',
      width: 150,
    },
    {
      title: t('order.customer'),
      dataIndex: ['customer', 'company_name'],
      key: 'customer',
      ellipsis: true,
    },
    {
      title: t('order.orderDate'),
      dataIndex: 'order_date',
      key: 'order_date',
      width: 120,
      responsive: ['md'],
      render: (val: string) => formatDate(val),
    },
    {
      title: t('order.grandTotal'),
      dataIndex: 'grand_total',
      key: 'grand_total',
      width: 160,
      align: 'right',
      render: (val: number) => formatVND(val),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: SalesOrderStatus) => <StatusTag status={val} type="sales" />,
    },
    {
      title: t('order.expectedDelivery'),
      dataIndex: 'expected_delivery',
      key: 'expected_delivery',
      width: 140,
      responsive: ['md'],
      render: (val: string) => formatDate(val),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: SalesOrder) => {
        const nextStatuses = NEXT_STATUS[record.status] ?? [];
        return (
          <Space size="small">
            <Tooltip title={t('common.viewDetail')}>
              <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => navigate(`/sales-orders/${record.id}`)} />
            </Tooltip>
            {nextStatuses.length > 0 && (
              <Dropdown
                menu={{
                  items: nextStatuses.map((s) => ({
                    key: s,
                    label: salesStatusLabels[s],
                    danger: s === 'CANCELLED',
                  })),
                  onClick: ({ key }) => statusMutation.mutate({ id: record.id, status: key }),
                }}
                trigger={['click']}
              >
                <Tooltip title={t('common.changeStatus')}>
                  <Button type="text" size="small" icon={<SwapOutlined />} style={{ color: '#52c41a' }} />
                </Tooltip>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card style={{ borderRadius: 12 }}>
      <PageHeader
        title={t('order.salesOrders')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ borderRadius: 8 }}
            onClick={() => setCreateOpen(true)}
          >
            {t('order.createOrder')}
          </Button>
        }
      />

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t('order.searchPlaceholder')}
          allowClear
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ width: '100%', maxWidth: 400, borderRadius: 8 }}
        />
        <Select
          value={status}
          options={statusOptions}
          onChange={(val) => { setStatus(val); setPage(1); }}
          style={{ minWidth: 180 }}
          placeholder={t('order.filterByStatus')}
        />
        <RangePicker
          format="DD/MM/YYYY"
          onChange={(dates) => { setDateRange(dates as any); setPage(1); }}
          style={{ borderRadius: 8 }}
          placeholder={[t('common.fromDate'), t('common.toDate')]}
        />
      </Space>

      <Table<SalesOrder>
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={isLoading}
        style={{ borderRadius: 12 }}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: meta?.total ?? 0,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (total) => t('order.totalOrders', { count: total }),
        }}
      />

      <SalesOrderFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => setCreateOpen(false)} />
    </Card>
  );
};

export default SalesOrderListPage;
