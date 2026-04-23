import React from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Button, Space, Divider, Row, Col, message } from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateSalesOrder } from '../hooks';
import { useCustomers } from '@/features/customers/hooks';
import { useProducts } from '@/features/products/hooks';
import { SalesOrderFormModalProps } from '../types';

const vatOptions = [
  { label: '0%', value: 0 },
  { label: '5%', value: 5 },
  { label: '8%', value: 8 },
  { label: '10%', value: 10 },
];

const SalesOrderFormModal: React.FC<SalesOrderFormModalProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const createMutation = useCreateSalesOrder();

  const { data: customersData } = useCustomers({ limit: 200 });
  const customers = customersData?.data ?? [];

  const { data: productsData } = useProducts({ limit: 200 });
  const products = productsData?.data ?? [];

  const customerOptions = customers.map((c: any) => ({ label: c.company_name || c.contact_name, value: c.id }));
  const productOptions = products.map((p: any) => ({ label: `${p.sku} - ${p.name}`, value: p.id, price: p.retail_price || 0 }));
  const productIds = new Set(products.map((p: any) => p.id));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const items = values.items || [];

      // Validate at least 1 item
      if (items.length === 0) {
        message.error(t('order.minOneItem'));
        return;
      }

      // Validate all products exist in DB
      for (const item of items) {
        if (!item.product_id || !productIds.has(item.product_id)) {
          message.error(t('order.invalidProduct'));
          return;
        }
      }

      const payload = {
        customer_id: values.customer_id,
        expected_delivery: values.expected_delivery?.format('YYYY-MM-DD'),
        notes: values.notes,
        vat_rate: 'VAT_0' as any,
        shipping_fee: values.shipping_fee || 0,
        other_fee: values.other_fee || 0,
        other_fee_note: values.other_fee_note,
        items: items.map((item: any) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_pct: item.discount_pct || 0,
          vat_rate: item.vat_rate ?? 10,
        })),
      };
      createMutation.mutate(payload, {
        onSuccess: () => { form.resetFields(); onSuccess(); },
      });
    } catch {
      // validation errors handled by form
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
      width={Math.min(window.innerWidth * 0.95, 850)}
      onCancel={onClose}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>{t('common.cancel')}</Button>
          <Button type="primary" loading={createMutation.isPending} onClick={handleSubmit} style={{ borderRadius: 8 }}>{t('common.create')}</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={{ items: [{ vat_rate: 10 }] }}>
        <Form.Item name="customer_id" label={t('order.customer')} rules={[{ required: true, message: t('validation.customerRequired') }]}>
          <Select showSearch optionFilterProp="label" options={customerOptions} placeholder={t('customer.customerTypePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="expected_delivery" label={t('order.expectedDelivery')}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="shipping_fee" label={t('order.shippingFee')}>
              <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="other_fee" label={t('order.otherFee')}>
              <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notes" label={t('common.notes')}>
          <Input.TextArea rows={2} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Divider>{t('order.productDetails')}</Divider>

        <Form.List name="items" rules={[{ validator: async (_, items) => { if (!items || items.length === 0) throw new Error(t('order.minOneItem')); } }]}>
          {(fields, { add, remove }, { errors }) => (
            <>
              {fields.map(({ key, name, ...rest }) => (
                <Row key={key} gutter={8} align="top" style={{ marginBottom: 8 }}>
                  <Col xs={24} sm={7}>
                    <Form.Item {...rest} name={[name, 'product_id']} rules={[{ required: true, message: t('validation.productRequired') }]}>
                      <Select showSearch optionFilterProp="label" options={productOptions} placeholder={t('product.name')} onChange={(v) => handleProductSelect(v, name)} size="small" />
                    </Form.Item>
                  </Col>
                  <Col xs={6} sm={3}>
                    <Form.Item {...rest} name={[name, 'quantity']} rules={[{ required: true, message: 'SL' }, { type: 'number', min: 1, message: '≥1' }]}>
                      <InputNumber min={1} placeholder="SL" style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  </Col>
                  <Col xs={8} sm={4}>
                    <Form.Item {...rest} name={[name, 'unit_price']} rules={[{ required: true, message: t('validation.unitPricePositive') }, { type: 'number', min: 1, message: '>0' }]}>
                      <InputNumber min={0} placeholder={t('order.unitPrice')} style={{ width: '100%' }} size="small" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0} />
                    </Form.Item>
                  </Col>
                  <Col xs={5} sm={3}>
                    <Form.Item {...rest} name={[name, 'discount_pct']}>
                      <InputNumber min={0} max={100} placeholder="CK%" style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  </Col>
                  <Col xs={5} sm={3}>
                    <Form.Item {...rest} name={[name, 'vat_rate']} initialValue={10}>
                      <Select options={vatOptions} placeholder="VAT" size="small" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={3} style={{ display: 'flex', alignItems: 'center', paddingTop: 4 }}>
                    {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />}
                  </Col>
                </Row>
              ))}
              <Form.ErrorList errors={errors} />
              <Button type="dashed" onClick={() => add({ vat_rate: 10 })} icon={<PlusOutlined />} block style={{ borderRadius: 8 }}>
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
