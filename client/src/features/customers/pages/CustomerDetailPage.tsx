import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Spin, Table, Tag, Typography, Space, Empty, Row, Col, Avatar, Button, Modal, Input, Select, DatePicker,
} from 'antd';
import { PhoneOutlined, MailOutlined, UserOutlined, AuditOutlined, DollarOutlined, EnvironmentOutlined, ShoppingCartOutlined, CreditCardOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useCustomer } from '../hooks';
import { StatusTag } from '@/components/common';
import { Customer, SalesOrder, Receivable, Payment } from '@/types';
import dayjs from 'dayjs';
import { formatVND, formatDate, customerTypeLabels } from '@/utils/format';

const { Text } = Typography;
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const CustomerDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modal, setModal] = useState<'orders' | 'payments' | 'debts' | null>(null);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentDateRange, setPaymentDateRange] = useState<[any, any] | null>(null);
  const [debtStatus, setDebtStatus] = useState('');
  const [debtSearch, setDebtSearch] = useState('');

  const { data: customerData, isLoading } = useCustomer(id);
  const customer: Customer | undefined = customerData?.data;

  const orders: SalesOrder[] = (customerData?.data?.sales_orders as SalesOrder[]) ?? [];
  const receivables: Receivable[] = (customerData?.data?.receivables as Receivable[]) ?? [];
  const allPayments: Payment[] = useMemo(() => receivables.flatMap((r) => r.payments ?? []), [receivables]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderSearch) result = result.filter((o) => o.order_code.toLowerCase().includes(orderSearch.toLowerCase()));
    if (orderStatus) result = result.filter((o) => o.status === orderStatus);
    return result;
  }, [orders, orderSearch, orderStatus]);

  const filteredPayments = useMemo(() => {
    let result = allPayments;
    if (paymentSearch) result = result.filter((p: any) => (p.reference || '').toLowerCase().includes(paymentSearch.toLowerCase()));
    if (paymentDateRange?.[0] && paymentDateRange?.[1]) {
      const from = paymentDateRange[0].startOf('day');
      const to = paymentDateRange[1].endOf('day');
      result = result.filter((p: any) => { const d = dayjs(p.payment_date); return d.isAfter(from) && d.isBefore(to); });
    }
    return result;
  }, [allPayments, paymentSearch, paymentDateRange]);

  const filteredDebts = useMemo(() => {
    let result = receivables;
    if (debtSearch) result = result.filter((r: any) => (r.invoice_number || '').toLowerCase().includes(debtSearch.toLowerCase()));
    if (debtStatus) result = result.filter((r) => r.status === debtStatus);
    return result;
  }, [receivables, debtSearch, debtStatus]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!customer) return <Empty description={t('customer.notFound')} style={{ padding: 80 }} />;

  const name = customer.company_name || customer.contact_name || '—';
  const initials = name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const typeLabel = customerTypeLabels[customer.customer_type] || customer.customer_type;

  const nw = () => ({ style: { whiteSpace: 'nowrap' as const } });

  const orderColumns: ColumnsType<SalesOrder> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: t('order.orderCode'), key: 'order_code', width: 170, onHeaderCell: nw, render: (_: unknown, r: SalesOrder) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${r.id}`)}>{r.order_code}</Button> },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'order_date', width: 120, onHeaderCell: nw, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'grand_total', key: 'grand_total', width: 150, align: 'right', onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, onHeaderCell: nw, render: (s: string) => <StatusTag status={s} type="sales" /> },
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'payment_date', width: 160, onHeaderCell: nw, render: formatDate },
    { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right', onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 150, onHeaderCell: nw },
    { title: t('payment.reference'), dataIndex: 'reference', key: 'reference', ellipsis: true, onHeaderCell: nw },
  ];

  const receivableColumns: ColumnsType<Receivable> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: t('debt.invoiceNumber'), key: 'invoice_number', width: 160, onHeaderCell: nw, render: (_: unknown, r: any) => r.sales_order_id ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${r.sales_order_id}`)}>{r.invoice_number || '-'}</Button> : (r.invoice_number || '-') },
    { title: t('debt.dueDate'), dataIndex: 'due_date', key: 'due_date', width: 130, onHeaderCell: nw, render: formatDate },
    { title: t('debt.originalAmount'), dataIndex: 'original_amount', key: 'original_amount', width: 140, align: 'right', onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('debt.paidShort'), dataIndex: 'paid_amount', key: 'paid_amount', width: 140, align: 'right', onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('debt.remaining'), dataIndex: 'remaining', key: 'remaining', width: 140, align: 'right', onHeaderCell: nw, render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(v)}</Text> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, onHeaderCell: nw, render: (s: string) => <StatusTag status={s} type="debt" /> },
  ];

  const paginationConfig = (total: string) => ({
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
    onShowSizeChange: (_: number, size: number) => setPageSize(size),
    showTotal: (t2: number) => `${t2} ${total}`,
  });

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        {/* Header */}
        <Space size={16} style={{ marginBottom: 24 }}>
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

        {/* Info grid */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{customer.phone || '—'}</Text></div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />EMAIL</Text><Text strong>{customer.email || '—'}</Text></div>
          </Col>
          {customer.customer_type === 'BUSINESS' && (
            <>
              <Col xs={24} sm={8}>
                <div style={fieldStyle}><Text style={labelStyle}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{customer.contact_name || '—'}</Text></div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={fieldStyle}><Text style={labelStyle}><AuditOutlined style={{ marginRight: 4 }} />{t('customer.taxCode')}</Text><Text strong>{customer.tax_code || '—'}</Text></div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={fieldStyle}><Text style={labelStyle}><DollarOutlined style={{ marginRight: 4 }} />{t('customer.debtLimit')}</Text><Text strong>{formatVND(customer.debt_limit)}</Text></div>
              </Col>
            </>
          )}
          <Col xs={24}>
            <div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{customer.address || '—'}</Text></div>
          </Col>
        </Row>

        {/* 3 Action Buttons */}
        <Row gutter={[12, 12]} style={{ marginTop: 20 }}>
          <Col xs={24} sm={8}>
            <Button block icon={<ShoppingCartOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('orders')}>
              {t('customer.orderHistory')} ({orders.length})
            </Button>
          </Col>
          <Col xs={24} sm={8}>
            <Button block icon={<CreditCardOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('payments')}>
              {t('customer.paymentHistory')} ({allPayments.length})
            </Button>
          </Col>
          <Col xs={24} sm={8}>
            <Button block icon={<FileTextOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('debts')}>
              {t('customer.debts')} ({receivables.length})
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Order History Modal */}
      <Modal open={modal === 'orders'} onCancel={() => setModal(null)} footer={null}
        title={t('customer.orderHistory')} width={window.innerWidth < 640 ? '95vw' : 800}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('order.searchCode')} allowClear value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
          <Select value={orderStatus} onChange={setOrderStatus} style={{ minWidth: 140 }} options={[
            { label: t('common.all'), value: '' },
            { label: t('salesStatusLabels.DRAFT'), value: 'DRAFT' },
            { label: t('salesStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
            { label: t('salesStatusLabels.SHIPPING'), value: 'SHIPPING' },
            { label: t('salesStatusLabels.COMPLETED'), value: 'COMPLETED' },
            { label: t('salesStatusLabels.CANCELLED'), value: 'CANCELLED' },
          ]} />
        </Space>
        <Table<SalesOrder> rowKey="id" columns={orderColumns} dataSource={filteredOrders}
          scroll={{ x: 600 }} size="small" pagination={paginationConfig(t('customer.orderUnit'))} />
      </Modal>

      {/* Payment History Modal */}
      <Modal open={modal === 'payments'} onCancel={() => setModal(null)} footer={null}
        title={t('customer.paymentHistory')} width={window.innerWidth < 640 ? '95vw' : 750}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('payment.searchReference')} allowClear value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
          <DatePicker.RangePicker format="DD/MM/YYYY" onChange={(dates) => setPaymentDateRange(dates as any)} style={{ borderRadius: 8 }} placeholder={[t('common.fromDate'), t('common.toDate')]} />
        </Space>
        <Table<Payment> rowKey="id" columns={paymentColumns} dataSource={filteredPayments}
          scroll={{ x: 650 }} size="small" pagination={paginationConfig(t('customer.transactionUnit'))} />
      </Modal>

      {/* Debts Modal */}
      <Modal open={modal === 'debts'} onCancel={() => setModal(null)} footer={null}
        title={t('customer.debts')} width={window.innerWidth < 640 ? '95vw' : 900}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('debt.searchInvoice')} allowClear value={debtSearch} onChange={(e) => setDebtSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
          <Select value={debtStatus} onChange={setDebtStatus} style={{ minWidth: 140 }} options={[
            { label: t('common.all'), value: '' },
            { label: t('debtStatusLabels.UNPAID'), value: 'UNPAID' },
            { label: t('debtStatusLabels.PARTIAL'), value: 'PARTIAL' },
            { label: t('debtStatusLabels.PAID'), value: 'PAID' },
            { label: t('debtStatusLabels.OVERDUE'), value: 'OVERDUE' },
          ]} />
        </Space>
        <Table<Receivable> rowKey="id" columns={receivableColumns} dataSource={filteredDebts}
          scroll={{ x: 800 }} size="small" pagination={paginationConfig(t('customer.debtUnit'))} />
      </Modal>
    </>
  );
};

export default CustomerDetailPage;
