import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Space, Typography, Spin, Empty, Table, Tag, Button, Modal, Tooltip, Row, Col, Statistic, Input, DatePicker, Form, Avatar,
} from 'antd';
import { FilePdfOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, PlusOutlined, DollarOutlined, ShopOutlined, SaveOutlined, UserOutlined, PhoneOutlined, CalendarOutlined, FieldTimeOutlined, FileTextOutlined, EnvironmentOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useSalesOrder } from '../../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';
import { invoiceApi } from '@/features/invoices/api';
import InvoiceEditModal from '@/features/invoices/components/InvoiceEditModal';
import apiClient from '@/lib/api-client';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };

const SalesOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [previewInvId, setPreviewInvId] = useState<string | null>(null);
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const { data: orderData, isLoading } = useSalesOrder(id);
  const order = orderData?.data as any;

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiClient.patch(`/sales-orders/${id}`, data),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['sales-order'] }); setEditing(false); },
    onError: () => toast.error(t('common.error')),
  });

  const createInvMutation = useMutation({
    mutationFn: () => apiClient.post(`/invoice/from-order/${id}`),
    onSuccess: () => { toast.success(t('invoice.draftCreated')); qc.invalidateQueries({ queryKey: ['sales-order'] }); },
  });
  const approveInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/finalize`),
    onSuccess: () => { toast.success(t('invoice.finalized')); qc.invalidateQueries({ queryKey: ['sales-order'] }); },
  });
  const cancelInvMutation = useMutation({
    mutationFn: (invId: string) => apiClient.post(`/invoice/${invId}/cancel`),
    onSuccess: () => { toast.success(t('invoice.cancelled')); qc.invalidateQueries({ queryKey: ['sales-order'] }); },
  });
  const updateInvMutation = useMutation({
    mutationFn: ({ invId, data }: { invId: string; data: Record<string, unknown> }) => apiClient.patch(`/invoice/${invId}`, data),
    onSuccess: () => { toast.success(t('common.saved')); qc.invalidateQueries({ queryKey: ['sales-order'] }); setEditInvId(null); },
    onError: () => toast.error(t('common.error')),
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!order) return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;

  const purchaseOrders = order.purchase_orders || [];
  const salesInvoices = order.invoices || [];

  const purchaseTotal = order.purchase_total || purchaseOrders.reduce((s: number, po: any) => s + Number(po.total), 0);
  const profit = order.profit || (Number(order.grand_total) - purchaseTotal);

  // Item columns with supplier info
  const nowrap = () => ({ style: { whiteSpace: 'nowrap' as const } });
  const itemColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku', width: 100, responsive: ['md'] as any },
    { title: t('order.productName'), dataIndex: ['product', 'name'], key: 'name', ellipsis: true },
    { title: t('order.suppliers'), key: 'supplier', width: 180, onHeaderCell: nowrap, render: (_: any, r: any) => r.supplier?.company_name || '-', responsive: ['lg'] as any },
    { title: t('order.purchaseOrderShort'), key: 'po', width: 160, onHeaderCell: nowrap, render: (_: any, r: any) => {
      const po = purchaseOrders.find((p: any) => p.supplier_id === r.supplier_id);
      return po ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${po.id}`)}>{po.order_code}</Button> : '-';
    }, responsive: ['lg'] as any },
    { title: t('order.quantity'), dataIndex: 'quantity', key: 'qty', width: 70, align: 'right' as const },
    { title: t('product.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 110, onHeaderCell: nowrap, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('order.purchasePrice'), dataIndex: 'purchase_price', key: 'pp', width: 110, onHeaderCell: nowrap, align: 'right' as const, render: (v: number) => v ? formatVND(v) : '-', responsive: ['lg'] as any },
    { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 130, onHeaderCell: nowrap, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('order.supplierStatus'), key: 'ss', width: 130, onHeaderCell: nowrap,
      render: (_: any, r: any) => {
        const colors: Record<string, string> = { PENDING: 'gold', CONFIRMED: 'cyan', SHIPPING: 'purple', DELIVERED: 'green' };
        const labels: Record<string, string> = { PENDING: 'Chờ', CONFIRMED: 'Xác nhận', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao' };
        return <Tag color={colors[r.supplier_status] || 'default'} style={{ borderRadius: 6 }}>{labels[r.supplier_status] || r.supplier_status}</Tag>;
      },
    },
  ];

  const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
  const fLabel: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

  return (
    <div>
      {/* Financial summary — on top */}
      <Card style={cardStyle}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e6f4ff', height: '100%' }}>
              <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: '#1890ff' }} />{t('order.grandTotal')}</>} value={Number(order.grand_total)} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#1890ff', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #fff2e8', height: '100%' }}>
              <Statistic title={<><ShopOutlined style={{ marginRight: 4, color: '#fa541c' }} />{t('order.purchaseTotal')}</>} value={purchaseTotal} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa541c', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: profit >= 0 ? '1px solid #f6ffed' : '1px solid #fff2f0', height: '100%' }}>
              <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: profit >= 0 ? '#52c41a' : '#cf1322' }} />{t('order.profit')}</>} value={profit} formatter={(v) => formatVND(v as number)} valueStyle={{ color: profit >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }} />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Order info */}
      <Card style={cardStyle}>
        {/* Header */}
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }} align="start">
          <Space size={16}>
            <Avatar size={48} style={{ background: '#1677ff', fontSize: 16 }}>{order.order_code.slice(-3)}</Avatar>
            <div>
              <Text strong style={{ fontSize: 20, display: 'block' }}>{order.order_code}</Text>
              <Space size={6}>
                <StatusTag status={order.status} type="sales" />
                {!editing && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                  <Tooltip title={t('common.edit')}>
                    <Button icon={<EditOutlined />} size="small" onClick={() => { setEditing(true); form.setFieldsValue({ notes: order.notes, expected_delivery: order.expected_delivery ? dayjs(order.expected_delivery) : null }); }} style={{ borderRadius: 8 }} />
                  </Tooltip>
                )}
                {editing && (
                  <Button type="primary" icon={<SaveOutlined />} size="small" loading={saveMutation.isPending}
                    onClick={() => { const v = form.getFieldsValue(); saveMutation.mutate({ notes: v.notes, expected_delivery: v.expected_delivery?.format('YYYY-MM-DD') }); }}
                    style={{ borderRadius: 8 }}>{t('common.save')}</Button>
                )}
              </Space>
            </div>
          </Space>
        </Space>

        {/* Info grid */}
        {editing ? (
          <Form form={form} layout="vertical">
            <Row gutter={12}>
              <Col xs={24} md={12}><Form.Item name="expected_delivery" label={t('order.expectedDelivery')}><DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} /></Form.Item></Col>
              <Col xs={24}><Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} style={{ borderRadius: 8 }} /></Form.Item></Col>
            </Row>
          </Form>
        ) : (
          <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><UserOutlined style={{ marginRight: 4 }} />{t('order.customer')}</Text><Text strong>{order.customer?.company_name || order.customer?.contact_name}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{order.customer?.phone || '—'}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><CalendarOutlined style={{ marginRight: 4 }} />{t('order.orderDate')}</Text><Text strong>{formatDate(order.order_date)}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FieldTimeOutlined style={{ marginRight: 4 }} />{t('order.expectedDelivery')}</Text><Text strong>{formatDate(order.expected_delivery)}</Text></div></Col>
            <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><FileTextOutlined style={{ marginRight: 4 }} />{t('common.notes')}</Text><Text strong>{order.notes || '—'}</Text></div></Col>
            {order.customer?.address && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={fLabel}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{order.customer.address}</Text></div></Col>}
          </Row>
        )}


      </Card>

      {/* Hoá đơn bán */}
      <Card title={<><FilePdfOutlined style={{ marginRight: 6 }} /> {t('invoice.salesInvoice')} ({salesInvoices.length})</>} style={cardStyle}>
        {salesInvoices.length === 0 && order.status !== 'PENDING' && (
          <Button icon={<PlusOutlined />} onClick={() => createInvMutation.mutate()} loading={createInvMutation.isPending} style={{ borderRadius: 8 }}>{t('invoice.createDraft')}</Button>
        )}
        {salesInvoices.length === 0 && order.status === 'PENDING' && <Text type="secondary">{t('invoice.autoCreateOnConfirm')}</Text>}
        {salesInvoices.map((inv: any) => (
          <Card key={inv.id} size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Space size={8}>
                <Text strong>{t('invoice.invoiceNumber')}: {inv.invoice_number}</Text>
                <Tag color={inv.status === 'APPROVED' ? 'green' : inv.status === 'DRAFT' ? 'orange' : 'red'} style={{ borderRadius: 6 }}>
                  {inv.status === 'APPROVED' ? t('invoice.statusApproved') : inv.status === 'DRAFT' ? t('invoice.statusDraft') : t('invoice.statusCancelled')}
                </Tag>
                <Text strong>{formatVND(inv.total)}</Text>
              </Space>
              <Space size={4} style={{ flexShrink: 0 }}>
                <Tooltip title={t('invoice.viewPdf')}><Button type="text" size="small" icon={<FilePdfOutlined />} onClick={() => setPreviewInvId(inv.id)} /></Tooltip>
                <Tooltip title={t('invoice.downloadPdf')}><Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => {
                  const url = `${invoiceApi.getPdfUrl(inv.id)}?token=${localStorage.getItem('token')}`;
                  window.open(url, '_blank');
                }} /></Tooltip>
                <Tooltip title={t('invoice.editDraft')}><Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditInvId(inv.id)} /></Tooltip>
                {inv.status === 'DRAFT' && (
                  <>
                    <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => approveInvMutation.mutate(inv.id)} /></Tooltip>
                    <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => cancelInvMutation.mutate(inv.id)} /></Tooltip>
                  </>
                )}
              </Space>
            </div>
          </Card>
        ))}
      </Card>

      {/* Chi tiết sản phẩm */}
      <Card title={t('order.productDetails') + ` (${order.items?.length || 0})`} style={cardStyle}>
        <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 800 }} rowKey="id" />
      </Card>

      {/* PDF Preview Modal */}
      <Modal open={!!previewInvId} onCancel={() => setPreviewInvId(null)} footer={null}
        width={window.innerWidth < 640 ? '95vw' : 900} title={t('invoice.preview')}
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
    </div>
  );
};

export default SalesOrderDetailPage;
