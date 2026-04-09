import React, { useState } from 'react';
import { Card, Tabs, Table, Row, Col, Statistic, DatePicker, Button, Spin, Empty } from 'antd';
import { DownloadOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { usePnlReport, useDebtAgingReport, useProductSalesReport } from '../hooks';
import { PnlReport, DebtAgingReport, ProductSalesItem } from '@/types';
import { formatVND } from '@/utils/format';
import { exportToExcel } from '@/utils/export';
import { PageHeader } from '@/components/common';

const { RangePicker } = DatePicker;

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const fromDate = range[0].format('YYYY-MM-DD');
  const toDate = range[1].format('YYYY-MM-DD');

  const { data: pnlData, isLoading: pnlLoading } = usePnlReport(fromDate, toDate);
  const pnl = pnlData?.data as PnlReport | undefined;

  const { data: debtAgingData, isLoading: debtLoading } = useDebtAgingReport();
  const debtAging = debtAgingData?.data as DebtAgingReport | undefined;

  const { data: salesData, isLoading: salesLoading } = useProductSalesReport(fromDate, toDate);
  const productSales = (salesData?.data ?? []) as ProductSalesItem[];

  const handleExportPnl = () => {
    if (!pnl) return;
    exportToExcel(
      [
        { [t('report.indicator')]: t('report.revenue'), [t('common.amount')]: pnl.revenue },
        { [t('report.indicator')]: t('report.cogs'), [t('common.amount')]: pnl.cogs },
        { [t('report.indicator')]: t('report.grossProfit'), [t('common.amount')]: pnl.gross_profit },
        { [t('report.indicator')]: t('report.operatingCostsFull'), [t('common.amount')]: pnl.operating_costs },
        { [t('report.indicator')]: t('report.netProfit'), [t('common.amount')]: pnl.net_profit },
      ],
      `${t('report.pnlFileName')}_${fromDate}_${toDate}`,
      t('report.pnlSheet'),
    );
  };

  const handleExportDebt = () => {
    if (!debtAging) return;
    const { receivables, payables } = debtAging;
    exportToExcel(
      [
        { [t('report.type')]: t('report.receivableCurrent'), [t('common.amount')]: receivables.buckets.current },
        { [t('report.type')]: t('report.receivable1_30'), [t('common.amount')]: receivables.buckets['1_30'] },
        { [t('report.type')]: t('report.receivable31_60'), [t('common.amount')]: receivables.buckets['31_60'] },
        { [t('report.type')]: t('report.receivable60Plus'), [t('common.amount')]: receivables.buckets['60_plus'] },
        { [t('report.type')]: t('report.payableCurrent'), [t('common.amount')]: payables.buckets.current },
        { [t('report.type')]: t('report.payable1_30'), [t('common.amount')]: payables.buckets['1_30'] },
        { [t('report.type')]: t('report.payable31_60'), [t('common.amount')]: payables.buckets['31_60'] },
        { [t('report.type')]: t('report.payable60Plus'), [t('common.amount')]: payables.buckets['60_plus'] },
      ],
      t('report.debtAgingFileName'),
      t('report.debtAgingSheet'),
    );
  };

  const handleExportProducts = () => {
    if (!productSales?.length) return;
    exportToExcel(
      productSales.map((p) => ({
        SKU: p.sku, [t('product.name')]: p.name, [t('dashboard.qty')]: p.qty, [t('report.revenue')]: p.revenue,
      })),
      `${t('report.productSalesFileName')}_${fromDate}_${toDate}`,
      t('report.productSalesSheet'),
    );
  };

  const pnlChartData = pnl
    ? [
        { name: t('report.revenue'), value: pnl.revenue },
        { name: t('report.cogs'), value: pnl.cogs },
        { name: t('report.grossProfit'), value: pnl.gross_profit },
        { name: t('report.operatingCosts'), value: pnl.operating_costs },
        { name: t('report.profit'), value: pnl.net_profit },
      ]
    : [];

  const top10Products = (productSales ?? [])
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const debtColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: t('report.type'), dataIndex: 'type', key: 'type' },
    { title: t('report.current'), dataIndex: 'current', key: 'current', align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('report.days1_30'), dataIndex: 'd1_30', key: 'd1_30', align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('report.days31_60'), dataIndex: 'd31_60', key: 'd31_60', align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('report.days60Plus'), dataIndex: 'd60_plus', key: 'd60_plus', align: 'right' as const, render: (v: number) => formatVND(v) },
  ];

  const debtTableData = debtAging
    ? [
        {
          key: 'recv',
          type: t('report.receivableType'),
          current: debtAging.receivables.buckets.current,
          d1_30: debtAging.receivables.buckets['1_30'],
          d31_60: debtAging.receivables.buckets['31_60'],
          d60_plus: debtAging.receivables.buckets['60_plus'],
        },
        {
          key: 'pay',
          type: t('report.payableType'),
          current: debtAging.payables.buckets.current,
          d1_30: debtAging.payables.buckets['1_30'],
          d31_60: debtAging.payables.buckets['31_60'],
          d60_plus: debtAging.payables.buckets['60_plus'],
        },
      ]
    : [];

  const productColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: t('product.name'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t('dashboard.qty'), dataIndex: 'qty', key: 'qty', align: 'right' as const, width: 100 },
    { title: t('report.revenue'), dataIndex: 'revenue', key: 'revenue', align: 'right' as const, width: 160, render: (v: number) => formatVND(v) },
  ];

  const tabItems = [
    {
      key: 'pnl',
      label: t('report.pnl'),
      children: pnlLoading ? <Spin /> : !pnl ? <Empty description={t('common.noData')} /> : (
        <>
          <Row justify="end" style={{ marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExportPnl} style={{ borderRadius: 8 }}>{t('common.exportExcel')}</Button>
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {[
              { title: t('report.revenue'), value: pnl.revenue, color: '#1890ff', icon: <RiseOutlined /> },
              { title: t('report.cogs'), value: pnl.cogs, color: '#fa8c16' },
              { title: t('report.grossProfit'), value: pnl.gross_profit, color: '#52c41a' },
              { title: t('report.operatingCosts'), value: pnl.operating_costs, color: '#cf1322', icon: <FallOutlined /> },
              { title: t('report.netProfit'), value: pnl.net_profit, color: pnl.net_profit >= 0 ? '#52c41a' : '#cf1322' },
            ].map((s) => (
              <Col xs={24} sm={12} md={4} key={s.title}>
                <Card style={cardStyle} size="small">
                  <Statistic title={s.title} value={s.value} formatter={(v) => formatVND(v as number)} valueStyle={{ color: s.color, fontSize: 16 }} prefix={s.icon} />
                </Card>
              </Col>
            ))}
          </Row>
          <Card style={cardStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={pnlChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
                <Tooltip formatter={(v: any) => formatVND(v)} />
                <Bar dataKey="value" name={t('common.amount')} fill="#1890ff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      ),
    },
    {
      key: 'debt',
      label: t('report.debtAging'),
      children: debtLoading ? <Spin /> : !debtAging ? <Empty description={t('common.noData')} /> : (
        <>
          <Row justify="end" style={{ marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExportDebt} style={{ borderRadius: 8 }}>{t('common.exportExcel')}</Button>
          </Row>
          <Table dataSource={debtTableData} columns={debtColumns} pagination={false} locale={{ emptyText: <Empty description={t('common.noData')} /> }} />
        </>
      ),
    },
    {
      key: 'products',
      label: t('report.productSales'),
      children: salesLoading ? <Spin /> : !(productSales ?? []).length ? <Empty description={t('common.noData')} /> : (
        <>
          <Row justify="end" style={{ marginBottom: 12 }}>
            <Button icon={<DownloadOutlined />} onClick={handleExportProducts} style={{ borderRadius: 8 }}>{t('common.exportExcel')}</Button>
          </Row>
          <Table dataSource={productSales} columns={productColumns} rowKey="sku" pagination={{ pageSize: 10 }} size="small" style={{ marginBottom: 20 }} />
          {top10Products.length > 0 && (
            <Card title={t('report.top10Products')} style={cardStyle}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={top10Products} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip formatter={(v: any) => formatVND(v)} />
                  <Bar dataKey="revenue" name={t('report.revenue')} fill="#52c41a" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader
          title={t('report.title')}
          extra={
            <RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              format="DD/MM/YYYY"
              style={{ borderRadius: 8 }}
            />
          }
        />
        <Tabs items={tabItems} defaultActiveKey="pnl" />
      </Card>
    </div>
  );
};

export default ReportsPage;
