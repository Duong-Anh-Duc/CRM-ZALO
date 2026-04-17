import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Table, Tag, Typography, Space, Empty, Row, Col, Avatar, Button, Input, Select, Statistic, Tabs, Tooltip, Modal } from 'antd';
import { PhoneOutlined, MailOutlined, UserOutlined, AuditOutlined, EnvironmentOutlined, ClockCircleOutlined, SearchOutlined, WarningOutlined, HistoryOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSupplier } from '../hooks';
import { StatusTag } from '@/components/common';
import { Supplier, PurchaseOrder, Payable } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { invoiceApi } from '@/features/invoices/api';

const { Text } = Typography;
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const SupplierDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(10);

  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [prodSearch, setProdSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');

  const paymentTermsLabels: Record<string, string> = {
    IMMEDIATE: t('paymentTermsLabels.IMMEDIATE'),
    NET_30: t('paymentTermsLabels.NET_30'),
    NET_60: t('paymentTermsLabels.NET_60'),
    NET_90: t('paymentTermsLabels.NET_90'),
  };

  const { data: supplierData, isLoading } = useSupplier(id);
  const supplier: Supplier | undefined = supplierData?.data;

  const supplierPrices: any[] = (supplierData?.data?.supplier_prices as any[]) ?? [];
  const products = useMemo(() => supplierPrices.map((sp: any) => ({
    id: sp.product?.id, sku: sp.product?.sku, name: sp.product?.name,
    cost_price: sp.purchase_price, moq: sp.moq, lead_time_days: sp.lead_time_days,
    is_preferred: sp.is_preferred,
  })), [supplierPrices]);
  const orders: PurchaseOrder[] = (supplierData?.data?.purchase_orders as PurchaseOrder[]) ?? [];
  const payables: Payable[] = (supplierData?.data?.payables as Payable[]) ?? [];

  // Map: purchase_order_id → payable
  const payableByOrder = useMemo(() => {
    const map = new Map<string, Payable>();
    payables.forEach((p: any) => { if (p.purchase_order_id) map.set(p.purchase_order_id, p); });
    return map;
  }, [payables]);

  const filteredProducts = useMemo(() => {
    if (!prodSearch) return products;
    const s = prodSearch.toLowerCase();
    return products.filter((p: any) => (p.name || '').toLowerCase().includes(s) || (p.sku || '').toLowerCase().includes(s));
  }, [products, prodSearch]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderSearch) result = result.filter((o) => o.order_code.toLowerCase().includes(orderSearch.toLowerCase()));
    if (orderStatus) result = result.filter((o) => o.status === orderStatus);
    return result;
  }, [orders, orderSearch, orderStatus]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!supplier) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const initials = supplier.company_name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  const totalDebt = payables.reduce((s, p) => s + Number(p.remaining), 0);
  const totalPaid = payables.reduce((s, p) => s + Number(p.paid_amount), 0);
  const totalPurchase = orders.filter((o) => o.status !== 'CANCELLED').reduce((s, o) => s + Number(o.total), 0);
  const overdueCount = payables.filter((p) => p.status === 'OVERDUE').length;

  const nw = () => ({ style: { whiteSpace: 'nowrap' as const } });
  const pgConfig = { pageSize, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], onShowSizeChange: (_: number, size: number) => setPageSize(size) };

  const productColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: t('order.productName'), key: 'name', ellipsis: true, onHeaderCell: nw, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/products/${r.id}`)}>{r.name}</Button> },
    { title: t('supplier.costPrice'), dataIndex: 'cost_price', key: 'cost', width: 120, align: 'right' as const, onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 80, align: 'right' as const },
    { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 120, onHeaderCell: nw, render: (v: number) => v ? `${v} ${t('product.days')}` : '-' },
    { title: '', dataIndex: 'is_preferred', key: 'pref', width: 70, render: (v: boolean) => v ? <Tag color="gold" style={{ borderRadius: 6 }}>{t('product.preferred')}</Tag> : null },
  ];

  // Unified order + debt columns
  const orderDebtColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('order.orderCode'), key: 'code', width: 170, onHeaderCell: nw, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${r.id}`)}>{r.order_code}</Button> },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'date', width: 110, onHeaderCell: nw, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'total', key: 'total', width: 130, align: 'right' as const, onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, onHeaderCell: nw, render: (s: string) => <StatusTag status={s} type="purchase" /> },
    {
      title: t('debt.invoiceNumber'), key: 'invoice', width: 140,
      render: (_: any, r: any) => {
        const pay = payableByOrder.get(r.id) as any;
        if (!pay?.invoice_number) return <Text type="secondary">—</Text>;
        return (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={async () => {
            try {
              const res = await invoiceApi.list({ purchase_order_id: r.id, limit: 1 });
              const inv = res.data?.data?.invoices?.[0] || res.data?.data?.[0];
              if (inv) setPreviewInvoiceId(inv.id);
            } catch { /* ignore */ }
          }}>
            <FilePdfOutlined style={{ marginRight: 4 }} />{pay.invoice_number}
          </Button>
        );
      },
    },
    {
      title: t('debt.paidShort'), key: 'paid', width: 120, align: 'right' as const,
      render: (_: any, r: any) => {
        const pay = payableByOrder.get(r.id);
        return pay ? <Text style={{ color: '#52c41a' }}>{formatVND(Number(pay.paid_amount))}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: t('debt.remaining'), key: 'remaining', width: 120, align: 'right' as const,
      render: (_: any, r: any) => {
        const pay = payableByOrder.get(r.id);
        if (!pay) return <Text type="secondary">—</Text>;
        const rem = Number(pay.remaining);
        return <Text strong style={{ color: rem > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(rem)}</Text>;
      },
    },
    {
      title: t('debt.status'), key: 'debt_status', width: 130,
      render: (_: any, r: any) => {
        const pay = payableByOrder.get(r.id);
        return pay ? <StatusTag status={pay.status} type="debt" /> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: t('common.actions'), key: 'actions', width: 60, align: 'center' as const, fixed: 'right' as const,
      render: (_: any, r: any) => {
        const pay = payableByOrder.get(r.id) as any;
        const hasPayments = pay?.payments?.length > 0;
        return hasPayments ? (
          <Tooltip title={t('supplier.purchaseHistory')}>
            <Button type="text" size="small" icon={<HistoryOutlined />} style={{ color: '#52c41a' }} onClick={() => setPaymentModal(pay)} />
          </Tooltip>
        ) : null;
      },
    },
  ];

  return (
    <>
      {/* Summary bar - lên đầu */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Statistic title={t('order.grandTotal')} value={totalPurchase} formatter={(v) => formatVND(v as number)} valueStyle={{ fontSize: 16, color: '#1890ff' }} />
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

      {/* Thông tin NCC */}
      <Card title={t('supplier.info')} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space size={16} style={{ marginBottom: 20 }}>
          <Avatar size={56} style={{ background: '#722ed1', fontSize: 20, fontWeight: 600 }}>{initials}</Avatar>
          <div>
            <Text strong style={{ fontSize: 20, display: 'block' }}>{supplier.company_name}</Text>
            <Tag style={{ borderRadius: 12, fontWeight: 500, color: supplier.is_active ? '#52c41a' : '#999', background: supplier.is_active ? '#f6ffed' : '#f5f5f5', border: `1px solid ${supplier.is_active ? '#b7eb8f' : '#d9d9d9'}` }}>
              {supplier.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
            </Tag>
          </div>
        </Space>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{supplier.contact_name || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{supplier.phone || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />EMAIL</Text><Text strong>{supplier.email || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><AuditOutlined style={{ marginRight: 4 }} />{t('customer.taxCode')}</Text><Text strong>{supplier.tax_code || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><ClockCircleOutlined style={{ marginRight: 4 }} />{t('supplier.paymentTerms')}</Text><Text strong>{paymentTermsLabels[supplier.payment_terms] || supplier.payment_terms}</Text></div></Col>
          <Col xs={24}><div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{supplier.address || '—'}</Text></div></Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }}>
        <Tabs items={[
          {
            key: 'orders',
            label: `${t('supplier.purchaseHistory')} (${orders.length})`,
            children: (
              <>
                <Space wrap style={{ marginBottom: 12 }}>
                  <Input prefix={<SearchOutlined />} placeholder={t('order.searchCode')} allowClear value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
                  <Select value={orderStatus} onChange={setOrderStatus} style={{ minWidth: 150 }} options={[
                    { label: t('common.all'), value: '' },
                    { label: t('purchaseStatusLabels.DRAFT'), value: 'DRAFT' },
                    { label: t('purchaseStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
                    { label: t('purchaseStatusLabels.SHIPPING'), value: 'SHIPPING' },
                    { label: t('purchaseStatusLabels.COMPLETED'), value: 'COMPLETED' },
                  ]} />
                </Space>
                <Table
                  rowKey="id" columns={orderDebtColumns} dataSource={filteredOrders}
                  scroll={{ x: 'max-content' }} size="small" pagination={pgConfig}
                  locale={{ emptyText: <Empty description={t('common.noData')} /> }}
                />
              </>
            ),
          },
          {
            key: 'products',
            label: `${t('supplier.productsSupplied')} (${products.length})`,
            children: (
              <>
                <Input prefix={<SearchOutlined />} placeholder={t('product.searchPlaceholder')} allowClear value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} style={{ width: 220, borderRadius: 8, marginBottom: 12 }} />
                <Table rowKey="id" columns={productColumns} dataSource={filteredProducts}
                  scroll={{ x: 'max-content' }} size="small" pagination={pgConfig}
                  locale={{ emptyText: <Empty description={t('common.noData')} /> }} />
              </>
            ),
          },
        ]} />
      </Card>

      {/* Invoice PDF Preview */}
      <Modal open={!!previewInvoiceId} onCancel={() => setPreviewInvoiceId(null)} footer={null} width={900} title={t('invoice.preview')} styles={{ body: { padding: 0, height: '75vh' } }}>
        {previewInvoiceId && <iframe src={`${invoiceApi.getPdfUrl(previewInvoiceId)}?token=${localStorage.getItem('token')}`} style={{ width: '100%', height: '75vh', border: 'none' }} title="Invoice Preview" />}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        open={!!paymentModal}
        title={`${t('debt.paymentHistory')} — ${paymentModal?.invoice_number || ''}`}
        footer={null}
        width={650}
        onCancel={() => setPaymentModal(null)}
      >
        <Table
          size="small"
          dataSource={paymentModal?.payments || []}
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

export default SupplierDetailPage;
