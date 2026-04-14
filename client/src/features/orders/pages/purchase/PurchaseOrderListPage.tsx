import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Typography, Space, Card, Select, Tooltip, Dropdown, Input, DatePicker } from 'antd';
import { PlusOutlined, TruckOutlined, EyeOutlined, EditOutlined, SwapOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { usePurchaseOrders, useUpdatePurchaseOrderStatus } from '../../hooks';
import { PurchaseOrder, PurchaseOrderStatus } from '@/types';
import { formatVND, formatDate, purchaseStatusLabels } from '@/utils/format';
import { PageHeader, StatusTag } from '@/components/common';
import PurchaseOrderFormModal from '../../components/PurchaseOrderFormModal';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const PurchaseOrderListPage: React.FC = () => {
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
    { label: t('purchaseStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
    { label: t('purchaseStatusLabels.SHIPPING'), value: 'SHIPPING' },
    { label: t('purchaseStatusLabels.COMPLETED'), value: 'COMPLETED' },
  ];

  const { data, isLoading } = usePurchaseOrders({
    status: status || undefined,
    search: search || undefined,
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    page,
    limit: pageSize,
  });
  const statusMutation = useUpdatePurchaseOrderStatus();

  const NEXT_STATUS: Record<string, string[]> = {
    PENDING: ['NEW', 'CANCELLED'],
    NEW: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['COMPLETED'],
  };

  const orders: PurchaseOrder[] = data?.data ?? [];
  const meta = data?.meta;

  const columns: ColumnsType<PurchaseOrder> = [
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
      title: t('order.linkedSO'),
      key: 'sales_order',
      width: 150,
      render: (_: unknown, record: any) => record.sales_order?.order_code || '-',
      responsive: ['md'] as any,
    },
    {
      title: t('order.supplier'),
      dataIndex: ['supplier', 'company_name'],
      key: 'supplier',
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
      dataIndex: 'total',
      key: 'total',
      width: 160,
      align: 'right',
      render: (val: number) => formatVND(val),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: PurchaseOrderStatus) => <StatusTag status={val} type="purchase" />,
    },
    {
      title: t('order.expectedDelivery'),
      dataIndex: 'expected_delivery',
      key: 'expected_delivery',
      width: 160,
      responsive: ['md'],
      render: (val: string) => (
        <Space>
          <TruckOutlined style={{ color: '#1890ff' }} />
          <Text strong>{formatDate(val)}</Text>
        </Space>
      ),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: PurchaseOrder) => {
        const nextStatuses = NEXT_STATUS[record.status] ?? [];
        return (
          <Space size="small">
            <Tooltip title={t('common.viewDetail')}>
              <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => navigate(`/purchase-orders/${record.id}`)} />
            </Tooltip>
            {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
              <Tooltip title={t('common.edit')}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => navigate(`/purchase-orders/${record.id}?edit=1`)} />
              </Tooltip>
            )}
            {nextStatuses.length > 0 && (
              <Dropdown
                menu={{
                  items: nextStatuses.map((s) => ({
                    key: s,
                    label: purchaseStatusLabels[s],
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
        title={t('order.purchaseOrders')}
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

      <Table<PurchaseOrder>
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

      <PurchaseOrderFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={() => setCreateOpen(false)} />
    </Card>
  );
};

export default PurchaseOrderListPage;
