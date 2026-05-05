import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Table, InputNumber, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiClient from '@/lib/api-client';
import { useCreatePurchaseReturn } from '../hooks';
import { formatVND } from '@/utils/format';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PurchaseReturnFormModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [, setSelectedPO] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const createMutation = useCreatePurchaseReturn();

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchase-orders-for-return'],
    queryFn: () => apiClient.get('/purchase-orders', { params: { limit: 200 } }).then((r) => r.data.data ?? []),
    enabled: open,
  });

  useEffect(() => {
    if (!open) { setSelectedPO(null); setReturnItems([]); form.resetFields(); }
  }, [open, form]);

  const handlePOChange = async (poId: string) => {
    try {
      const res = await apiClient.get(`/purchase-orders/${poId}`);
      const po = res.data.data;
      setSelectedPO(po);
      form.setFieldsValue({ supplier_id: po.supplier_id });
      setReturnItems(
        (po.items || []).map((item: any) => ({
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

    if (items.length === 0) {
      message.error(t('return.selectAtLeastOneItem') || 'Vui lòng nhập số lượng trả cho ít nhất 1 sản phẩm');
      return;
    }

    await createMutation.mutateAsync({
      purchase_order_id: values.purchase_order_id,
      supplier_id: values.supplier_id,
      return_date: values.return_date?.format('YYYY-MM-DD'),
      reason: values.reason,
      notes: values.notes,
      items,
    });
    onSuccess();
  };

  const poOptions = (purchaseOrders ?? []).map((po: any) => ({
    value: po.id,
    label: `${po.order_code} - ${po.supplier?.company_name || ''}`,
  }));

  return (
    <Modal
      open={open}
      title={t('return.createPurchaseReturn')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width={Math.min(window.innerWidth * 0.95, 750)}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
    >
      <Form form={form} layout="vertical" initialValues={{ return_date: dayjs() }}>
        <Form.Item name="purchase_order_id" label={t('return.selectPurchaseOrder')} rules={[{ required: true }]}>
          <Select showSearch optionFilterProp="label" options={poOptions} onChange={handlePOChange} placeholder={t('return.selectPurchaseOrder')} />
        </Form.Item>
        <Form.Item name="supplier_id" hidden><Input /></Form.Item>
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
              { title: t('return.originalQty'), dataIndex: 'original_qty', key: 'orig', width: 70, align: 'right' as const },
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

export default PurchaseReturnFormModal;
