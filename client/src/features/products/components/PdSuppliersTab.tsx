import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { formatVND, formatNumber } from '@/utils/format';
import type { SupplierPriceLite } from '../utils/metrics';

interface Props {
  prices: (SupplierPriceLite & { id: string })[];
  retailPrice?: number | null;
  preferredId?: string | null;
  canManage: boolean;
  onAdd: () => void;
  onEdit: (record: any) => void;
  onDelete: (id: string) => void;
  onCreatePO: (supplierId: string) => void;
}

const PdSuppliersTab: React.FC<Props> = ({ prices, retailPrice, preferredId, canManage, onAdd, onEdit, onDelete, onCreatePO }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!prices.length) {
    return (
      <>
        <div className="pd-section-header">
          <h2 className="pd-section-title"><span className="num">·</span> {t('product.compareSuppliers')}</h2>
          {canManage && <button className="pd-btn pd-btn-primary" onClick={onAdd}>+ {t('product.addSupplierPrice')}</button>}
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--pd-text-3)' }}>
          {t('product.noSupplierPrices')}
        </div>
      </>
    );
  }

  const minPrice = Math.min(...prices.map(p => p.purchase_price || Infinity));

  return (
    <>
      <div className="pd-section-header">
        <h2 className="pd-section-title"><span className="num">·</span> {t('product.compareSuppliers')}</h2>
        {canManage && <button className="pd-btn pd-btn-primary" onClick={onAdd}>+ {t('product.addSupplierPrice')}</button>}
      </div>

      <div className="pd-supplier-grid">
        {prices.map((sp: any) => {
          const isPreferred = sp.id === preferredId;
          const isCheapest = sp.purchase_price === minPrice;
          const deltaVsRetail = retailPrice && sp.purchase_price
            ? Math.round(((retailPrice - sp.purchase_price) / retailPrice) * 1000) / 10
            : null;
          return (
            <div key={sp.id} className={`pd-supplier-card${isPreferred ? ' preferred' : ''}`}>
              <div className="pd-supplier-name" style={{ cursor: sp.supplier?.id ? 'pointer' : 'default' }}
                onClick={() => sp.supplier?.id && navigate(`/suppliers/${sp.supplier.id}`)}>
                {sp.supplier?.company_name || '—'}
              </div>
              <div className="pd-supplier-id">
                {isCheapest && !isPreferred ? `★ ${t('product.bestPrice')} · ` : ''}
                {sp.supplier?.id ? sp.supplier.id.slice(0, 8) : 'NCC'}
              </div>

              <div className="pd-supplier-price">
                <span className="pd-supplier-price-value">{sp.purchase_price ? formatNumber(sp.purchase_price) : '—'}</span>
                <span className="pd-supplier-price-unit">VND / {t(`unitLabels.PIECE`)}</span>
                {deltaVsRetail !== null && (
                  <span className={`pd-supplier-delta ${deltaVsRetail > 0 ? 'pd-delta-good' : 'pd-delta-bad'}`}>
                    {deltaVsRetail > 0 ? `↓ ${deltaVsRetail}%` : `↑ ${Math.abs(deltaVsRetail)}%`}
                  </span>
                )}
              </div>

              <div className="pd-supplier-stats">
                <div>
                  <div className="pd-ss-label">MOQ</div>
                  <div className="pd-ss-value">{sp.moq ? formatNumber(sp.moq) : '—'}</div>
                </div>
                <div>
                  <div className="pd-ss-label">{t('supplier.leadTime')}</div>
                  <div className="pd-ss-value">{sp.lead_time_days ? `${sp.lead_time_days} ${t('product.days')}` : '—'}</div>
                </div>
                <div>
                  <div className="pd-ss-label">{t('product.priceList')}</div>
                  <div className="pd-ss-value">{sp.purchase_price ? formatVND(sp.purchase_price) : '—'}</div>
                </div>
              </div>

              <div className="pd-supplier-actions">
                {sp.supplier?.id && <button className="pd-btn pd-btn-primary" onClick={() => onCreatePO(sp.supplier.id)}>{t('product.createPO')}</button>}
                {canManage && <button className="pd-btn" onClick={() => onEdit(sp)}>{t('common.edit')}</button>}
                {canManage && (
                  <Popconfirm title={t('common.deleteConfirm')} okText={t('common.delete')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }} onConfirm={() => onDelete(sp.id)}>
                    <button className="pd-btn">{t('common.delete')}</button>
                  </Popconfirm>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default PdSuppliersTab;
