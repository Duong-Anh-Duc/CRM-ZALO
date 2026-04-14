import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Table, Space, Typography, Spin, Empty, Tag, Button, Upload, Tooltip, Row, Col, Avatar, Statistic, Modal, Popconfirm,
} from 'antd';
import { UploadOutlined, FilePdfOutlined, DollarOutlined, ShopOutlined, CalendarOutlined, FieldTimeOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, CheckCircleOutlined, PlusOutlined } from '@ant-design/icons';
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
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const fLabel: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const PurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: orderData, isLoading } = usePurchaseOrder(id);
  const order = orderData?.data as any;

  const createInvMutation = useMutation({
    mutationFn: () => apiClient.post(`/invoice/purchase/${id}`),
    onSuccess: () => { toast.success(t('invoice.draftCreated')); qc.invalidateQueries({ queryKey: ['purchase-order'] }); },
  });
  const approveInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/finalize`),
    onSuccess: () => { toast.success(t('invoice.finalized')); qc.invalidateQueries({ queryKey: ['purchase-order'] }); },
  });
  const cancelInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/cancel`),
    onSuccess: () => { toast.success(t('invoice.cancelled')); qc.invalidateQueries({ queryKey: ['purchase-order'] }); },
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
      {/* Total on top */}
      <Card style={cardStyle}>
        <Card size="small" style={{ borderRadius: 10, border: '1px solid #fff2e8' }}>
          <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: '#fa541c' }} />{t('order.total')}</>} value={Number(order.total)} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa541c', fontSize: 20 }} />
        </Card>
      </Card>

      <Card style={cardStyle}>
        {/* Header */}
        <Space size={16} style={{ marginBottom: 20 }}>
          <Avatar size={48} style={{ background: '#722ed1', fontSize: 16 }}>{order.order_code.slice(-3)}</Avatar>
          <div>
            <Text strong style={{ fontSize: 20, display: 'block' }}>{order.order_code}</Text>
            <StatusTag status={order.status} type="purchase" />
          </div>
        </Space>

        {/* Info grid */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><ShopOutlined style={{ marginRight: 4 }} />{t('order.supplier')}</Text><Text strong>{order.supplier?.company_name}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.orderDate')}</Text><Text strong>{formatDate(order.order_date)}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FieldTimeOutlined style={{ marginRight: 4 }} />{t('order.expectedDelivery')}</Text><Text strong>{formatDate(order.expected_delivery)}</Text></div></Col>
          <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('common.notes')}</Text><Text strong>{order.notes || '—'}</Text></div></Col>
        </Row>

      </Card>

      {/* Hoá đơn mua */}
      <Card title={<><FilePdfOutlined style={{ marginRight: 6 }} /> {t('invoice.purchaseInvoice')}</>} style={cardStyle}>
        {!invoice ? (
          <Button icon={<PlusOutlined />} onClick={() => createInvMutation.mutate()} loading={createInvMutation.isPending} style={{ borderRadius: 8 }}>
            {t('invoice.createDraft')}
          </Button>
        ) : (
          <Card size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Space size={8}>
                <Text strong>{t('invoice.invoiceNumber')}: {invoice.invoice_number}</Text>
                <Tag color={invoice.status === 'APPROVED' ? 'green' : 'orange'} style={{ borderRadius: 6 }}>
                  {invoice.status === 'APPROVED' ? t('invoice.statusApproved') : t('invoice.statusDraft')}
                </Tag>
                <Text strong>{formatVND(invoice.total)}</Text>
              </Space>
              <Space size={4} style={{ flexShrink: 0 }}>
                <Tooltip title={t('invoice.viewPdf')}><Button type="text" size="small" icon={<FilePdfOutlined />} onClick={() => setPreviewUrl(`${invoiceApi.getPdfUrl(invoice.id)}?token=${localStorage.getItem('token')}`)} /></Tooltip>
                <Tooltip title={t('invoice.downloadPdf')}><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => window.open(`${invoiceApi.getPdfUrl(invoice.id)}?token=${localStorage.getItem('token')}`, '_blank')} /></Tooltip>
                <Tooltip title={t('invoice.editDraft')}><Button type="text" size="small" icon={<EditOutlined />} /></Tooltip>
                {invoice.status === 'DRAFT' && (
                  <>
                    <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => approveInvMutation.mutate(invoice.id)} /></Tooltip>
                    <Popconfirm title={t('invoice.confirmDelete')} onConfirm={() => cancelInvMutation.mutate(invoice.id)} okText={t('common.confirm')} cancelText={t('common.cancel')}>
                      <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </div>
          </Card>
        )}
      </Card>

      {/* Preview Modal */}
      <Modal open={!!previewUrl} onCancel={() => setPreviewUrl(null)} footer={null} width={window.innerWidth < 640 ? '95vw' : 900}
        title={t('invoice.preview')} styles={{ body: { padding: 0, height: '80vh' } }}>
        {previewUrl && <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Invoice" />}
      </Modal>

      {/* Items */}
      <Card title={t('order.productDetails') + ` (${order.items?.length || 0})`} style={cardStyle}>
        <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 600 }} rowKey="id" />
      </Card>

    </div>
  );
};

export default PurchaseOrderDetailPage;
