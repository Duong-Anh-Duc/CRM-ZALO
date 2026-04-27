import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/utils/format';
import { formatVNDShort, CustomerFinancialStats } from '../utils/metrics';

interface Props {
  customer: any;
  stats: CustomerFinancialStats;
}

const ContactItem: React.FC<{ icon: React.ReactNode; label: string; value?: React.ReactNode; mono?: boolean; full?: boolean }> = ({ icon, label, value, mono, full }) => (
  <div className={`pd-contact-item${full ? ' full' : ''}`}>
    <div className="pd-contact-label">{icon}{label}</div>
    {value
      ? <div className={`pd-contact-value${mono ? ' mono' : ''}`}>{value}</div>
      : <div className="pd-contact-value empty">—</div>}
  </div>
);

const CustOverviewTab: React.FC<Props> = ({ customer, stats }) => {
  const { t } = useTranslation();
  const filledFields = [customer.phone, customer.email, customer.contact_name, customer.tax_code, customer.debt_limit, customer.address].filter(Boolean).length;
  const avg = formatVNDShort(stats.avgOrderValue);

  return (
    <>
      <section className="pd-section">
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">01</span> {t('customer.contactInfo')}</h2>
          <span className="pd-section-meta">{t('customer.fieldsFilled', { filled: filledFields, total: 6 })}</span>
        </div>
        <div className="pd-contact-grid">
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>}
            label={t('customer.phone')} value={customer.phone} mono />
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
            label="Email" value={customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : null} />
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            label={t('customer.contactName')} value={customer.contact_name} />
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="13" y2="17" /></svg>}
            label={t('customer.taxCode')} value={customer.tax_code} mono />
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
            label={t('customer.debtLimit')}
            value={Number(customer.debt_limit) > 0 ? Number(customer.debt_limit).toLocaleString('vi') + ' ₫' : null} mono />
          <ContactItem
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
            label={t('customer.memberSince')} value={customer.created_at ? formatDate(customer.created_at) : null} mono />
          <ContactItem full
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>}
            label={t('customer.address')} value={customer.address} />
        </div>
      </section>

      <section className="pd-section">
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">02</span> {t('customer.transactionSummary')}</h2>
          {stats.firstOrderDate && <span className="pd-section-meta">{t('customer.fromFirstOrder')}</span>}
        </div>
        <div className="pd-table-stats">
          <div className="pd-ts-cell">
            <div className="pd-ts-label">{t('customer.firstOrder')}</div>
            <div className="pd-ts-value text mono">{stats.firstOrderDate ? formatDate(stats.firstOrderDate) : '—'}</div>
          </div>
          <div className="pd-ts-cell">
            <div className="pd-ts-label">{t('customer.lastOrder')}</div>
            <div className="pd-ts-value text mono">{stats.lastOrderDate ? formatDate(stats.lastOrderDate) : '—'}</div>
          </div>
          <div className="pd-ts-cell">
            <div className="pd-ts-label">{t('customer.avgOrderValue')}</div>
            <div className="pd-ts-value">{avg.value}<span className="unit">{avg.unit}</span></div>
          </div>
          <div className="pd-ts-cell">
            <div className="pd-ts-label">{t('customer.paymentRate')}</div>
            <div className="pd-ts-value" style={{ color: stats.paymentRatePct >= 80 ? 'var(--pd-green)' : stats.paymentRatePct >= 30 ? 'var(--pd-amber)' : 'var(--pd-red)' }}>
              {stats.paymentRatePct}<span className="unit">%</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CustOverviewTab;
