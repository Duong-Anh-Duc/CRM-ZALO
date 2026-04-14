import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Typography, Space, Row, Col, Statistic, Select,
  Button, Input, Tooltip, Tag,
} from 'antd';
import {
  DollarOutlined, WarningOutlined, CalendarOutlined,
  SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useReceivablesByCustomer, useReceivableSummary } from '../hooks';
import { formatVND } from '@/utils/format';
import { PageHeader } from '@/components/common';

const { Text } = Typography;

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

const ReceivableListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('OUTSTANDING');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const statusOptions = [
    { label: t('debt.outstanding'), value: 'OUTSTANDING' },
    { label: t('common.all'), value: 'ALL' },
    { label: t('debtStatusLabels.PAID'), value: 'PAID' },
    { label: t('debtStatusLabels.OVERDUE'), value: 'OVERDUE' },
  ];

  const summaryQuery = useReceivableSummary();
  const { data, isLoading } = useReceivablesByCustomer({
    status: status || undefined,
    search: search || undefined,
    page,
    limit: pageSize,
  });

  const list: any[] = data?.data ?? [];
  const meta = data?.meta;
  const summary = summaryQuery.data?.data as any;

  const columns: ColumnsType<any> = [
    {
      title: 'STT', key: 'stt', width: 60, align: 'center' as const,
      render: (_: unknown, __: unknown, i: number) => (page - 1) * pageSize + i + 1,
    },
    {
      title: t('customer.companyName'), key: 'customer', ellipsis: true,
      render: (_: unknown, r: any) => <Text strong>{r.customer?.company_name || r.customer?.contact_name}</Text>,
    },
    {
      title: t('debt.invoiceCount'), key: 'count', width: 100, align: 'center' as const,
      render: (_: unknown, r: any) => <Tag style={{ borderRadius: 6 }}>{r.invoice_count} {t('debt.invoices')}</Tag>,
    },
    {
      title: t('debt.totalDebt'), key: 'total', width: 160, align: 'right' as const,
      render: (_: unknown, r: any) => formatVND(r.total_original),
    },
    {
      title: t('debt.totalPaid'), key: 'paid', width: 140, align: 'right' as const,
      render: (_: unknown, r: any) => formatVND(r.total_paid),
    },
    {
      title: t('debt.remaining'), key: 'remaining', width: 160, align: 'right' as const,
      render: (_: unknown, r: any) => (
        <Text strong style={{ color: r.total_remaining > 0 ? '#cf1322' : '#52c41a' }}>
          {formatVND(r.total_remaining)}
        </Text>
      ),
    },
    {
      title: t('debt.overdueCount'), key: 'overdue', width: 100, align: 'center' as const,
      render: (_: unknown, r: any) => r.overdue_count > 0
        ? <Tag color="red" style={{ borderRadius: 6 }}>{r.overdue_count}</Tag>
        : <Text type="secondary">0</Text>,
    },
    {
      title: t('common.actions'), key: 'actions', width: 80, fixed: 'right' as const, align: 'center' as const,
      render: (_: unknown, r: any) => (
        <Tooltip title={t('common.viewDetail')}>
          <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }}
            onClick={() => navigate(`/receivables/customer/${r.customer_id}`)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('debt.totalReceivable')} value={summary?.total_receivable ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<DollarOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('debt.overdue')} value={summary?.overdue ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<WarningOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('debt.dueThisWeek')} value={summary?.due_this_week ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<CalendarOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <PageHeader title={t('debt.receivables')} />

        <Space wrap style={{ marginBottom: 16 }}>
          <Select value={status} options={statusOptions}
            onChange={(val) => { setStatus(val); setPage(1); }} style={{ minWidth: 160 }} />
          <Input prefix={<SearchOutlined />} placeholder={t('debt.searchCustomer')} allowClear
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 220, borderRadius: 8 }} />
        </Space>

        <Table rowKey="customer_id" columns={columns} dataSource={list} loading={isLoading}
          style={{ borderRadius: 12 }} scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onClick: () => navigate(`/receivables/customer/${r.customer_id}`), style: { cursor: 'pointer' } })}
          pagination={{
            current: page, pageSize, total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, showTotal: (total) => `${total} ${t('debt.customers')}`,
          }}
        />
      </Card>
    </div>
  );
};

export default ReceivableListPage;
