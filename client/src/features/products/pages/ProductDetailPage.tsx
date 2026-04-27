import React from 'react';
import { Spin, Empty, Image, Dropdown } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useProduct, useDeleteProduct } from '../hooks';
import { Product } from '@/types';
import { formatNumber } from '@/utils/format';
import apiClient from '@/lib/api-client';
import { usePermission } from '@/contexts/AbilityContext';
import SupplierPriceFormModal from '../components/SupplierPriceFormModal';
import ProductFormModal from '../components/ProductFormModal';
import PdOverviewTab from '../components/PdOverviewTab';
import PdSuppliersTab from '../components/PdSuppliersTab';
import PdHistoryTab from '../components/PdHistoryTab';
import { aggregateHistory, computeSupplierMetrics, sparklinePath, abbreviateNumber } from '../utils/metrics';
import '../styles/productDetail.css';

type TabKey = 'overview' | 'suppliers' | 'sales' | 'purchase';

const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const { line, area } = sparklinePath(values);
  if (!line) return null;
  return (
    <svg className="pd-sparkline" viewBox="0 0 100 28" preserveAspectRatio="none">
      <polyline fill={`${color}14`} stroke="none" points={area} />
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={line} />
    </svg>
  );
};

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: productData, isLoading } = useProduct(id);
  const product = productData?.data as any;
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<TabKey>('overview');
  const [activeImageIdx, setActiveImageIdx] = React.useState(0);
  const [spModal, setSpModal] = React.useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [editOpen, setEditOpen] = React.useState(false);

  const canManageSupplierPrice = usePermission('supplier_price.manage');
  const canUpdate = usePermission('product.update');
  const canDelete = usePermission('product.delete');
  const deleteMutation = useDeleteProduct();

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!product) return <Empty description={t('product.notFound')} style={{ marginTop: 80 }} />;

  const images: any[] = product.images || [];
  const currentImage = images[activeImageIdx]?.url;
  const sales = product.sales_order_items || [];
  const purchases = product.purchase_order_items || [];
  const salesStats = aggregateHistory(sales, 'sales_order');
  const purchaseStats = aggregateHistory(purchases, 'purchase_order');
  const supplierMetrics = computeSupplierMetrics(product.supplier_prices || [], product.retail_price);

  const handleDeleteSP = async (spId: string) => {
    try {
      await apiClient.delete(`/supplier-prices/${spId}`);
      toast.success(t('common.deleted'));
      qc.invalidateQueries({ queryKey: ['products', id] });
    } catch (err: any) { toast.error(err?.response?.data?.message || t('common.error')); }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: t('product.overview') },
    { key: 'suppliers', label: t('product.suppliersTab'), count: product.supplier_prices?.length || 0 },
    { key: 'sales', label: t('product.salesHistory'), count: sales.length },
    { key: 'purchase', label: t('product.purchaseHistory'), count: purchases.length },
  ];

  const moreMenuItems = canDelete ? [{
    key: 'delete', danger: true, label: t('common.delete'),
    onClick: () => {
      if (window.confirm(t('common.deleteConfirm'))) {
        deleteMutation.mutate(id!, { onSuccess: () => navigate('/products') });
      }
    },
  }] : [];

  const qtyAbbrev = abbreviateNumber(salesStats.totalQty);
  const purchaseAbbrev = abbreviateNumber(purchaseStats.totalQty);

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/products')}>{t('menu.products')}</a>
          {product.category?.name && <><span className="sep">/</span><span>{product.category.name}</span></>}
          <span className="sep">/</span>
          <span className="current">{product.name}</span>
        </div>
        <div className="pd-actions">
          {canUpdate && <button className="pd-btn" onClick={() => setEditOpen(true)}>{t('common.edit')}</button>}
          {canManageSupplierPrice && <button className="pd-btn pd-btn-primary" onClick={() => setSpModal({ open: true, record: null })}>+ {t('product.addSupplierPrice')}</button>}
          {moreMenuItems.length > 0 && (
            <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
              <button className="pd-btn pd-btn-icon">⋯</button>
            </Dropdown>
          )}
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero">
          <div className="pd-gallery">
            <div className="pd-gallery-main">
              {images.length > 0 && <span className="pd-gallery-badge">{activeImageIdx + 1} / {images.length}</span>}
              {currentImage ? (
                <Image src={currentImage} preview={{ src: currentImage }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg className="placeholder" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3-3-9 9" />
                </svg>
              )}
            </div>
            {images.length > 1 && (
              <div className="pd-gallery-thumbs">
                {images.slice(0, 4).map((img: any, i: number) => (
                  <div key={img.id} className={`pd-thumb${i === activeImageIdx ? ' active' : ''}`} onClick={() => setActiveImageIdx(i)}>
                    <img src={img.url} alt="" />
                  </div>
                ))}
                {images.length > 4 && <div className="pd-thumb">+{images.length - 4}</div>}
              </div>
            )}
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className={`pd-badge ${product.is_active ? 'pd-badge-success' : 'pd-badge-muted'}`}>
                {product.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
              </span>
              {product.category?.name && <span className="pd-badge pd-badge-neutral">{product.category.name}</span>}
              <span className="pd-sku">SKU · {product.sku}</span>
            </div>

            <div className="pd-title-block">
              <h1 className="pd-title">{product.name}</h1>
              {product.description && <p className="pd-subtitle">{product.description}</p>}
            </div>

            <div className="pd-metrics">
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  {t('product.retailPrice')}
                </div>
                <div className="pd-metric-value">{product.retail_price ? formatNumber(product.retail_price) : '—'}<span className="pd-metric-unit"> VND</span></div>
                <div className="pd-metric-trend">{product.retail_price ? t('product.referencePrice') : t('product.notSet')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  {t('product.bestPriceFromSupplier')}
                </div>
                <div className="pd-metric-value" style={{ color: supplierMetrics.best ? 'var(--pd-green)' : undefined }}>
                  {supplierMetrics.best ? formatNumber(supplierMetrics.best.purchase_price!) : '—'}
                  <span className="pd-metric-unit"> VND</span>
                </div>
                <div className={`pd-metric-trend ${supplierMetrics.marginVsRetailPct && supplierMetrics.marginVsRetailPct > 0 ? 'pd-trend-up' : ''}`}>
                  {supplierMetrics.marginVsRetailPct !== null ? `↓ ${supplierMetrics.marginVsRetailPct}% ${t('product.vsRetail')}` : t('product.notSet')}
                </div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" /></svg>
                  {t('product.soldOrders', { count: sales.length })}
                </div>
                <div className="pd-metric-value">{qtyAbbrev.value}<span className="pd-metric-unit"> {qtyAbbrev.unit} {t(`unitLabels.PIECE`)}</span></div>
                <Sparkline values={salesStats.spark} color="#15803D" />
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 7 9 13 13 9 21 17" /><polyline points="14 17 21 17 21 10" /></svg>
                  {t('product.boughtOrders', { count: purchases.length })}
                </div>
                <div className="pd-metric-value">{purchaseAbbrev.value}<span className="pd-metric-unit"> {purchaseAbbrev.unit} {t(`unitLabels.PIECE`)}</span></div>
                <Sparkline values={purchaseStats.spark} color="#1F3A8A" />
              </div>
            </div>

            {supplierMetrics.marginVsRetailPct !== null && supplierMetrics.marginVsRetailPct > 20 && (
              <div className="pd-quote">
                <div className="pd-quote-text">
                  "{t('product.insightMargin', { pct: supplierMetrics.marginVsRetailPct })}"
                </div>
                <button className="pd-btn" onClick={() => setTab('suppliers')}>{t('product.viewAnalysis')} →</button>
              </div>
            )}
          </div>
        </section>

        <div className="pd-tabs-wrap">
          <div className="pd-tabs">
            {tabs.map(tb => (
              <button key={tb.key} className={`pd-tab${tb.key === tab ? ' active' : ''}`} onClick={() => setTab(tb.key)}>
                {tb.label}
                {tb.count !== undefined && <span className="pd-tab-count">{tb.count}</span>}
              </button>
            ))}
          </div>
          <div className="pd-tab-content">
            {tab === 'overview' && <PdOverviewTab product={product} />}
            {tab === 'suppliers' && (
              <PdSuppliersTab
                prices={product.supplier_prices || []}
                retailPrice={product.retail_price}
                preferredId={supplierMetrics.preferred?.id ?? null}
                canManage={canManageSupplierPrice}
                onAdd={() => setSpModal({ open: true, record: null })}
                onEdit={(r) => setSpModal({ open: true, record: r })}
                onDelete={handleDeleteSP}
                onCreatePO={(supplierId) => navigate(`/purchase-orders/create?supplier_id=${supplierId}&product_id=${id}`)}
              />
            )}
            {tab === 'sales' && <PdHistoryTab items={sales} kind="sales" />}
            {tab === 'purchase' && <PdHistoryTab items={purchases} kind="purchase" />}
          </div>
        </div>
      </div>

      <SupplierPriceFormModal open={spModal.open} productId={id!} record={spModal.record}
        onClose={() => setSpModal({ open: false, record: null })}
        onSaved={() => qc.invalidateQueries({ queryKey: ['products', id] })} />
      <ProductFormModal open={editOpen} product={product as Product} onClose={() => setEditOpen(false)}
        onSuccess={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ['products', id] }); }} />
    </div>
  );
};

export default ProductDetailPage;
