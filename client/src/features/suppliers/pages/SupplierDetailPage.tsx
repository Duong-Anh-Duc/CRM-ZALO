import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Descriptions, Spin, Table, Tabs, Tag, Typography, Space, Empty
} from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useSupplier } from '../hooks';
import { StatusTag } from '@/components/common';
import { Supplier, PurchaseOrder, Payable, Product } from '@/types';
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

  const products: Product[] = (supplierData?.data?.products as Product[]) ?? [];
  const orders: PurchaseOrder[] = (supplierData?.data?.orders as PurchaseOrder[]) ?? [];
  const payables: Payable[] = (supplierData?.data?.payables as Payable[]) ?? [];

  const productColumns: ColumnsType<Product> = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: t('order.productName'), dataIndex: 'name', key: 'name', ellipsis: true },
    { title: t('supplier.unit'), dataIndex: 'unit', key: 'unit', width: 100 },
    {
      title: t('supplier.costPrice'), dataIndex: 'cost_price', key: 'cost_price', width: 150, align: 'right',
      render: (v: number) => formatVND(v),
    },
  ];

  const orderColumns: ColumnsType<PurchaseOrder> = [
    { title: t('order.orderCode'), dataIndex: 'order_code', key: 'order_code', width: 140 },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'order_date', width: 120, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'total', key: 'total', width: 150, align: 'right', render: (v: number) => formatVND(v) },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => <StatusTag status={s} type="purchase" />,
    },
  ];

  const payableColumns: ColumnsType<Payable> = [
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
        <Descriptions bordered column={2} size="small" style={{ borderRadius: 8 }}>
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
        <Table<Product>
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
        <Table<PurchaseOrder>
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
        <Table<Payable>
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
