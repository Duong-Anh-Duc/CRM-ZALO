import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Card, Descriptions, Space, Typography, Spin, Empty, Table, Tag, Button, Modal, Tooltip, Row, Col, Statistic, Input, DatePicker, Tabs, Form,
} from 'antd';
import { FilePdfOutlined, EyeOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, PlusOutlined, DollarOutlined, ShopOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useSalesOrder } from '../../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';
import { invoiceApi } from '@/features/invoices/api';
import apiClient from '@/lib/api-client';

const { Title, Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };

const SalesOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [previewInvId, setPreviewInvId] = useState<string | null>(null);
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

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!order) return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;

  const purchaseOrders = order.purchase_orders || [];
  const salesInvoices = order.invoices || [];
  const receivables = order.receivables || [];
  const purchaseTotal = order.purchase_total || purchaseOrders.reduce((s: number, po: any) => s + Number(po.total), 0);
  const profit = order.profit || (Number(order.grand_total) - purchaseTotal);

  // Item columns with supplier info
  const itemColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku', width: 100, responsive: ['md'] as any },
    { title: t('order.productName'), dataIndex: ['product', 'name'], key: 'name', ellipsis: true },
    { title: t('order.suppliers'), key: 'supplier', width: 140, render: (_: any, r: any) => r.supplier?.company_name || '-', responsive: ['lg'] as any },
    { title: t('order.quantity'), dataIndex: 'quantity', key: 'qty', width: 70, align: 'right' as const },
    { title: t('product.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 110, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('order.purchasePrice'), dataIndex: 'purchase_price', key: 'pp', width: 110, align: 'right' as const, render: (v: number) => v ? formatVND(v) : '-', responsive: ['lg'] as any },
    { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('order.supplierStatus'), key: 'ss', width: 120,
      render: (_: any, r: any) => {
        const colors: Record<string, string> = { PENDING: 'gold', CONFIRMED: 'cyan', SHIPPING: 'purple', DELIVERED: 'green' };
        const labels: Record<string, string> = { PENDING: 'Chờ', CONFIRMED: 'Xác nhận', SHIPPING: 'Đang giao', DELIVERED: 'Đã giao' };
        return <Tag color={colors[r.supplier_status] || 'default'} style={{ borderRadius: 6 }}>{labels[r.supplier_status] || r.supplier_status}</Tag>;
      },
    },
  ];

  const tabItems = [
    {
      key: 'pos',
      label: <><ShopOutlined /> {t('order.purchaseOrders')} ({purchaseOrders.length})</>,
      children: purchaseOrders.length === 0 ? (
        <Empty description={order.status === 'PENDING' ? t('invoice.autoCreateOnConfirm') : '-'} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {purchaseOrders.map((po: any) => (
            <Card key={po.id} size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <Space><Text strong>{po.order_code}</Text><Text type="secondary">{po.supplier?.company_name}</Text><StatusTag status={po.status} type="purchase" /></Space>
                <Space><Text strong>{formatVND(po.total)}</Text>
                  <Tooltip title={t('common.viewDetail')}><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/purchase-orders/${po.id}`)} /></Tooltip>
                </Space>
              </Space>
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'sales-invoice',
      label: <><FilePdfOutlined /> {t('invoice.salesInvoice')} ({salesInvoices.length})</>,
      children: (
        <div>
          {salesInvoices.length === 0 && order.status !== 'PENDING' && (
            <Button icon={<PlusOutlined />} onClick={() => createInvMutation.mutate()} loading={createInvMutation.isPending} style={{ borderRadius: 8, marginBottom: 12 }}>{t('invoice.createDraft')}</Button>
          )}
          {salesInvoices.length === 0 && order.status === 'PENDING' && (
            <Empty description={t('invoice.autoCreateOnConfirm')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
          {salesInvoices.map((inv: any) => (
            <Card key={inv.id} size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 8 }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <Space>
                  <Text strong>#{inv.invoice_number}</Text>
                  <Tag color={inv.status === 'APPROVED' ? 'green' : inv.status === 'DRAFT' ? 'orange' : 'red'} style={{ borderRadius: 6 }}>
                    {inv.status === 'APPROVED' ? t('invoice.statusApproved') : inv.status === 'DRAFT' ? t('invoice.statusDraft') : t('invoice.statusCancelled')}
                  </Tag>
                  <Text>{formatVND(inv.total)}</Text>
                </Space>
                <Space>
                  <Tooltip title={t('invoice.viewPdf')}><Button type="text" size="small" icon={<FilePdfOutlined />} onClick={() => setPreviewInvId(inv.id)} /></Tooltip>
                  {inv.status === 'DRAFT' && (
                    <>
                      <Tooltip title={t('invoice.finalize')}><Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />} onClick={() => approveInvMutation.mutate(inv.id)} /></Tooltip>
                      <Tooltip title={t('common.delete')}><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => cancelInvMutation.mutate(inv.id)} /></Tooltip>
                    </>
                  )}
                </Space>
              </Space>
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'items',
      label: t('order.productDetails') + ` (${order.items?.length || 0})`,
      children: <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 800 }} rowKey="id" />,
    },
    ...(receivables.length > 0 ? [{
      key: 'debts',
      label: <><DollarOutlined /> {t('debt.receivables')} ({receivables.length})</>,
      children: (
        <div>
          {receivables.map((rec: any) => (
            <Descriptions key={rec.id} column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 8 }}>
              <Descriptions.Item label={t('common.status')}><StatusTag status={rec.status} type="debt" /></Descriptions.Item>
              <Descriptions.Item label={t('debt.dueDate')}>{formatDate(rec.due_date)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.originalAmount')}>{formatVND(rec.original_amount)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.paidShort')}>{formatVND(rec.paid_amount)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.remaining')}>
                <Text strong style={{ color: rec.remaining > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(rec.remaining)}</Text>
              </Descriptions.Item>
            </Descriptions>
          ))}
        </div>
      ),
    }] : []),
  ];

  return (
    <div>
      {/* Tabs — on top */}
      <Card style={cardStyle}>
        <Tabs items={tabItems} />
      </Card>

      {/* Header + Summary */}
      <Card style={cardStyle}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <Title level={4} style={{ margin: 0 }}>{order.order_code}</Title>
          <Space>
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
        </Space>

        {editing ? (
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item name="notes" label={t('common.notes')}>
                  <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        ) : (
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} style={{ marginTop: 16 }} bordered size="small">
            <Descriptions.Item label={t('order.customer')}>{order.customer?.company_name || order.customer?.contact_name}</Descriptions.Item>
            <Descriptions.Item label={t('customer.contactName')}>{order.customer?.contact_name || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('customer.phone')}>{order.customer?.phone || '-'}</Descriptions.Item>
            {order.customer?.email && <Descriptions.Item label="Email">{order.customer.email}</Descriptions.Item>}
            {order.customer?.tax_code && <Descriptions.Item label={t('customer.taxCode')}>{order.customer.tax_code}</Descriptions.Item>}
            {order.customer?.address && <Descriptions.Item label={t('customer.address')} span={order.customer?.email ? 1 : 2}>{order.customer.address}</Descriptions.Item>}
            <Descriptions.Item label={t('order.orderDate')}>{formatDate(order.order_date)}</Descriptions.Item>
            <Descriptions.Item label={t('order.expectedDelivery')}>{formatDate(order.expected_delivery)}</Descriptions.Item>
            <Descriptions.Item label={t('common.notes')} span={3}>{order.notes || '-'}</Descriptions.Item>
          </Descriptions>
        )}

        {/* Financial summary */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
              <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: '#1890ff' }} />{t('order.grandTotal')}</>} value={Number(order.grand_total)} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#1890ff', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #fff2e8' }}>
              <Statistic title={<><ShopOutlined style={{ marginRight: 4, color: '#fa541c' }} />{t('order.purchaseTotal')}</>} value={purchaseTotal} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#fa541c', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: profit >= 0 ? '1px solid #f6ffed' : '1px solid #fff2f0' }}>
              <Statistic title={<><DollarOutlined style={{ marginRight: 4, color: profit >= 0 ? '#52c41a' : '#cf1322' }} />{t('order.profit')}</>} value={profit} formatter={(v) => formatVND(v as number)} valueStyle={{ color: profit >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }} />
            </Card>
          </Col>
        </Row>

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
    </div>
  );
};

export default SalesOrderDetailPage;
