import React from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Button, Space, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreatePurchaseOrder } from '../hooks';
import { useSuppliers } from '@/features/suppliers/hooks';
import { useProducts } from '@/features/products/hooks';
import { PurchaseOrderFormModalProps } from '../types';

const PurchaseOrderFormModal: React.FC<PurchaseOrderFormModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const createMutation = useCreatePurchaseOrder();

  const { data: suppliersData } = useSuppliers({ limit: 200 });
  const suppliers = suppliersData?.data ?? [];

  const { data: productsData } = useProducts({ limit: 200 });
  const products = productsData?.data ?? [];

  const supplierOptions = suppliers.map((s: any) => ({ label: s.company_name, value: s.id }));
  const productOptions = products.map((p: any) => ({ label: `${p.sku} - ${p.name}`, value: p.id, price: p.wholesale_price || 0 }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        supplier_id: values.supplier_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        items: (values.items || []).map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      };
      createMutation.mutate(payload, {
        onSuccess: () => { form.resetFields(); onSuccess(); },
      });
    } catch {
      // validation
    }
  };

  const handleProductSelect = (productId: string, fieldName: number) => {
    const product = products.find((p: any) => p.id === productId);
    if (product) {
      const items = form.getFieldValue('items') || [];
      items[fieldName] = { ...items[fieldName], unit_price: (product as any).wholesale_price || 0 };
      form.setFieldsValue({ items });
    }
  };

  return (
    <Modal
      open={open}
      title={t('order.createPurchaseOrder')}
      width={800}
      onCancel={onClose}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
          <Button type="primary" loading={createMutation.isPending} onClick={handleSubmit} style={{ borderRadius: 8 }}>{t('common.create')}</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ items: [{}] }}>
        <Form.Item name="supplier_id" label={t('order.supplier')} rules={[{ required: true, message: t('validation.supplierRequired') }]}>
          <Select showSearch optionFilterProp="label" options={supplierOptions} placeholder={t('supplier.title')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="notes" label={t('common.notes')}>
          <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Divider>{t('order.productDetails')}</Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="start" style={{ display: 'flex', marginBottom: 8 }} wrap>
                  <Form.Item {...rest} name={[name, 'product_id']} rules={[{ required: true, message: t('validation.productRequired') }]} style={{ width: 300 }}>
                    <Select showSearch optionFilterProp="label" options={productOptions} placeholder={t('product.name')} onChange={(v) => handleProductSelect(v, name)} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'quantity']} rules={[{ required: true, message: t('validation.qtyPositive') }]} style={{ width: 100 }}>
                    <InputNumber min={1} placeholder={t('order.quantity')} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'unit_price']} rules={[{ required: true, message: t('validation.unitPricePositive') }]} style={{ width: 160 }}>
                    <InputNumber min={0} placeholder={t('product.unitPrice')} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
                  </Form.Item>
                  {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', marginTop: 8 }} />}
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block style={{ borderRadius: 8 }}>
                {t('product.addProduct')}
              </Button>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default PurchaseOrderFormModal;
