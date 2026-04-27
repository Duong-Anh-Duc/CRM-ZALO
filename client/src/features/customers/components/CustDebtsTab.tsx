import React from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { formatVND, formatDate } from '@/utils/format';
import { formatVNDShort, CustomerFinancialStats } from '../utils/metrics';

interface Props {
  receivables: any[];
  stats: CustomerFinancialStats;
  onSendReminder: (receivableId: string) => void;
}

const CustDebtsTab: React.FC<Props> = ({ receivables, stats, onSendReminder }) => {
  const { t } = useTranslation();
  const open = receivables.filter((r) => Number(r.remaining) > 0);
  const totalShort = formatVNDShort(stats.totalRemaining);
  const overdueShort = formatVNDShort(stats.overdueAmount);
  const inTermShort = formatVNDShort(stats.inTermAmount);

  return (
    <>
      <div className="pd-section-header">
        <h2 className="pd-section-title"><span className="num">·</span> {t('customer.debtStatus')}</h2>
        <span className="pd-section-meta">{t('customer.openInvoices', { count: open.length })}</span>
      </div>

      <div className="pd-table-stats" style={{ marginBottom: 24 }}>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('debt.totalReceivable')}</div>
          <div className="pd-ts-value" style={{ color: stats.totalRemaining > 0 ? 'var(--pd-red)' : 'var(--pd-text)' }}>{totalShort.value}<span className="unit">{totalShort.unit}</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('debt.overdue')}</div>
          <div className="pd-ts-value" style={{ color: stats.overdueAmount > 0 ? 'var(--pd-red)' : 'var(--pd-text)' }}>{overdueShort.value}<span className="unit">{overdueShort.unit}</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('customer.inTerm')}</div>
          <div className="pd-ts-value">{inTermShort.value}<span className="unit">{inTermShort.unit}</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('customer.avgDebtAge')}</div>
          <div className="pd-ts-value">{stats.avgAgeDays}<span className="unit">{t('product.days')}</span></div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className="pd-empty-state">
          <div className="title">{t('customer.noOpenDebt')}</div>
          <div>{t('customer.noOpenDebtDesc')}</div>
        </div>
      ) : (
        <div className="pd-debt-list">
          {open.map((r) => {
            const today = dayjs();
            const dueDate = r.due_date ? dayjs(r.due_date) : null;
            const daysToDue = dueDate ? dueDate.diff(today, 'day') : null;
            const isOverdue = r.status === 'OVERDUE' || (daysToDue !== null && daysToDue < 0);
            const daysLate = dueDate && isOverdue ? today.diff(dueDate, 'day') : null;

            return (
              <div key={r.id} className={`pd-debt-card${isOverdue ? ' overdue' : ''}`}>
                <div className={`pd-debt-status-icon ${isOverdue ? 'overdue' : 'unpaid'}`}>
                  {isOverdue ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  )}
                </div>
                <div className="pd-debt-info">
                  <div className="pd-debt-row1">
                    <span className="pd-debt-invoice">{r.invoice_number || `REC-${String(r.id).slice(0, 6)}`}</span>
                    {isOverdue
                      ? <span className="pd-badge pd-badge-red">{t('customer.overdueDays', { days: daysLate })}</span>
                      : daysToDue !== null && <span className="pd-badge pd-badge-amber">{t('customer.dueIn', { days: daysToDue })}</span>}
                  </div>
                  <div className="pd-debt-meta">
                    {r.sales_order?.order_code && <><span>{t('debt.order')} <span className="mono">{r.sales_order.order_code}</span></span><span>·</span></>}
                    {r.invoice_date && <><span>{t('debt.issued')} <span className="mono">{formatDate(r.invoice_date)}</span></span><span>·</span></>}
                    {r.due_date && <span>{t('debt.dueDate')} <span className="mono" style={{ color: isOverdue ? 'var(--pd-red)' : undefined }}>{formatDate(r.due_date)}</span></span>}
                  </div>
                </div>
                <div className="pd-debt-amounts">
                  <div className={`pd-debt-amount-main${isOverdue ? ' danger' : ''}`}>{formatVND(Number(r.remaining))}</div>
                  <div className="pd-debt-amount-meta">
                    {Number(r.paid_amount) > 0
                      ? t('customer.paidOf', { paid: Number(r.paid_amount).toLocaleString('vi'), total: Number(r.original_amount).toLocaleString('vi') })
                      : t('customer.unpaid')}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button className={`pd-btn ${isOverdue ? 'pd-btn-danger' : ''}`} style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => onSendReminder(r.id)}>
                      {isOverdue ? t('customer.remindNow') : t('customer.sendReminder')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default CustDebtsTab;
