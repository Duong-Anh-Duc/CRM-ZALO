import React, { useEffect } from 'react';
import { Form, Input, InputNumber, Modal, Select, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateCustomer, useUpdateCustomer } from '../hooks';
import { Customer, CustomerType } from '@/types';
import { customerTypeLabels, formatNumber } from '@/utils/format';

interface CustomerFormModalProps {
  open: boolean;
  customer?: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

const customerTypeOptions = (
  Object.entries(customerTypeLabels) as [CustomerType, string][]
).map(([value, label]) => ({ value, label }));

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  customer,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEdit = !!customer;

  useEffect(() => {
    if (open) {
      if (customer) {
        form.setFieldsValue({
          company_name: customer.company_name,
          tax_code: customer.tax_code,
          address: customer.address,
          contact_name: customer.contact_name,
          phone: customer.phone,
          email: customer.email,
          customer_type: customer.customer_type,
          debt_limit: customer.debt_limit,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, customer, form]);

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const loading = createMutation.isPending || updateMutation.isPending;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit) {
        updateMutation.mutate({ id: customer!.id, data: values }, { onSuccess: () => onSuccess() });
      } else {
        createMutation.mutate(values, { onSuccess: () => onSuccess() });
      }
    } catch {
      // validation errors shown by form
    }
  };

  return (
    <Modal
      title={isEdit ? t('customer.editCustomer') : t('customer.addCustomer')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={isEdit ? t('common.update') : t('common.create')}
      cancelText={t('common.cancel')}
      confirmLoading={loading}
      destroyOnClose
      styles={{ body: { borderRadius: 12 } }}
      width={600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="company_name"
          label={t('customer.companyName')}
          rules={[{ required: true, message: t('customer.companyNameRequired') }]}
        >
          <Input placeholder={t('customer.companyNamePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="tax_code" label={t('customer.taxCode')}>
          <Input placeholder={t('customer.taxCodePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="address" label={t('customer.address')}>
          <Input.TextArea rows={2} placeholder={t('customer.addressPlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="contact_name" label={t('customer.contactName')}>
          <Input placeholder={t('customer.contactNamePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item
          name="phone"
          label={t('customer.phone')}
          rules={[{ pattern: /^[0-9+\-\s()]+$/, message: t('customer.phoneInvalid') }]}
        >
          <Input placeholder={t('customer.phonePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item
          name="email"
          label={t('settings.email')}
          rules={[{ type: 'email', message: t('auth.emailInvalid') }]}
        >
          <Input placeholder={t('customer.emailPlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item
          name="customer_type"
          label={t('customer.customerType')}
          rules={[{ required: true, message: t('customer.customerTypeRequired') }]}
        >
          <Select
            placeholder={t('customer.customerTypePlaceholder')}
            options={customerTypeOptions}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="debt_limit"
          label={t('customer.debtLimit')}
          rules={[{ required: true, message: t('customer.debtLimitRequired') }]}
        >
          <InputNumber
            style={{ width: '100%', borderRadius: 8 }}
            min={0}
            step={1000000}
            placeholder={t('customer.debtLimitPlaceholder')}
            formatter={(value) => (value ? formatNumber(Number(value)) : '')}
            parser={(value) => Number((value ?? '').replace(/\./g, '')) as unknown as 0}
            addonAfter="VND"
          />
        </Form.Item>

        <Tooltip title={t('common.phase2ZaloIntegration')}>
          <Form.Item label={t('customer.zalo')}>
            <Input disabled placeholder={t('common.phase2ZaloIntegration')} style={{ borderRadius: 8 }} />
          </Form.Item>
        </Tooltip>
      </Form>
    </Modal>
  );
};

export default CustomerFormModal;
