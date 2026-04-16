import React, { useState } from 'react';
import { Card, Table, Button, Input, Select, Space, Empty, Tag, Row, Col, Statistic, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useCashTransactions, useCashSummary, useCashCategories, useDeleteCashTransaction } from '../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { PageHeader } from '@/components/common';
import CashTransactionFormModal from '../components/CashTransactionFormModal';

const CashBookPage: React.FC = () => {
  const { t } = useTranslation();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canManage = hasRole('ADMIN', 'STAFF');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [formDefaultType, setFormDefaultType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const { data, isLoading, refetch } = useCashTransactions({ search, type: typeFilter, category_id: categoryFilter, page, limit: pageSize });
  const { data: summaryData } = useCashSummary({});
  const { data: categories } = useCashCategories();
  const deleteMutation = useDeleteCashTransaction();

  const list = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const summary = summaryData?.data ?? { total_income: 0, total_expense: 0, balance: 0 };

  const categoryOptions = (categories?.data ?? categories ?? []).map((c: any) => ({ value: c.id, label: `${c.type === 'INCOME' ? '↑' : '↓'} ${c.name}` }));

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => (page - 1) * pageSize + i + 1 },
    { title: t('cashBook.date'), dataIndex: 'date', key: 'date', width: 110, render: formatDate },
    {
      title: t('cashBook.type'), key: 'type', width: 100,
      render: (_: any, rec: any) => (
        <Tag color={rec.type === 'INCOME' ? 'green' : 'red'} style={{ borderRadius: 6 }}>
          {rec.type === 'INCOME' ? t('cashBook.income') : t('cashBook.expense')}
        </Tag>
      ),
    },
    { title: t('cashBook.category'), key: 'category', width: 140, render: (_: any, rec: any) => rec.category?.name || '-' },
    { title: t('cashBook.description'), dataIndex: 'description', key: 'desc', ellipsis: true },
    {
      title: t('cashBook.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right' as const,
      render: (v: number, rec: any) => (
        <span style={{ color: rec.type === 'INCOME' ? '#52c41a' : '#cf1322', fontWeight: 600 }}>
          {rec.type === 'INCOME' ? '+' : '-'}{formatVND(v)}
        </span>
      ),
    },
    {
      title: t('payment.method'), dataIndex: 'payment_method', key: 'method', width: 130, responsive: ['md'] as any,
      render: (v: string) => <Tag style={{ borderRadius: 4 }}>{v === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : t('payment.methodCash')}</Tag>,
    },
    { title: t('cashBook.reference'), dataIndex: 'reference', key: 'ref', width: 130, responsive: ['lg'] as any, ellipsis: true, render: (v: string) => v || '-' },
    ...(canManage ? [{
      title: t('common.actions'), key: 'actions', width: 60, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, rec: any) => rec.is_auto ? (
        <Tooltip title={t('cashBook.autoSync')}>
          <LockOutlined style={{ color: '#999' }} />
        </Tooltip>
      ) : (
        <Popconfirm title={t('common.deleteConfirm')} onConfirm={() => deleteMutation.mutate(rec.id)} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }}>
          <Tooltip title={t('common.deleteRecord')}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    }] : []),
  ];

  const openForm = (type: 'INCOME' | 'EXPENSE') => {
    setFormDefaultType(type);
    setFormOpen(true);
  };

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #f6ffed' }}>
            <Statistic title={t('cashBook.totalIncome')} value={summary.total_income} formatter={(v) => formatVND(v as number)} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #fff2f0' }}>
            <Statistic title={t('cashBook.totalExpense')} value={summary.total_expense} formatter={(v) => formatVND(v as number)} prefix={<ArrowDownOutlined />} valueStyle={{ color: '#cf1322', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
            <Statistic title={t('cashBook.balance')} value={summary.balance} formatter={(v) => formatVND(v as number)} valueStyle={{ color: summary.balance >= 0 ? '#1890ff' : '#cf1322', fontSize: 18 }} />
          </Card>
        </Col>
      </Row>

      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('cashBook.title')}
          extra={canManage ? (
            <Space>
              <Button type="primary" icon={<PlusOutlined />} style={{ borderRadius: 8, background: '#52c41a', borderColor: '#52c41a' }} onClick={() => openForm('INCOME')}>
                {t('cashBook.addIncome')}
              </Button>
              <Button type="primary" danger icon={<PlusOutlined />} style={{ borderRadius: 8 }} onClick={() => openForm('EXPENSE')}>
                {t('cashBook.addExpense')}
              </Button>
            </Space>
          ) : undefined}
        />

        <Space wrap style={{ marginBottom: 12, width: '100%' }}>
          <Input placeholder={t('cashBook.searchPlaceholder')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Select
            placeholder={t('cashBook.filterType')} allowClear style={{ width: 140, borderRadius: 8 }} value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={[
              { value: 'INCOME', label: t('cashBook.income') },
              { value: 'EXPENSE', label: t('cashBook.expense') },
            ]}
          />
          <Select placeholder={t('cashBook.filterCategory')} allowClear showSearch optionFilterProp="label" style={{ width: 180, borderRadius: 8 }} value={categoryFilter} onChange={(v) => { setCategoryFilter(v); setPage(1); }} options={categoryOptions} />
        </Space>

        <Table
          dataSource={list} columns={columns} rowKey="id" size="small" loading={isLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ current: page, pageSize, total, showSizeChanger: true, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
        />
      </Card>

      <CashTransactionFormModal open={formOpen} defaultType={formDefaultType} onClose={() => setFormOpen(false)} onSuccess={() => { setFormOpen(false); refetch(); }} />
    </>
  );
};

export default CashBookPage;
