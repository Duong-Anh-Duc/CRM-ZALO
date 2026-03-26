import React from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Button, Space, Divider } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateSalesOrder } from '../hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useProducts } from '@/features/products/hooks';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SalesOrderFormModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const createMutation = useCreateSalesOrder();

  const { data: customersData } = useCustomers({ limit: 200 });
  const customers = customersData?.data ?? [];

  const { data: productsData } = useProducts({ limit: 200 });
  const products = productsData?.data ?? [];

  const customerOptions = customers.map((c: any) => ({ label: c.company_name, value: c.id }));
  const productOptions = products.map((p: any) => ({ label: `${p.sku} - ${p.name}`, value: p.id, price: p.retail_price || 0 }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        customer_id: values.customer_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        vat_rate: values.vat_rate,
        items: (values.items || []).map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_pct: item.discount_pct || 0,
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
      items[fieldName] = { ...items[fieldName], unit_price: (product as any).retail_price || 0 };
      form.setFieldsValue({ items });
    }
  };

  return (
    <Modal
      open={open}
      title={t('order.createSalesOrder')}
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
      <Form form={form} layout="vertical" initialValues={{ vat_rate: 'VAT_10', items: [{}] }}>
        <Form.Item name="customer_id" label={t('order.customer')} rules={[{ required: true, message: t('validation.customerRequired') }]}>
          <Select showSearch optionFilterProp="label" options={customerOptions} placeholder={t('customer.customerTypePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Space style={{ width: '100%' }} size="middle">
          <Form.Item name="expected_delivery" label={t('order.expectedDelivery')} style={{ flex: 1 }}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="vat_rate" label="VAT" rules={[{ required: true }]} style={{ width: 150 }}>
            <Select options={[{ label: '0%', value: 'VAT_0' }, { label: '8%', value: 'VAT_8' }, { label: '10%', value: 'VAT_10' }]} />
          </Form.Item>
        </Space>

        <Form.Item name="notes" label={t('common.notes')}>
          <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Divider>{t('order.productDetails')}</Divider>

        <Form.List name="items">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Space key={key} align="start" style={{ display: 'flex', marginBottom: 8 }} wrap>
                  <Form.Item {...rest} name={[name, 'product_id']} rules={[{ required: true, message: t('validation.productRequired') }]} style={{ width: 250 }}>
                    <Select showSearch optionFilterProp="label" options={productOptions} placeholder={t('product.name')} onChange={(v) => handleProductSelect(v, name)} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'quantity']} rules={[{ required: true, message: t('validation.qtyPositive') }]} style={{ width: 100 }}>
                    <InputNumber min={1} placeholder={t('order.quantity')} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'unit_price']} rules={[{ required: true, message: t('validation.unitPricePositive') }]} style={{ width: 150 }}>
                    <InputNumber min={0} placeholder={t('product.unitPrice')} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'discount_pct']} style={{ width: 80 }}>
                    <InputNumber min={0} max={100} placeholder="CK%" style={{ width: '100%' }} />
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

export default SalesOrderFormModal;
