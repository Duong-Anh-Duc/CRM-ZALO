import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Descriptions, Table, Space, Typography, Spin, Empty, Divider,
} from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { usePurchaseOrder } from '../../hooks';
import { PurchaseOrder, PurchaseOrderItem } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';

const { Title, Text } = Typography;

const PurchaseOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data: orderData, isLoading } = usePurchaseOrder(id);
  const data = orderData?.data as PurchaseOrder | undefined;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!data) {
    return <Empty description={t('order.notFound')} style={{ marginTop: 80 }} />;
  }

  const order = data;
  const payable = (order as any).payable;

  const itemColumns: ColumnsType<PurchaseOrderItem> = [
    { title: t('common.stt'), key: 'stt', width: 60, render: (_, __, i) => i + 1 },
    { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku', width: 120 },
    { title: t('order.productName'), dataIndex: ['product', 'name'], key: 'name', ellipsis: true },
    { title: t('order.quantity'), dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' },
    {
      title: t('product.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 140,
      align: 'right',
      render: (v: number) => formatVND(v),
    },
    {
      title: t('order.lineTotal'),
      dataIndex: 'line_total',
      key: 'line_total',
      width: 160,
      align: 'right',
      render: (v: number) => formatVND(v),
    },
  ];

  return (
    <div>
      {/* Order Header */}
      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
          <Title level={4} style={{ margin: 0 }}>
            {t('order.purchaseOrder', { code: order.order_code })}
          </Title>
          <StatusTag status={order.status} type="purchase" />
        </Space>

        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} style={{ marginTop: 16 }} bordered size="small">
          <Descriptions.Item label={t('menu.suppliers')}>{order.supplier?.company_name}</Descriptions.Item>
          <Descriptions.Item label={t('order.orderDate')}>{formatDate(order.order_date)}</Descriptions.Item>
          <Descriptions.Item label={t('order.expectedDelivery')}>
            {formatDate(order.expected_delivery)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.notes')}>{order.notes || '-'}</Descriptions.Item>
        </Descriptions>

      </Card>

      {/* Items */}
      <Card title={t('order.productDetails')} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Table<PurchaseOrderItem>
          rowKey="id"
          columns={itemColumns}
          dataSource={order.items}
          pagination={false}
          size="small"
          style={{ borderRadius: 12 }}
        />

        <Divider />

        <div style={{ textAlign: 'right', maxWidth: 350, marginLeft: 'auto' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: 16 }}>{t('order.total')}</Text>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                {formatVND(order.total)}
              </Text>
            </div>
          </Space>
        </div>
      </Card>

      {/* Payable Info */}
      {payable && (
        <Card title={t('order.debtInfo')} style={{ borderRadius: 12 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label={t('order.invoiceNumber')}>{payable.invoice_number || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>
              <StatusTag status={payable.status} type="debt" />
            </Descriptions.Item>
            <Descriptions.Item label={t('order.originalAmount')}>{formatVND(payable.original_amount)}</Descriptions.Item>
            <Descriptions.Item label={t('order.paidAmount')}>{formatVND(payable.paid_amount)}</Descriptions.Item>
            <Descriptions.Item label={t('order.remaining')}>
              <Text strong style={{ color: payable.remaining > 0 ? '#cf1322' : '#52c41a' }}>
                {formatVND(payable.remaining)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('order.dueDate')}>{formatDate(payable.due_date)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
};

export default PurchaseOrderDetailPage;
