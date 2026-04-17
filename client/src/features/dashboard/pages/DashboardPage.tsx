import React, { useMemo, useState } from 'react';
import { Card, Statistic, Row, Col, Select, DatePicker, Spin, Empty, Space } from 'antd';
import {
  DollarOutlined, FallOutlined, RiseOutlined,
  WalletOutlined, BankOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { useDashboard } from '../hooks';
import { DashboardOverview } from '@/types';
import { formatVND, salesStatusLabels } from '@/utils/format';

const { RangePicker } = DatePicker;

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', height: '100%' };
const PIE_COLORS = ['#1890ff', '#13c2c2', '#722ed1', '#52c41a', '#ff4d4f'];
const CH = 280;

function getDateRange(key: string): [string, string] {
  const today = dayjs();
  const fmt = 'YYYY-MM-DD';
  switch (key) {
    case 'thisMonth': return [today.startOf('month').format(fmt), today.format(fmt)];
    case 'thisQuarter': {
      const qStart = today.month(Math.floor(today.month() / 3) * 3).startOf('month');
      return [qStart.format(fmt), today.format(fmt)];
    }
    case 'thisYear': return [today.startOf('year').format(fmt), today.format(fmt)];
    case '6months': return [today.subtract(6, 'month').startOf('month').format(fmt), today.format(fmt)];
    default: return [today.subtract(6, 'month').startOf('month').format(fmt), today.format(fmt)];
  }
}

const yFmt = (v: number) => `${(v / 1_000_000).toFixed(0)}tr`;
const ttFmt = (v: any) => formatVND(v);

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('6months');
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  const dateParams = useMemo(() => {
    if (period === 'custom' && customRange) {
      return { from_date: customRange[0].format('YYYY-MM-DD'), to_date: customRange[1].format('YYYY-MM-DD') };
    }
    const [from_date, to_date] = getDateRange(period);
    return { from_date, to_date };
  }, [period, customRange]);

  const { data: rawData, isLoading } = useDashboard(dateParams);
  const d = rawData?.data as DashboardOverview | undefined;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip={t('common.loadingData')} /></div>;
  if (!d) return <Empty description={t('common.noData')} style={{ marginTop: 80 }} />;

  const totalRevenue = d.revenue_trend.reduce((s, m) => s + m.revenue, 0);
  const totalCost = d.revenue_trend.reduce((s, m) => s + m.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  const statusData = d.orders_by_status.map((s) => ({ ...s, label: salesStatusLabels[s.status] || s.status }));

  const agingData = [
    { name: t('dashboard.agingCurrent'), recv: d.receivable_aging?.current?.total || 0, pay: d.payable_aging?.current?.total || 0 },
    { name: t('dashboard.aging1to30'), recv: d.receivable_aging?.['1_30']?.total || 0, pay: d.payable_aging?.['1_30']?.total || 0 },
    { name: t('dashboard.aging31to60'), recv: d.receivable_aging?.['31_60']?.total || 0, pay: d.payable_aging?.['31_60']?.total || 0 },
    { name: t('dashboard.aging60plus'), recv: d.receivable_aging?.['60_plus']?.total || 0, pay: d.payable_aging?.['60_plus']?.total || 0 },
  ];


  return (
    <div>
      {/* Filter bar */}
      <Row justify="end" style={{ marginBottom: 16 }}>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 160 }}>
            <Select.Option value="thisMonth">{t('dashboard.thisMonth')}</Select.Option>
            <Select.Option value="thisQuarter">{t('dashboard.thisQuarter')}</Select.Option>
            <Select.Option value="thisYear">{t('dashboard.thisYear')}</Select.Option>
            <Select.Option value="6months">{t('dashboard.last6Months')}</Select.Option>
            <Select.Option value="custom">{t('dashboard.custom')}</Select.Option>
          </Select>
          {period === 'custom' && (
            <RangePicker
              value={customRange}
              onChange={(vals) => setCustomRange(vals as [Dayjs, Dayjs])}
            />
          )}
        </Space>
      </Row>

      {/* Row 1: Summary cards */}
      <Row gutter={[16, 16]}>
        {[
          { title: t('dashboard.totalRevenue'), value: totalRevenue, color: '#1890ff', icon: <DollarOutlined /> },
          { title: t('dashboard.totalCost'), value: totalCost, color: '#ff4d4f', icon: <FallOutlined /> },
          { title: t('dashboard.profitLabel'), value: totalProfit, color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f', icon: <RiseOutlined /> },
          { title: t('dashboard.totalReceivable'), value: d.receivable.total_amount, color: '#fa8c16', icon: <WalletOutlined /> },
          { title: t('dashboard.totalPayable'), value: d.payable.total_amount, color: '#722ed1', icon: <BankOutlined /> },
          { title: t('dashboard.cashBalance'), value: d.cash_book?.balance ?? 0, color: (d.cash_book?.balance ?? 0) >= 0 ? '#1890ff' : '#ff4d4f', icon: <WalletOutlined /> },
        ].map((c, i) => (
          <Col xs={12} sm={8} key={i}>
            <Card style={cardStyle}>
              <Statistic
                title={<>{React.cloneElement(c.icon, { style: { marginRight: 6, color: c.color } })}{c.title}</>}
                value={c.value}
                formatter={(v) => formatVND(v as number)}
                valueStyle={{ color: c.color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Row 2: Revenue trend + Order status pie */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.revenueCostTrend')} style={cardStyle}>
            {d.revenue_trend.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <AreaChart data={d.revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={yFmt} />
                  <Tooltip formatter={ttFmt} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name={t('dashboard.revenue')} stroke="#1890ff" fill="#1890ff" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="cost" name={t('dashboard.cost')} stroke="#ff4d4f" fill="#ff4d4f" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.ordersByStatus')} style={cardStyle}>
            {statusData.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <PieChart>
                  <Pie data={statusData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, value }: any) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Aging + Cash flow */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.agingAnalysis')} style={cardStyle}>
            {agingData.some(a => a.recv || a.pay) ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={agingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={yFmt} />
                  <Tooltip formatter={ttFmt} />
                  <Legend />
                  <Bar dataKey="recv" name={t('dashboard.receivableAging')} fill="#fa8c16" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pay" name={t('dashboard.payableAging')} fill="#722ed1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.cashFlowTrend')} style={cardStyle}>
            {d.cash_flow?.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={d.cash_flow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={yFmt} />
                  <Tooltip formatter={ttFmt} />
                  <Legend />
                  <Bar dataKey="income_total" name={t('dashboard.income')} stackId="cf" fill="#52c41a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense_total" name={t('dashboard.expense')} stackId="cf" fill="#ff4d4f" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
      </Row>

      {/* Row 4: Top customers + Top products */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.top5Customers')} style={cardStyle}>
            {d.top_customers?.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={d.top_customers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={yFmt} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={ttFmt} />
                  <Bar dataKey="revenue" name={t('dashboard.revenue')} fill="#1890ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.top5Products')} style={cardStyle}>
            {d.top_products?.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={d.top_products} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={yFmt} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={ttFmt} />
                  <Bar dataKey="revenue" name={t('dashboard.revenue')} fill="#52c41a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
      </Row>

      {/* Row 5: Order trend + Returns by status */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.orderTrend')} style={cardStyle}>
            {d.order_trend?.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <AreaChart data={d.order_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name={t('dashboard.orderCount')} stroke="#1890ff" fill="#1890ff" fillOpacity={0.15} strokeWidth={2} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.returnsSummary')} style={cardStyle}>
            {(() => {
              const sr = d.returns_summary?.sales_returns || [];
              const pr = d.returns_summary?.purchase_returns || [];
              const statusLabels: Record<string, string> = {
                PENDING: t('returnStatusLabels.PENDING'), APPROVED: t('returnStatusLabels.APPROVED'),
                RECEIVING: t('returnStatusLabels.RECEIVING'), SHIPPING: t('returnStatusLabels.SHIPPING'),
                COMPLETED: t('returnStatusLabels.COMPLETED'), REJECTED: t('returnStatusLabels.REJECTED'),
                CANCELLED: t('returnStatusLabels.CANCELLED'),
              };
              const statusColors: Record<string, string> = {
                PENDING: '#faad14', APPROVED: '#13c2c2', RECEIVING: '#fa8c16',
                SHIPPING: '#722ed1', COMPLETED: '#52c41a', REJECTED: '#ff4d4f', CANCELLED: '#999',
              };
              const srData = sr.filter((r: any) => r.count > 0).map((r: any) => ({ name: statusLabels[r.status] || r.status, value: r.count, color: statusColors[r.status] || '#999' }));
              const prData = pr.filter((r: any) => r.count > 0).map((r: any) => ({ name: statusLabels[r.status] || r.status, value: r.count, color: statusColors[r.status] || '#999' }));
              const hasData = srData.length > 0 || prData.length > 0;
              return hasData ? (
                <Row gutter={16}>
                  <Col xs={12} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#1890ff' }}>{t('dashboard.salesReturnCount')} ({sr.reduce((s: number, r: any) => s + r.count, 0)})</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={srData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} label={({ value }) => value}>
                          {srData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Col>
                  <Col xs={12} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#722ed1' }}>{t('dashboard.purchaseReturnCount')} ({pr.reduce((s: number, r: any) => s + r.count, 0)})</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={prData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={65} label={({ value }) => value}>
                          {prData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Col>
                </Row>
              ) : <Empty description={t('common.noDataYet')} />;
            })()}
          </Card>
        </Col>
      </Row>

      {/* Row 6: Payroll trend + Upcoming deliveries */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title={`${t('dashboard.payrollSummary')}${d.payroll_summary ? ` — T${d.payroll_summary.month}/${d.payroll_summary.year}` : ''}`} style={cardStyle}>
            {d.payroll_summary ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={[
                  { name: t('payroll.grossSalary'), value: d.payroll_summary.total_gross || 0, fill: '#1890ff' },
                  { name: t('payroll.insuranceEmployee'), value: d.payroll_summary.total_ins_employee || 0, fill: '#fa8c16' },
                  { name: t('payroll.pit'), value: d.payroll_summary.total_pit || 0, fill: '#ff4d4f' },
                  { name: t('payroll.netSalary'), value: d.payroll_summary.total_net || 0, fill: '#52c41a' },
                  { name: t('payroll.insuranceEmployer'), value: d.payroll_summary.total_ins_employer || 0, fill: '#722ed1' },
                ]} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => (v / 1000000).toFixed(0) + 'M'} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [formatVND(v), null]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {[0,1,2,3,4].map(i => <Cell key={i} fill={['#1890ff','#fa8c16','#ff4d4f','#52c41a','#722ed1'][i]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('common.noDataYet')} />}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title={t('dashboard.upcomingDeliveries')} style={cardStyle}>
            {d.upcoming_deliveries?.length ? (
              <ResponsiveContainer width="100%" height={CH}>
                <BarChart data={d.upcoming_deliveries.map((del: any) => ({
                  name: del.order_code,
                  supplier: del.supplier?.company_name?.slice(0, 15) || '',
                  days: Math.max(0, Math.ceil((new Date(del.expected_delivery).getTime() - Date.now()) / 86400000)),
                }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [`${v} ${t('dashboard.days')}`, t('dashboard.remaining')]} />
                  <Bar dataKey="days" fill="#1890ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty description={t('dashboard.noUpcomingDeliveries')} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
