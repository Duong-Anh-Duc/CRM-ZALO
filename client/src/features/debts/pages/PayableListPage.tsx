import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Typography, Space, Row, Col, Statistic, Select,
  DatePicker, Button, Input, Tooltip,
} from 'antd';
import {
  DollarOutlined, WarningOutlined, CalendarOutlined,
  DownloadOutlined, SearchOutlined, RobotOutlined, EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { usePayables, usePayableSummary } from '../hooks';
import { Payable, DebtSummary } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { PaymentModal, StatusTag, PageHeader } from '@/components/common';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

const PayableListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [supplier, setSupplier] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paymentTarget, setPaymentTarget] = useState<{ id: string; remaining: number } | null>(null);

  const debtStatusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('debtStatusLabels.UNPAID'), value: 'UNPAID' },
    { label: t('debtStatusLabels.PARTIAL'), value: 'PARTIAL' },
    { label: t('debtStatusLabels.PAID'), value: 'PAID' },
    { label: t('debtStatusLabels.OVERDUE'), value: 'OVERDUE' },
  ];

  const summaryQuery = usePayableSummary();

  const { data, isLoading } = usePayables({
    status: status || undefined,
    supplier_search: supplier || undefined,
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    page,
    limit: pageSize,
  });

  const list: Payable[] = data?.data ?? [];
  const meta = data?.meta;
  const summary = summaryQuery.data?.data as DebtSummary | undefined;

  const columns: ColumnsType<Payable> = [
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'invoice_number', width: 120, ellipsis: true },
    {
      title: t('supplier.name'),
      dataIndex: ['supplier', 'company_name'],
      key: 'supplier',
      ellipsis: true,
    },
    {
      title: t('order.orderCode'),
      dataIndex: ['purchase_order', 'order_code'],
      key: 'order_code',
      width: 130,
    },
    {
      title: t('debt.invoiceDate'),
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: t('debt.dueDate'),
      dataIndex: 'due_date',
      key: 'due_date',
      width: 130,
      render: (v: string) => formatDate(v),
    },
    {
      title: t('debt.originalAmount'),
      dataIndex: 'original_amount',
      key: 'original_amount',
      width: 140,
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: t('debt.paidShort'),
      dataIndex: 'paid_amount',
      key: 'paid_amount',
      width: 130,
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: t('debt.remaining'),
      dataIndex: 'remaining',
      key: 'remaining',
      width: 140,
      align: 'right',
      render: (v: number) => (
        <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>
          {formatVND(v)}
        </Text>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => <StatusTag status={val} type="debt" />,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      fixed: 'right' as const,
      render: (_: unknown, record: Payable) => (
        <Space size="small">
          {record.purchase_order?.id && (
            <Tooltip title={t('common.viewDetail')}>
              <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => navigate(`/purchase-orders/${record.purchase_order?.id}`)} />
            </Tooltip>
          )}
          {record.remaining > 0 && (
            <Tooltip title={t('common.recordPayment')}>
              <Button type="text" size="small" icon={<DollarOutlined />} style={{ color: '#52c41a' }} onClick={(e) => {
                e.stopPropagation();
                setPaymentTarget({ id: record.id, remaining: record.remaining });
              }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.totalPayable')}
              value={summary?.total_payable ?? 0}
              formatter={(v) => formatVND(v as number)}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.overdue')}
              value={summary?.overdue ?? 0}
              formatter={(v) => formatVND(v as number)}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic
              title={t('debt.dueThisWeek')}
              value={summary?.due_this_week ?? 0}
              formatter={(v) => formatVND(v as number)}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Table */}
      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('debt.payables')}
          extra={
            <Space>
              <Button
                icon={<RobotOutlined />}
                style={{
                  borderRadius: 8,
                  borderColor: '#d9d9d9',
                  background: '#f5f5f5',
                  opacity: 0.6,
                }}
                disabled
              >
                {t('debt.aiReconciliation')}
              </Button>
              <Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }}>
                {t('common.exportExcel')}
              </Button>
            </Space>
          }
        />

        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            value={status}
            options={debtStatusOptions}
            onChange={(val) => { setStatus(val); setPage(1); }}
            style={{ minWidth: 180 }}
            placeholder={t('common.status')}
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('debt.searchSupplier')}
            allowClear
            value={supplier}
            onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
            style={{ width: 220, borderRadius: 8 }}
          />
          <RangePicker
            format="DD/MM/YYYY"
            onChange={(dates) => { setDateRange(dates as any); setPage(1); }}
            style={{ borderRadius: 8 }}
            placeholder={[t('common.fromDate'), t('common.toDate')]}
          />
        </Space>

        <Table<Payable>
          rowKey="id"
          columns={columns}
          dataSource={list}
          loading={isLoading}
          style={{ borderRadius: 12 }}
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => t('debt.totalRecords', { count: total }),
          }}
        />
      </Card>

      {/* Payment Modal */}
      {paymentTarget && (
        <PaymentModal
          open
          type="payable"
          debtId={paymentTarget.id}
          maxAmount={paymentTarget.remaining}
          onClose={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
};

export default PayableListPage;
