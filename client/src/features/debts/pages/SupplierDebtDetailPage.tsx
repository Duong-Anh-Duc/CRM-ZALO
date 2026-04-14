import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Typography, Space, Row, Col, Statistic, Spin, Empty, Button, Tooltip } from 'antd';
import { DollarOutlined, ArrowLeftOutlined, EyeOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useSupplierDebtDetail } from '../hooks';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag, PaymentModal } from '@/components/common';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const SupplierDebtDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);

  const { data, isLoading } = useSupplierDebtDetail(supplierId);
  const detail = data?.data as any;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!detail) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const { supplier, payables, summary } = detail;

  const invoiceColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'inv', width: 140, ellipsis: true },
    {
      title: t('order.orderCode'), key: 'order', width: 160,
      render: (_: any, r: any) => r.purchase_order ? (
        <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${r.purchase_order.id}`)}>
          {r.purchase_order.order_code}
        </Button>
      ) : '-',
    },
    { title: t('debt.invoiceDate'), dataIndex: 'invoice_date', key: 'inv_date', width: 110, render: formatDate },
    { title: t('debt.dueDate'), dataIndex: 'due_date', key: 'due', width: 110, render: formatDate },
    { title: t('debt.originalAmount'), dataIndex: 'original_amount', key: 'orig', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('debt.paidShort'), dataIndex: 'paid_amount', key: 'paid', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    {
      title: t('debt.remaining'), dataIndex: 'remaining', key: 'rem', width: 140, align: 'right' as const,
      render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(v)}</Text>,
    },
    { title: t('common.status'), dataIndex: 'status', key: 'status', width: 130, render: (s: string) => <StatusTag status={s} type="debt" /> },
  ];

  const allPayments = payables
    .flatMap((p: any) => (p.payments || []).map((pay: any) => ({ ...pay, invoice_number: p.invoice_number })))
    .sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  const paymentColumns: ColumnsType<any> = [
    { title: 'STT', key: 'stt', width: 50, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'date', width: 120, render: formatDate },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'inv', width: 140 },
    { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 130 },
    { title: t('payment.reference'), dataIndex: 'reference', key: 'ref', ellipsis: true },
  ];

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} type="text" style={{ marginBottom: 12 }} onClick={() => navigate('/debts')}>
        {t('debt.payables')}
      </Button>

      {/* Summary */}
      <Card style={cardStyle}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #e6f4ff' }}>
              <Statistic title={t('debt.totalDebt')} value={summary.total_original} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#1890ff', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: '1px solid #f6ffed' }}>
              <Statistic title={t('debt.totalPaid')} value={summary.total_paid} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" style={{ borderRadius: 10, border: summary.total_remaining > 0 ? '1px solid #fff2f0' : '1px solid #f6ffed' }}>
              <Statistic title={t('debt.remaining')} value={summary.total_remaining} formatter={(v) => formatVND(v as number)} valueStyle={{ color: summary.total_remaining > 0 ? '#cf1322' : '#52c41a', fontSize: 18 }} />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Supplier info */}
      <Card style={cardStyle}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 18 }}>{supplier.company_name}</Text>
          {summary.total_remaining > 0 && (
            <Button type="primary" icon={<DollarOutlined />} style={{ borderRadius: 8 }} onClick={() => setShowPayment(true)}>
              {t('common.recordPayment')}
            </Button>
          )}
        </Space>
        <Row gutter={[12, 12]}>
          {supplier.contact_name && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}>{t('customer.contactName')}</Text><Text strong>{supplier.contact_name}</Text></div></Col>}
          {supplier.phone && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{supplier.phone}</Text></div></Col>}
          {supplier.email && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />Email</Text><Text strong>{supplier.email}</Text></div></Col>}
        </Row>
      </Card>

      {/* Invoice list */}
      <Card title={t('debt.invoiceList') + ` (${payables.length})`} style={cardStyle}>
        <Table columns={invoiceColumns} dataSource={payables} rowKey="id" pagination={false} size="small" scroll={{ x: 900 }} />
      </Card>

      {/* Payment history */}
      {allPayments.length > 0 && (
        <Card title={t('debt.paymentHistory') + ` (${allPayments.length})`} style={cardStyle}>
          <Table columns={paymentColumns} dataSource={allPayments} rowKey="id" pagination={{ pageSize: 10 }} size="small" scroll={{ x: 600 }} />
        </Card>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          open
          type="payable"
          debtId={supplierId!}
          maxAmount={summary.total_remaining}
          onClose={() => setShowPayment(false)}
        />
      )}
    </div>
  );
};

export default SupplierDebtDetailPage;
