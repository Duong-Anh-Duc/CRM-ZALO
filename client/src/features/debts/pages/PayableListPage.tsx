import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Typography, Space, Row, Col, Statistic, Select,
  Button, Input, Tooltip, Tag, Empty, DatePicker,
} from 'antd';
import {
  DollarOutlined, FileTextOutlined, ShopOutlined, CheckCircleOutlined,
  SearchOutlined, EyeOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { usePayablesBySupplier } from '../hooks';
import { formatVND } from '@/utils/format';

const { Text } = Typography;
const PIE_COLORS = ['#ff4d4f', '#fa8c16', '#1890ff', '#52c41a', '#722ed1', '#13c2c2', '#eb2f96', '#2f54eb'];

function getDateRange(period: string) {
  const now = dayjs();
  switch (period) {
    case 'thisMonth': return { from_date: now.startOf('month').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') };
    case 'thisQuarter': { const qm = Math.floor(now.month() / 3) * 3; return { from_date: now.month(qm).startOf('month').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') }; }
    case 'thisYear': return { from_date: now.startOf('year').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') };
    default: return {};
  }
}

const PayableListPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('OUTSTANDING');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('thisMonth');
  const [customRange, setCustomRange] = useState<[any, any] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const statusOptions = [
    { label: t('debt.outstanding'), value: 'OUTSTANDING' },
    { label: t('common.all'), value: 'ALL' },
    { label: t('debtStatusLabels.PAID'), value: 'PAID' },
  ];

  const dateRange = period === 'custom' && customRange
    ? { from_date: customRange[0]?.format('YYYY-MM-DD'), to_date: customRange[1]?.format('YYYY-MM-DD') }
    : getDateRange(period);
  const { data, isLoading } = usePayablesBySupplier({
    status: status || undefined,
    search: search || undefined,
    page,
    limit: pageSize,
    ...dateRange,
  });

  const list: any[] = data?.data ?? [];
  const meta = data?.meta;
  const summary = (meta as any)?.summary as { total_remaining: number; total_paid: number; total_original: number; supplier_count: number } | undefined;

  // Donut chart: by debt status
  const chartData = useMemo(() => {
    if (!list.length) return [];
    const statusMap: Record<string, number> = {};
    for (const r of list) {
      if (r.total_remaining > 0) {
        if (r.overdue_count > 0) {
          statusMap[t('debt.statusOverdue')] = (statusMap[t('debt.statusOverdue')] || 0) + r.total_remaining;
        } else {
          statusMap[t('debt.statusUnpaid')] = (statusMap[t('debt.statusUnpaid')] || 0) + r.total_remaining;
        }
      }
      if (r.total_paid > 0) {
        statusMap[t('debt.statusPaid')] = (statusMap[t('debt.statusPaid')] || 0) + r.total_paid;
      }
    }
    return Object.entries(statusMap).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [list, t]);

  const columns: ColumnsType<any> = [
    {
      title: 'STT', key: 'stt', width: 60, align: 'center' as const,
      render: (_: unknown, __: unknown, i: number) => (page - 1) * pageSize + i + 1,
    },
    {
      title: t('supplier.companyName'), key: 'supplier', ellipsis: true,
      render: (_: unknown, r: any) => <Text strong>{r.supplier?.company_name}</Text>,
    },
    {
      title: t('debt.invoiceCount'), key: 'count', width: 100, align: 'center' as const, responsive: ['md'] as any,
      render: (_: unknown, r: any) => <Tag style={{ borderRadius: 6 }}>{r.invoice_count} {t('debt.invoices')}</Tag>,
    },
    {
      title: t('debt.totalDebt'), key: 'total', width: 160, align: 'right' as const, responsive: ['lg'] as any,
      render: (_: unknown, r: any) => formatVND(r.total_original),
    },
    {
      title: t('debt.totalPaid'), key: 'paid', width: 140, align: 'right' as const, responsive: ['lg'] as any,
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
      title: t('common.actions'), key: 'actions', width: 70, fixed: 'right' as const, align: 'center' as const,
      render: (_: unknown, r: any) => (
        <Tooltip title={t('common.viewDetail')}>
          <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }}
            onClick={() => navigate(`/payables/supplier/${r.supplier_id}`)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 12 }} wrap>
        <Select value={period} onChange={(v) => { setPeriod(v); setPage(1); }} style={{ width: 140 }} options={[
          { value: 'thisMonth', label: t('dashboard.thisMonth') },
          { value: 'thisQuarter', label: t('dashboard.thisQuarter') },
          { value: 'thisYear', label: t('dashboard.thisYear') },
          { value: 'all', label: t('common.all') },
          { value: 'custom', label: t('dashboard.custom') },
        ]} />
        {period === 'custom' && (
          <DatePicker.RangePicker format="DD/MM/YYYY" value={customRange} onChange={(dates) => { setCustomRange(dates as any); setPage(1); }}
            style={{ borderRadius: 8 }} placeholder={[t('common.fromDate'), t('common.toDate')]} />
        )}
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.totalInvoiced')} value={summary?.total_original ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<FileTextOutlined />} valueStyle={{ color: '#595959', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.alreadyPaidOut')} value={summary?.total_paid ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.remainingToPay')} value={summary?.total_remaining ?? 0}
              formatter={(v) => formatVND(v as number)} prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322', fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.supplierCount')} value={summary?.supplier_count ?? 0}
              prefix={<ShopOutlined />} valueStyle={{ color: '#722ed1', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {chartData.length > 0 && (
        <Card size="small" title={t('debt.debtByStatus')} style={{ borderRadius: 12, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={55} outerRadius={100}
                label={({ percent }) => `${((percent || 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#ccc', strokeWidth: 1 }}
              >
                {chartData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <RTooltip formatter={(v: any, name: any) => [formatVND(v), name]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Select value={status} options={statusOptions}
          onChange={(val) => { setStatus(val); setPage(1); }} style={{ maxWidth: 200, flex: '1 1 160px' }} />
        <Input prefix={<SearchOutlined />} placeholder={t('debt.searchSupplier')} allowClear
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 260, flex: '1 1 180px', borderRadius: 8 }} />
      </Space>

      <Table rowKey="supplier_id" columns={columns} dataSource={list} loading={isLoading}
        style={{ borderRadius: 12 }} scroll={{ x: 'max-content' }}
        onRow={(r) => ({ onClick: () => navigate(`/payables/supplier/${r.supplier_id}`), style: { cursor: 'pointer' } })}
        pagination={{
          current: page, pageSize, total: meta?.total ?? 0,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          showSizeChanger: true, showTotal: (total) => `${total} ${t('debt.suppliers')}`,
        }}
        locale={{ emptyText: <Empty description={t('common.noData')} /> }}
      />
    </div>
  );
};

export default PayableListPage;
