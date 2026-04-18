import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Typography, Space, Row, Col, Statistic, Spin, Empty, Button, Tag, Input, Select, Tooltip, Modal, Tabs, Descriptions, Image, DatePicker } from 'antd';
import { DollarOutlined, ArrowLeftOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined, UserOutlined, WarningOutlined, SearchOutlined, UnorderedListOutlined, DownloadOutlined, FilePdfOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useSupplierDebtDetail } from '../hooks';
import { payableApi } from '../api';
import { formatVND, formatDate } from '@/utils/format';
import { StatusTag, PaymentModal } from '@/components/common';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const SupplierDebtDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState<{ type: 'items'; record: any } | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<any>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [activeTab, setActiveTab] = useState('invoices');
  const [paymentDateRange, setPaymentDateRange] = useState<[any, any] | null>([dayjs().startOf('month'), dayjs().endOf('month')]);

  const { data, isLoading } = useSupplierDebtDetail(supplierId);
  const detail = data?.data as any;

  const filteredPayables = useMemo(() => {
    if (!detail) return [];
    let list = detail.payables as any[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p: any) =>
        p.invoice_number?.toLowerCase().includes(q) ||
        p.purchase_order?.order_code?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      list = list.filter((p: any) => p.status === statusFilter);
    }
    return list;
  }, [detail, search, statusFilter]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    const payables = detail.payables as any[];
    const monthMap = new Map<string, { debt: number; paid: number }>();
    for (const p of payables) {
      const m = dayjs(p.invoice_date).format('YYYY-MM');
      const entry = monthMap.get(m) || { debt: 0, paid: 0 };
      entry.debt += Number(p.original_amount);
      monthMap.set(m, entry);
      for (const pay of (p.payments || [])) {
        const pm = dayjs(pay.payment_date).format('YYYY-MM');
        const pe = monthMap.get(pm) || { debt: 0, paid: 0 };
        pe.paid += Number(pay.amount);
        monthMap.set(pm, pe);
      }
    }
    const sortedKeys = Array.from(monthMap.keys()).sort();
    let cumDebt = 0, cumPaid = 0;
    return sortedKeys.map((key) => {
      const v = monthMap.get(key)!;
      cumDebt += v.debt; cumPaid += v.paid;
      return { date: dayjs(key).format('MM/YYYY'), remaining: Math.max(0, cumDebt - cumPaid) };
    });
  }, [detail]);

  const allPayments = useMemo(() => {
    if (!detail) return [];
    return (detail.payables as any[]).flatMap((p: any) =>
      (p.payments || []).map((pay: any) => ({ ...pay, invoice_number: p.invoice_number }))
    ).sort((a: any, b: any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [detail]);

  const filteredPayments = useMemo(() => {
    if (!paymentDateRange?.[0] || !paymentDateRange?.[1]) return allPayments;
    const from = paymentDateRange[0].startOf('day');
    const to = paymentDateRange[1].endOf('day');
    return allPayments.filter((p: any) => {
      const d = dayjs(p.payment_date);
      return d.isAfter(from) && d.isBefore(to) || d.isSame(from) || d.isSame(to);
    });
  }, [allPayments, paymentDateRange]);

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!supplierId) return;
    setExporting(type);
    try {
      const res = type === 'pdf' ? await payableApi.exportPdf(supplierId) : await payableApi.exportExcel(supplierId);
      const blob = new Blob([res.data], { type: type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `cong-no-${detail?.supplier?.company_name || supplierId}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click(); URL.revokeObjectURL(url);
    } catch { toast.error(t('common.error')); } finally { setExporting(null); }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!detail) return <Empty description={t('supplier.notFound')} style={{ marginTop: 80 }} />;

  const { supplier, payables, summary } = detail;
  const overdueCount = payables.filter((p: any) => p.status === 'OVERDUE').length;

  const invoiceColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, idx: number) => (page - 1) * pageSize + idx + 1 },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'invoice_number', width: 130 },
    { title: t('product.status'), key: 'status', width: 140, render: (_: any, rec: any) => <StatusTag status={rec.status} type="debt" /> },
    { title: t('order.orderCode'), key: 'order_code', width: 160, responsive: ['md'] as any, render: (_: any, rec: any) => rec.purchase_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/purchase-orders/${rec.purchase_order.id}`)}>{rec.purchase_order.order_code}</Button> : '-' },
    { title: t('debt.invoiceDate'), dataIndex: 'invoice_date', key: 'invoice_date', width: 110, responsive: ['lg'] as any, render: (v: string) => formatDate(v) },
    { title: t('debt.dueDate'), dataIndex: 'due_date', key: 'due_date', width: 120, render: (v: string, rec: any) => { const overdue = new Date(v) < new Date() && rec.remaining > 0; return <Text style={overdue ? { color: '#cf1322', fontWeight: 600 } : {}}>{formatDate(v)}</Text>; } },
    { title: t('debt.originalAmount'), dataIndex: 'original_amount', key: 'original_amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('debt.paidShort'), dataIndex: 'paid_amount', key: 'paid_amount', width: 130, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('debt.remaining'), dataIndex: 'remaining', key: 'remaining', width: 140, align: 'right' as const, render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(v)}</Text> },
    { title: '', key: 'actions', width: 50, align: 'center' as const, fixed: 'right' as const, render: (_: any, rec: any) => rec.purchase_order?.items?.length > 0 ? <Tooltip title={t('order.productDetails')}><Button type="text" size="small" icon={<UnorderedListOutlined />} style={{ color: '#1677ff' }} onClick={() => setModalData({ type: 'items', record: rec })} /></Tooltip> : null },
  ];

  const paymentColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
    { title: t('payment.paymentDate'), dataIndex: 'payment_date', key: 'date', width: 120, render: formatDate },
    { title: t('common.amount'), dataIndex: 'amount', key: 'amount', width: 150, align: 'right' as const, render: (v: number) => <Text strong style={{ color: '#52c41a' }}>{formatVND(v)}</Text> },
    { title: t('payment.method'), dataIndex: 'method', key: 'method', width: 140, render: (v: string) => <Tag style={{ borderRadius: 4 }}>{v === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : v === 'CASH' ? t('payment.methodCash') : v}</Tag> },
    { title: t('payment.reference'), dataIndex: 'reference', key: 'ref', ellipsis: true, render: (v: string) => v || '-' },
    { title: t('cashBook.evidence'), key: 'evidence', width: 90, align: 'center' as const, render: (_: any, rec: any) => rec.evidence_url ? <Tag color="green" style={{ borderRadius: 4 }}>{t('common.yes')}</Tag> : <Tag style={{ borderRadius: 4 }}>{t('common.no')}</Tag> },
    { title: '', key: 'actions', width: 50, align: 'center' as const, render: (_: any, rec: any) => <Tooltip title={t('common.viewDetail')}><Button type="text" size="small" icon={<EyeOutlined />} style={{ color: '#1677ff' }} onClick={() => setPaymentDetail(rec)} /></Tooltip> },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/debts')}>{t('debt.payables')}</Button>
        <Space size={8}>
          <Tooltip title={t('debt.exportExcel')}><Button icon={<DownloadOutlined />} style={{ borderRadius: 8 }} loading={exporting === 'excel'} onClick={() => handleExport('excel')} /></Tooltip>
          <Tooltip title={t('debt.exportPdf')}><Button icon={<FilePdfOutlined />} style={{ borderRadius: 8 }} loading={exporting === 'pdf'} onClick={() => handleExport('pdf')} /></Tooltip>
        </Space>
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.totalDebt')} value={summary.total_original} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#1890ff', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.totalPaid')} value={summary.total_paid} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#52c41a', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.remaining')} value={summary.total_remaining} formatter={(v) => formatVND(v as number)} valueStyle={{ color: summary.total_remaining > 0 ? '#cf1322' : '#52c41a', fontSize: 16 }} /></Card></Col>
        <Col xs={24} sm={6}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.overdueCount')} value={overdueCount} prefix={overdueCount > 0 ? <WarningOutlined /> : undefined} valueStyle={{ color: overdueCount > 0 ? '#cf1322' : '#999', fontSize: 16 }} suffix={t('debt.invoices')} /></Card></Col>
      </Row>

      <Card style={cardStyle}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Text strong style={{ fontSize: 18 }}>{supplier.company_name}</Text>
          {summary.total_remaining > 0 && <Button type="primary" icon={<DollarOutlined />} style={{ borderRadius: 8 }} onClick={() => setShowPayment(true)}>{t('common.recordPayment')}</Button>}
        </Space>
        <Row gutter={[12, 12]}>
          {supplier.contact_name && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><UserOutlined style={{ marginRight: 4 }} />{t('customer.contactName')}</Text><Text strong>{supplier.contact_name}</Text></div></Col>}
          {supplier.phone && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{supplier.phone}</Text></div></Col>}
          {supplier.email && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />Email</Text><Text strong>{supplier.email}</Text></div></Col>}
          {supplier.address && <Col xs={24}><div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{supplier.address}</Text></div></Col>}
        </Row>
      </Card>

      {chartData.length > 1 && (
        <Card title={t('debt.debtTracking')} style={cardStyle}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRemainingP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fa541c" stopOpacity={0.2} /><stop offset="95%" stopColor="#fa541c" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
              <RTooltip formatter={(value) => formatVND(Number(value))} />
              <Area type="monotone" dataKey="remaining" name={t('debt.remaining')} stroke="#fa541c" fill="url(#colorRemainingP)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card style={cardStyle}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'invoices', label: `${t('debt.invoiceList')} (${filteredPayables.length})`, children: (
            <>
              <Space wrap style={{ marginBottom: 12, width: '100%' }}>
                <Input placeholder={t('debt.searchInvoice')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                <Select placeholder={t('debt.filterStatus')} allowClear style={{ width: 180, borderRadius: 8 }} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }}
                  options={[{ value: 'UNPAID', label: t('debt.statusUnpaid') }, { value: 'PARTIAL', label: t('debt.statusPartial') }, { value: 'OVERDUE', label: t('debt.statusOverdue') }, { value: 'PAID', label: t('debt.statusPaid') }]} />
              </Space>
              <Table dataSource={filteredPayables} columns={invoiceColumns} rowKey="id" size="small" scroll={{ x: 'max-content' }}
                pagination={{ current: page, pageSize, total: filteredPayables.length, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], showTotal: (total) => t('debt.totalInvoices', { count: total }), onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
                locale={{ emptyText: <Empty description={t('common.noData')} /> }} />
            </>
          )},
          { key: 'payments', label: `${t('debt.paymentHistory')} (${filteredPayments.length})`, children: (
            <>
              <Space wrap style={{ marginBottom: 12, width: '100%' }}>
                <DatePicker.RangePicker value={paymentDateRange as any} format="DD/MM/YYYY" style={{ borderRadius: 8 }}
                  onChange={(d) => setPaymentDateRange(d as any)} placeholder={[t('common.fromDate'), t('common.toDate')]} />
                <Button size="small" onClick={() => setPaymentDateRange([dayjs().startOf('month'), dayjs().endOf('month')])}>{t('common.thisMonth')}</Button>
                <Button size="small" onClick={() => setPaymentDateRange(null)}>{t('common.all')}</Button>
              </Space>
              <Table dataSource={filteredPayments} columns={paymentColumns} rowKey="id" size="small" scroll={{ x: 'max-content' }}
                pagination={filteredPayments.length > 10 ? { pageSize: 10, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'] } : false}
                locale={{ emptyText: <Empty description={t('common.noData')} /> }} />
            </>
          )},
        ]} />
      </Card>

      {/* Modal chi tiết sản phẩm */}
      <Modal open={modalData?.type === 'items'} title={`${t('order.productDetails')} - ${modalData?.record?.invoice_number || ''}`} footer={null} width={700} onCancel={() => setModalData(null)}>
        {modalData?.type === 'items' && (() => {
          const rec = modalData.record; const items = rec.purchase_order?.items || [];
          return (<>
            {rec.purchase_order?.expected_delivery && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('order.expectedDelivery')}: {formatDate(rec.purchase_order.expected_delivery)}</Text>}
            {rec.purchase_order?.notes && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('common.notes')}: {rec.purchase_order.notes}</Text>}
            <Table size="small" dataSource={items} rowKey={(_, idx) => String(idx)} pagination={false} scroll={{ x: 'max-content' }} columns={[
              { title: 'STT', key: 'stt', width: 45, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, item: any) => (<div><Text style={{ fontSize: 13 }}>{item.product?.name}</Text><br /><Space size={4} wrap><Text type="secondary" style={{ fontSize: 11 }}>{item.product?.sku}</Text>{item.product?.material && <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', borderRadius: 4, margin: 0 }}>{item.product.material}</Tag>}{item.product?.capacity_ml != null && <Text type="secondary" style={{ fontSize: 10 }}>{item.product.capacity_ml}ml</Text>}</Space></div>) },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'unit_price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 60, align: 'right' as const },
              { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'line_total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
            ]} summary={() => rec.purchase_order?.total != null ? (<Table.Summary.Row><Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>{t('order.orderTotal')}</Text></Table.Summary.Cell><Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#1890ff' }}>{formatVND(rec.purchase_order.total)}</Text></Table.Summary.Cell></Table.Summary.Row>) : undefined} />
          </>);
        })()}
      </Modal>

      {/* Modal chi tiết thanh toán */}
      <Modal open={!!paymentDetail} title={t('debt.paymentDetail')} footer={null} width={500} onCancel={() => setPaymentDetail(null)}>
        {paymentDetail && (
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t('payment.paymentDate')}>{formatDate(paymentDetail.payment_date)}</Descriptions.Item>
            <Descriptions.Item label={t('common.amount')}>
              <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{formatVND(paymentDetail.amount)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('payment.method')}>
              {paymentDetail.method === 'BANK_TRANSFER' ? t('payment.methodBankTransfer') : paymentDetail.method === 'CASH' ? t('payment.methodCash') : paymentDetail.method}
            </Descriptions.Item>
            {paymentDetail.reference && <Descriptions.Item label={t('payment.reference')}>{paymentDetail.reference}</Descriptions.Item>}
            <Descriptions.Item label={t('cashBook.evidence')}>
              {paymentDetail.evidence_url ? (
                <Image src={paymentDetail.evidence_url} style={{ maxHeight: 200, borderRadius: 8 }} preview={{ mask: t('common.viewDetail') }} />
              ) : (
                <Text type="secondary">—</Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {showPayment && (
        <PaymentModal open type="payable" debtId={supplierId!} maxAmount={summary.total_remaining} onClose={() => setShowPayment(false)} />
      )}
    </div>
  );
};

export default SupplierDebtDetailPage;
