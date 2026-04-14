import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Typography, Space, Row, Col, Statistic, Select,
  Button, Input, Tooltip, Tag,
} from 'antd';
import {
  DollarOutlined, WarningOutlined, CalendarOutlined,
  SearchOutlined, EyeOutlined, FilePdfOutlined, DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { usePayablesBySupplier, usePayableSummary } from '../hooks';
import { payableApi } from '../api';
import { formatVND, formatDate, debtStatusLabels } from '@/utils/format';
import { exportToExcel } from '@/utils/export';
import { PageHeader } from '@/components/common';

const { Text } = Typography;

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

const PayableListPage: React.FC = () => {
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

  const summaryQuery = usePayableSummary();
  const { data, isLoading } = usePayablesBySupplier({
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
      title: t('supplier.companyName'), key: 'supplier', ellipsis: true,
      render: (_: unknown, r: any) => <Text strong>{r.supplier?.company_name}</Text>,
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
      title: t('common.actions'), key: 'actions', width: 130, fixed: 'right' as const, align: 'center' as const,
      render: (_: unknown, r: any) => (
        <Space size={2}>
          <Tooltip title={t('common.viewDetail')}>
            <Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }}
              onClick={() => navigate(`/payables/supplier/${r.supplier_id}`)} />
          </Tooltip>
          <Tooltip title={t('debt.exportExcel')}>
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={async () => {
              try {
                const detail = await payableApi.getSupplierDetail(r.supplier_id);
                const d = detail.data?.data;
                const pays = d?.payables || [];
                const supp = d?.supplier;
                const sum = d?.summary;
                const name = supp?.company_name || '';
                const rows = [
                  { [t('debt.payables')]: t('order.supplier') + ': ' + name },
                  { [t('debt.payables')]: t('customer.phone') + ': ' + (supp?.phone || '-'), '': t('customer.address') + ': ' + (supp?.address || '-') },
                  { [t('debt.payables')]: t('debt.totalDebt') + ': ' + formatVND(sum?.total_original), '': t('debt.totalPaid') + ': ' + formatVND(sum?.total_paid), ' ': t('debt.remaining') + ': ' + formatVND(sum?.total_remaining) },
                  {},
                  ...pays.map((pay: any, i: number) => ({
                    'STT': i + 1,
                    [t('debt.invoiceNumber')]: pay.invoice_number || '',
                    [t('order.orderCode')]: pay.purchase_order?.order_code || '',
                    [t('debt.invoiceDate')]: formatDate(pay.invoice_date),
                    [t('debt.dueDate')]: formatDate(pay.due_date),
                    [t('debt.originalAmount')]: pay.original_amount,
                    [t('debt.paidShort')]: pay.paid_amount,
                    [t('debt.remaining')]: pay.remaining,
                    [t('common.status')]: debtStatusLabels[pay.status] || pay.status,
                  })),
                ];
                exportToExcel(rows, `cong-no-phai-tra-${name}`, t('debt.payables'));
              } catch { /* ignore */ }
            }} />
          </Tooltip>
          <Tooltip title={t('debt.exportPdf')}>
            <Button type="text" size="small" icon={<FilePdfOutlined />} onClick={async () => {
              try {
                const res = await payableApi.exportPdf(r.supplier_id);
                const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
                window.open(url, '_blank');
              } catch { /* ignore */ }
            }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title={t('debt.totalPayable')} value={summary?.total_payable ?? 0}
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
        <PageHeader title={t('debt.payables')} />

        <Space wrap style={{ marginBottom: 16 }}>
          <Select value={status} options={statusOptions}
            onChange={(val) => { setStatus(val); setPage(1); }} style={{ minWidth: 160 }} />
          <Input prefix={<SearchOutlined />} placeholder={t('debt.searchSupplier')} allowClear
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 220, borderRadius: 8 }} />
        </Space>

        <Table rowKey="supplier_id" columns={columns} dataSource={list} loading={isLoading}
          style={{ borderRadius: 12 }} scroll={{ x: 'max-content' }}
          onRow={(r) => ({ onClick: () => navigate(`/payables/supplier/${r.supplier_id}`), style: { cursor: 'pointer' } })}
          pagination={{
            current: page, pageSize, total: meta?.total ?? 0,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true, showTotal: (total) => `${total} ${t('debt.suppliers')}`,
          }}
        />
      </Card>
    </div>
  );
};

export default PayableListPage;
