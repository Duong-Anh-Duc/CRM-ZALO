import React, { useState, useMemo } from 'react';
import { Card, Table, Button, Input, Select, Space, Empty, Tag, Row, Col, Statistic, Tooltip, Tabs, Modal, Descriptions, Image, Typography, Upload, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, ArrowUpOutlined, ArrowDownOutlined, WalletOutlined, EyeOutlined, InboxOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend } from 'recharts';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/auth.store';
import { useCashTransactions, useCashSummary, useCashCategories } from '../hooks';
import { cashBookApi } from '../api';
import { formatVND, formatDate } from '@/utils/format';
import { toast } from 'react-toastify';
import { PageHeader } from '@/components/common';
import CashTransactionFormModal from '../components/CashTransactionFormModal';

const PIE_COLORS = ['#1890ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#ff4d4f', '#faad14', '#eb2f96', '#2f54eb', '#a0d911'];

function getDateRange(period: string) {
  const now = dayjs();
  switch (period) {
    case 'thisMonth': return { from_date: now.startOf('month').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') };
    case 'thisQuarter': { const qm = Math.floor(now.month() / 3) * 3; return { from_date: now.month(qm).startOf('month').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') }; }
    case 'thisYear': return { from_date: now.startOf('year').format('YYYY-MM-DD'), to_date: now.format('YYYY-MM-DD') };
    default: return {};
  }
}

const CashBookPage: React.FC = () => {
  const { t } = useTranslation();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('ADMIN', 'STAFF');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [period, setPeriod] = useState('thisMonth');
  const [customRange, setCustomRange] = useState<[any, any] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<any>(null);

  const typeFilter = activeTab === 'ALL' ? undefined : activeTab;
  const dateRange = period === 'custom' && customRange
    ? { from_date: customRange[0]?.format('YYYY-MM-DD'), to_date: customRange[1]?.format('YYYY-MM-DD') }
    : getDateRange(period);
  const { data, isLoading, refetch } = useCashTransactions({ search, type: typeFilter, category_id: categoryFilter, page, limit: pageSize, ...dateRange });
  const { data: summaryData } = useCashSummary(dateRange);
  const { data: categories } = useCashCategories(typeFilter);


  const list = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const summary = summaryData?.data ?? { total_income: 0, total_expense: 0, balance: 0, income_count: 0, expense_count: 0 };
  const categoryOptions = (categories?.data ?? categories ?? []).map((c: any) => ({ value: c.id, label: c.name }));

  // Chart data: group all transactions by category
  const { data: allForChart } = useCashTransactions({ ...dateRange, type: typeFilter, limit: 500 });
  const chartData = useMemo(() => {
    const items = allForChart?.data ?? [];
    const map = new Map<string, { name: string; value: number }>();
    items.forEach((tx: any) => {
      const catName = tx.category?.name || '-';
      const existing = map.get(catName);
      if (existing) existing.value += Number(tx.amount);
      else map.set(catName, { name: catName, value: Number(tx.amount) });
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [allForChart]);

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('cashBook.date'), dataIndex: 'date', key: 'date', width: 110, render: formatDate },
    ...(activeTab === 'ALL' ? [{
      title: t('cashBook.type'), key: 'type', width: 80,
      render: (_: any, rec: any) => <Tag color={rec.type === 'INCOME' ? 'green' : 'red'} style={{ borderRadius: 6 }}>{rec.type === 'INCOME' ? t('cashBook.income') : t('cashBook.expense')}</Tag>,
    }] : []),
    { title: t('cashBook.category'), key: 'category', width: 150, render: (_: any, rec: any) => rec.category?.name || '-' },
    { title: t('cashBook.content'), dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: t('cashBook.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right' as const,
      render: (v: number, rec: any) => <span style={{ color: rec.type === 'INCOME' ? '#52c41a' : '#cf1322', fontWeight: 600 }}>{rec.type === 'INCOME' ? '+' : '-'}{formatVND(v)}</span>,
    },
    { title: t('payment.method'), dataIndex: 'payment_method', key: 'method', width: 120, responsive: ['md'] as any, render: (v: string) => <Tag style={{ borderRadius: 4 }}>{v === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : t('payment.methodCash')}</Tag> },
    {
      title: t('common.actions'), key: 'actions', width: 80, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => (
        <Space size="small">
          <Tooltip title={t('cashBook.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setDetailRecord(rec)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('cashBook.title')}
          extra={
            <Space wrap>
              <Select value={period} onChange={(v) => { setPeriod(v); setPage(1); }} style={{ width: 140, borderRadius: 8 }} options={[
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
              {canManage && (
                <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => setFormOpen(true)}>
                  {t('cashBook.createTransaction')}
                </Button>
              )}
            </Space>
          }
        />

        {/* Summary bar — inside card, styled like debt page */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title={t('cashBook.totalIncome')} value={summary.total_income} formatter={(v) => formatVND(v as number)} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title={t('cashBook.totalExpense')} value={summary.total_expense} formatter={(v) => formatVND(v as number)} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#cf1322', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title={t('cashBook.balance')} value={summary.balance} formatter={(v) => formatVND(v as number)} prefix={<WalletOutlined />} valueStyle={{ color: summary.balance >= 0 ? '#1890ff' : '#cf1322', fontSize: 18 }} />
            </Card>
          </Col>
        </Row>

        {/* Chart by category */}
        {chartData.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card size="small" title={activeTab === 'INCOME' ? t('cashBook.incomeByCategory') : activeTab === 'EXPENSE' ? t('cashBook.expenseByCategory') : t('cashBook.byCategory')} style={{ borderRadius: 12 }}>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={60} outerRadius={110}
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
            </Col>
          </Row>
        )}

        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); setCategoryFilter(undefined); setPage(1); }}
          items={[
            { key: 'ALL', label: t('common.all') },
            { key: 'INCOME', label: `${t('cashBook.income')} (${summary.income_count || 0})` },
            { key: 'EXPENSE', label: `${t('cashBook.expense')} (${summary.expense_count || 0})` },
          ]}
          style={{ marginBottom: 4 }}
        />

        <Space wrap style={{ marginBottom: 12 }}>
          <Input placeholder={t('cashBook.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select placeholder={t('cashBook.filterCategory')} allowClear showSearch optionFilterProp="label" style={{ width: 180, borderRadius: 8 }} value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} options={categoryOptions} />
        </Space>

        <Table
          dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
        />
      </Card>

      <CashTransactionFormModal open={formOpen} onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); refetch(); }} />

      {/* Detail Modal */}
      <Modal
        open={!!detailRecord}
        title={t('cashBook.viewDetail')}
        footer={null}
        width={500}
        onCancel={() => setDetailRecord(null)}
      >
        {detailRecord && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('cashBook.type')}>
                <Tag color={detailRecord.type === 'INCOME' ? 'green' : 'red'} style={{ borderRadius: 6 }}>
                  {detailRecord.type === 'INCOME' ? t('cashBook.income') : t('cashBook.expense')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('cashBook.date')}>{formatDate(detailRecord.date)}</Descriptions.Item>
              <Descriptions.Item label={t('cashBook.category')}>{detailRecord.category?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cashBook.content')}>{detailRecord.description}</Descriptions.Item>
              <Descriptions.Item label={t('cashBook.amount')}>
                <Typography.Text strong style={{ color: detailRecord.type === 'INCOME' ? '#52c41a' : '#cf1322', fontSize: 16 }}>
                  {detailRecord.type === 'INCOME' ? '+' : '-'}{formatVND(detailRecord.amount)}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('payment.method')}>
                {detailRecord.payment_method === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : t('payment.methodCash')}
              </Descriptions.Item>
              {detailRecord.notes && <Descriptions.Item label={t('cashBook.notes')}>{detailRecord.notes}</Descriptions.Item>}
              <Descriptions.Item label={t('cashBook.evidence')}>
                {detailRecord.evidence_url ? (
                  <Image src={detailRecord.evidence_url} style={{ maxHeight: 200, borderRadius: 8 }} />
                ) : (
                  <Upload.Dragger
                    accept="image/*,.pdf"
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      try {
                        const { uploadFile } = await import('@/utils/upload');
                        const url = await uploadFile(file, 'evidence');
                        await cashBookApi.update(detailRecord.id, { evidence_url: url });
                        toast.success(t('common.saved'));
                        setDetailRecord(null);
                        refetch();
                      } catch (err: any) { toast.error(err?.response?.data?.message || t('common.error')); }
                      return false;
                    }}
                    style={{ borderRadius: 8 }}
                  >
                    <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 32, color: '#1677ff' }} /></p>
                    <p className="ant-upload-text" style={{ fontSize: 13 }}>{t('debt.uploadEvidence')}</p>
                  </Upload.Dragger>
                )}
              </Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>

    </>
  );
};

export default CashBookPage;
