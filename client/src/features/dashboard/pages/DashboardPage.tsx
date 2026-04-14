import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Statistic, Row, Col, Table, Spin, Empty, Button } from 'antd';
import {
  DollarOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../hooks';
import { DashboardOverview } from '@/types';
import { formatVND, formatDate, salesStatusLabels } from '@/utils/format';

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  height: '100%',
};

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: rawData, isLoading } = useDashboard();
  const data = rawData?.data as DashboardOverview | undefined;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip={t('common.loadingData')} />
      </div>
    );
  }

  if (!data) {
    return <Empty description={t('common.noData')} style={{ marginTop: 80 }} />;
  }

  const { receivable, payable, top_customers, top_products, orders_by_status, upcoming_deliveries, revenue_trend } = data;

  const statusChartData = orders_by_status.map((s) => ({
    ...s,
    label: salesStatusLabels[s.status] || s.status,
  }));

  return (
    <div style={{ padding: 24 }}>
      {/* Summary Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic
              title={<><DollarOutlined style={{ marginRight: 6 }} />{t('dashboard.totalReceivable')}</>}
              value={receivable.total_amount}
              formatter={(v) => formatVND(v as number)}
              valueStyle={{ color: receivable.overdue_amount > 0 ? '#cf1322' : '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic
              title={<><ShoppingCartOutlined style={{ marginRight: 6 }} />{t('dashboard.totalPayable')}</>}
              value={payable.total_amount}
              formatter={(v) => formatVND(v as number)}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic
              title={<><WarningOutlined style={{ marginRight: 6 }} />{t('dashboard.overdueReceivable')}</>}
              value={receivable.overdue_amount}
              formatter={(v) => formatVND(v as number)}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={cardStyle}>
            <Statistic
              title={<><WarningOutlined style={{ marginRight: 6 }} />{t('dashboard.overduePayable')}</>}
              value={payable.overdue_amount}
              formatter={(v) => formatVND(v as number)}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Revenue vs Profit Chart */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={t('dashboard.revenueProfit')} style={cardStyle}>
            {revenue_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenue_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`} />
                  <Tooltip formatter={(v: any) => formatVND(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name={t('dashboard.revenue')} stroke="#1890ff" strokeWidth={2} />
                  <Line type="monotone" dataKey="profit" name={t('dashboard.profit')} stroke="#52c41a" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description={t('common.noDataYet')} />
            )}
          </Card>
        </Col>

        {/* Orders by Status */}
        <Col xs={24} lg={8}>
          <Card title={t('dashboard.ordersByStatus')} style={cardStyle}>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="label" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" name={t('dashboard.orderCount')} fill="#1890ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description={t('common.noDataYet')} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Top Customers */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={t('dashboard.top5Customers')} style={cardStyle}>
            <Table
              dataSource={top_customers}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 400 }}
              columns={[
                { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
                { title: t('dashboard.customerName'), key: 'name', ellipsis: true, render: (_: unknown, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/customers/${r.id}`)}>{r.name}</Button> },
                {
                  title: t('dashboard.revenue'),
                  dataIndex: 'revenue',
                  key: 'revenue',
                  width: 160,
                  align: 'right',
                  render: (v: number) => formatVND(v),
                },
              ]}
              locale={{ emptyText: <Empty description={t('common.noDataYet')} /> }}
            />
          </Card>
        </Col>
      </Row>

      {/* Top Products */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={t('dashboard.top5Products')} style={cardStyle}>
            <Table
              dataSource={top_products}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 500 }}
              columns={[
                { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
                { title: t('dashboard.productName'), key: 'name', ellipsis: true, render: (_: unknown, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/products/${r.id}`)}>{r.name}</Button> },
                {
                  title: t('dashboard.qty'),
                  dataIndex: 'qty',
                  key: 'qty',
                  width: 100,
                  align: 'right',
                  onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' as const } }),
                },
                {
                  title: t('dashboard.revenue'),
                  dataIndex: 'revenue',
                  key: 'revenue',
                  width: 160,
                  align: 'right',
                  render: (v: number) => formatVND(v),
                },
              ]}
              locale={{ emptyText: <Empty description={t('common.noDataYet')} /> }}
            />
          </Card>
        </Col>
      </Row>

      {/* Upcoming Deliveries */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title={t('dashboard.upcomingDeliveries')} style={cardStyle} extra={<TruckOutlined />}>
            <Table
              dataSource={upcoming_deliveries}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 500 }}
              columns={[
                { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
                { title: t('order.orderCode'), key: 'order_code', render: (_: unknown, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${r.id}`)}>{r.order_code}</Button> },
                {
                  title: t('order.supplier'),
                  key: 'supplier',
                  render: (_: unknown, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/suppliers/${r.supplier_id}`)}>{r.supplier?.company_name}</Button>,
                },
                {
                  title: t('order.expectedDelivery'),
                  dataIndex: 'expected_delivery',
                  key: 'expected_delivery',
                  render: (v: string) => formatDate(v),
                },
              ]}
              locale={{ emptyText: <Empty description={t('dashboard.noUpcomingDeliveries')} /> }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
