import React, { useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Switch, Space, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSuppliers } from '@/features/suppliers/hooks';
import apiClient from '@/lib/api-client';
import { toast } from 'react-toastify';

interface Props {
  open: boolean;
  productId: string;
  record?: any | null;
  onClose: () => void;
  onSaved: () => void;
}

const SupplierPriceFormModal: React.FC<Props> = ({ open, productId, record, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);
  const { data: suppliersData } = useSuppliers({ limit: 200 });
  const suppliers = suppliersData?.data ?? [];
  const isEdit = !!record?.id;

  useEffect(() => {
    if (open) {
      if (record) {
        form.setFieldsValue({
          supplier_id: record.supplier_id,
          purchase_price: record.purchase_price,
          moq: record.moq,
          lead_time_days: record.lead_time_days,
          is_preferred: record.is_preferred,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, record, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (isEdit) {
        await apiClient.patch(`/supplier-prices/${record.id}`, values);
      } else {
        await apiClient.post('/supplier-prices', { ...values, product_id: productId });
      }
      toast.success(t('common.saved'));
      onSaved();
      onClose();
    } catch (err: any) {
      if (err?.errorFields) return;
      toast.error(err?.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} title={isEdit ? t('product.editSupplierPrice') : t('product.addSupplierPrice')}
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
          <Button type="primary" loading={saving} onClick={handleSubmit} style={{ borderRadius: 8 }}>{t('common.save')}</Button>
        </Space>
      }
      destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="supplier_id" label={t('product.supplier')} rules={[{ required: true, message: t('validation.supplierRequired') }]}>
          <Select showSearch optionFilterProp="label" disabled={isEdit}
            popupMatchSelectWidth={false}
            options={suppliers.map((s: any) => ({ label: s.company_name, value: s.id }))}
            style={{ borderRadius: 8 }} />
        </Form.Item>
        <Form.Item name="purchase_price" label={t('product.purchasePrice')} rules={[{ required: true, message: t('validation.unitPricePositive') }]}>
          <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} addonAfter="VND"
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(v) => Number(v?.replace(/\./g, '') ?? 0) as any} />
        </Form.Item>
        <Form.Item name="moq" label="MOQ">
          <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} />
        </Form.Item>
        <Form.Item name="lead_time_days" label={t('supplier.leadTime')}>
          <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} addonAfter={t('product.days')} />
        </Form.Item>
        <Form.Item name="is_preferred" label={t('product.preferred')} valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SupplierPriceFormModal;
