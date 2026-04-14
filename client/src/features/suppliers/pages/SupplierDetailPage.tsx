import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Spin, Table, Tag, Typography, Space, Empty, Row, Col, Avatar, Button, Modal, Input, Select } from 'antd';
import { PhoneOutlined, MailOutlined, UserOutlined, AuditOutlined, EnvironmentOutlined, ClockCircleOutlined, ShopOutlined, ShoppingCartOutlined, DollarOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSupplier } from '../hooks';
import { StatusTag } from '@/components/common';
import { Supplier, PurchaseOrder, Payable } from '@/types';
import { formatVND, formatDate } from '@/utils/format';

const { Text } = Typography;
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const SupplierDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [modal, setModal] = useState<'products' | 'orders' | 'payables' | null>(null);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [prodSearch, setProdSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [debtStatus, setDebtStatus] = useState('');

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

  const filteredPayables = useMemo(() => {
    let result = payables;
    if (debtStatus) result = result.filter((p) => p.status === debtStatus);
    return result;
  }, [payables, debtStatus]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!supplier) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const initials = supplier.company_name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const nw = () => ({ style: { whiteSpace: 'nowrap' as const } });
  const pgConfig = (unit: string) => ({
    pageSize, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'],
    onShowSizeChange: (_: number, size: number) => setPageSize(size),
    showTotal: (t2: number) => `${t2} ${unit}`,
  });

  const productColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: t('order.productName'), key: 'name', ellipsis: true, onHeaderCell: nw, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { setModal(null); navigate(`/products/${r.id}`); }}>{r.name}</Button> },
    { title: t('supplier.costPrice'), dataIndex: 'cost_price', key: 'cost', width: 120, align: 'right' as const, onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 80, align: 'right' as const },
    { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 120, onHeaderCell: nw, render: (v: number) => v ? `${v} ${t('product.days')}` : '-' },
    { title: '', dataIndex: 'is_preferred', key: 'pref', width: 70, render: (v: boolean) => v ? <Tag color="gold" style={{ borderRadius: 6 }}>{t('product.preferred')}</Tag> : null },
  ];

  const orderColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('order.orderCode'), key: 'code', width: 170, onHeaderCell: nw, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { setModal(null); navigate(`/purchase-orders/${r.id}`); }}>{r.order_code}</Button> },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'date', width: 110, onHeaderCell: nw, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'total', key: 'total', width: 140, align: 'right' as const, onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, onHeaderCell: nw, render: (s: string) => <StatusTag status={s} type="purchase" /> },
  ];

  const payableColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'inv', width: 150, ellipsis: true, onHeaderCell: nw },
    { title: t('debt.dueDate'), dataIndex: 'due_date', key: 'due', width: 120, onHeaderCell: nw, render: formatDate },
    { title: t('debt.originalAmount'), dataIndex: 'original_amount', key: 'orig', width: 140, align: 'right' as const, onHeaderCell: nw, render: (v: number) => formatVND(v) },
    { title: t('debt.remaining'), dataIndex: 'remaining', key: 'rem', width: 140, align: 'right' as const, onHeaderCell: nw, render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(v)}</Text> },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, onHeaderCell: nw, render: (s: string) => <StatusTag status={s} type="debt" /> },
  ];

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        {/* Header */}
        <Space size={16} style={{ marginBottom: 24 }}>
          <Avatar size={56} style={{ background: '#722ed1', fontSize: 20, fontWeight: 600 }}>{initials}</Avatar>
          <div>
            <Text strong style={{ fontSize: 20, display: 'block' }}>{supplier.company_name}</Text>
            <Tag style={{ borderRadius: 12, fontWeight: 500, color: supplier.is_active ? '#52c41a' : '#999', background: supplier.is_active ? '#f6ffed' : '#f5f5f5', border: `1px solid ${supplier.is_active ? '#b7eb8f' : '#d9d9d9'}` }}>
              {supplier.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
            </Tag>
          </div>
        </Space>

        {/* Info grid */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{supplier.contact_name || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{supplier.phone || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />EMAIL</Text><Text strong>{supplier.email || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><AuditOutlined style={{ marginRight: 4 }} />{t('customer.taxCode')}</Text><Text strong>{supplier.tax_code || '—'}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><ClockCircleOutlined style={{ marginRight: 4 }} />{t('supplier.paymentTerms')}</Text><Text strong>{paymentTermsLabels[supplier.payment_terms] || supplier.payment_terms}</Text></div></Col>
          <Col xs={24}><div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{supplier.address || '—'}</Text></div></Col>
        </Row>

        {/* 3 Action Buttons */}
        <Row gutter={[12, 12]} style={{ marginTop: 20 }}>
          <Col xs={24} sm={8}>
            <Button block icon={<ShopOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('products')}>
              {t('supplier.productsSupplied')} ({products.length})
            </Button>
          </Col>
          <Col xs={24} sm={8}>
            <Button block icon={<ShoppingCartOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('orders')}>
              {t('supplier.purchaseHistory')} ({orders.length})
            </Button>
          </Col>
          <Col xs={24} sm={8}>
            <Button block icon={<DollarOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setModal('payables')}>
              {t('debt.payables')} ({payables.length})
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Products Modal */}
      <Modal open={modal === 'products'} onCancel={() => setModal(null)} footer={null}
        title={t('supplier.productsSupplied')} width={window.innerWidth < 640 ? '95vw' : 850}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('product.searchPlaceholder')} allowClear value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} style={{ width: 220, borderRadius: 8 }} />
        </Space>
        <Table rowKey="id" columns={productColumns} dataSource={filteredProducts}
          scroll={{ x: 700 }} size="small" pagination={pgConfig(t('product.suppliersUnit'))} />
      </Modal>

      {/* Orders Modal */}
      <Modal open={modal === 'orders'} onCancel={() => setModal(null)} footer={null}
        title={t('supplier.purchaseHistory')} width={window.innerWidth < 640 ? '95vw' : 800}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Input prefix={<SearchOutlined />} placeholder={t('order.searchCode')} allowClear value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
          <Select value={orderStatus} onChange={setOrderStatus} style={{ minWidth: 140 }} options={[
            { label: t('common.all'), value: '' },
            { label: t('purchaseStatusLabels.CONFIRMED'), value: 'CONFIRMED' },
            { label: t('purchaseStatusLabels.SHIPPING'), value: 'SHIPPING' },
            { label: t('purchaseStatusLabels.COMPLETED'), value: 'COMPLETED' },
          ]} />
        </Space>
        <Table rowKey="id" columns={orderColumns} dataSource={filteredOrders}
          scroll={{ x: 600 }} size="small" pagination={pgConfig(t('supplier.orderUnit'))} />
      </Modal>

      {/* Payables Modal */}
      <Modal open={modal === 'payables'} onCancel={() => setModal(null)} footer={null}
        title={t('debt.payables')} width={window.innerWidth < 640 ? '95vw' : 850}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select value={debtStatus} onChange={setDebtStatus} style={{ minWidth: 140 }} options={[
            { label: t('common.all'), value: '' },
            { label: t('debtStatusLabels.UNPAID'), value: 'UNPAID' },
            { label: t('debtStatusLabels.PARTIAL'), value: 'PARTIAL' },
            { label: t('debtStatusLabels.PAID'), value: 'PAID' },
            { label: t('debtStatusLabels.OVERDUE'), value: 'OVERDUE' },
          ]} />
        </Space>
        <Table rowKey="id" columns={payableColumns} dataSource={filteredPayables}
          scroll={{ x: 700 }} size="small" pagination={pgConfig(t('supplier.debtUnit'))} />
      </Modal>
    </>
  );
};

export default SupplierDetailPage;
