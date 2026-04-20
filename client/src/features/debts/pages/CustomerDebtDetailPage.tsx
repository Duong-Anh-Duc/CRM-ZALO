import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Typography, Space, Row, Col, Statistic, Spin, Empty, Button, Tag, Input, Switch, Tooltip, Modal, Tabs, Descriptions, Image, DatePicker, Progress } from 'antd';
import { DollarOutlined, ArrowLeftOutlined, PhoneOutlined, MailOutlined, EnvironmentOutlined, SearchOutlined, UnorderedListOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { useCustomerDebtDetail } from '../hooks';
import { receivableApi } from '../api';
import { formatVND, formatDate } from '@/utils/format';
import { PaymentModal, ExportLedgerModal } from '@/components/common';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };
const fieldStyle: React.CSSProperties = { background: '#f5f5f5', borderRadius: 8, padding: '12px 16px' };
const labelStyle: React.CSSProperties = { fontSize: 11, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5, display: 'block', marginBottom: 4 };

const CustomerDebtDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [showPayment, setShowPayment] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalData, setModalData] = useState<{ type: 'items'; record: any } | null>(null);
  const [paymentDetail, setPaymentDetail] = useState<any>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'preview' | 'preview-excel' | null>(null);
  const [preview, setPreview] = useState<{ type: 'pdf'; url: string } | { type: 'excel'; html: string } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState('invoices');
  const [paymentDateRange, setPaymentDateRange] = useState<[any, any] | null>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [invoiceDateRange, setInvoiceDateRange] = useState<[any, any] | null>(null);

  const { data, isLoading } = useCustomerDebtDetail(customerId);
  const detail = data?.data as any;

  const filteredReceivables = useMemo(() => {
    if (!detail) return [];
    let list = [...(detail.receivables as any[])];
    list.sort((a: any, b: any) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        r.invoice_number?.toLowerCase().includes(q) ||
        r.sales_order?.order_code?.toLowerCase().includes(q)
      );
    }
    if (onlyUnpaid) {
      list = list.filter((r: any) => Number(r.remaining) > 0);
    }
    if (invoiceDateRange?.[0] && invoiceDateRange?.[1]) {
      const from = invoiceDateRange[0].startOf('day');
      const to = invoiceDateRange[1].endOf('day');
      list = list.filter((r: any) => {
        const d = dayjs(r.invoice_date);
        return (d.isAfter(from) && d.isBefore(to)) || d.isSame(from, 'day') || d.isSame(to, 'day');
      });
    }
    return list;
  }, [detail, search, onlyUnpaid, invoiceDateRange]);

  const chartData = useMemo(() => {
    if (!detail) return [];
    const receivables = detail.receivables as any[];
    const monthMap = new Map<string, { debt: number; paid: number }>();
    for (const r of receivables) {
      const m = dayjs(r.invoice_date).format('YYYY-MM');
      const entry = monthMap.get(m) || { debt: 0, paid: 0 };
      entry.debt += Number(r.original_amount);
      monthMap.set(m, entry);
      for (const p of (r.payments || [])) {
        const pm = dayjs(p.payment_date).format('YYYY-MM');
        const pe = monthMap.get(pm) || { debt: 0, paid: 0 };
        pe.paid += Number(p.amount);
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

  // Flatten all payments
  const allPayments = useMemo(() => {
    if (!detail) return [];
    return (detail.receivables as any[]).flatMap((r: any) =>
      (r.payments || []).map((p: any) => ({ ...p, invoice_number: r.invoice_number }))
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

  const handleExport = async (action: 'excel' | 'pdf' | 'preview' | 'preview-excel', range: { from_date?: string; to_date?: string }) => {
    if (!customerId) return;
    setExporting(action);
    try {
      if (action === 'preview') {
        const res = await receivableApi.exportPdf(customerId, range);
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreview({ type: 'pdf', url });
        setShowExportModal(false);
      } else if (action === 'preview-excel') {
        const res = await receivableApi.exportExcel(customerId, range);
        const blob: Blob = res.data;
        const arrayBuf = await blob.arrayBuffer();
        const XLSX = await import('xlsx');
        const wb = XLSX.read(arrayBuf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const html = sheet ? XLSX.utils.sheet_to_html(sheet) : `<p>${t('debt.exportEmptySheet')}</p>`;
        setPreview({ type: 'excel', html });
        setShowExportModal(false);
      } else {
        const res = action === 'pdf'
          ? await receivableApi.exportPdf(customerId, range)
          : await receivableApi.exportExcel(customerId, range);
        const mime = action === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([res.data], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `cong-no-${detail?.customer?.company_name || customerId}.${action === 'pdf' ? 'pdf' : 'xlsx'}`;
        a.click(); URL.revokeObjectURL(url);
        setShowExportModal(false);
      }
    } catch { toast.error(t('common.error')); } finally { setExporting(null); }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!detail) return <Empty description={t('customer.notFound')} style={{ marginTop: 80 }} />;

  const { customer, summary } = detail;

  const paidPercent = summary.total_original > 0 ? Math.min(100, Math.round((summary.total_paid / summary.total_original) * 100)) : 0;

  const invoiceColumns: any[] = [
    { title: 'STT', key: 'stt', width: 50, align: 'center' as const, render: (_: any, __: any, idx: number) => (page - 1) * pageSize + idx + 1 },
    { title: t('debt.invoiceNumber'), dataIndex: 'invoice_number', key: 'invoice_number', width: 130 },
    { title: t('order.orderCode'), key: 'order_code', width: 160, responsive: ['md'] as any, render: (_: any, rec: any) => rec.sales_order ? <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(`/sales-orders/${rec.sales_order.id}`)}>{rec.sales_order.order_code}</Button> : '-' },
    { title: t('debt.invoiceDate'), dataIndex: 'invoice_date', key: 'invoice_date', width: 110, render: (v: string) => formatDate(v) },
    { title: t('debt.originalAmount'), dataIndex: 'original_amount', key: 'original_amount', width: 140, align: 'right' as const, render: (v: number) => formatVND(v) },
    { title: t('debt.remaining'), dataIndex: 'remaining', key: 'remaining', width: 140, align: 'right' as const, render: (v: number) => <Text strong style={{ color: v > 0 ? '#cf1322' : '#52c41a' }}>{formatVND(v)}</Text> },
    { title: '', key: 'actions', width: 50, align: 'center' as const, fixed: 'right' as const, render: (_: any, rec: any) => rec.sales_order?.items?.length > 0 ? <Tooltip title={t('order.productDetails')}><Button type="text" size="small" icon={<UnorderedListOutlined />} style={{ color: '#1677ff' }} onClick={() => setModalData({ type: 'items', record: rec })} /></Tooltip> : null },
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
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/debts')}>{t('debt.receivables')}</Button>
        <Space size={8}>
          <Button icon={<DownloadOutlined />} type="primary" ghost style={{ borderRadius: 8 }} onClick={() => setShowExportModal(true)}>{t('debt.exportReport')}</Button>
        </Space>
      </Space>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.totalDebt')} value={summary.total_original} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#1890ff', fontSize: 18 }} /></Card></Col>
        <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.totalPaid')} value={summary.total_paid} formatter={(v) => formatVND(v as number)} valueStyle={{ color: '#52c41a', fontSize: 18 }} /></Card></Col>
        <Col xs={24} sm={8}><Card size="small" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><Statistic title={t('debt.remaining')} value={summary.total_remaining} formatter={(v) => formatVND(v as number)} valueStyle={{ color: summary.total_remaining > 0 ? '#cf1322' : '#52c41a', fontSize: 18 }} /></Card></Col>
      </Row>

      <Card style={cardStyle}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Text strong style={{ fontSize: 18 }}>{customer.company_name || customer.contact_name}</Text>
          {summary.total_remaining > 0 && <Button type="primary" icon={<DollarOutlined />} style={{ borderRadius: 8 }} onClick={() => setShowPayment(true)}>{t('common.recordPayment')}</Button>}
        </Space>
        {summary.total_original > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ fontSize: 12, color: '#666' }}>{t('debt.paymentProgress')}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>{formatVND(summary.total_paid)} / {formatVND(summary.total_original)}</Text>
            </Space>
            <Progress percent={paidPercent} strokeColor={paidPercent === 100 ? '#52c41a' : '#1890ff'} size="small" />
          </div>
        )}
        <Row gutter={[12, 12]}>
          {customer.contact_name && customer.company_name && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}>{t('customer.contactName')}</Text><Text strong>{customer.contact_name}</Text></div></Col>}
          {customer.phone && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><PhoneOutlined style={{ marginRight: 4 }} />{t('customer.phone')}</Text><Text strong>{customer.phone}</Text></div></Col>}
          {customer.email && <Col xs={24} sm={8}><div style={fieldStyle}><Text style={labelStyle}><MailOutlined style={{ marginRight: 4 }} />Email</Text><Text strong>{customer.email}</Text></div></Col>}
          {customer.address && <Col xs={24}><div style={fieldStyle}><Text style={labelStyle}><EnvironmentOutlined style={{ marginRight: 4 }} />{t('customer.address')}</Text><Text strong>{customer.address}</Text></div></Col>}
        </Row>
      </Card>

      {chartData.length > 1 && (
        <Card title={t('debt.debtTracking')} style={cardStyle}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fa541c" stopOpacity={0.2} /><stop offset="95%" stopColor="#fa541c" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v} />
              <RTooltip formatter={(value) => formatVND(Number(value))} />
              <Area type="monotone" dataKey="remaining" name={t('debt.remaining')} stroke="#fa541c" fill="url(#colorRemaining)" strokeWidth={2} dot={{ r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card style={cardStyle}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'invoices', label: `${t('debt.invoiceList')} (${filteredReceivables.length})`, children: (
            <>
              <Space wrap style={{ marginBottom: 12, width: '100%' }}>
                <Input placeholder={t('debt.searchInvoice')} prefix={<SearchOutlined />} allowClear style={{ width: 220, borderRadius: 8 }} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                <DatePicker.RangePicker value={invoiceDateRange as any} format="DD/MM/YYYY" style={{ borderRadius: 8 }}
                  onChange={(d) => { setInvoiceDateRange(d as any); setPage(1); }} placeholder={[t('common.fromDate'), t('common.toDate')]} />
                <Space size={6}>
                  <Switch checked={onlyUnpaid} onChange={(v) => { setOnlyUnpaid(v); setPage(1); }} size="small" />
                  <Text style={{ fontSize: 13 }}>{t('debt.onlyUnpaid')}</Text>
                </Space>
              </Space>
              <Table dataSource={filteredReceivables} columns={invoiceColumns} rowKey="id" size="small" scroll={{ x: 'max-content' }}
                pagination={{ current: page, pageSize, total: filteredReceivables.length, showSizeChanger: true, pageSizeOptions: ['5', '10', '20'], showTotal: (total) => t('debt.totalInvoices', { count: total }), onChange: (p, ps) => { setPage(p); setPageSize(ps); } }}
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
          const rec = modalData.record; const items = rec.sales_order?.items || [];
          return (<>
            {rec.sales_order?.expected_delivery && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{t('order.expectedDelivery')}: {formatDate(rec.sales_order.expected_delivery)}</Text>}
            {rec.sales_order?.notes && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>{t('common.notes')}: {rec.sales_order.notes}</Text>}
            <Table size="small" dataSource={items} rowKey={(_, idx) => String(idx)} pagination={false} scroll={{ x: 'max-content' }} columns={[
              { title: 'STT', key: 'stt', width: 45, align: 'center' as const, render: (_: any, __: any, i: number) => i + 1 },
              { title: t('product.name'), key: 'name', ellipsis: true, render: (_: any, item: any) => (<div><Text style={{ fontSize: 13 }}>{item.product?.name}</Text><br /><Space size={4} wrap><Text type="secondary" style={{ fontSize: 11 }}>{item.product?.sku}</Text>{item.product?.material && <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', borderRadius: 4, margin: 0 }}>{item.product.material}</Tag>}{item.product?.capacity_ml != null && <Text type="secondary" style={{ fontSize: 10 }}>{item.product.capacity_ml}ml</Text>}</Space></div>) },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'unit_price', width: 120, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 60, align: 'right' as const },
              { title: t('order.lineTotal'), dataIndex: 'line_total', key: 'line_total', width: 130, align: 'right' as const, render: (v: number) => <Text strong>{formatVND(v)}</Text> },
            ]} summary={() => rec.sales_order?.grand_total != null ? (<Table.Summary.Row><Table.Summary.Cell index={0} colSpan={4} align="right"><Text strong>{t('order.orderTotal')}</Text></Table.Summary.Cell><Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#1890ff' }}>{formatVND(rec.sales_order.grand_total)}</Text></Table.Summary.Cell></Table.Summary.Row>) : undefined} />
          </>);
        })()}
      </Modal>

      {/* Modal chi tiết thanh toán */}
      <Modal open={!!paymentDetail} title={t('debt.paymentDetail')} footer={null} width={500} onCancel={() => setPaymentDetail(null)}>
        {paymentDetail && (
          <>
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
          </>
        )}
      </Modal>

      {showPayment && (
        <PaymentModal open type="receivable" debtId={customerId!} maxAmount={summary.total_remaining} onClose={() => setShowPayment(false)} />
      )}

      <ExportLedgerModal
        open={showExportModal}
        loading={exporting}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleExport}
      />

      <Modal
        open={!!preview}
        title={preview?.type === 'excel' ? t('debt.exportPreviewExcel') : t('debt.exportPreviewPdf')}
        width="90vw"
        footer={null}
        onCancel={() => {
          if (preview?.type === 'pdf') URL.revokeObjectURL(preview.url);
          setPreview(null);
        }}
        styles={{ body: { height: '80vh', padding: 0, overflow: 'hidden' } }}
      >
        {preview?.type === 'pdf' && (
          <iframe title="pdf-preview" src={preview.url} style={{ width: '100%', height: '100%', border: 0 }} />
        )}
        {preview?.type === 'excel' && (
          <div
            style={{ padding: 16, height: '100%', overflow: 'auto', background: '#f5f5f5', fontFamily: "'Times New Roman', serif" }}
            dangerouslySetInnerHTML={{
              __html: `<style>table{border-collapse:collapse;background:#fff;width:100%}td,th{border:1px solid #bfbfbf;padding:6px 10px;font-size:12px;vertical-align:top}tr:first-child td{font-weight:bold;background:#fafafa}</style>${preview.html}`,
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default CustomerDebtDetailPage;
