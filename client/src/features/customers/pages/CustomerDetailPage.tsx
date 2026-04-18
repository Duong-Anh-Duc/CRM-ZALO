import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Spin, Table, Tag, Typography, Space, Empty, Row, Col, Avatar, Button, Input, Select, Statistic, Tooltip, Modal,
} from 'antd';
import { PhoneOutlined, MailOutlined, UserOutlined, AuditOutlined, DollarOutlined, EnvironmentOutlined, SearchOutlined, WarningOutlined, HistoryOutlined, FilePdfOutlined, WalletOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCustomer } from '../hooks';
import { StatusTag } from '@/components/common';
import { invoiceApi } from '@/features/invoices/api';
import { Customer, SalesOrder, Receivable } from '@/types';
import { formatVND, formatDate, customerTypeLabels } from '@/utils/format';

const { Text } = Typography;
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const CustomerDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const { data: customerData, isLoading } = useCustomer(id);
  const customer: Customer | undefined = customerData?.data;

  const orders: SalesOrder[] = (customerData?.data?.sales_orders as SalesOrder[]) ?? [];
  const receivables: Receivable[] = (customerData?.data?.receivables as Receivable[]) ?? [];

  const receivableByOrder = useMemo(() => {
    const map = new Map<string, Receivable>();
    receivables.forEach((r: any) => { if (r.sales_order_id) map.set(r.sales_order_id, r); });
    return map;
  }, [receivables]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderSearch) result = result.filter((o) => o.order_code.toLowerCase().includes(orderSearch.toLowerCase()));
    if (orderStatus) result = result.filter((o) => o.status === orderStatus);
    return result;
  }, [orders, orderSearch, orderStatus]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!customer) return <Empty description={t('customer.notFound')} style={{ padding: 80 }} />;

  const name = customer.company_name || customer.contact_name || '—';
  const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const typeLabel = customerTypeLabels[customer.customer_type] || customer.customer_type;

  const totalRevenue = orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + Number(o.grand_total), 0);
  const totalDebt = receivables.reduce((s, r) => s + Number(r.remaining), 0);
  const totalPaid = receivables.reduce((s, r) => s + Number(r.paid_amount), 0);
  const overdueCount = receivables.filter((r) => r.status === 'OVERDUE').length;

  const columns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    {
      title: t('order.orderCode'), key: 'order_code', width: 170,
      render: (_: any, r: SalesOrder) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${r.id}`)}>{r.order_code}</Button>,
    },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'date', width: 110, render: formatDate },
    {
      title: t('order.grandTotal'), dataIndex: 'grand_total', key: 'total', width: 130, align: 'right' as const,
      render: (v: number) => formatVND(v),
    },
    {
      title: t('common.status'), key: 'order_status', width: 130,
      render: (_: any, r: SalesOrder) => <StatusTag status={r.status} type="sales" />,
    },
    {
      title: t('debt.invoiceNumber'), key: 'invoice', width: 140,
      render: (_: any, r: SalesOrder) => {
        const rec = receivableByOrder.get(r.id) as any;
        if (!rec?.invoice_number) return <Text type="secondary">—</Text>;
        return (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={async () => {
            try {
              const res = await invoiceApi.list({ sales_order_id: r.id, limit: 1 });
              const inv = res.data?.data?.invoices?.[0] || res.data?.data?.[0];
              if (inv) setPreviewInvoiceId(inv.id);
            } catch { /* ignore */ }
          }}>
            <FilePdfOutlined style={{ marginRight: 4 }} />{rec.invoice_number}
          </Button>
        );
      },
    },
    {
      title: t('debt.paidShort'), key: 'paid', width: 120, align: 'right' as const,
      render: (_: any, r: SalesOrder) => {
        const rec = receivableByOrder.get(r.id);
        return rec ? <Text style={{ color: '#52c41a' }}>{formatVND(Number(rec.paid_amount))}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: t('debt.remaining'), key: 'remaining', width: 120, align: 'right' as const,
      render: (_: any, r: SalesOrder) => {
        const rec = receivableByOrder.get(r.id);
        if (!rec) return <Text type="secondary">—</Text>;
        const rem = Number(rec.remaining);
        return <Text strong style={{ color: rem > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(rem)}</Text>;
      },
    },
    {
      title: t('debt.status'), key: 'debt_status', width: 130,
      render: (_: any, r: SalesOrder) => {
        const rec = receivableByOrder.get(r.id);
        return rec ? <StatusTag status={rec.status} type="debt" /> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: t('common.actions'), key: 'actions', width: 60, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, r: SalesOrder) => {
        const rec = receivableByOrder.get(r.id) as any;
        const hasPayments = rec?.payments?.length > 0;
        return hasPayments ? (
          <Tooltip title={t('customer.paymentHistory')}>
            <Button type="text" size="small" icon={<HistoryOutlined />} style={{ color: '#52c41a' }} onClick={() => setPaymentModal(rec)} />
          </Tooltip>
        ) : null;
      },
    },
  ];

  const payments = paymentModal?.payments || [];

  return (
    <>
      {/* Summary bar - lên đầu */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('order.grandTotal')} value={totalRevenue} formatter={(v) => formatVND(v as number)} valueStyle={{ fontSize: 16, color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.totalPaid')} value={totalPaid} formatter={(v) => formatVND(v as number)} valueStyle={{ fontSize: 16, color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.remaining')} value={totalDebt} formatter={(v) => formatVND(v as number)} valueStyle={{ fontSize: 16, color: totalDebt > 0 ? '#cf1322' : '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('debt.overdue')} value={overdueCount} prefix={overdueCount > 0 ? <WarningOutlined /> : undefined} valueStyle={{ fontSize: 18, color: overdueCount > 0 ? '#cf1322' : '#999' }} suffix={t('debt.invoices')} />
          </Card>
        </Col>
      </Row>

      {/* Thông tin khách hàng */}
      <Card title={t('customer.info')} style={{ borderRadius: 12, marginBottom: 16 }}
        extra={<Button type="primary" icon={<WalletOutlined />} style={{ borderRadius: 8 }} onClick={() => navigate(`/receivables/customer/${customer.id}`)}>{t('debt.viewDebt')}</Button>}>
        <Space size={16} style={{ marginBottom: 20 }}>
          <Avatar size={56} style={{ background: '#1677ff', fontSize: 20, fontWeight: 600 }}>{initials}</Avatar>
          <div>
            <Text strong style={{ fontSize: 20, display: 'block' }}>{name}</Text>
            <Space size={6}>
              <Tag style={{ borderRadius: 12, fontWeight: 500, color: customer.customer_type === 'INDIVIDUAL' ? '#1677ff' : '#722ed1', background: customer.customer_type === 'INDIVIDUAL' ? '#e6f4ff' : '#f9f0ff', border: `1px solid ${customer.customer_type === 'INDIVIDUAL' ? '#91caff' : '#d3adf7'}` }}>{typeLabel}</Tag>
              <Tag style={{ borderRadius: 12, fontWeight: 500, color: customer.is_active ? '#52c41a' : '#999', background: customer.is_active ? '#f6ffed' : '#f5f5f5', border: `1px solid ${customer.is_active ? '#b7eb8f' : '#d9d9d9'}` }}>
                {customer.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
              </Tag>
            </Space>
          </div>
        </Space>

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{customer.phone || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />EMAIL</Text><Text strong>{customer.email || '—'}</Text></div></Col>
          {customer.customer_type === 'BUSINESS' && (
            <>
              <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{customer.contact_name || '—'}</Text></div></Col>
              <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><AuditOutlined style={{ marginRight: 4 }} />{t('customer.taxCode')}</Text><Text strong>{customer.tax_code || '—'}</Text></div></Col>
              <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><DollarOutlined style={{ marginRight: 4 }} />{t('customer.debtLimit')}</Text><Text strong>{formatVND(customer.debt_limit)}</Text></div></Col>
            </>
          )}
          <Col xs={24}><div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{customer.address || '—'}</Text></div></Col>
        </Row>
      </Card>

      <Card title={t('customer.orderHistory')} style={{ borderRadius: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('order.searchCode')} allowClear value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
          <Select value={orderStatus} onChange={setOrderStatus} style={{ minWidth: 150 }} options={[
            { label: t('common.all'), value: '' },
            { label: t('salesStatusLabels.DRAFT'), value: 'DRAFT' },
            { label: t('salesStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
            { label: t('salesStatusLabels.SHIPPING'), value: 'SHIPPING' },
            { label: t('salesStatusLabels.COMPLETED'), value: 'COMPLETED' },
            { label: t('salesStatusLabels.CANCELLED'), value: 'CANCELLED' },
          ]} />
        </Space>

        <Table
          dataSource={filteredOrders}
          columns={columns}
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }}
          locale={{ emptyText: <Empty description={t('common.noData')} /> }}
        />
      </Card>

      {/* Invoice PDF Preview Modal */}
      <Modal
        open={!!previewInvoiceId}
        onCancel={() => setPreviewInvoiceId(null)}
        footer={null}
        width={900}
        title={t('invoice.preview')}
        styles={{ body: { padding: 0, height: '75vh' } }}
      >
        {previewInvoiceId && (
          <iframe
            src={`${invoiceApi.getPdfUrl(previewInvoiceId)}?token=${localStorage.getItem('token')}`}
            style={{ width: '100%', height: '75vh', border: 'none' }}
            title="Invoice Preview"
          />
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        open={!!paymentModal}
        title={`${t('customer.paymentHistory')} — ${paymentModal?.invoice_number || ''}`}
        footer={null}
        width={650}
        onCancel={() => setPaymentModal(null)}
      >
        <Table
          size="small"
          dataSource={payments}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: 'STT', key: 'stt', width: 40, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
            { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'date', width: 110, render: formatDate },
            { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 130, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{formatVND(v)}</Text> },
            { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 140, render: (v: string) => <Tag style={{ borderRadius: 4 }}>{v === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : v === 'CASH' ? t('payment.methodCash') : v}</Tag> },
            { title: t('payment.reference'), dataIndex: 'reference', key: 'ref', ellipsis: true, render: (v: string) => v || '-' },
          ]}
        />
      </Modal>
    </>
  );
};

export default CustomerDetailPage;
