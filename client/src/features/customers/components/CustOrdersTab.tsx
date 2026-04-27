import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatVND, formatDate, getSalesStatusLabels } from '@/utils/format';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const statusBadgeClass: Record<string, string> = {
  DRAFT: 'pd-badge-gray', PENDING: 'pd-badge-gray',
  NEW: 'pd-badge-info', CONFIRMED: 'pd-badge-info',
  PREPARING: 'pd-badge-amber', SHIPPING: 'pd-badge-amber',
  INVOICED: 'pd-badge-info', COMPLETED: 'pd-badge-success',
  CANCELLED: 'pd-badge-red',
};

const debtBadgeClass = (status?: string) => {
  if (status === 'PAID') return 'pd-badge-success';
  if (status === 'OVERDUE') return 'pd-badge-red';
  if (status === 'PARTIAL') return 'pd-badge-amber';
  return 'pd-badge-amber';
};

interface Props {
  orders: any[];
  receivableByOrder: Map<string, any>;
  onCreateOrder: () => void;
  onPreviewInvoice: (orderId: string) => void;
}

const CustOrdersTab: React.FC<Props> = ({ orders, receivableByOrder, onCreateOrder, onPreviewInvoice }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const statusLabels = getSalesStatusLabels();

  const filtered = orders.filter((o) => {
    if (search && !o.order_code?.toLowerCase().includes(search.toLowerCase())) return false;
    if (status && o.status !== status) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      <div className="pd-section-header">
        <h2 className="pd-section-title"><span className="num">·</span> {t('customer.orderHistory')}</h2>
        <button className="pd-btn pd-btn-primary" onClick={onCreateOrder}>+ {t('customer.createOrder')}</button>
      </div>

      <div className="pd-filter-bar">
        <input className="pd-input" placeholder={t('order.searchCode')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="pd-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('common.all')}</option>
          {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th>{t('order.orderCode')}</th>
              <th>{t('order.orderDate')}</th>
              <th className="right">{t('order.grandTotal')}</th>
              <th>{t('common.status')}</th>
              <th>{t('debt.invoiceNumber')}</th>
              <th className="right">{t('debt.paidShort')}</th>
              <th className="right">{t('debt.remaining')}</th>
              <th>{t('debt.status')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr className="empty-row"><td colSpan={9} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--pd-text-3)' }}>{t('common.noData')}</td></tr>
            ) : pageItems.map((o, idx) => {
              const rec = receivableByOrder.get(o.id);
              const isOverdue = rec?.status === 'OVERDUE';
              return (
                <tr key={o.id} className={isOverdue ? 'row-overdue' : ''}>
                  <td className="mono">{String((page - 1) * pageSize + idx + 1).padStart(2, '0')}</td>
                  <td><span className="order-id mono" onClick={() => navigate(`/sales-orders/${o.id}`)}>{o.order_code}</span></td>
                  <td className="mono">{formatDate(o.order_date)}</td>
                  <td className="right amount">{formatVND(Number(o.grand_total))}</td>
                  <td><span className={`pd-badge ${statusBadgeClass[o.status] || 'pd-badge-gray'}`}>{statusLabels[o.status] || o.status}</span></td>
                  <td>
                    {rec?.invoice_number
                      ? <span className="invoice-link" onClick={() => onPreviewInvoice(o.id)}>{rec.invoice_number}</span>
                      : <span className="empty-cell">—</span>}
                  </td>
                  <td className="right mono" style={{ color: rec?.paid_amount > 0 ? 'var(--pd-green)' : 'var(--pd-text-3)' }}>{rec ? formatVND(Number(rec.paid_amount)) : '—'}</td>
                  <td className="right amount" style={{ color: rec?.remaining > 0 ? 'var(--pd-red)' : undefined }}>{rec ? formatVND(Number(rec.remaining)) : '—'}</td>
                  <td>{rec ? <span className={`pd-badge ${debtBadgeClass(rec.status)}`}>{t(`debtStatusLabels.${rec.status}`)}</span> : <span className="empty-cell">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="pd-pagination">
            <span>
              {t('product.showing', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, filtered.length), total: filtered.length })}
              <select className="pd-page-size" style={{ marginLeft: 12 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </span>
            <div className="pd-page-controls">
              <button className="pd-page-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((p) => (
                <button key={p} className={`pd-page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pd-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CustOrdersTab;
