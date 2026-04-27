import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Empty, Modal, Table, Tag, Tooltip, Button, Input } from 'antd';
import { HistoryOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSupplier } from '../hooks';
import { Supplier, PurchaseOrder, Payable } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { invoiceApi } from '@/features/invoices/api';
import { computeCustomerStats, formatVNDShort, getInitials } from '@/features/customers/utils/metrics';
import '@/features/products/styles/productDetail.css';

type TabKey = 'overview' | 'orders' | 'products' | 'debts' | 'activity';

const SupplierDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const [orderSearch, setOrderSearch] = useState('');
  const [prodSearch, setProdSearch] = useState('');
  const [paymentModal, setPaymentModal] = useState<any>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const { data: supplierData, isLoading } = useSupplier(id);
  const supplier: Supplier | undefined = supplierData?.data;

  const orders: PurchaseOrder[] = (supplierData?.data?.purchase_orders as PurchaseOrder[]) ?? [];
  const payables: Payable[] = (supplierData?.data?.payables as Payable[]) ?? [];
  const supplierPrices: any[] = (supplierData?.data?.supplier_prices as any[]) ?? [];
  const products = useMemo(() => supplierPrices.map((sp: any) => ({
    id: sp.product?.id, sku: sp.product?.sku, name: sp.product?.name,
    cost_price: sp.purchase_price, moq: sp.moq, lead_time_days: sp.lead_time_days, is_preferred: sp.is_preferred,
  })), [supplierPrices]);

  // Reuse customer stats helper but pass the analogous arrays
  const stats = useMemo(() => computeCustomerStats(
    orders.map((o: any) => ({ ...o, grand_total: Number(o.total) })) as any[],
    payables as any[],
  ), [orders, payables]);

  const payableByOrder = useMemo(() => {
    const m = new Map<string, Payable>();
    payables.forEach((p: any) => { if (p.purchase_order_id) m.set(p.purchase_order_id, p); });
    return m;
  }, [payables]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!supplier) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const initials = getInitials(supplier.company_name);
  const totalShort = formatVNDShort(stats.totalRevenue);
  const paidShort = formatVNDShort(stats.totalPaid);
  const remainShort = formatVNDShort(stats.totalRemaining);

  const filteredOrders = orders.filter((o: any) => !orderSearch || o.order_code.toLowerCase().includes(orderSearch.toLowerCase()));
  const filteredProducts = products.filter((p: any) => !prodSearch || (p.name || '').toLowerCase().includes(prodSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(prodSearch.toLowerCase()));

  const tabs: { key: TabKey; label: string; count?: number; danger?: boolean }[] = [
    { key: 'overview', label: t('product.overview') },
    { key: 'orders', label: t('supplier.purchaseHistory'), count: orders.length },
    { key: 'products', label: t('supplier.productsSupplied'), count: products.length },
    { key: 'debts', label: t('customer.debts'), count: stats.overdueCount, danger: stats.overdueCount > 0 },
  ];

  const orderColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('order.orderCode'), key: 'code', width: 170, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${r.id}`)}>{r.order_code}</Button> },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'date', width: 110, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, render: (s: string) => <Tag>{t(`purchaseStatusLabels.${s}`)}</Tag> },
    { title: t('debt.invoiceNumber'), key: 'invoice', width: 140, render: (_: any, r: any) => {
      const pay = payableByOrder.get(r.id) as any;
      if (!pay?.invoice_number) return '—';
      return <Button type="link" size="small" style={{ padding: 0 }} onClick={async () => {
        try { const res = await invoiceApi.list({ purchase_order_id: r.id, limit: 1 }); const inv = (res.data?.data as any)?.invoices?.[0] || (res.data?.data as any)?.[0]; if (inv) setPreviewInvoiceId(inv.id); } catch { /**/ }
      }}><FilePdfOutlined style={{ marginRight: 4 }} />{pay.invoice_number}</Button>;
    }},
    { title: t('debt.paidShort'), key: 'paid', width: 120, align: 'right' as const, render: (_: any, r: any) => { const pay = payableByOrder.get(r.id); return pay ? <span style={{ color: '#52c41a' }}>{formatVND(Number(pay.paid_amount))}</span> : '—'; } },
    { title: t('debt.remaining'), key: 'remaining', width: 120, align: 'right' as const, render: (_: any, r: any) => { const pay = payableByOrder.get(r.id); if (!pay) return '—'; const rem = Number(pay.remaining); return <strong style={{ color: rem > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(rem)}</strong>; } },
    { title: '', key: 'actions', width: 50, align: 'center' as const, render: (_: any, r: any) => { const pay = payableByOrder.get(r.id) as any; return pay?.payments?.length > 0 ? <Tooltip title={t('debt.paymentHistory')}><Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => setPaymentModal(pay)} /></Tooltip> : null; } },
  ];

  const productColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 110 },
    { title: t('order.productName'), key: 'name', ellipsis: true, render: (_: any, r: any) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/products/${r.id}`)}>{r.name}</Button> },
    { title: t('supplier.costPrice'), dataIndex: 'cost_price', key: 'cost', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 80, align: 'right' as const },
    { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 110, render: (v: number) => v ? `${v} ${t('product.days')}` : '-' },
    { title: '', dataIndex: 'is_preferred', key: 'pref', width: 90, render: (v: boolean) => v ? <Tag color="gold">{t('product.preferred')}</Tag> : null },
  ];

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/suppliers')}>{t('menu.suppliers')}</a>
          <span className="sep">/</span>
          <span className="current">{supplier.company_name}</span>
        </div>
        <div className="pd-actions">
          <button className="pd-btn" onClick={() => navigate(`/suppliers/${id}/edit`)}>{t('common.edit')}</button>
          <button className="pd-btn pd-btn-primary" onClick={() => navigate(`/purchase-orders/create?supplier_id=${id}`)}>+ {t('order.createPurchaseOrder')}</button>
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero pd-hero-cust">
          <div className="pd-cust-card">
            <div className="pd-cust-cover">
              <div className="pd-cust-cover-label">{t('menu.suppliers')}</div>
            </div>
            <div className="pd-cust-avatar-wrap"><div className="pd-cust-avatar" style={{ background: 'linear-gradient(135deg, #F3E8FF 0%, #C4B5FD 100%)' }}>{initials}</div></div>
            <div className="pd-cust-body">
              <h2 className="pd-cust-name">{supplier.company_name}</h2>
              <div className="pd-cust-id">{supplier.id?.slice(0, 8).toUpperCase()} · {t('supplier.partnerSince', { date: formatDate(supplier.created_at) })}</div>
              <div className="pd-cust-badges">
                <span className="pd-badge pd-badge-purple">{t('menu.suppliers')}</span>
                <span className={`pd-badge ${supplier.is_active ? 'pd-badge-success' : 'pd-badge-gray'}`}>{supplier.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}</span>
              </div>
              <ul className="pd-cust-meta-list">
                {supplier.contact_name && <li><span className="lbl">{t('customer.contactName')}</span><span className="val">{supplier.contact_name}</span></li>}
                {supplier.phone && <li><span className="lbl">{t('customer.phone')}</span><span className="val mono">{supplier.phone}</span></li>}
                {supplier.tax_code && <li><span className="lbl">{t('customer.taxCode')}</span><span className="val mono">{supplier.tax_code}</span></li>}
                {supplier.payment_terms && <li><span className="lbl">{t('supplier.paymentTerms')}</span><span className="val">{t(`paymentTermsLabels.${supplier.payment_terms}`)}</span></li>}
                <li><span className="lbl">{t('customer.ordersTotal')}</span><span className="val mono">{orders.length}</span></li>
              </ul>
              <div className="pd-cust-actions">
                {supplier.phone && <a className="pd-btn" href={`tel:${supplier.phone}`} style={{ textDecoration: 'none' }}>{t('customer.call')}</a>}
                {supplier.email && <a className="pd-btn pd-btn-primary" href={`mailto:${supplier.email}`} style={{ textDecoration: 'none' }}>{t('customer.email')}</a>}
              </div>
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className="pd-badge pd-badge-info">{t('supplier.purchaseProfile')}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--pd-text-3)' }}>{t('customer.updatedAt')} {formatDate(supplier.updated_at)}</span>
            </div>
            <div className="pd-title-block">
              <h1 className="pd-title">{t('supplier.profileTitle')}</h1>
              <p className="pd-subtitle">{t('supplier.profileSubtitle')}</p>
            </div>

            <div className="pd-metrics">
              <div className="pd-metric">
                <div className="pd-metric-label">{t('supplier.totalPurchase')}</div>
                <div className="pd-metric-value">{totalShort.value}<span className="pd-metric-unit"> {totalShort.unit}</span></div>
                <div className="pd-metric-trend">{t('customer.ordersDuration', { count: orders.length })}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('supplier.paid')}</div>
                <div className="pd-metric-value success">{paidShort.value}<span className="pd-metric-unit"> {paidShort.unit}</span></div>
                <div className="pd-metric-trend trend-up">{stats.paymentRatePct}% {t('customer.ofTotal')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('supplier.payable')}</div>
                <div className="pd-metric-value">{remainShort.value}<span className="pd-metric-unit"> {remainShort.unit}</span></div>
                <div className="pd-metric-trend">{t('customer.onInvoices', { count: payables.filter((p: any) => Number(p.remaining) > 0).length })}</div>
              </div>
              <div className={`pd-metric${stats.overdueCount > 0 ? ' alert' : ''}`}>
                <div className="pd-metric-label">{t('debt.overdue')}</div>
                <div className={`pd-metric-value${stats.overdueCount > 0 ? ' danger' : ''}`}>{stats.overdueCount}<span className="pd-metric-unit"> {t('debt.invoices')}</span></div>
                <div className={`pd-metric-trend${stats.overdueCount > 0 ? ' trend-down' : ''}`}>
                  {stats.overdueCount > 0
                    ? `${formatVNDShort(stats.overdueAmount).value} ${formatVNDShort(stats.overdueAmount).unit}${stats.worstOverdueInvoice ? ` · ${t('customer.lateDays', { days: stats.worstOverdueInvoice.daysLate })}` : ''}`
                    : t('customer.noOverdue')}
                </div>
              </div>
            </div>

            {stats.worstOverdueInvoice && (
              <div className="pd-quote warning">
                <div className="pd-quote-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div className="pd-quote-text">{t('supplier.overdueWarning', { invoice: stats.worstOverdueInvoice.invoiceNumber, amount: stats.worstOverdueInvoice.amount.toLocaleString('vi'), days: stats.worstOverdueInvoice.daysLate })}</div>
                <button className="pd-btn" onClick={() => setTab('debts')}>{t('debt.viewDebt')} →</button>
              </div>
            )}
          </div>
        </section>

        <div className="pd-tabs-wrap">
          <div className="pd-tabs">
            {tabs.map(tb => (
              <button key={tb.key} className={`pd-tab${tb.key === tab ? ' active' : ''}`} onClick={() => setTab(tb.key)}>
                {tb.label}{tb.count !== undefined && tb.count > 0 && <span className={`pd-tab-count${tb.danger ? ' danger' : ''}`}>{tb.count}</span>}
              </button>
            ))}
          </div>
          <div className="pd-tab-content">
            {tab === 'overview' && (
              <section className="pd-section">
                <div className="pd-section-header"><h2 className="pd-section-title"><span className="num">01</span> {t('customer.contactInfo')}</h2></div>
                <div className="pd-contact-grid">
                  <div className="pd-contact-item"><div className="pd-contact-label">{t('customer.phone')}</div><div className={`pd-contact-value${supplier.phone ? ' mono' : ' empty'}`}>{supplier.phone || '—'}</div></div>
                  <div className="pd-contact-item"><div className="pd-contact-label">Email</div><div className={`pd-contact-value${supplier.email ? '' : ' empty'}`}>{supplier.email ? <a href={`mailto:${supplier.email}`}>{supplier.email}</a> : '—'}</div></div>
                  <div className="pd-contact-item"><div className="pd-contact-label">{t('customer.contactName')}</div><div className={`pd-contact-value${supplier.contact_name ? '' : ' empty'}`}>{supplier.contact_name || '—'}</div></div>
                  <div className="pd-contact-item"><div className="pd-contact-label">{t('customer.taxCode')}</div><div className={`pd-contact-value${supplier.tax_code ? ' mono' : ' empty'}`}>{supplier.tax_code || '—'}</div></div>
                  <div className="pd-contact-item"><div className="pd-contact-label">{t('supplier.paymentTerms')}</div><div className="pd-contact-value">{t(`paymentTermsLabels.${supplier.payment_terms}`)}</div></div>
                  <div className="pd-contact-item"><div className="pd-contact-label">{t('customer.memberSince')}</div><div className="pd-contact-value mono">{formatDate(supplier.created_at)}</div></div>
                  <div className="pd-contact-item full"><div className="pd-contact-label">{t('customer.address')}</div><div className={`pd-contact-value${supplier.address ? '' : ' empty'}`}>{supplier.address || '—'}</div></div>
                </div>
              </section>
            )}
            {tab === 'orders' && (
              <>
                <div className="pd-filter-bar">
                  <Input className="pd-input" prefix={<SearchOutlined />} placeholder={t('order.searchCode')} value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} style={{ maxWidth: 280 }} />
                </div>
                <Table rowKey="id" columns={orderColumns} dataSource={filteredOrders} size="small" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['5', '10', '20', '50'] }} />
              </>
            )}
            {tab === 'products' && (
              <>
                <div className="pd-filter-bar">
                  <Input className="pd-input" prefix={<SearchOutlined />} placeholder={t('product.searchPlaceholder')} value={prodSearch} onChange={(e) => setProdSearch(e.target.value)} style={{ maxWidth: 280 }} />
                </div>
                <Table rowKey="id" columns={productColumns} dataSource={filteredProducts} size="small" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ['5', '10', '20', '50'] }} />
              </>
            )}
            {tab === 'debts' && (
              <>
                <div className="pd-section-header">
                  <h2 className="pd-section-title"><span className="num">·</span> {t('customer.debtStatus')}</h2>
                  <button className="pd-btn pd-btn-primary" onClick={() => navigate(`/payables/supplier/${supplier.id}`)}>{t('debt.viewDetail')}</button>
                </div>
                <Table rowKey="id" columns={orderColumns.filter((c: any) => ['stt','code','date','invoice','paid','remaining','actions'].includes(c.key))}
                  dataSource={filteredOrders.filter((o: any) => payableByOrder.has(o.id))}
                  size="small" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: true }} />
              </>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!previewInvoiceId} onCancel={() => setPreviewInvoiceId(null)} footer={null} width={Math.min(window.innerWidth * 0.95, 900)} title={t('invoice.preview')} styles={{ body: { padding: 0, height: '75vh' } }}>
        {previewInvoiceId && <iframe src={`${invoiceApi.getPdfUrl(previewInvoiceId)}?token=${localStorage.getItem('token')}`} style={{ width: '100%', height: '75vh', border: 'none' }} title="Invoice" />}
      </Modal>

      <Modal open={!!paymentModal} title={`${t('debt.paymentHistory')} — ${paymentModal?.invoice_number || ''}`} footer={null} width={Math.min(window.innerWidth * 0.95, 650)} onCancel={() => setPaymentModal(null)}>
        <Table size="small" dataSource={paymentModal?.payments || []} rowKey="id" pagination={false} scroll={{ x: 'max-content' }} columns={[
          { title: 'STT', key: 'stt', width: 40, render: (_: any, __: any, i: number) => i + 1 },
          { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'date', width: 110, render: formatDate },
          { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 130, align: 'right' as const, render: (v: number) => <strong style={{ color: '#52c41a' }}>{formatVND(v)}</strong> },
          { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 140, render: (v: string) => <Tag>{v === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : v === 'CASH' ? t('payment.methodCash') : v}</Tag> },
          { title: t('payment.reference'), dataIndex: 'reference', key: 'ref', ellipsis: true, render: (v: string) => v || '-' },
        ]} />
      </Modal>
    </div>
  );
};

export default SupplierDetailPage;
