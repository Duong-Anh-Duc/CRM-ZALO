import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Space, Typography, Spin, Empty, Tag, Button, Modal, Tooltip, Row, Col, Input, DatePicker, Form, Avatar, Popconfirm, Select, InputNumber, Drawer, Dropdown, Table, Tabs,
} from 'antd';
import { FilePdfOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, PlusOutlined, ShopOutlined, SaveOutlined, UserOutlined, CalendarOutlined, FieldTimeOutlined, FileTextOutlined, EnvironmentOutlined, DownloadOutlined, SearchOutlined, SwapOutlined, MailOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { useSalesOrder, useCreatePurchaseOrder } from '../../hooks';
import { useProducts } from '@/features/products/hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';
import { invoiceApi } from '@/features/invoices/api';
import InvoiceEditModal from '@/features/invoices/components/InvoiceEditModal';
import apiClient from '@/lib/api-client';
import { usePermission } from '@/contexts/AbilityContext';
import { formatVNDShort, getInitials } from '@/features/customers/utils/metrics';
import '@/features/products/styles/productDetail.css';

const { Text } = Typography;
const SalesOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [previewInvId, setPreviewInvId] = useState<string | null>(null);
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'invoice' | 'products' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addItemState, setAddItemState] = useState<{ open: boolean; product: any | null; values: { customer_product_name: string; quantity: number; unit_price: number } }>({ open: false, product: null, values: { customer_product_name: '', quantity: 1, unit_price: 0 } });
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('');
  const [productMaterial, setProductMaterial] = useState('');
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const canUpdateSO = usePermission('sales_order.update');
  const canManageSOStatus = usePermission('sales_order.manage_status');
  const canManageSOItems = usePermission('sales_order.manage_items');
  const canCreatePO = usePermission('purchase_order.create');
  const canCreateInv = usePermission('invoice.create');
  const canUpdateInv = usePermission('invoice.update');
  const canFinalizeInv = usePermission('invoice.finalize');
  const canCancelInv = usePermission('invoice.cancel');

  const { data: orderData, isLoading } = useSalesOrder(id);
  const order = orderData?.data as any;

  const { data: customerPricesData } = useQuery({
    queryKey: ['customer-product-prices', order?.customer_id],
    queryFn: async () => apiClient.get('/customer-product-prices', { params: { customer_id: order?.customer_id } }),
    enabled: !!order?.customer_id,
  });
  const customerPriceMap = React.useMemo(() => {
    const map = new Map<string, number>();
    const list = (customerPricesData?.data as any)?.data || [];
    list.forEach((cp: any) => map.set(cp.product_id, Number(cp.price)));
    return map;
  }, [customerPricesData]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch(`/sales-orders/${id}`, data),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); setEditing(false); },
    onError: () => toast.error(t('common.error')),
  });
  const statusMutation = useMutation({
    mutationFn: (status: string) => apiClient.patch(`/sales-orders/${id}/status`, { status }),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); },
    onError: (err: any) => toast.error(err?.response?.data?.message || t('common.error')),
  });

  const createInvMutation = useMutation({
    mutationFn: () => apiClient.post(`/invoice/from-order/${id}`),
    onSuccess: () => { toast.success(t('invoice.draftCreated')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); },
  });
  const cancelInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/cancel`),
    onSuccess: () => { toast.success(t('invoice.cancelled')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); },
  });
  const approveInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/finalize`),
    onSuccess: () => { toast.success(t('invoice.finalized')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); },
  });
  const updateInvMutation = useMutation({
    mutationFn: ({ invId, data }: { invId: string; data: Record<string, unknown> }) => apiClient.patch(`/invoice/${invId}`, data),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['sales-orders'] }); setEditInvId(null); },
    onError: () => toast.error(t('common.error')),
  });

  // Item CRUD mutations (DRAFT only)
  const invalidateOrder = () => qc.invalidateQueries({ queryKey: ['sales-orders', id] });
  const addItemMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post(`/sales-orders/${id}/items`, data),
    onSuccess: () => { toast.success(t('order.itemAdded')); invalidateOrder(); },
    onError: () => toast.error(t('common.error')),
  });
  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/sales-orders/${id}/items/${itemId}`),
    onSuccess: () => { toast.success(t('order.itemRemoved')); invalidateOrder(); },
    onError: () => toast.error(t('common.error')),
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: Record<string, unknown> }) => apiClient.patch(`/sales-orders/${id}/items/${itemId}`, data),
    onSuccess: () => { invalidateOrder(); },
    onError: () => toast.error(t('common.error')),
  });

  const createPOMutation = useCreatePurchaseOrder();
  const [createPOState, setCreatePOState] = useState<{ supplierId: string; supplierName: string; items: any[] } | null>(null);
  const [poItems, setPoItems] = useState<any[]>([]);
  const [poExpectedDelivery, setPoExpectedDelivery] = useState<any>(null);
  const [poNotes, setPoNotes] = useState('');

  const openCreatePO = (supplierId: string, supplierName: string, items: any[]) => {
    setCreatePOState({ supplierId, supplierName, items });
    setPoItems(items.map((it: any) => ({
      product_id: it.product_id,
      product_sku: it.product?.sku,
      product_name: it.product?.name,
      quantity: Number(it.quantity),
      unit_price: Number(it.purchase_price || it.unit_price || 0),
    })));
    setPoExpectedDelivery(order.expected_delivery ? dayjs(order.expected_delivery) : null);
    setPoNotes('');
  };

  const submitCreatePO = () => {
    if (!createPOState) return;
    const invalid = poItems.some((i) => !i.quantity || i.quantity <= 0 || !i.unit_price || i.unit_price <= 0);
    if (invalid) { toast.error(t('validation.qtyPositive')); return; }
    const payload = {
      supplier_id: createPOState.supplierId,
      sales_order_id: id,
      expected_delivery: poExpectedDelivery?.format('YYYY-MM-DD'),
      notes: poNotes || undefined,
      items: poItems.map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
      })),
    };
    createPOMutation.mutate(payload as any, {
      onSuccess: () => { toast.success(t('common.saved')); invalidateOrder(); setCreatePOState(null); },
      onError: (err: any) => toast.error(err?.response?.data?.message || t('common.error')),
    });
  };

  // Product search for Add Product drawer
  const { data: productsData } = useProducts({
    limit: 50,
    search: productSearch || undefined,
    category_id: productCategory || undefined,
    material: productMaterial || undefined,
  });
  const drawerProducts = (productsData?.data ?? []) as any[];
  const categories = [...new Map<string, any>(drawerProducts.filter((p: any) => p.category?.id).map((p: any) => [p.category.id, p.category])).values()];

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!order) return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;

  const purchaseOrders = order.purchase_orders || [];
  const salesInvoices = order.invoices || [];

  const purchaseTotal = order.purchase_total || purchaseOrders.reduce((s: number, po: any) => s + Number(po.total), 0);
  const profit = order.profit || (Number(order.grand_total) - purchaseTotal);

  const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
  const fLabel: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

  const isCancelled = order.status === 'CANCELLED';
  const grandTotalShort = formatVNDShort(Number(order.grand_total));
  const purchaseTotalShort = formatVNDShort(purchaseTotal);
  const profitShort = formatVNDShort(Math.abs(profit));
  const customerName = order.customer?.company_name || order.customer?.contact_name || '—';
  const custInitials = getInitials(customerName);
  const profitPct = order.grand_total > 0 ? Math.round((profit / Number(order.grand_total)) * 1000) / 10 : 0;

  return (
    <div className="pd-root">
      <div className="pd-topbar">
        <div className="pd-breadcrumb">
          <a onClick={() => navigate('/sales-orders')}>{t('order.salesOrders')}</a>
          <span className="sep">/</span>
          <span className="current">{order.order_code}</span>
        </div>
      </div>

      <div className="pd-main">
        <section className="pd-hero pd-hero-cust">
          <div className="pd-cust-card">
            <div className="pd-cust-cover"><div className="pd-cust-cover-label">{t('order.salesOrderShort')} · {t(`salesStatusLabels.${order.status}`)}</div></div>
            <div className="pd-cust-avatar-wrap"><div className="pd-cust-avatar">{custInitials}</div></div>
            <div className="pd-cust-body">
              <h2 className="pd-cust-name">{customerName}</h2>
              <div className="pd-cust-id">{order.order_code} · {formatDate(order.order_date)}</div>
              <div className="pd-cust-badges">
                <span className={`pd-badge ${isCancelled ? 'pd-badge-red' : order.status === 'COMPLETED' ? 'pd-badge-success' : 'pd-badge-info'}`}>{t(`salesStatusLabels.${order.status}`)}</span>
                {salesInvoices.length > 0 && <span className="pd-badge pd-badge-purple" style={{ cursor: 'pointer' }} onClick={() => setActiveModal('invoice')}>{salesInvoices.length} {t('debt.invoices')}</span>}
                {purchaseOrders.length > 0
                  ? <span className="pd-badge pd-badge-amber">{purchaseOrders.length} PO</span>
                  : (!isCancelled && order.status !== 'DRAFT' && order.status !== 'PENDING') && (
                    <span className="pd-badge pd-badge-red" title={t('order.missingPOWarning')}>⚠ {t('order.noPO')}</span>
                  )}
              </div>
              <ul className="pd-cust-meta-list">
                {order.customer?.phone && <li><span className="lbl">{t('customer.phone')}</span><span className="val mono">{order.customer.phone}</span></li>}
                {order.customer?.email && <li><span className="lbl">Email</span><span className="val" style={{ fontSize: 12 }}>{order.customer.email}</span></li>}
                {order.expected_delivery && <li><span className="lbl">{t('order.expectedDelivery')}</span><span className="val mono">{formatDate(order.expected_delivery)}</span></li>}
              </ul>
              {order.customer && (
                <div className="pd-cust-actions">
                  <button className="pd-btn" onClick={() => navigate(`/customers/${order.customer.id}`)}>{t('common.viewDetail')}</button>
                </div>
              )}
            </div>
          </div>

          <div className="pd-info">
            <div className="pd-meta-row">
              <span className="pd-badge pd-badge-info">{t('order.salesOrderShort')}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--pd-text-3)' }}>{order.order_code}</span>
            </div>
            <div className="pd-title-block">
              <h1 className="pd-title">{t('order.salesOrderShort')} · <span style={{ fontFamily: 'Geist Mono, monospace' }}>{order.order_code}</span></h1>
              <p className="pd-subtitle">
                {customerName} · {(order.items || []).length} {t('product.results')} · {t('order.profit')} {profit >= 0 ? '+' : '−'}{profitPct}%
              </p>
            </div>

            {/* Pipeline */}
            {isCancelled ? (
              <div className="pd-pipeline">
                <div className="pd-pipeline-step cancelled"><span className="step-num">×</span><span className="step-label">{t('salesStatusLabels.CANCELLED')}</span></div>
              </div>
            ) : (
              <div className="pd-pipeline">
                {['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED'].map((s, i) => {
                  const idx = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'COMPLETED'].indexOf(order.status);
                  const cls = i < idx ? 'done' : i === idx ? `current ${s.toLowerCase()}` : 'pending';
                  return (
                    <div key={s} className={`pd-pipeline-step ${cls}`}>
                      <span className="step-num">0{i + 1}</span>
                      <span className="step-label">{i === idx ? '› ' : ''}{t(`salesStatusLabels.${s}`)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Financial metrics */}
            <div className="pd-metrics">
              <div className="pd-metric">
                <div className="pd-metric-label">{t('order.grandTotal')}</div>
                <div className="pd-metric-value">{grandTotalShort.value}<span className="pd-metric-unit"> {grandTotalShort.unit}</span></div>
                <div className="pd-metric-trend">{(order.items || []).length} {t('product.results')}</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('order.purchaseTotal')}</div>
                <div className="pd-metric-value">{purchaseTotalShort.value}<span className="pd-metric-unit"> {purchaseTotalShort.unit}</span></div>
                <div className="pd-metric-trend">{purchaseOrders.length} PO</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('order.profit')}</div>
                <div className={`pd-metric-value ${profit >= 0 ? 'success' : 'danger'}`}>{profit >= 0 ? '+' : '−'}{profitShort.value}<span className="pd-metric-unit"> {profitShort.unit}</span></div>
                <div className={`pd-metric-trend ${profit >= 0 ? 'trend-up' : 'trend-down'}`}>{profit >= 0 ? '+' : '−'}{Math.abs(profitPct)}%</div>
              </div>
              <div className="pd-metric">
                <div className="pd-metric-label">{t('order.expectedDelivery')}</div>
                <div className="pd-metric-value" style={{ fontSize: 18 }}>{order.expected_delivery ? formatDate(order.expected_delivery) : '—'}</div>
                <div className="pd-metric-trend">{order.order_date ? `${t('order.orderDate')} ${formatDate(order.order_date)}` : ''}</div>
              </div>
            </div>
          </div>
        </section>

        <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} align="center" wrap>
          {canUpdateSO && !editing && (order.status === 'DRAFT' || order.status === 'CONFIRMED') && (
            <Button icon={<EditOutlined />} style={{ borderRadius: 8 }} onClick={() => {
              setEditing(true);
              form.setFieldsValue({
                notes: order.notes,
                expected_delivery: order.expected_delivery ? dayjs(order.expected_delivery) : null,
                vat_rate: order.vat_rate,
                shipping_fee: Number(order.shipping_fee) || 0,
                other_fee: Number(order.other_fee) || 0,
                other_fee_note: order.other_fee_note || '',
              });
            }}>{t('common.edit')}</Button>
          )}
          {editing && (
            <>
              <Button onClick={() => setEditing(false)} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending}
                onClick={() => {
                  const v = form.getFieldsValue();
                  const payload: any = {
                    notes: v.notes,
                    expected_delivery: v.expected_delivery?.format('YYYY-MM-DD'),
                    other_fee_note: v.other_fee_note || null,
                  };
                  if (order.status === 'DRAFT') {
                    payload.vat_rate = v.vat_rate;
                    payload.shipping_fee = Number(v.shipping_fee) || 0;
                    payload.other_fee = Number(v.other_fee) || 0;
                  }
                  saveMutation.mutate(payload);
                }}
                style={{ borderRadius: 8 }}>{t('common.save')}</Button>
            </>
          )}
          {/* Status dropdown */}
          {(() => {
            const NEXT: Record<string, { key: string; label: string; danger?: boolean }[]> = {
              DRAFT: [{ key: 'CONFIRMED', label: t('order.actionConfirm') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
              CONFIRMED: [{ key: 'SHIPPING', label: t('order.actionShipping') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
              SHIPPING: [{ key: 'COMPLETED', label: t('order.actionComplete') }],
            };
            const options = NEXT[order.status] || [];
            const showInvoice = order.status !== 'DRAFT';
            const showStatusButton = canManageSOStatus && options.length > 0;
            if (!showStatusButton && !showInvoice) return null;
            return (
              <Space>
                {showInvoice && (
                  salesInvoices.length === 0 ? (
                    canCreateInv ? (
                      <Button icon={<FilePdfOutlined />} style={{ borderRadius: 8 }} loading={createInvMutation.isPending}
                        onClick={() => Modal.confirm({ title: t('invoice.issueInvoice'), content: order.order_code, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => createInvMutation.mutate() })}>
                        {t('invoice.issueInvoice')}
                      </Button>
                    ) : null
                  ) : (
                    <Button icon={<FilePdfOutlined />} style={{ borderRadius: 8 }} onClick={() => setActiveModal('invoice')}>
                      {t('invoice.viewInvoice')}
                    </Button>
                  )
                )}
                {showStatusButton && (
                  <Dropdown menu={{ items: options.map((o) => ({ key: o.key, label: o.label, danger: o.danger })), onClick: ({ key }) => {
                    const opt = options.find((o) => o.key === key);
                    Modal.confirm({
                      title: t('order.confirmStatusChange'),
                      icon: <ExclamationCircleOutlined />,
                      content: `${order.order_code}: ${opt?.label}`,
                      okText: t('common.confirm'),
                      cancelText: t('common.cancel'),
                      okButtonProps: { danger: opt?.danger },
                      onOk: () => statusMutation.mutate(key),
                    });
                  }}} trigger={['click']}>
                    <Button type="primary" icon={<SwapOutlined />} style={{ borderRadius: 8 }} loading={statusMutation.isPending}>
                      {t('order.changeStatus')}
                    </Button>
                  </Dropdown>
                )}
              </Space>
            );
          })()}
        </Space>

        {/* Thông tin khách hàng — chỉ hiển thị địa chỉ + tên người liên hệ vì các field khác đã có ở hero card */}
        {(order.customer?.address || (order.customer?.contact_name && order.customer?.company_name)) && (
          <>
            <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>{t('order.customerInfo')}</Text>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {order.customer?.contact_name && order.customer?.company_name && (
                <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{order.customer.contact_name}</Text></div></Col>
              )}
              {order.customer?.email && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><MailOutlined style={{ marginRight: 4 }} />Email</Text><Text strong>{order.customer.email}</Text></div></Col>}
              {order.customer?.address && <Col xs={24}><div style={fieldStyle}><Text style={fLabel}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{order.customer.address}</Text></div></Col>}
            </Row>
          </>
        )}

        {/* Thông tin đơn hàng */}
        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>{t('order.orderInfo')}</Text>
        {editing ? (
          <Form form={form} layout="vertical">
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}><Form.Item name="expected_delivery" label={t('order.expectedDelivery')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
              <Col xs={24} sm={8}>
                <div style={fieldStyle}><Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.orderDate')}</Text><Text strong>{formatDate(order.order_date)}</Text></div>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="vat_rate" label="VAT">
                  <Select style={{ borderRadius: 8 }} options={[
                    { label: '0%', value: 'VAT_0' }, { label: '5%', value: 'VAT_5' },
                    { label: '8%', value: 'VAT_8' }, { label: '10%', value: 'VAT_10' },
                  ]} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="shipping_fee" label={t('order.shippingFee')}>
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} addonAfter="VND" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="other_fee" label={t('order.otherFee')}>
                  <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} addonAfter="VND" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="other_fee_note" label={t('order.otherFeeNote') || 'Ghi chú phụ phí'}>
                  <Input style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24}><Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} style={{ borderRadius: 8 }} /></Form.Item></Col>
            </Row>
          </Form>
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.orderDate')}</Text><Text strong>{formatDate(order.order_date)}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FieldTimeOutlined style={{ marginRight: 4 }} />{t('order.expectedDelivery')}</Text><Text strong>{formatDate(order.expected_delivery)}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}>VAT</Text><Text strong>{formatVND(order.vat_amount || 0)}</Text></div></Col>
            {Number(order.shipping_fee) > 0 && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}>{t('order.shippingFee')}</Text><Text strong>{formatVND(order.shipping_fee)}</Text></div></Col>}
            {Number(order.other_fee) > 0 && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}>{t('order.otherFee')}</Text><Text strong>{formatVND(order.other_fee)}{order.other_fee_note ? ` (${order.other_fee_note})` : ''}</Text></div></Col>}
            <Col xs={24}><div style={fieldStyle}><Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('common.notes')}</Text><Text strong>{order.notes || '—'}</Text></div></Col>
          </Row>
        )}


        {/* Tabs: Sản phẩm | Nhà cung cấp */}
        <Tabs defaultActiveKey="products" style={{ marginTop: 20 }} items={[
          { key: 'products', label: `${t('order.productDetails')} (${order.items?.length || 0})`, children: (
          <div>
          <Table
            size="small"
            dataSource={order.items || []}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            pagination={order.items?.length > 5 ? { pageSize: 5, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'] } : false}
            columns={[
              { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              { title: 'SKU', key: 'sku', width: 100, render: (_: any, item: any) => <Text type="secondary">{item.product?.sku}</Text> },
              { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, item: any) => (
                <Space size={4}><Text>{item.product?.name}</Text>{item.customer_product_name && <Tag color="orange" style={{ borderRadius: 4, fontSize: 10 }}>{item.customer_product_name}</Tag>}</Space>
              )},
              {
                title: t('supplier.name'), key: 'supplier', width: 160, responsive: ['md'] as any,
                render: (_: any, item: any) => {
                  if (!item.supplier) return <Text type="secondary" style={{ color: '#fa8c16' }}>{t('order.noSupplierShort')}</Text>;
                  const po = purchaseOrders.find((p: any) => p.supplier_id === item.supplier_id);
                  return (
                    <div>
                      <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }} onClick={() => navigate(`/suppliers/${item.supplier_id}`)}>{item.supplier.company_name}</Button>
                      {po && <Button type="link" size="small" style={{ padding: 0, fontSize: 11, display: 'block' }} onClick={() => navigate(`/purchase-orders/${po.id}`)}>{po.order_code}</Button>}
                    </div>
                  );
                },
              },
              { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 60, align: 'right' as const },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'CK%', dataIndex: 'discount_pct', key: 'ck', width: 60, align: 'right' as const, responsive: ['lg'] as any, render: (v: number) => v > 0 ? `${v}%` : '-' },
              { title: 'VAT', dataIndex: 'vat_rate', key: 'vat', width: 60, align: 'right' as const, render: (v: number) => v > 0 ? <Tag color="blue" style={{ borderRadius: 4, fontSize: 10, margin: 0 }}>{v}%</Tag> : '-' },
              { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
            ]}
            summary={() => {
              const subtotal = (order.items || []).reduce((s: number, i: any) => s + Number(i.line_total), 0);
              const vatTotal = (order.items || []).reduce((s: number, i: any) => s + Number(i.vat_amount || 0), 0);
              return (
                <>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right"><Text>{t('order.subtotal')}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text>{formatVND(subtotal)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                  {vatTotal > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={8} align="right"><Text>VAT</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right"><Text>{formatVND(vatTotal)}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  {Number(order.shipping_fee) > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={8} align="right"><Text>{t('order.shippingFee')}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right"><Text>{formatVND(order.shipping_fee)}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  {Number(order.other_fee) > 0 && (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={8} align="right"><Text>{t('order.otherFee')}</Text></Table.Summary.Cell>
                      <Table.Summary.Cell index={1} align="right"><Text>{formatVND(order.other_fee)}</Text></Table.Summary.Cell>
                    </Table.Summary.Row>
                  )}
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={8} align="right"><Text strong>{t('order.grandTotal')}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#1890ff', fontSize: 14 }}>{formatVND(order.grand_total)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                </>
              );
            }}
          />
          {canManageSOItems && order.status === 'DRAFT' && (
            <Button type="dashed" icon={<PlusOutlined />} block style={{ borderRadius: 8, marginTop: 8 }} onClick={() => setDrawerOpen(true)}>
              {t('order.addProduct')}
            </Button>
          )}
          </div>
          )},
          { key: 'suppliers', label: <><ShopOutlined /> {t('order.supplierTab')} ({(() => {
            const sids = new Set((order.items || []).filter((i: any) => i.supplier_id).map((i: any) => i.supplier_id));
            return sids.size;
          })()})</>, children: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const items = order.items || [];
                const groups = new Map<string, { supplier: any; po: any; items: any[] }>();
                const noSupplier: any[] = [];
                for (const item of items) {
                  if (!item.supplier_id) { noSupplier.push(item); continue; }
                  if (!groups.has(item.supplier_id)) {
                    const po = purchaseOrders.find((p: any) => p.supplier_id === item.supplier_id);
                    groups.set(item.supplier_id, { supplier: item.supplier, po, items: [] });
                  }
                  groups.get(item.supplier_id)!.items.push(item);
                }
                return (
                  <>
                    {Array.from(groups.entries()).map(([sid, group]) => (
                      <Card key={sid} size="small" style={{ borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                          <Space>
                            <Avatar size={36} style={{ background: '#722ed1' }} icon={<ShopOutlined />} />
                            <div>
                              <Text strong>{group.supplier?.company_name || t('order.unknownSupplier')}</Text>
                              {group.supplier?.phone && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>{group.supplier.phone}</Text>}
                            </div>
                          </Space>
                          <Space>
                            {group.po ? (
                              <>
                                <StatusTag status={group.po.status} type="purchase" />
                                <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => navigate(`/purchase-orders/${group.po.id}`)}>
                                  {group.po.order_code} — {formatVND(group.po.total)}
                                </Button>
                              </>
                            ) : (
                              <>
                                <Tag color="warning" style={{ borderRadius: 6 }}>{t('order.noPO')}</Tag>
                                {canCreatePO && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                                  <Button type="primary" size="small" icon={<PlusOutlined />}
                                    style={{ borderRadius: 8 }} onClick={() => openCreatePO(sid, group.supplier?.company_name || '', group.items)}>
                                    {t('order.createPurchaseOrder')}
                                  </Button>
                                )}
                              </>
                            )}
                          </Space>
                        </div>
                        <Table size="small" dataSource={group.items} rowKey="id" pagination={false} scroll={{ x: 'max-content' }}
                          columns={[
                            { title: 'SKU', key: 'sku', width: 100, render: (_: any, i: any) => <Text type="secondary">{i.product?.sku}</Text> },
                            { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, i: any) => i.product?.name },
                            { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 70, align: 'right' as const },
                            { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
                            { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
                          ]}
                        />
                      </Card>
                    ))}
                    {noSupplier.length > 0 && (
                      <Card size="small" style={{ borderRadius: 10, borderColor: '#fa8c16' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <Text strong style={{ color: '#fa8c16' }}>{t('order.noSupplierAssigned')}</Text>
                          <Tag color="warning" style={{ borderRadius: 6 }}>{t('order.noPO')}</Tag>
                        </div>
                        <Table size="small" dataSource={noSupplier} rowKey="id" pagination={false} scroll={{ x: 'max-content' }}
                          columns={[
                            { title: 'SKU', key: 'sku', width: 100, render: (_: any, i: any) => <Text type="secondary">{i.product?.sku}</Text> },
                            { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, i: any) => i.product?.name },
                            { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 70, align: 'right' as const },
                            { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
                            { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
                          ]}
                        />
                      </Card>
                    )}
                    {groups.size === 0 && noSupplier.length === 0 && <Empty description={t('common.noData')} />}
                  </>
                );
              })()}
            </div>
          )},
        ]} />
      </Card>

      {/* Invoice Modal */}
      <Modal open={activeModal === 'invoice'} onCancel={() => setActiveModal(null)} footer={null}
        title={t('invoice.salesInvoice')} width={Math.min(window.innerWidth * 0.95, 900)}
        styles={{ body: { padding: 0 } }}>
        {salesInvoices.length === 0 && canCreateInv && (
          <div style={{ padding: 24 }}>
            <Button icon={<PlusOutlined />} loading={createInvMutation.isPending} style={{ borderRadius: 8 }}
              onClick={() => Modal.confirm({ title: t('invoice.issueInvoice'), content: order.order_code, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => createInvMutation.mutate() })}>{t('invoice.issueInvoice')}</Button>
          </div>
        )}
        {salesInvoices.map((inv: any) => (
          <div key={inv.id}>
            {/* PDF Preview */}
            <iframe src={`${invoiceApi.getPdfUrl(inv.id)}?token=${localStorage.getItem('token')}`}
              style={{ width: '100%', height: '60vh', border: 'none' }} title="Invoice" />
            {/* Actions bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap', gap: 8 }}>
              <Space size={8}>
                <Text strong>{t('invoice.invoiceNumber')}: {inv.invoice_number}</Text>
                <Tag color={inv.status === 'APPROVED' ? 'green' : inv.status === 'DRAFT' ? 'orange' : 'red'} style={{ borderRadius: 6 }}>
                  {inv.status === 'APPROVED' ? t('invoice.statusApproved') : inv.status === 'DRAFT' ? t('invoice.statusDraft') : t('invoice.statusCancelled')}
                </Tag>
                <Text strong>{formatVND(inv.total)}</Text>
              </Space>
              <Space size={4}>
                <Tooltip title={t('invoice.downloadPdf')}><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => {
                  window.open(`${invoiceApi.getPdfUrl(inv.id)}?token=${localStorage.getItem('token')}`, '_blank');
                }} /></Tooltip>
                {canFinalizeInv && inv.status === 'DRAFT' && (
                  <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    onClick={() => Modal.confirm({ title: t('invoice.finalize'), content: inv.invoice_number, okText: t('common.confirm'), cancelText: t('common.cancel'), onOk: () => approveInvMutation.mutate(inv.id) })} /></Tooltip>
                )}
                {canUpdateInv && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                  <Tooltip title={t('invoice.editDraft')}><Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditInvId(inv.id)} /></Tooltip>
                )}
                {canCancelInv && inv.status === 'DRAFT' && (
                  <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={() => Modal.confirm({ title: t('invoice.confirmDelete'), content: inv.invoice_number, okText: t('common.confirm'), cancelText: t('common.cancel'), okButtonProps: { danger: true }, onOk: () => cancelInvMutation.mutate(inv.id) })} /></Tooltip>
                )}
              </Space>
            </div>
          </div>
        ))}
      </Modal>

      {/* Products Modal — group by NCC */}
      <Modal open={activeModal === 'products'} onCancel={() => setActiveModal(null)} footer={null}
        title={t('order.productDetails') + ` (${order.items?.length || 0})`} width={Math.min(window.innerWidth * 0.95, 800)}>
        {(() => {
          const items = order.items || [];
          const isDraft = order.status === 'DRAFT';
          // Group items by supplier
          const groups = new Map<string, { supplier: any; po: any; items: any[] }>();
          const noSupplier: any[] = [];
          for (const item of items) {
            if (!item.supplier_id) { noSupplier.push(item); continue; }
            if (!groups.has(item.supplier_id)) {
              const po = purchaseOrders.find((p: any) => p.supplier_id === item.supplier_id);
              groups.set(item.supplier_id, { supplier: item.supplier, po, items: [] });
            }
            groups.get(item.supplier_id)!.items.push(item);
          }

          const renderItemRow = (item: any, i: number) => (
            <div key={item.id} style={{ padding: '6px 0', borderTop: i > 0 ? '1px solid #f5f5f5' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                <Space size={8}>
                  <Text type="secondary">{item.product?.sku}</Text>
                  <Text>{item.product?.name}</Text>
                  {item.customer_product_name && <Tag color="orange" style={{ borderRadius: 4, fontSize: 11 }}>{item.customer_product_name}</Tag>}
                </Space>
                {!isDraft && (
                  <Space size={16}>
                    <Text>{'\u00d7'}{item.quantity}</Text>
                    <Text>{formatVND(item.unit_price)}</Text>
                    {item.discount_pct > 0 && <Text type="secondary">-{item.discount_pct}%</Text>}
                    {item.vat_rate > 0 && <Tag color="blue" style={{ borderRadius: 4, fontSize: 10 }}>VAT {item.vat_rate}%</Tag>}
                    <Text strong>{formatVND(item.line_total)}</Text>
                  </Space>
                )}
              </div>
              {isDraft && canManageSOItems && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <InputNumber size="small" min={1} value={item.quantity} style={{ width: 70, borderRadius: 6 }}
                    onBlur={(e) => { const v = Number(e.target.value); if (v > 0 && v !== item.quantity) updateItemMutation.mutate({ itemId: item.id, data: { quantity: v } }); }} />
                  <InputNumber size="small" min={0} value={Number(item.unit_price)} style={{ width: 110, borderRadius: 6 }}
                    formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    parser={(v) => Number(v?.replace(/\./g, '') ?? 0)}
                    onBlur={(e) => { const v = Number(e.target.value?.replace(/\./g, '')); if (v >= 0 && v !== Number(item.unit_price)) updateItemMutation.mutate({ itemId: item.id, data: { unit_price: v } }); }} />
                  <InputNumber size="small" min={0} max={100} value={Number(item.discount_pct)} style={{ width: 65, borderRadius: 6 }}
                    addonAfter="%"
                    onBlur={(e) => { const v = Number(e.target.value); if (v >= 0 && v !== Number(item.discount_pct)) updateItemMutation.mutate({ itemId: item.id, data: { discount_pct: v } }); }} />
                  <Select size="small" value={item.vat_rate ?? 0} style={{ width: 85, borderRadius: 6 }}
                    options={[{ label: 'VAT 0%', value: 0 }, { label: 'VAT 8%', value: 8 }, { label: 'VAT 10%', value: 10 }]}
                    onChange={(v) => updateItemMutation.mutate({ itemId: item.id, data: { vat_rate: v } })} />
                  <Text strong style={{ minWidth: 80 }}>{formatVND(item.line_total)}</Text>
                  <Select size="small" value={item.supplier_id || undefined}
                    onChange={(v) => {
                      const sp = item.product?.supplier_prices?.find((s: any) => s.supplier_id === v);
                      updateItemMutation.mutate({ itemId: item.id, data: { supplier_id: v || null, purchase_price: sp?.purchase_price || null } });
                    }}
                    allowClear placeholder={t('order.assignLater')}
                    style={{ minWidth: 180, borderRadius: 6 }}
                    options={(item.product?.supplier_prices || []).map((sp: any) => ({
                      label: `${sp.supplier?.company_name} — ${formatVND(sp.purchase_price)}${sp.is_preferred ? ' \u2605' : ''}`,
                      value: sp.supplier_id,
                    }))} />
                  <Popconfirm title={t('order.removeItemConfirm')} onConfirm={() => removeItemMutation.mutate(item.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} loading={removeItemMutation.isPending} />
                  </Popconfirm>
                </div>
              )}
            </div>
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Array.from(groups.entries()).map(([sid, group]) => (
                <Card key={sid} size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <Space>
                      <Text strong>{group.supplier?.company_name || t('order.unknownSupplier')}</Text>
                      {group.po && <StatusTag status={group.po.status} type="purchase" />}
                    </Space>
                    {group.po && (
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => { setActiveModal(null); navigate(`/purchase-orders/${group.po.id}`); }}>
                        {group.po.order_code} {'\u2192'} {formatVND(group.po.total)}
                      </Button>
                    )}
                  </div>
                  {group.items.map((item: any, i: number) => renderItemRow(item, i))}
                </Card>
              ))}
              {noSupplier.length > 0 && (
                <Card size="small" style={{ borderRadius: 8, border: '1px solid #fff2e8' }}>
                  <Text strong style={{ display: 'block', marginBottom: 8, color: '#fa8c16' }}>{t('order.noSupplierAssigned')}</Text>
                  {noSupplier.map((item: any, i: number) => renderItemRow(item, i))}
                </Card>
              )}
              {isDraft && canManageSOItems && (
                <Button type="dashed" icon={<PlusOutlined />} block style={{ borderRadius: 8 }}
                  onClick={() => { setProductSearch(''); setProductCategory(''); setProductMaterial(''); setDrawerOpen(true); }}>
                  {t('order.addProduct')}
                </Button>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Product Search Drawer (for adding items in DRAFT) */}
      <Drawer title={t('order.searchProduct')} placement="right"
        width={Math.min(window.innerWidth * 0.95, 600)} open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Input prefix={<SearchOutlined />} placeholder={t('order.searchProductPlaceholder')}
          value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
          allowClear size="large" style={{ borderRadius: 8, marginBottom: 12 }} autoFocus />
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Select value={productCategory} onChange={setProductCategory} placeholder={t('product.category')} allowClear
            style={{ minWidth: 160, borderRadius: 8 }}
            options={[{ label: t('common.all'), value: '' }, ...categories.map((c: any) => ({ label: c?.name, value: c?.id }))]} />
          <Select value={productMaterial} onChange={setProductMaterial} placeholder={t('product.material')} allowClear
            style={{ minWidth: 120, borderRadius: 8 }}
            options={[{ label: t('common.all'), value: '' }, { label: 'PET', value: 'PET' }, { label: 'HDPE', value: 'HDPE' }, { label: 'PP', value: 'PP' }, { label: 'PVC', value: 'PVC' }]} />
          <Text type="secondary">{drawerProducts.length} {t('product.results')}</Text>
        </Space>
        {drawerProducts.length === 0 ? <Empty description={t('common.noData')} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drawerProducts.map((product: any) => (
              <Card key={product.id} size="small" hoverable style={{ borderRadius: 8, cursor: 'pointer' }}
                onClick={() => {
                  const savedPrice = customerPriceMap.get(product.id);
                  setAddItemState({
                    open: true, product,
                    values: {
                      customer_product_name: '',
                      quantity: 1,
                      unit_price: savedPrice ?? (product.retail_price || 0),
                    },
                  });
                  setDrawerOpen(false);
                }}>
                <Row gutter={12} align="middle">
                  <Col flex="none">
                    {product.images?.[0]?.url ? (
                      <Avatar size={56} src={product.images[0].url} shape="square" style={{ borderRadius: 6 }} />
                    ) : (
                      <Avatar size={56} shape="square" style={{ borderRadius: 6, background: '#f0f0f0', color: '#999' }}>{product.sku?.slice(0, 3)}</Avatar>
                    )}
                  </Col>
                  <Col flex="auto">
                    <Text strong style={{ display: 'block', fontSize: 14 }}>{product.name}</Text>
                    <Space size={8} wrap>
                      <Tag style={{ borderRadius: 4 }}>{product.sku}</Tag>
                      {product.category?.name && <Tag color="blue" style={{ borderRadius: 4 }}>{product.category.name}</Tag>}
                      {product.capacity_ml && <Text type="secondary">{product.capacity_ml}ml</Text>}
                    </Space>
                    <div style={{ marginTop: 4 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: 11 }}>{t('product.retailPrice')}: </Text>
                        <Text strong>{formatVND(product.retail_price)}</Text>
                      </div>
                      {customerPriceMap.has(product.id) && (
                        <div style={{ marginTop: 2 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{t('product.savedCustomerPrice')}: </Text>
                          <Text type="success" strong>{formatVND(customerPriceMap.get(product.id)!)}</Text>
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>
              </Card>
            ))}
          </div>
        )}
      </Drawer>

      {/* PDF Preview Modal */}
      <Modal open={!!previewInvId} onCancel={() => setPreviewInvId(null)} footer={null}
        width={Math.min(window.innerWidth * 0.95, 900)} title={t('invoice.preview')}
        styles={{ body: { padding: 0, height: '80vh' } }}>
        {previewInvId && (
          <iframe src={`${invoiceApi.getPdfUrl(previewInvId)}?token=${localStorage.getItem('token')}`}
            style={{ width: '100%', height: '100%', border: 'none' }} title="Invoice" />
        )}
      </Modal>

      {/* Invoice Edit Modal */}
      {editInvId && (
        <InvoiceEditModal
          invoiceId={editInvId}
          open={!!editInvId}
          onClose={() => setEditInvId(null)}
          onSave={(data) => updateInvMutation.mutate({ invId: editInvId, data })}
          saving={updateInvMutation.isPending}
        />
      )}

      {/* Add Item Modal (required: tên khách gọi, SL, giá) */}
      <Modal open={addItemState.open}
        title={<><PlusOutlined /> {t('order.addProduct')}{addItemState.product ? ` — ${addItemState.product.name}` : ''}</>}
        onCancel={() => setAddItemState({ open: false, product: null, values: { customer_product_name: '', quantity: 1, unit_price: 0 } })}
        okText={t('common.confirm')} cancelText={t('common.cancel')}
        confirmLoading={addItemMutation.isPending}
        okButtonProps={{ style: { borderRadius: 8 } }}
        onOk={() => {
          const { product, values } = addItemState;
          if (!product) return;
          if (!values.customer_product_name?.trim()) { toast.error(t('validation.customerProductNameRequired')); return; }
          if (!values.quantity || values.quantity <= 0) { toast.error(t('validation.qtyPositive')); return; }
          if (!values.unit_price || values.unit_price <= 0) { toast.error(t('validation.unitPricePositive')); return; }
          const preferred = product.supplier_prices?.find((sp: any) => sp.is_preferred);
          const supplier = preferred || product.supplier_prices?.[0];
          addItemMutation.mutate({
            product_id: product.id,
            supplier_id: supplier?.supplier_id || undefined,
            purchase_price: supplier?.purchase_price || undefined,
            customer_product_name: values.customer_product_name.trim(),
            quantity: values.quantity,
            unit_price: values.unit_price,
          }, {
            onSuccess: () => setAddItemState({ open: false, product: null, values: { customer_product_name: '', quantity: 1, unit_price: 0 } }),
          });
        }}>
        {addItemState.product && (
          <div>
            <Row gutter={[12, 12]}>
              <Col xs={24}>
                <Text style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                  {t('product.name')} <span style={{ color: '#ff4d4f' }}>*</span>
                </Text>
                <Input value={addItemState.values.customer_product_name}
                  onChange={(e) => setAddItemState((s) => ({ ...s, values: { ...s.values, customer_product_name: e.target.value } }))}
                  placeholder={t('order.customerProductNamePlaceholder')} style={{ borderRadius: 8 }} autoFocus />
                <Text type="secondary" style={{ fontSize: 11 }}>{t('product.sku')}: {addItemState.product.sku} — {addItemState.product.name}</Text>
              </Col>
              <Col xs={12}>
                <Text style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                  {t('order.quantity')} <span style={{ color: '#ff4d4f' }}>*</span>
                </Text>
                <InputNumber min={1} value={addItemState.values.quantity}
                  onChange={(v) => setAddItemState((s) => ({ ...s, values: { ...s.values, quantity: Number(v) || 0 } }))}
                  style={{ width: '100%', borderRadius: 8 }} />
              </Col>
              <Col xs={12}>
                <Text style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                  {t('order.unitPrice')} <span style={{ color: '#ff4d4f' }}>*</span>
                </Text>
                <InputNumber min={1} value={addItemState.values.unit_price}
                  onChange={(v) => setAddItemState((s) => ({ ...s, values: { ...s.values, unit_price: Number(v) || 0 } }))}
                  style={{ width: '100%', borderRadius: 8 }} addonAfter="VND"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(val) => Number(val?.replace(/\./g, '') ?? 0)} />
                <Space size={4} style={{ marginTop: 4 }} wrap>
                  <Text type="secondary" style={{ fontSize: 11 }}>{t('product.retailPrice')}: {formatVND(addItemState.product.retail_price)}</Text>
                  {customerPriceMap.has(addItemState.product.id) && (
                    <Tag color="purple" style={{ fontSize: 10, borderRadius: 4 }}>{t('product.savedCustomerPrice')}: {formatVND(customerPriceMap.get(addItemState.product.id)!)}</Tag>
                  )}
                </Space>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Create PO Review Modal */}
      <Modal open={!!createPOState} onCancel={() => setCreatePOState(null)}
        title={<><ShopOutlined /> {t('order.createPurchaseOrder')}{createPOState ? ` — ${createPOState.supplierName}` : ''}</>}
        width={Math.min(window.innerWidth * 0.95, 820)}
        okText={t('common.confirm')} cancelText={t('common.cancel')}
        onOk={submitCreatePO} confirmLoading={createPOMutation.isPending}
        okButtonProps={{ style: { borderRadius: 8 } }}>
        {createPOState && (
          <div>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12}>
                <Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.expectedDelivery')}</Text>
                <DatePicker value={poExpectedDelivery} onChange={setPoExpectedDelivery}
                  format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
              </Col>
              <Col xs={24} sm={12}>
                <Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('order.linkedSO')}</Text>
                <Input value={order.order_code} disabled style={{ borderRadius: 8 }} />
              </Col>
              <Col xs={24}>
                <Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('common.notes')}</Text>
                <Input.TextArea rows={2} value={poNotes} onChange={(e) => setPoNotes(e.target.value)} style={{ borderRadius: 8 }} />
              </Col>
            </Row>
            <Text style={fLabel}>{t('order.productDetails')} ({poItems.length})</Text>
            <Table size="small" dataSource={poItems} rowKey="product_id" pagination={false}
              scroll={{ x: 'max-content' }} style={{ marginTop: 8 }}
              columns={[
                { title: 'SKU', dataIndex: 'product_sku', key: 'sku', width: 100, render: (v: string) => <Text type="secondary">{v}</Text> },
                { title: t('product.name'), dataIndex: 'product_name', key: 'name', ellipsis: true },
                { title: 'SL', dataIndex: 'quantity', key: 'qty', width: 100, align: 'right' as const,
                  render: (v: number, _: any, i: number) => (
                    <InputNumber size="small" min={1} value={v} style={{ width: '100%', borderRadius: 6 }}
                      onChange={(nv) => setPoItems((prev) => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(nv) || 0 } : it))} />
                  ) },
                { title: t('product.purchasePrice'), dataIndex: 'unit_price', key: 'price', width: 150, align: 'right' as const,
                  render: (v: number, _: any, i: number) => (
                    <InputNumber size="small" min={0} value={v} style={{ width: '100%', borderRadius: 6 }}
                      formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      parser={(val) => Number(val?.replace(/\./g, '') ?? 0)}
                      onChange={(nv) => setPoItems((prev) => prev.map((it, idx) => idx === i ? { ...it, unit_price: Number(nv) || 0 } : it))} />
                  ) },
                { title: t('order.lineTotal'), key: 'total', width: 140, align: 'right' as const,
                  render: (_: any, r: any) => <Text strong>{formatVND(Number(r.quantity || 0) * Number(r.unit_price || 0))}</Text> },
              ]}
              summary={() => {
                const total = poItems.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);
                return (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>{t('order.grandTotal')}</Text></Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#1890ff' }}>{formatVND(total)}</Text></Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
};

export default SalesOrderDetailPage;
