import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { aggregateHistory, formatVNDShort, abbreviateNumber } from '../utils/metrics';
import { formatVND, formatNumber, formatDate } from '@/utils/format';

interface Props {
  items: any[];
  kind: 'sales' | 'purchase';
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const PdHistoryTab: React.FC<Props> = ({ items, kind }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const stats = aggregateHistory(items, kind === 'sales' ? 'sales_order' : 'purchase_order');
  const qtyAbbrev = abbreviateNumber(stats.totalQty);
  const amountAbbrev = formatVNDShort(stats.totalAmount);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);

  const partnerLabel = kind === 'sales' ? t('product.topCustomer') : t('product.mainSupplier');
  const tableTitle = kind === 'sales' ? t('product.salesHistory') : t('product.purchaseHistory');
  const orderPrefix = kind === 'sales' ? 'sales-orders' : 'purchase-orders';
  const partnerColumn = kind === 'sales' ? t('customer.name') : t('supplier.name');

  return (
    <>
      <div className="pd-section-header">
        <h2 className="pd-section-title"><span className="num">·</span> {tableTitle}</h2>
        <span className="pd-section-meta">{t('product.ordersCount', { count: items.length })}</span>
      </div>

      <div className="pd-table-stats">
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('product.totalQuantity')}</div>
          <div className="pd-ts-value">{qtyAbbrev.value}<span className="unit">{qtyAbbrev.unit} {t(`unitLabels.PIECE`)}</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{kind === 'sales' ? t('product.totalRevenue') : t('product.totalCost')}</div>
          <div className="pd-ts-value">{amountAbbrev.value}<span className="unit">{amountAbbrev.unit}</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{t('product.avgUnitPrice')}</div>
          <div className="pd-ts-value">{formatNumber(stats.avgPrice)}<span className="unit">VND</span></div>
        </div>
        <div className="pd-ts-cell">
          <div className="pd-ts-label">{partnerLabel}</div>
          <div className="pd-ts-value text">
            {stats.topPartnerName || '—'}
            {stats.topPartnerOrderCount > 0 && (
              <div style={{ fontSize: 12, color: 'var(--pd-text-3)', marginTop: 4 }}>
                {stats.topPartnerOrderCount}/{items.length} {t('product.orders')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pd-table-wrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>STT</th>
              <th>{t('order.orderCode')}</th>
              <th>{partnerColumn}</th>
              <th>{t('order.orderDate')}</th>
              <th className="right">{t('common.quantity')}</th>
              <th className="right">{t('order.unitPrice')}</th>
              <th className="right">{t('order.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr className="empty-row"><td colSpan={7}>{t('common.noData')}</td></tr>
            ) : pageItems.map((it, idx) => {
              const order = kind === 'sales' ? it.sales_order : it.purchase_order;
              const partner = kind === 'sales' ? order?.customer : order?.supplier;
              const partnerName = partner?.company_name || partner?.contact_name || '—';
              return (
                <tr key={it.id}>
                  <td className="mono">{String((page - 1) * pageSize + idx + 1).padStart(2, '0')}</td>
                  <td>
                    {order?.id
                      ? <span className="order-id mono" onClick={() => navigate(`/${orderPrefix}/${order.id}`)}>{order.order_code}</span>
                      : <span className="mono">{order?.order_code || '—'}</span>}
                  </td>
                  <td>{partnerName}</td>
                  <td className="mono">{order?.order_date ? formatDate(order.order_date) : '—'}</td>
                  <td className="right mono">{formatNumber(it.quantity)}</td>
                  <td className="right mono">{formatVND(it.unit_price)}</td>
                  <td className="right amount">{formatVND(it.line_total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length > 0 && (
          <div className="pd-pagination">
            <span>
              {t('product.showing', {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, items.length),
                total: items.length,
              })}
              <select className="pd-page-size" style={{ marginLeft: 12 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}/{t('common.total', { count: items.length }).toLowerCase()}</option>)}
              </select>
            </span>
            <div className="pd-page-controls">
              <button className="pd-page-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(p => (
                <button key={p} className={`pd-page-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="pd-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PdHistoryTab;
