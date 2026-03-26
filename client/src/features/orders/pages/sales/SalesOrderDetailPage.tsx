import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Space, Typography, Spin, Empty,
  Divider, Input, Table,
} from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSalesOrder } from '../../hooks';
import { SalesOrder, SalesOrderItem } from '@/types';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag } from '@/components/common';

const { Title, Text } = Typography;

const SalesOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data: orderData, isLoading } = useSalesOrder(id);
  const data = orderData?.data as SalesOrder | undefined;

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
  const receivable = (order as any).receivable;

  const itemColumns: ColumnsType<SalesOrderItem> = [
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
      title: t('order.discountPct'),
      dataIndex: 'discount_pct',
      key: 'discount_pct',
      width: 100,
      align: 'right',
      render: (v: number) => (v ? `${v}%` : '-'),
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
            {t('order.salesOrder', { code: order.order_code })}
          </Title>
          <StatusTag status={order.status} type="sales" />
        </Space>

        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} style={{ marginTop: 16 }} bordered size="small">
          <Descriptions.Item label={t('menu.customers')}>{order.customer?.company_name}</Descriptions.Item>
          <Descriptions.Item label={t('order.orderDate')}>{formatDate(order.order_date)}</Descriptions.Item>
          <Descriptions.Item label={t('order.expectedDelivery')}>
            {formatDate(order.expected_delivery)}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.notes')}>{order.notes || '-'}</Descriptions.Item>
        </Descriptions>

      </Card>

      {/* Items */}
      <Card title={t('order.productDetails')} style={{ borderRadius: 12, marginBottom: 16 }}>
        <Table<SalesOrderItem>
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
              <Text>{t('order.subtotal')}</Text>
              <Text>{formatVND(order.subtotal)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>{t('order.discount')}</Text>
              <Text>{formatVND(order.discount_amount)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>VAT ({order.vat_rate?.replace('VAT_', '')}%):</Text>
              <Text>{formatVND(order.vat_amount)}</Text>
            </div>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: 16 }}>{t('order.total')}</Text>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>
                {formatVND(order.grand_total)}
              </Text>
            </div>
          </Space>
        </div>
      </Card>

      {/* Receivable Info */}
      {receivable && (
        <Card title={t('order.debtInfo')} style={{ borderRadius: 12, marginBottom: 16 }}>
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label={t('order.invoiceNumber')}>{receivable.invoice_number || '-'}</Descriptions.Item>
            <Descriptions.Item label={t('common.status')}>
              <StatusTag status={receivable.status} type="debt" />
            </Descriptions.Item>
            <Descriptions.Item label={t('order.originalAmount')}>{formatVND(receivable.original_amount)}</Descriptions.Item>
            <Descriptions.Item label={t('order.paidAmount')}>{formatVND(receivable.paid_amount)}</Descriptions.Item>
            <Descriptions.Item label={t('order.remaining')}>
              <Text strong style={{ color: receivable.remaining > 0 ? '#cf1322' : '#52c41a' }}>
                {formatVND(receivable.remaining)}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('order.dueDate')}>{formatDate(receivable.due_date)}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Zalo - Phase 2 */}
      <Card
        title={t('order.sendZalo')}
        style={{ borderRadius: 12, opacity: 0.5 }}
        extra={<Tag style={{ borderRadius: 8 }}>{t('common.phase2')}</Tag>}
      >
        <Input.TextArea
          rows={3}
          disabled
          placeholder={t('order.zaloPlaceholder')}
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};

export default SalesOrderDetailPage;
