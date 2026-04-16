import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Table, Space, Typography, Spin, Empty, Tag, Button, Tooltip, Row, Col, Avatar, Statistic, Modal, Popconfirm, Dropdown,
} from 'antd';
import { FilePdfOutlined, DollarOutlined, ShopOutlined, CalendarOutlined, FieldTimeOutlined, FileTextOutlined, DeleteOutlined, DownloadOutlined, CheckCircleOutlined, PlusOutlined, ShoppingOutlined, SwapOutlined, UserOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import type { ColumnsType } from 'antd/es/table';
import { usePurchaseOrder } from '../../hooks';
import { PurchaseOrderItem } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';
import { invoiceApi } from '@/features/invoices/api';
import apiClient from '@/lib/api-client';

const { Text } = Typography;
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const fLabel: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const PurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'invoice' | 'products' | null>(null);

  const { data: orderData, isLoading } = usePurchaseOrder(id);
  const order = orderData?.data as any;

  const createInvMutation = useMutation({
    mutationFn: () => apiClient.post(`/invoice/purchase/${id}`),
    onSuccess: () => { toast.success(t('invoice.draftCreated')); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); },
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

  const itemColumns: ColumnsType<PurchaseOrderItem> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku', width: 100, responsive: ['md'] as any },
    { title: t('order.productName'), dataIndex: ['product', 'name'], key: 'name', ellipsis: true },
    { title: t('order.quantity'), dataIndex: 'quantity', key: 'qty', width: 80, align: 'right' as const },
    { title: t('product.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 150, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('order.salesOrderShort'), key: 'so', width: 160, render: () => order.sales_order ? (
      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${order.sales_order.id}`)}>{order.sales_order.order_code}</Button>
    ) : '-', responsive: ['lg'] as any },
  ];

  return (
    <div>
      <Card style={{ borderRadius: 12 }}>
        {/* Total */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #fff2e8' }}>
              <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: '#fa541c' }} />{t('order.total')}</>} value={Number(order.total)} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa541c', fontSize: 20 }} />
            </Card>
          </Col>
        </Row>

        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }} align="start" wrap>
          <Space size={16}>
            <Avatar size={48} style={{ background: '#722ed1', fontSize: 20 }} icon={<ShopOutlined />} />
            <div>
              <Text strong style={{ fontSize: 20, display: 'block' }}>{order.order_code}</Text>
              <StatusTag status={order.status} type="purchase" />
            </div>
          </Space>
          {/* Status dropdown */}
          {(() => {
            const NEXT: Record<string, { key: string; label: string; danger?: boolean }[]> = {
              DRAFT: [{ key: 'CONFIRMED', label: t('order.actionConfirm') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
              CONFIRMED: [{ key: 'SHIPPING', label: t('order.actionShipping') }, { key: 'CANCELLED', label: t('order.actionCancel'), danger: true }],
              SHIPPING: [{ key: 'COMPLETED', label: t('order.actionComplete') }],
            };
            const options = NEXT[order.status] || [];
            if (options.length === 0) return null;
            return (
              <Dropdown menu={{ items: options.map((o) => ({ key: o.key, label: o.label, danger: o.danger })), onClick: ({ key }) => statusMutation.mutate(key) }} trigger={['click']}>
                <Button icon={<SwapOutlined />} style={{ borderRadius: 8 }} loading={statusMutation.isPending}>
                  {t('order.changeStatus')}
                </Button>
              </Dropdown>
            );
          })()}
        </Space>

        {/* Thông tin nhà cung cấp */}
        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>{t('order.supplierInfo')}</Text>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><ShopOutlined style={{ marginRight: 4 }} />{t('order.supplier')}</Text><Text strong>{order.supplier?.company_name}</Text></div></Col>
          {order.supplier?.contact_name && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{order.supplier.contact_name}</Text></div></Col>}
          {order.supplier?.phone && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{order.supplier.phone}</Text></div></Col>}
          {order.supplier?.email && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><MailOutlined style={{ marginRight: 4 }} />Email</Text><Text strong>{order.supplier.email}</Text></div></Col>}
          {order.supplier?.address && <Col xs={24}><div style={fieldStyle}><Text style={fLabel}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{order.supplier.address}</Text></div></Col>}
        </Row>

        {/* Thông tin đơn hàng */}
        <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>{t('order.orderInfo')}</Text>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.orderDate')}</Text><Text strong>{formatDate(order.order_date)}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FieldTimeOutlined style={{ marginRight: 4 }} />{t('order.expectedDelivery')}</Text><Text strong>{formatDate(order.expected_delivery)}</Text></div></Col>
          {order.sales_order && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><ShoppingOutlined style={{ marginRight: 4 }} />{t('order.linkedSO')}</Text><Text strong style={{ color: '#1677ff', cursor: 'pointer' }} onClick={() => navigate(`/sales-orders/${order.sales_order.id}`)}>{order.sales_order.order_code}</Text></div></Col>}
          {Number(order.shipping_fee) > 0 && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}>{t('order.shippingFee')}</Text><Text strong>{formatVND(order.shipping_fee)}</Text></div></Col>}
          {Number(order.other_fee) > 0 && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}>{t('order.otherFee')}</Text><Text strong>{formatVND(order.other_fee)}{order.other_fee_note ? ` (${order.other_fee_note})` : ''}</Text></div></Col>}
          <Col xs={24}><div style={fieldStyle}><Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('common.notes')}</Text><Text strong>{order.notes || '—'}</Text></div></Col>
        </Row>

        {/* Nút hoá đơn */}
        <Row gutter={[12, 12]} style={{ marginTop: 20 }}>
          <Col xs={24}>
            <Button block icon={<FilePdfOutlined />} style={{ borderRadius: 8, height: 44 }} onClick={() => setActiveModal('invoice')}>
              {invoice ? t('invoice.viewInvoice') : t('invoice.issueInvoice')} ({invoice ? 1 : 0})
            </Button>
          </Col>
        </Row>

        {/* Chi tiết sản phẩm — hiển thị trực tiếp */}
        <div style={{ marginTop: 20 }}>
          <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
            {t('order.productDetails')} ({order.items?.length || 0})
          </Text>
          <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 'max-content' }} rowKey="id" />
        </div>
      </Card>

      {/* Invoice Modal — with PDF preview */}
      <Modal open={activeModal === 'invoice'} onCancel={() => setActiveModal(null)} footer={null}
        title={t('invoice.purchaseInvoice')} width={window.innerWidth < 640 ? '95vw' : 900}
        styles={{ body: { padding: 0 } }}>
        {!invoice ? (
          <div style={{ padding: 24 }}>
            <Button icon={<PlusOutlined />} onClick={() => createInvMutation.mutate()} loading={createInvMutation.isPending} style={{ borderRadius: 8 }}>
              {t('invoice.issueInvoice')}
            </Button>
          </div>
        ) : (
          <div>
            <iframe src={`${invoiceApi.getPdfUrl(invoice.id)}?token=${localStorage.getItem('token')}`}
              style={{ width: '100%', height: '60vh', border: 'none' }} title="Invoice" />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderTop: '1px solid #f0f0f0', flexWrap: 'wrap', gap: 8 }}>
              <Space size={8}>
                <Text strong>{t('invoice.invoiceNumber')}: {invoice.invoice_number}</Text>
                <Tag color={invoice.status === 'APPROVED' ? 'green' : 'orange'} style={{ borderRadius: 6 }}>
                  {invoice.status === 'APPROVED' ? t('invoice.statusApproved') : t('invoice.statusDraft')}
                </Tag>
                <Text strong>{formatVND(invoice.total)}</Text>
              </Space>
              <Space size={4}>
                <Tooltip title={t('invoice.downloadPdf')}><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => window.open(`${invoiceApi.getPdfUrl(invoice.id)}?token=${localStorage.getItem('token')}`, '_blank')} /></Tooltip>
                {invoice.status === 'DRAFT' && (
                  <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => approveInvMutation.mutate(invoice.id)} /></Tooltip>
                )}
                {invoice.status === 'DRAFT' && (
                  <Popconfirm title={t('invoice.confirmDelete')} onConfirm={() => cancelInvMutation.mutate(invoice.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                    <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                  </Popconfirm>
                )}
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* Products Modal */}
      <Modal open={activeModal === 'products'} onCancel={() => setActiveModal(null)} footer={null}
        title={t('order.productDetails') + ` (${order.items?.length || 0})`} width={window.innerWidth < 640 ? '95vw' : 850}>
        <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 600 }} rowKey="id" />
      </Modal>

      {/* PDF Preview Modal */}
      <Modal open={!!previewUrl} onCancel={() => setPreviewUrl(null)} footer={null} width={window.innerWidth < 640 ? '95vw' : 900}
        title={t('invoice.preview')} styles={{ body: { padding: 0, height: '80vh' } }}>
        {previewUrl && <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Invoice" />}
      </Modal>

    </div>
  );
};

export default PurchaseOrderDetailPage;
