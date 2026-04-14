import React, { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Modal, Select, Divider, Typography } from 'antd';
import { UserOutlined, BankOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useCreateCustomer, useUpdateCustomer } from '../hooks';
import { CustomerType } from '@/types';
import { getCustomerTypeLabels, formatNumber } from '@/utils/format';
import { CustomerFormModalProps } from '../types';

const { Text } = Typography;

const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  open,
  customer,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEdit = !!customer;
  const [customerType, setCustomerType] = useState<string>('');

  const isIndividual = customerType === 'INDIVIDUAL';
  const isBusiness = customerType === 'BUSINESS';

  const customerTypeOptions = (
    Object.entries(getCustomerTypeLabels()) as [CustomerType, string][]
  ).map(([value, label]) => ({ value, label }));

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
          zalo_user_id: (customer as any).zalo_user_id,
        });
        setCustomerType(customer.customer_type);
      } else {
        form.resetFields();
        setCustomerType('');
      }
    }
  }, [open, customer, form]);

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const loading = createMutation.isPending || updateMutation.isPending;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // For individual: use contact_name as company_name if empty
      if (values.customer_type === 'INDIVIDUAL' && !values.company_name) {
        values.company_name = values.contact_name;
      }
      if (isEdit) {
        updateMutation.mutate({ id: customer!.id, data: values }, { onSuccess: () => onSuccess() });
      } else {
        createMutation.mutate(values, { onSuccess: () => onSuccess() });
      }
    } catch {
      // validation errors shown by form
    }
  };

  const handleTypeChange = (val: string) => {
    setCustomerType(val);
    // Clear business fields when switching to individual
    if (val === 'INDIVIDUAL') {
      form.setFieldsValue({ tax_code: '', debt_limit: 0 });
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
      width={window.innerWidth < 640 ? '95vw' : 600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {/* Step 1: Choose type first */}
        <Form.Item
          name="customer_type"
          label={t('customer.customerType')}
          rules={[{ required: true, message: t('customer.customerTypeRequired') }]}
        >
          <Select
            placeholder={t('customer.customerTypePlaceholder')}
            options={customerTypeOptions}
            style={{ borderRadius: 8 }}
            onChange={handleTypeChange}
          />
        </Form.Item>

        {customerType && (
          <>
            <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {isIndividual ? <><UserOutlined /> {t('customer.individualInfo')}</> : <><BankOutlined /> {t('customer.businessInfo')}</>}
              </Text>
            </Divider>

            {/* Contact name - required for individual */}
            <Form.Item
              name="contact_name"
              label={isIndividual ? t('customer.fullName') : t('customer.contactName')}
              rules={[{ required: isIndividual, message: t('customer.contactNameRequired') }]}
            >
              <Input placeholder={isIndividual ? t('customer.fullNamePlaceholder') : t('customer.contactNamePlaceholder')} style={{ borderRadius: 8 }} />
            </Form.Item>

            {/* Company name - required for business, optional for individual */}
            {isBusiness && (
              <Form.Item
                name="company_name"
                label={t('customer.companyName')}
                rules={[{ required: true, message: t('customer.companyNameRequired') }]}
              >
                <Input placeholder={t('customer.companyNamePlaceholder')} style={{ borderRadius: 8 }} />
              </Form.Item>
            )}

            {/* Tax code - only for business */}
            {isBusiness && (
              <Form.Item name="tax_code" label={t('customer.taxCode')}>
                <Input placeholder={t('customer.taxCodePlaceholder')} style={{ borderRadius: 8 }} />
              </Form.Item>
            )}

            {/* Phone - always */}
            <Form.Item
              name="phone"
              label={t('customer.phone')}
              rules={[
                { required: isIndividual, message: t('customer.phoneRequired') },
                { pattern: /^[0-9+\-\s()]+$/, message: t('customer.phoneInvalid') },
              ]}
            >
              <Input placeholder={t('customer.phonePlaceholder')} style={{ borderRadius: 8 }} />
            </Form.Item>

            {/* Email */}
            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: 'email', message: t('auth.emailInvalid') }]}
            >
              <Input placeholder={t('customer.emailPlaceholder')} style={{ borderRadius: 8 }} />
            </Form.Item>

            {/* Address */}
            <Form.Item name="address" label={t('customer.address')}>
              <Input.TextArea rows={2} placeholder={t('customer.addressPlaceholder')} style={{ borderRadius: 8 }} />
            </Form.Item>

            {/* Debt limit - only for business */}
            {isBusiness && (
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
            )}
          </>
        )}
      </Form>
    </Modal>
  );
};

export default CustomerFormModal;
