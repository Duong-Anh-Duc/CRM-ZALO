import React from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Descriptions, Spin, Table, Tabs, Tag, Typography, Space, Empty
} from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { useCustomer } from '../hooks';
import { StatusTag } from '@/components/common';
import { Customer, SalesOrder, Receivable, Payment } from '@/types';
import {
  formatVND, formatDate, formatDateTime, customerTypeLabels,
} from '@/utils/format';

const { Title, Text } = Typography;

const CustomerDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data: customerData, isLoading } = useCustomer(id);

  const customer: Customer | undefined = customerData?.data;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!customer) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description={t('customer.notFound')} />
      </div>
    );
  }

  const orders: SalesOrder[] = (customerData?.data?.orders as SalesOrder[]) ?? [];
  const receivables: Receivable[] = (customerData?.data?.receivables as Receivable[]) ?? [];
  const payments: Payment[] = receivables.flatMap((r) => r.payments ?? []);

  const orderColumns: ColumnsType<SalesOrder> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: t('order.orderCode'), dataIndex: 'order_code', key: 'order_code', width: 140 },
    { title: t('order.orderDate'), dataIndex: 'order_date', key: 'order_date', width: 120, render: formatDate },
    { title: t('order.grandTotal'), dataIndex: 'grand_total', key: 'grand_total', width: 150, align: 'right', render: (v: number) => formatVND(v) },
    {
      title: t('common.status'), dataIndex: 'status', key: 'status', width: 130,
      render: (s: string) => <StatusTag status={s} type="sales" />,
    },
  ];

  const paymentColumns: ColumnsType<Payment> = [
    { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: unknown, __: unknown, index: number) => index + 1 },
    { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'payment_date', width: 140, render: formatDate },
    { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right', render: (v: number) => formatVND(v) },
    { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 140 },
    { title: t('payment.reference'), dataIndex: 'reference', key: 'reference', ellipsis: true },
  ];

  const receivableColumns: ColumnsType<Receivable> = [
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
          <Descriptions.Item label={t('customer.companyName')}>{customer.company_name}</Descriptions.Item>
          <Descriptions.Item label={t('customer.taxCode')}>{customer.tax_code ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.address')} span={2}>{customer.address ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.contactName')}>{customer.contact_name ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.phone')}>{customer.phone ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email ?? '—'}</Descriptions.Item>
          <Descriptions.Item label={t('customer.customerType')}>
            <Tag color="blue" style={{ borderRadius: 8 }}>{customerTypeLabels[customer.customer_type]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('customer.debtLimit')}>{formatVND(customer.debt_limit)}</Descriptions.Item>
          <Descriptions.Item label={t('common.status')}>
            <Tag color={customer.is_active ? 'green' : 'default'} style={{ borderRadius: 8 }}>
              {customer.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('customer.zalo')}>
            <Text>{customer.zalo_user_id || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('customer.createdAt')}>{formatDateTime(customer.created_at)}</Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'orders',
      label: t('customer.orderHistory'),
      children: (
        <Table<SalesOrder>
          rowKey="id"
          columns={orderColumns}
          dataSource={orders}
          pagination={{ pageSize: 10, showTotal: (total) => t('customer.totalOrders', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
    {
      key: 'payments',
      label: t('customer.paymentHistory'),
      children: (
        <Table<Payment>
          rowKey="id"
          columns={paymentColumns}
          dataSource={payments}
          pagination={{ pageSize: 10, showTotal: (total) => t('customer.totalTransactions', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
    {
      key: 'receivables',
      label: t('customer.debts'),
      children: (
        <Table<Receivable>
          rowKey="id"
          columns={receivableColumns}
          dataSource={receivables}
          pagination={{ pageSize: 10, showTotal: (total) => t('customer.totalReceivables', { count: total }) }}
          style={{ borderRadius: 12 }}
        />
      ),
    },
  ];

  return (
    <>
      <Card style={{ borderRadius: 12 }}>
        <Space style={{ marginBottom: 16 }} align="center">
          <Title level={4} style={{ margin: 0 }}>{customer.company_name}</Title>
          <Tag color="blue" style={{ borderRadius: 8 }}>
            {customerTypeLabels[customer.customer_type]}
          </Tag>
          <Tag color={customer.is_active ? 'green' : 'default'} style={{ borderRadius: 8 }}>
            {customer.is_active ? t('common.activeStatus') : t('common.inactiveStatus')}
          </Tag>
        </Space>

        <Tabs items={tabItems} />
      </Card>

    </>
  );
};

export default CustomerDetailPage;
