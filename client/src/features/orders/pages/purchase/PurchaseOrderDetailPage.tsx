import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Empty, Modal, Popconfirm, Dropdown, Upload, Button, Tag, Space, Tooltip } from 'antd';
import { FilePdfOutlined, DeleteOutlined, DownloadOutlined, CheckCircleOutlined, SwapOutlined, InboxOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { usePurchaseOrder } from '../../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { invoiceApi } from '@/features/invoices/api';
import apiClient from '@/lib/api-client';
import { usePermission } from '@/contexts/AbilityContext';
import '@/features/products/styles/productDetail.css';

const PURCHASE_FLOW = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED'];

const PurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeModal, setActiveModal] = useState<'invoice' | null>(null);
  const canManagePOStatus = usePermission('purchase_order.manage_status');
  const canCreateInv = usePermission('invoice.create');
  const canFinalizeInv = usePermission('invoice.finalize');
  const canCancelInv = usePermission('invoice.cancel');

  const { data: orderData, isLoading } = usePurchaseOrder(id);
  const order = orderData?.data as any;

  const createInvMutation = useMutation({
    mutationFn: (fileData: string) => apiClient.post(`/invoice/purchase/${id}`, { file_url: fileData }),
    onSuccess: () => { toast.success(t('invoice.uploadSuccess')); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });
  const approveInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/finalize`),
    onSuccess: () => { toast.success(t('invoice.finalized')); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });
  const statusMutation = useMutation({
    mutationFn: (status: string) => apiClient.patch(`/purchase-orders/${id}/status`, { status }),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || t('common.error')),
  });
  const cancelInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/cancel`),
    onSuccess: () => { toast.success(t('invoice.cancelled')); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!order) return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;

  const invoice = (order.invoices || []).find((inv: any) => inv.status !== 'CANCELLED') as any;
  const isCancelled = order.status === 'CANCELLED';
  const currentIdx = PURCHASE_FLOW.indexOf(order.status);

  const NEXT: Record<string, { key: string; label: string; danger?: boolean }[]> = {
    DRAFT: [{ key: 'CONFIRMED', label: t('order.actionConfirm') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
    CONFIRMED: [{ key: 'SHIPPING', label: t('order.actionShipping') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
    SHIPPING: [{ key: 'COMPLETED', label: t('order.actionComplete') }],
  };
  const options = NEXT[order.status] || [];
  const showInvoice = order.status !== 'DRAFT';
  const showStatusButton = canManagePOStatus && options.length > 0;

  const subtotal = (order.items || []).reduce((s: number, it: any) => s + Number(it.line_total || 0), 0);

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/purchase-orders')}>{t('order.purchaseOrders')}</a>
          <span className="sep">/</span>
          <span className="current">{order.order_code}</span>
        </div>
        <div className="pd-actions">
          {showInvoice && (invoice || canCreateInv) && (
            <button className="pd-btn" onClick={() => setActiveModal('invoice')}>
              <FilePdfOutlined /> {invoice ? t('invoice.viewInvoice') : t('invoice.uploadFile')}
            </button>
          )}
          {showStatusButton && (
            <Dropdown menu={{ items: options.map((o) => ({ key: o.key, label: o.label, danger: o.danger })), onClick: ({ key }) => {
              const opt = options.find((o) => o.key === key);
              Modal.confirm({ title: t('order.confirmStatusChange'), icon: <ExclamationCircleOutlined />, content: `${order.order_code}: ${opt?.label}`, okText: t('common.confirm'), cancelText: t('common.cancel'), okButtonProps: { danger: opt?.danger }, onOk: () => statusMutation.mutate(key) });
            }}} trigger={['click']}>
              <button className="pd-btn pd-btn-primary"><SwapOutlined /> {t('order.changeStatus')}</button>
            </Dropdown>
          )}
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero pd-hero-cust">
          <div className="pd-cust-card">
            <div className="pd-cust-cover">
              <div className="pd-cust-cover-label">{t('order.purchaseOrderShort')} · {t(`purchaseStatusLabels.${order.status}`)}</div>
            </div>
            <div className="pd-cust-avatar-wrap"><div className="pd-cust-avatar" style={{ background: 'linear-gradient(135deg, #F3E8FF 0%, #C4B5FD 100%)' }}>PO</div></div>
            <div className="pd-cust-body">
              <h2 className="pd-cust-name">{order.order_code}</h2>
              <div className="pd-cust-id">{t('order.orderDate')} {formatDate(order.order_date)}</div>
              <div className="pd-cust-badges">
                <span className={`pd-badge ${isCancelled ? 'pd-badge-red' : order.status === 'COMPLETED' ? 'pd-badge-success' : 'pd-badge-info'}`}>{t(`purchaseStatusLabels.${order.status}`)}</span>
                {order.sales_order && <span className="pd-badge pd-badge-purple" onClick={() => navigate(`/sales-orders/${order.sales_order.id}`)} style={{ cursor: 'pointer' }}>SO {order.sales_order.order_code}</span>}
              </div>
              <ul className="pd-cust-meta-list">
                {order.supplier && <li><span className="lbl">{t('order.supplier')}</span><span className="val" style={{ cursor: 'pointer', color: 'var(--pd-indigo)' }} onClick={() => navigate(`/suppliers/${order.supplier.id}`)}>{order.supplier.company_name}</span></li>}
                {order.supplier?.contact_name && <li><span className="lbl">{t('customer.contactName')}</span><span className="val">{order.supplier.contact_name}</span></li>}
                {order.supplier?.phone && <li><span className="lbl">{t('customer.phone')}</span><span className="val mono">{order.supplier.phone}</span></li>}
                {order.expected_delivery && <li><span className="lbl">{t('order.expectedDelivery')}</span><span className="val mono">{formatDate(order.expected_delivery)}</span></li>}
              </ul>
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className="pd-badge pd-badge-info">{t('order.purchaseOrderShort')}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--pd-text-3)' }}>{order.order_code}</span>
            </div>
            <div className="pd-title-block">
              <h1 className="pd-title">{t('order.purchaseOrderShort')} · <span style={{ fontFamily: 'Geist Mono, monospace' }}>{order.order_code}</span></h1>
              <p className="pd-subtitle">{t('order.supplier')}: {order.supplier?.company_name || '—'} · {order.items?.length || 0} {t('product.results')}</p>
            </div>

            {/* Pipeline */}
            {isCancelled ? (
              <div className="pd-pipeline">
                <div className="pd-pipeline-step cancelled"><span className="step-num">×</span><span className="step-label">{t('purchaseStatusLabels.CANCELLED')}</span></div>
              </div>
            ) : (
              <div className="pd-pipeline">
                {PURCHASE_FLOW.map((s, i) => {
                  const cls = i < currentIdx ? 'done' : i === currentIdx ? `current ${s.toLowerCase()}` : 'pending';
                  return (
                    <div key={s} className={`pd-pipeline-step ${cls}`}>
                      <span className="step-num">0{i + 1}</span>
                      <span className="step-label">{i === currentIdx ? '› ' : ''}{t(`purchaseStatusLabels.${s}`)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Money summary */}
            <div className="pd-money-summary">
              <div className="pd-money-row"><span className="label">{t('order.subtotal')}</span><span className="value">{formatVND(subtotal)}</span></div>
              {Number(order.shipping_fee) > 0 && <div className="pd-money-row"><span className="label">{t('order.shippingFee')}</span><span className="value">{formatVND(order.shipping_fee)}</span></div>}
              {Number(order.other_fee) > 0 && <div className="pd-money-row"><span className="label">{t('order.otherFee')}{order.other_fee_note ? ` (${order.other_fee_note})` : ''}</span><span className="value">{formatVND(order.other_fee)}</span></div>}
              <div className="pd-money-row grand"><span className="label">{t('order.grandTotal')}</span><span className="value">{formatVND(order.total)}</span></div>
            </div>
          </div>
        </section>

        {/* Items table */}
        <div className="pd-tabs-wrap" style={{ padding: 24 }}>
          <div className="pd-section-header" style={{ marginBottom: 16 }}>
            <h2 className="pd-section-title"><span className="num">·</span> {t('order.productDetails')} <span className="pd-tab-count">{order.items?.length || 0}</span></h2>
            {order.notes && <span className="pd-section-meta">{t('common.notes')}: {order.notes}</span>}
          </div>
          <div className="pd-table-wrap">
            <table className="pd-items-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>STT</th>
                  <th>{t('order.productName')}</th>
                  <th className="right" style={{ width: 90 }}>{t('order.quantity')}</th>
                  <th className="right" style={{ width: 140 }}>{t('product.unitPrice')}</th>
                  <th className="right" style={{ width: 160 }}>{t('order.lineTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it: any, i: number) => (
                  <tr key={it.id}>
                    <td className="mono">{String(i + 1).padStart(2, '0')}</td>
                    <td>
                      <div className="product-name" style={{ cursor: it.product?.id ? 'pointer' : 'default', color: it.product?.id ? 'var(--pd-indigo)' : undefined }}
                        onClick={() => it.product?.id && navigate(`/products/${it.product.id}`)}>{it.product?.name}</div>
                      <span className="product-sku">{it.product?.sku}</span>
                    </td>
                    <td className="right mono">{Number(it.quantity).toLocaleString('vi')}</td>
                    <td className="right mono">{formatVND(it.unit_price)}</td>
                    <td className="right amount" style={{ fontWeight: 600 }}>{formatVND(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      <Modal open={activeModal === 'invoice'} onCancel={() => setActiveModal(null)} footer={null} title={t('invoice.purchaseInvoice')} width={Math.min(window.innerWidth * 0.95, 700)}>
        {!invoice ? (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <p style={{ marginBottom: 16, color: '#888' }}>{t('invoice.uploadDescription')}</p>
            <Upload.Dragger accept="image/*,.pdf" showUploadList={false} beforeUpload={async (file) => {
              try { const { uploadFile } = await import('@/utils/upload'); const url = await uploadFile(file, 'invoices'); createInvMutation.mutate(url); } catch { /**/ }
              return false;
            }} style={{ borderRadius: 8 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ fontSize: 40, color: '#1677ff' }} /></p>
              <p className="ant-upload-text">{t('invoice.uploadDragText')}</p>
              <p className="ant-upload-hint" style={{ fontSize: 12 }}>{t('invoice.uploadAccept')}</p>
            </Upload.Dragger>
          </div>
        ) : (
          <div>
            {invoice.file_url ? (
              invoice.file_url.endsWith('.pdf') || invoice.file_url.includes('application/pdf') ? (
                <iframe src={invoice.file_url.startsWith('data:') ? invoice.file_url : `${invoice.file_url}?token=${localStorage.getItem('token')}`} style={{ width: '100%', height: '50vh', border: 'none', borderRadius: 8 }} title="Invoice" />
              ) : (
                <div style={{ textAlign: 'center', padding: 16 }}><img src={invoice.file_url} alt="Invoice" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: 8 }} /></div>
              )
            ) : (
              <iframe src={`${invoiceApi.getPdfUrl(invoice.id)}?token=${localStorage.getItem('token')}`} style={{ width: '100%', height: '50vh', border: 'none' }} title="Invoice" />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap', gap: 8 }}>
              <Space size={8}>
                <strong>{t('invoice.invoiceNumber')}: {invoice.invoice_number}</strong>
                <Tag color={invoice.status === 'APPROVED' ? 'green' : 'orange'}>{invoice.status === 'APPROVED' ? t('invoice.statusApproved') : t('invoice.statusDraft')}</Tag>
              </Space>
              <Space size={4}>
                {invoice.file_url && <Tooltip title={t('invoice.downloadPdf')}><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => window.open(invoice.file_url, '_blank')} /></Tooltip>}
                {canFinalizeInv && invoice.status === 'DRAFT' && (
                  <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => Modal.confirm({ title: t('invoice.finalize'), content: invoice.invoice_number, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => approveInvMutation.mutate(invoice.id) })} /></Tooltip>
                )}
                {canCancelInv && invoice.status === 'DRAFT' && (
                  <Popconfirm title={t('invoice.confirmDelete')} onConfirm={() => cancelInvMutation.mutate(invoice.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                    <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                  </Popconfirm>
                )}
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseOrderDetailPage;
