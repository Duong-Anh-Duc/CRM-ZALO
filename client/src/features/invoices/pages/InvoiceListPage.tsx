import React, { useState, useEffect, useRef } from 'react';
import { Card, Table, Tag, Button, Select, Space, Modal, Input, DatePicker, Tooltip } from 'antd';
import { EditOutlined, CheckCircleOutlined, CloseCircleOutlined, FilePdfOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useInvoices, useFinalizeInvoice, useCancelInvoice, useUpdateInvoice } from '../hooks';
import { invoiceApi } from '../api';
import { PageHeader } from '@/components/common';
import { formatVND, formatDateTime } from '@/utils/format';
import InvoiceEditModal from '../components/InvoiceEditModal';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';

const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

const InvoiceListPage: React.FC = () => {
  const { t } = useTranslation();

  const statusConfig: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'orange', label: t('invoice.statusDraft') },
    FINAL: { color: 'green', label: t('invoice.statusFinal') },
    CANCELLED: { color: 'red', label: t('invoice.statusCancelled') },
  };

  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce search 500ms
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data, isLoading } = useInvoices({
    status: status || undefined,
    search: debouncedSearch || undefined,
    from_date: dateRange?.[0]?.format('YYYY-MM-DD'),
    to_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    page,
    limit: pageSize,
  });
  const finalizeMutation = useFinalizeInvoice();
  const cancelMutation = useCancelInvoice();
  const updateMutation = useUpdateInvoice();

  const invoices = data?.data?.invoices ?? [];
  const total = data?.data?.total ?? 0;

  const columns: ColumnsType<any> = [
    {
      title: 'STT', key: 'stt', width: 60, align: 'center',
      render: (_: unknown, __: unknown, i: number) => (page - 1) * pageSize + i + 1,
    },
    {
      title: t('invoice.number'), dataIndex: 'invoice_number', key: 'number', width: 160,
      render: (num: number, r: any) => `${r.serial}-${String(num).padStart(7, '0')}`,
    },
    {
      title: t('invoice.orderCode'), key: 'order',
      render: (_: unknown, r: any) => r.sales_order?.order_code || '-',
      responsive: ['md'] as any,
    },
    {
      title: t('invoice.buyer'), key: 'buyer',
      render: (_: unknown, r: any) => r.buyer_company || r.buyer_name,
    },
    {
      title: t('invoice.total'), dataIndex: 'total', key: 'total',
      render: (v: number) => formatVND(v),
    },
    {
      title: t('invoice.date'), dataIndex: 'invoice_date', key: 'date',
      render: (v: string) => formatDateTime(v),
      responsive: ['lg'] as any,
    },
    {
      title: t('invoice.status'), dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => {
        const cfg = statusConfig[s] || { color: 'default', label: s };
        return <Tag color={cfg.color} style={{ borderRadius: 6 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: t('common.actions'), key: 'actions', width: 160, align: 'center' as const,
      render: (_: unknown, r: any) => (
        <Space size={8}>
          <Tooltip title="Xem PDF">
            <Button type="text" size="small" icon={<FilePdfOutlined />} onClick={() => setPreviewId(r.id)} />
          </Tooltip>
          {r.status === 'DRAFT' && (
            <>
              <Tooltip title={t('common.edit')}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditId(r.id)} />
              </Tooltip>
              <Tooltip title={t('invoice.finalize')}>
                <Button type="text" size="small" icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  onClick={() => finalizeMutation.mutate(r.id)} loading={finalizeMutation.isPending} />
              </Tooltip>
            </>
          )}
          {r.status !== 'CANCELLED' && (
            <Tooltip title={t('common.cancel')}>
              <Button type="text" size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => cancelMutation.mutate(r.id)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={cardStyle}>
        <PageHeader title={t('invoice.title')} />

        {/* Filters */}
        <Space wrap style={{ marginBottom: 16, width: '100%' }}>
          <Input
            placeholder={t('invoice.searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: '100%', maxWidth: 300, borderRadius: 8 }}
          />
          <Select
            placeholder={t('invoice.status')}
            value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            allowClear
            style={{ minWidth: 140, borderRadius: 8 }}
            options={[
              { label: t('common.all'), value: '' },
              { label: t('invoice.statusDraft'), value: 'DRAFT' },
              { label: t('invoice.statusFinal'), value: 'FINAL' },
              { label: t('invoice.statusCancelled'), value: 'CANCELLED' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(v) => { setDateRange(v); setPage(1); }}
            format="DD/MM/YYYY"
            style={{ borderRadius: 8 }}
            placeholder={[t('common.fromDate') || 'Từ ngày', t('common.toDate') || 'Đến ngày']}
          />
        </Space>

        <Table
          dataSource={invoices}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            total,
            pageSize,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `${t} hoá đơn`,
          }}
        />
      </Card>

      {/* Edit modal */}
      {editId && (
        <InvoiceEditModal
          invoiceId={editId}
          open={!!editId}
          onClose={() => setEditId(null)}
          onSave={(d) => updateMutation.mutate({ id: editId, data: d }, { onSuccess: () => setEditId(null) })}
          saving={updateMutation.isPending}
        />
      )}

      {/* PDF preview modal */}
      <Modal
        open={!!previewId}
        onCancel={() => setPreviewId(null)}
        footer={null}
        width={window.innerWidth < 640 ? '95vw' : 900}
        title={t('invoice.preview')}
        styles={{ body: { padding: 0, height: '80vh' } }}
      >
        {previewId && (
          <iframe
            src={`${invoiceApi.getPdfUrl(previewId)}?token=${localStorage.getItem('token')}`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Invoice Preview"
          />
        )}
      </Modal>
    </div>
  );
};

export default InvoiceListPage;
