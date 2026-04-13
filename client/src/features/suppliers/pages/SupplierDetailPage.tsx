import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Descriptions, Spin, Table, Tabs, Tag, Typography, Space, Empty
} from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSupplier } from '../hooks';
import { StatusTag } from '@/components/common';
import { Supplier, PurchaseOrder, Payable } from '@/types';
import {
  formatVND, formatDate, formatDateTime,
} from '@/utils/format';

const { Title, Text } = Typography;

const SupplierDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const paymentTermsLabels: Record<string, string> = {
    IMMEDIATE: t('paymentTermsLabels.IMMEDIATE'),
    NET_30: t('paymentTermsLabels.NET_30'),
    NET_60: t('paymentTermsLabels.NET_60'),
    NET_90: t('paymentTermsLabels.NET_90'),
  };

  const { data: supplierData, isLoading } = useSupplier(id);

  const supplier: Supplier | undefined = supplierData?.data;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description={t('supplier.notFound')} />
      </div>
    );
  }

  const supplierPrices: any[] = (supplierData?.data?.supplier_prices as any[]) ?? [];
  const products = supplierPrices.map((sp: any) => ({
    id: sp.product?.id,
    sku: sp.product?.sku,
    name: sp.product?.name,
    cost_price: sp.purchase_price,
    moq: sp.moq,
    lead_time_days: sp.lead_time_days,
    stock_quantity: sp.stock_quantity,
    is_preferred: sp.is_preferred,
  }));
  const orders: PurchaseOrder[] = (supplierData?.data?.purchase_orders as PurchaseOrder[]) ?? [];
  const payables: Payable[] = (supplierData?.data?.payables as Payable[]) ?? [];

  const productColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: t('order.productName'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t('supplier.costPrice'), dataIndex: 'cost_price', key: 'cost_price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: 'MOQ', dataIndex: 'moq', key: 'moq', width: 80, align: 'right' as const },
    { title: t('supplier.leadTime'), dataIndex: 'lead_time_days', key: 'lead', width: 100, render: (v: number) => v ? `${v} ngày` : '-' },
    { title: t('supplier.stock'), dataIndex: 'stock_quantity', key: 'stock', width: 100, align: 'right' as const, render: (v: number) => v?.toLocaleString() || '-' },
    { title: '', dataIndex: 'is_preferred', key: 'pref', width: 60, render: (v: boolean) => v ? <Tag color="gold" style={{ borderRadius: 6 }}>Ưu tiên</Tag> : null },
  ];

  const orderColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: t('order.orderCode'), dataIndex: 'order_code', key: 'order_code', width: 150 },
    { title: t('order.linkedSO'), key: 'so', width: 150, render: (_: unknown, r: any) => r.sales_order?.order_code || '-' },
    { title: t('order.customer'), key: 'cust', width: 150, render: (_: unknown, r: any) => r.sales_order?.customer?.company_name || r.sales_order?.customer?.contact_name || '-', responsive: ['lg'] as any },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'order_date', width: 110, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'total', key: 'total', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 120, render: (s: string) => <StatusTag status={s} type="purchase" /> },
  ];

  const payableColumns: ColumnsType<Payable> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: t('order.invoiceNumber'), dataIndex: 'invoice_number', key: 'invoice_number', width: 140 },
    { title: t('debt.invoiceDate'), dataIndex: 'invoice_date', key: 'invoice_date', width: 120, render: formatDate },
    { title: t('order.dueDate'), dataIndex: 'due_date', key: 'due_date', width: 120, render: formatDate },
    { title: t('order.originalAmount'), dataIndex: 'original_amount', key: 'original_amount', width: 140, align: 'right', render: (v: number) => formatVND(v) },
    { title: t('order.paidAmount'), dataIndex: 'paid_amount', key: 'paid_amount', width: 140, align: 'right', render: (v: number) => formatVND(v) },
    { title: t('order.remaining'), dataIndex: 'remaining', key: 'remaining', width: 140, align: 'right', render: (v: number) => formatVND(v) },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => <StatusTag status={s} type="debt" />,
    },
  ];

  const tabItems = [
    {
      key: 'info',
      label: t('customer.info'),
      children: (
        <Descriptions bordered column={{ xs: 1, md: 2 }} size="small" style={{ borderRadius: 8 }}>
          <Descriptions.Item label={t('customer.companyName')}>{supplier.company_name}</Descriptions.Item>
          <Descriptions.Item label={t('customer.taxCode')}>{supplier.tax_code ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.address')} span={2}>{supplier.address ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.contactName')}>{supplier.contact_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.phone')}>{supplier.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{supplier.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('supplier.paymentTerms')}>
            {paymentTermsLabels[supplier.payment_terms] ?? supplier.payment_terms}
          </Descriptions.Item>
          <Descriptions.Item label={t('common.status')}>
            <Tag color={supplier.is_active ? 'green' : 'default'} style={{ borderRadius: 8 }}>
              {supplier.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('customer.zalo')}>
            <Text>{supplier.zalo_user_id || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('customer.createdAt')}>{formatDateTime(supplier.created_at)}</Descriptions.Item>
          <Descriptions.Item label={t('supplier.updatedAt')}>{formatDateTime(supplier.updated_at)}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'products',
      label: t('supplier.productsSupplied'),
      children: (
        <Table
          rowKey="id"
          columns={productColumns}
          dataSource={products}
          pagination={{ pageSize: 10, showTotal: (total) => t('supplier.totalProducts', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
    {
      key: 'orders',
      label: t('supplier.purchaseHistory'),
      children: (
        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={orders}
          pagination={{ pageSize: 10, showTotal: (total) => t('supplier.totalPurchaseOrders', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
    {
      key: 'payables',
      label: t('customer.debts'),
      children: (
        <Table
          rowKey="id"
          columns={payableColumns}
          dataSource={payables}
          pagination={{ pageSize: 10, showTotal: (total) => t('supplier.totalPayables', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
  ];

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        <Space style={{ marginBottom: 16 }} align="center">
          <Title level={4} style={{ margin: 0 }}>{supplier.company_name}</Title>
          <Tag color={supplier.is_active ? 'green' : 'default'} style={{ borderRadius: 8 }}>
            {supplier.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
          </Tag>
        </Space>

        <Tabs items={tabItems} />
      </Card>

    </>
  );
};

export default SupplierDetailPage;
