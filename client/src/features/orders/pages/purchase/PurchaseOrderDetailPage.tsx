import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Table, Space, Typography, Spin, Empty, Divider, Tag, Button, Upload, Tooltip, Tabs,
} from 'antd';
import { UploadOutlined, FilePdfOutlined, LinkOutlined, DollarOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { usePurchaseOrder } from '../../hooks';
import { PurchaseOrderItem } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';

const { Title, Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };

const PurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: orderData, isLoading } = usePurchaseOrder(id);
  const order = orderData?.data as any;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!order) return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;

  const invoices = order.invoices || [];
  const payables = order.payables || [];

  const itemColumns: ColumnsType<PurchaseOrderItem> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku', width: 100, responsive: ['md'] as any },
    { title: t('order.productName'), dataIndex: ['product', 'name'], key: 'name', ellipsis: true },
    { title: t('order.quantity'), dataIndex: 'quantity', key: 'qty', width: 80, align: 'right' as const },
    { title: t('product.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'total', width: 150, align: 'right' as const, render: (v: number) => formatVND(v) },
  ];

  const tabItems = [
    {
      key: 'invoice',
      label: <><FilePdfOutlined /> {t('invoice.purchaseInvoice')} ({invoices.length})</>,
      children: invoices.length === 0 ? (
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('invoice.uploadDescription')}</Text>
          <Upload action={`/api/invoice/purchase/${order.id}`} headers={{ Authorization: `Bearer ${localStorage.getItem('token')}` }}
            accept=".pdf,.jpg,.jpeg,.png" showUploadList={false} onChange={(info) => { if (info.file.status === 'done') window.location.reload(); }}>
            <Button icon={<UploadOutlined />} style={{ borderRadius: 8 }}>{t('invoice.uploadFile')}</Button>
          </Upload>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invoices.map((inv: any) => (
            <Card key={inv.id} size="small" style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <Space>
                  <Text strong>#{inv.invoice_number}</Text>
                  <Tag color={inv.status === 'APPROVED' ? 'green' : 'orange'} style={{ borderRadius: 6 }}>
                    {inv.status === 'APPROVED' ? t('invoice.statusApproved') : t('invoice.statusDraft')}
                  </Tag>
                  {inv.file_url && <Text type="secondary">{inv.file_name || t('invoice.fileAttached')}</Text>}
                </Space>
                {inv.file_url && (
                  <Tooltip title={t('invoice.viewFile')}>
                    <Button type="text" size="small" icon={<FilePdfOutlined />} href={inv.file_url} target="_blank" />
                  </Tooltip>
                )}
              </Space>
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'items',
      label: t('order.productDetails') + ` (${order.items?.length || 0})`,
      children: (
        <div>
          <Table columns={itemColumns} dataSource={order.items} pagination={false} size="small" scroll={{ x: 600 }} rowKey="id" />
          <Divider />
          <div style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 16 }}>{t('order.total')}: </Text>
            <Text strong style={{ fontSize: 16, color: '#fa541c' }}>{formatVND(order.total)}</Text>
          </div>
        </div>
      ),
    },
    ...(payables.length > 0 ? [{
      key: 'debts',
      label: <><DollarOutlined /> {t('debt.payables')} ({payables.length})</>,
      children: (
        <div>
          {payables.map((pay: any) => (
            <Descriptions key={pay.id} column={{ xs: 1, sm: 2 }} bordered size="small" style={{ marginBottom: 8 }}>
              <Descriptions.Item label={t('common.status')}><StatusTag status={pay.status} type="debt" /></Descriptions.Item>
              <Descriptions.Item label={t('debt.dueDate')}>{formatDate(pay.due_date)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.originalAmount')}>{formatVND(pay.original_amount)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.paidShort')}>{formatVND(pay.paid_amount)}</Descriptions.Item>
              <Descriptions.Item label={t('debt.remaining')}>
                <Text strong style={{ color: pay.remaining > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(pay.remaining)}</Text>
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

      {/* Header + Info */}
      <Card style={cardStyle}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <Title level={4} style={{ margin: 0 }}>{order.order_code}</Title>
          <StatusTag status={order.status} type="purchase" />
        </Space>

        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} style={{ marginTop: 16 }} bordered size="small">
          <Descriptions.Item label={t('order.supplier')}>{order.supplier?.company_name}</Descriptions.Item>
          <Descriptions.Item label={t('order.orderDate')}>{formatDate(order.order_date)}</Descriptions.Item>
          <Descriptions.Item label={t('order.expectedDelivery')}>{formatDate(order.expected_delivery)}</Descriptions.Item>
          {order.sales_order && (
            <Descriptions.Item label={t('order.linkedSO')}>
              <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => navigate(`/sales-orders/${order.sales_order.id}`)}>
                {order.sales_order.order_code}
              </Button>
              <Text type="secondary"> — {order.sales_order.customer?.company_name || order.sales_order.customer?.contact_name}</Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label={t('common.notes')} span={2}>{order.notes || '-'}</Descriptions.Item>
        </Descriptions>

        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <Text strong style={{ fontSize: 16 }}>{t('order.total')}: </Text>
          <Text strong style={{ fontSize: 16, color: '#fa541c' }}>{formatVND(order.total)}</Text>
        </div>
      </Card>
    </div>
  );
};

export default PurchaseOrderDetailPage;
