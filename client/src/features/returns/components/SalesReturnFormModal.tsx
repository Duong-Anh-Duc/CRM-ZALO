import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Table, InputNumber, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '@/lib/api-client';
import { useCreateSalesReturn } from '../hooks';
import { formatVND } from '@/utils/format';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SalesReturnFormModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [, setSelectedSO] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const createMutation = useCreateSalesReturn();

  const { data: salesOrders } = useQuery({
    queryKey: ['sales-orders-for-return'],
    queryFn: () => apiClient.get('/sales-orders', { params: { limit: 200 } }).then((r) => r.data.data ?? []),
    enabled: open,
  });

  useEffect(() => {
    if (!open) { setSelectedSO(null); setReturnItems([]); form.resetFields(); }
  }, [open, form]);

  const handleSOChange = async (soId: string) => {
    try {
      const res = await apiClient.get(`/sales-orders/${soId}`);
      const so = res.data.data;
      setSelectedSO(so);
      form.setFieldsValue({ customer_id: so.customer_id });
      setReturnItems(
        (so.items || []).filter((i: any) => i.product_id).map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product?.name || '',
          sku: item.product?.sku || '',
          original_qty: item.quantity,
          unit_price: item.unit_price,
          return_qty: 0,
          reason: '',
        }))
      );
    } catch { /* ignore */ }
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setReturnItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const totalAmount = returnItems.reduce((sum, i) => sum + (i.return_qty || 0) * i.unit_price, 0);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const items = returnItems
      .filter((i) => i.return_qty > 0)
      .map((i) => ({ product_id: i.product_id, quantity: i.return_qty, unit_price: i.unit_price, reason: i.reason || undefined }));

    if (items.length === 0) return;

    await createMutation.mutateAsync({
      sales_order_id: values.sales_order_id,
      customer_id: values.customer_id,
      return_date: values.return_date?.format('YYYY-MM-DD'),
      reason: values.reason,
      notes: values.notes,
      items,
    });
    onSuccess();
  };

  const soOptions = (salesOrders ?? []).map((so: any) => ({
    value: so.id,
    label: `${so.order_code} - ${so.customer?.company_name || so.customer?.contact_name || ''}`,
  }));

  return (
    <Modal
      open={open}
      title={t('return.createSalesReturn')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width={750}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
    >
      <Form form={form} layout="vertical" initialValues={{ return_date: dayjs() }}>
        <Form.Item name="sales_order_id" label={t('return.selectSalesOrder')} rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={soOptions} onChange={handleSOChange} placeholder={t('return.selectSalesOrder')} />
        </Form.Item>
        <Form.Item name="customer_id" hidden><Input /></Form.Item>
        <Form.Item name="return_date" label={t('return.returnDate')}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="reason" label={t('return.reason')}>
          <TextArea rows={2} />
        </Form.Item>
        <Form.Item name="notes" label={t('return.notes')}>
          <TextArea rows={2} />
        </Form.Item>
      </Form>

      {returnItems.length > 0 && (
        <>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>{t('return.selectReturnItems')}</Text>
          <Table
            size="small"
            dataSource={returnItems}
            rowKey="product_id"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'STT', key: 'stt', width: 40, render: (_: any, __: any, i: number) => i + 1 },
              {
                title: t('product.name'), key: 'name',
                render: (_: any, rec: any) => <div><Text>{rec.product_name}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{rec.sku}</Text></div>,
              },
              { title: t('order.unitPrice'), dataIndex: 'unit_price', key: 'price', width: 110, align: 'right' as const, render: (v: number) => formatVND(v) },
              { title: 'SL gốc', dataIndex: 'original_qty', key: 'orig', width: 70, align: 'right' as const },
              {
                title: t('return.returnQuantity'), key: 'return_qty', width: 100,
                render: (_: any, rec: any, idx: number) => (
                  <InputNumber min={0} max={rec.original_qty} value={rec.return_qty} size="small" style={{ width: 80 }} onChange={(v) => updateItem(idx, 'return_qty', v || 0)} />
                ),
              },
              {
                title: t('return.itemReason'), key: 'reason', width: 150,
                render: (_: any, rec: any, idx: number) => (
                  <Input size="small" value={rec.reason} placeholder={t('return.itemReason')} onChange={(e) => updateItem(idx, 'reason', e.target.value)} />
                ),
              },
              {
                title: t('order.lineTotal'), key: 'total', width: 120, align: 'right' as const,
                render: (_: any, rec: any) => <Text strong>{formatVND((rec.return_qty || 0) * rec.unit_price)}</Text>,
              },
            ]}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6} align="right"><Text strong>{t('order.orderTotal')}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><Text strong style={{ color: '#cf1322' }}>{formatVND(totalAmount)}</Text></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </>
      )}
    </Modal>
  );
};

export default SalesReturnFormModal;
