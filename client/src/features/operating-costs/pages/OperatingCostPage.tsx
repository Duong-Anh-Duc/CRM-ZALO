import React, { useState } from 'react';
import { Card, Table, Row, Col, Statistic, DatePicker, Button, Spin, Empty, Tag, Space } from 'antd';
import { PlusOutlined, DollarOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useOperatingCosts } from '../hooks';
import { usePermission } from '@/contexts/AbilityContext';
import { OperatingCost } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { PageHeader } from '@/components/common';
import CostFormModal from '../components/CostFormModal';

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const OperatingCostPage: React.FC = () => {
  const { t } = useTranslation();
  const canCreate = usePermission('operating_cost.create');
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<OperatingCost | null>(null);

  const year = selectedMonth.year();
  const monthStr = selectedMonth.format('YYYY-MM');

  const { data: costsData, isLoading, refetch } = useOperatingCosts({ month: monthStr });
  const costs = (costsData?.data ?? []) as OperatingCost[];

  const grouped = (costs ?? []).reduce<Record<string, OperatingCost[]>>((acc, c) => {
    const cat = c.category?.name ?? t('cost.other');
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  const categoryTotals = Object.entries(grouped).map(([category, items]) => ({
    category,
    total: items.reduce((s, i) => s + i.amount, 0),
  }));

  const totalAmount = categoryTotals.reduce((s, c) => s + c.total, 0);

  const chartData = categoryTotals.map((c) => ({
    name: c.category,
    [t('common.amount')]: c.total,
  }));

  const columns = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: t('common.date'), dataIndex: 'date', key: 'date', width: 110, render: (v: string) => formatDate(v), onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: t('cost.category'), dataIndex: ['category', 'name'], key: 'category', width: 140, render: (v: string) => <Tag color="blue" style={{ borderRadius: 8 }}>{v}</Tag>, onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
    { title: t('common.description'), dataIndex: 'description', key: 'description', ellipsis: true },
    { title: t('common.amount'), dataIndex: 'amount', key: 'amount', align: 'right' as const, width: 150, render: (v: number) => formatVND(v), onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }) },
  ];

  const handleOpenCreate = () => { setEditingCost(null); setModalOpen(true); };
  const handleSuccess = () => { setModalOpen(false); setEditingCost(null); refetch(); };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div>
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <PageHeader
          title={t('cost.title')}
          extra={
            <Space wrap>
              <DatePicker picker="month" value={selectedMonth} onChange={(v) => v && setSelectedMonth(v)}
                format="MM/YYYY" style={{ borderRadius: 8 }} allowClear={false} />
              {canCreate && (
                <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate} style={{ borderRadius: 8 }}>
                  {t('cost.addCost')}
                </Button>
              )}
            </Space>
          }
        />
      </Card>

      {/* Summary */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('cost.totalMonthly', { month: selectedMonth.month() + 1, year })}
              value={totalAmount} formatter={(v) => formatVND(v as number)}
              prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('cost.expenseCount')} value={(costs ?? []).length} suffix={t('cost.expenseSuffix')} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('cost.categoryCount')} value={categoryTotals.length} suffix={t('cost.categorySuffix')} />
          </Card>
        </Col>
      </Row>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card title={t('cost.byCategory')} style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <ResponsiveContainer width="100%" height={280} minWidth={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} height={50} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
                <Tooltip formatter={(v: any) => formatVND(v)} />
                <Bar dataKey={t('common.amount')} fill="#1890ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Table grouped by category */}
      {Object.entries(grouped).length > 0 ? (
        Object.entries(grouped).map(([cat, items]) => (
          <Card key={cat}
            title={`${cat} — ${formatVND(items.reduce((s, i) => s + i.amount, 0))}`}
            style={{ ...cardStyle, marginBottom: 12 }} size="small">
            <Table dataSource={items} columns={columns} rowKey="id" pagination={false} size="small"
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description={t('common.noData')} /> }} />
          </Card>
        ))
      ) : (
        <Empty description={t('cost.noCostsThisMonth')} style={{ marginTop: 40 }} />
      )}

      <CostFormModal open={modalOpen} editingCost={editingCost}
        onCancel={() => { setModalOpen(false); setEditingCost(null); }} onSuccess={handleSuccess} />
    </div>
  );
};

export default OperatingCostPage;
