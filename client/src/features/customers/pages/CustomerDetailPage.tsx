import React, { useMemo, useState } from 'react';
import { Spin, Empty, Modal } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useCustomer } from '../hooks';
import { invoiceApi } from '@/features/invoices/api';
import { formatVND, formatDate } from '@/utils/format';
import CustOverviewTab from '../components/CustOverviewTab';
import CustOrdersTab from '../components/CustOrdersTab';
import CustDebtsTab from '../components/CustDebtsTab';
import { computeCustomerStats, formatVNDShort, getInitials } from '../utils/metrics';
import '@/features/products/styles/productDetail.css';

type TabKey = 'overview' | 'orders' | 'debts' | 'activity';

const CustomerDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customerData, isLoading } = useCustomer(id);
  const customer: any = customerData?.data;

  const [tab, setTab] = useState<TabKey>('overview');
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);

  const orders: any[] = customer?.sales_orders ?? [];
  const receivables: any[] = customer?.receivables ?? [];
  const stats = useMemo(() => computeCustomerStats(orders, receivables), [orders, receivables]);

  const receivableByOrder = useMemo(() => {
    const m = new Map<string, any>();
    receivables.forEach((r) => { if (r.sales_order_id) m.set(r.sales_order_id, r); });
    return m;
  }, [receivables]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!customer) return <Empty description={t('customer.notFound')} style={{ marginTop: 80 }} />;

  const name = customer.company_name || customer.contact_name || '—';
  const initials = getInitials(name);
  const debtLimit = Number(customer.debt_limit || 0);
  const usagePct = debtLimit > 0 ? Math.min(100, (stats.totalRemaining / debtLimit) * 100) : 0;
  const fillClass = usagePct >= 80 ? 'danger' : usagePct >= 50 ? 'warn' : '';

  const totalRevShort = formatVNDShort(stats.totalRevenue);
  const paidShort = formatVNDShort(stats.totalPaid);
  const remainShort = formatVNDShort(stats.totalRemaining);

  const handlePreviewInvoice = async (orderId: string) => {
    try {
      const res = await invoiceApi.list({ sales_order_id: orderId, limit: 1 });
      const inv = (res.data?.data as any)?.invoices?.[0] || (res.data?.data as any)?.[0];
      if (inv) setPreviewInvoiceId(inv.id);
    } catch { /* ignore */ }
  };

  const handleSendReminder = (_recId: string) => {
    toast.info(t('customer.reminderTodo'));
  };

  const tabs: { key: TabKey; label: string; count?: number; danger?: boolean }[] = [
    { key: 'overview', label: t('product.overview') },
    { key: 'orders', label: t('customer.orders'), count: orders.length },
    { key: 'debts', label: t('customer.debts'), count: stats.overdueCount, danger: stats.overdueCount > 0 },
    { key: 'activity', label: t('customer.activity') },
  ];

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/customers')}>{t('menu.customers')}</a>
          <span className="sep">/</span>
          <span>{t(`customerTypeLabels.${customer.customer_type}`)}</span>
          <span className="sep">/</span>
          <span className="current">{name}</span>
        </div>
        <div className="pd-actions">
          <button className="pd-btn" onClick={() => navigate(`/customers/${id}/edit`)}>{t('common.edit')}</button>
          <button className="pd-btn pd-btn-primary" onClick={() => navigate(`/sales-orders/create?customer_id=${id}`)}>+ {t('customer.createOrder')}</button>
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero pd-hero-cust">
          <div className="pd-cust-card">
            <div className="pd-cust-cover">
              <div className="pd-cust-cover-label">{t('menu.customers')} · {t(`customerTypeLabels.${customer.customer_type}`)}</div>
            </div>
            <div className="pd-cust-avatar-wrap"><div className="pd-cust-avatar">{initials}</div></div>
            <div className="pd-cust-body">
              <h2 className="pd-cust-name">{name}</h2>
              <div className="pd-cust-id">{customer.id?.slice(0, 8).toUpperCase()} · {t('customer.memberSince')} {formatDate(customer.created_at)}</div>

              <div className="pd-cust-badges">
                <span className={`pd-badge ${customer.customer_type === 'BUSINESS' ? 'pd-badge-purple' : 'pd-badge-info'}`}>
                  {t(`customerTypeLabels.${customer.customer_type}`)}
                </span>
                <span className={`pd-badge ${customer.is_active ? 'pd-badge-success' : 'pd-badge-gray'}`}>
                  {customer.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
                </span>
              </div>

              <ul className="pd-cust-meta-list">
                {customer.contact_name && <li><span className="lbl">{t('customer.contactName')}</span><span className="val">{customer.contact_name}</span></li>}
                {customer.phone && <li><span className="lbl">{t('customer.phone')}</span><span className="val mono">{customer.phone}</span></li>}
                {customer.tax_code && <li><span className="lbl">{t('customer.taxCode')}</span><span className="val mono">{customer.tax_code}</span></li>}
                <li><span className="lbl">{t('customer.ordersTotal')}</span><span className="val mono">{orders.length}</span></li>
              </ul>

              <div className="pd-cust-actions">
                {customer.phone && <a className="pd-btn" href={`tel:${customer.phone}`} style={{ textDecoration: 'none' }}>{t('customer.call')}</a>}
                {customer.email && <a className="pd-btn pd-btn-primary" href={`mailto:${customer.email}`} style={{ textDecoration: 'none' }}>{t('customer.email')}</a>}
              </div>
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className="pd-badge pd-badge-info">{t('customer.financialProfile')}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--pd-text-3)' }}>{t('customer.updatedAt')} {formatDate(customer.updated_at)}</span>
            </div>

            <div className="pd-title-block">
              <h1 className="pd-title">{t('customer.profileTitle')}</h1>
              <p className="pd-subtitle">
                {t('customer.profileSubtitle')}
                {customer.email && <> {t('customer.contactVia')} <a href={`mailto:${customer.email}`}>{customer.email}</a> {t('customer.toUpdateInfo')}.</>}
              </p>
            </div>

            <div className="pd-metrics">
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  {t('customer.txTotal')}
                </div>
                <div className="pd-metric-value">{totalRevShort.value}<span className="pd-metric-unit"> {totalRevShort.unit}</span></div>
                <div className="pd-metric-trend">{t('customer.ordersDuration', { count: orders.length })}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  {t('customer.totalPaid')}
                </div>
                <div className="pd-metric-value success">{paidShort.value}<span className="pd-metric-unit"> {paidShort.unit}</span></div>
                <div className="pd-metric-trend trend-up">{stats.paymentRatePct}% {t('customer.ofTotal')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  {t('customer.remaining')}
                </div>
                <div className="pd-metric-value">{remainShort.value}<span className="pd-metric-unit"> {remainShort.unit}</span></div>
                <div className="pd-metric-trend">{t('customer.onInvoices', { count: receivables.filter((r) => Number(r.remaining) > 0).length })}</div>
              </div>
              <div className={`pd-metric${stats.overdueCount > 0 ? ' alert' : ''}`}>
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  {t('debt.overdue')}
                </div>
                <div className={`pd-metric-value${stats.overdueCount > 0 ? ' danger' : ''}`}>{stats.overdueCount}<span className="pd-metric-unit"> {t('debt.invoices')}</span></div>
                <div className={`pd-metric-trend${stats.overdueCount > 0 ? ' trend-down' : ''}`}>
                  {stats.overdueCount > 0
                    ? `${formatVNDShort(stats.overdueAmount).value} ${formatVNDShort(stats.overdueAmount).unit}${stats.worstOverdueInvoice ? ` · ${t('customer.lateDays', { days: stats.worstOverdueInvoice.daysLate })}` : ''}`
                    : t('customer.noOverdue')}
                </div>
              </div>
            </div>

            {debtLimit > 0 && (
              <div className="pd-credit-wrap">
                <div className="pd-credit-header">
                  <span className="pd-credit-title">{t('customer.creditUsage')}</span>
                  <span className="pd-credit-vals">
                    <span className="used">{formatVND(stats.totalRemaining)}</span>
                    <span className="total"> / {formatVND(debtLimit)}</span>
                  </span>
                </div>
                <div className="pd-credit-bar">
                  <div className={`pd-credit-fill ${fillClass}`} style={{ width: `${usagePct}%` }} />
                </div>
                <div className="pd-credit-meta">
                  <span>{t('customer.usedPct', { pct: usagePct.toFixed(2).replace(/\.?0+$/, '') })}</span>
                  <span>{t('customer.availableLimit')} <strong>{formatVND(Math.max(0, debtLimit - stats.totalRemaining))}</strong></span>
                </div>
              </div>
            )}

            {stats.worstOverdueInvoice && (
              <div className="pd-quote warning">
                <div className="pd-quote-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                </div>
                <div className="pd-quote-text">
                  {t('customer.overdueWarning', {
                    invoice: stats.worstOverdueInvoice.invoiceNumber,
                    amount: stats.worstOverdueInvoice.amount.toLocaleString('vi'),
                    days: stats.worstOverdueInvoice.daysLate,
                  })}
                </div>
                <button className="pd-btn" onClick={() => setTab('debts')}>{t('customer.sendReminder')} →</button>
              </div>
            )}
          </div>
        </section>

        <div className="pd-tabs-wrap">
          <div className="pd-tabs">
            {tabs.map((tb) => (
              <button key={tb.key} className={`pd-tab${tb.key === tab ? ' active' : ''}`} onClick={() => setTab(tb.key)}>
                {tb.label}
                {tb.count !== undefined && tb.count > 0 && <span className={`pd-tab-count${tb.danger ? ' danger' : ''}`}>{tb.count}</span>}
              </button>
            ))}
          </div>
          <div className="pd-tab-content">
            {tab === 'overview' && <CustOverviewTab customer={customer} stats={stats} />}
            {tab === 'orders' && (
              <CustOrdersTab orders={orders} receivableByOrder={receivableByOrder}
                onCreateOrder={() => navigate(`/sales-orders/create?customer_id=${id}`)}
                onPreviewInvoice={handlePreviewInvoice} />
            )}
            {tab === 'debts' && <CustDebtsTab receivables={receivables} stats={stats} onSendReminder={handleSendReminder} />}
            {tab === 'activity' && (
              <div className="pd-empty-state">
                <svg className="icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                <div className="title">{t('customer.noActivity')}</div>
                <div>{t('customer.noActivityDesc')}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={!!previewInvoiceId} onCancel={() => setPreviewInvoiceId(null)} footer={null}
        width={Math.min(window.innerWidth * 0.95, 900)} title={t('invoice.preview')}
        styles={{ body: { padding: 0, height: '75vh' } }}>
        {previewInvoiceId && (
          <iframe src={`${invoiceApi.getPdfUrl(previewInvoiceId)}?token=${localStorage.getItem('token')}`}
            style={{ width: '100%', height: '75vh', border: 'none' }} title="Invoice" />
        )}
      </Modal>
    </div>
  );
};

export default CustomerDetailPage;
