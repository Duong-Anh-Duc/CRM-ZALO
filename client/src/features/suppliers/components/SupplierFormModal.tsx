import React, { useEffect } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCreateSupplier, useUpdateSupplier } from '../hooks';
import { PaymentTerms } from '@/types';
import { SupplierFormModalProps } from '../types';

const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  open,
  supplier,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEdit = !!supplier;

  const paymentTermsOptions: { value: PaymentTerms; label: string }[] = [
    { value: 'IMMEDIATE', label: t('paymentTermsLabels.IMMEDIATE') },
    { value: 'NET_30', label: t('paymentTermsLabels.NET_30') },
    { value: 'NET_60', label: t('paymentTermsLabels.NET_60') },
    { value: 'NET_90', label: t('paymentTermsLabels.NET_90') },
  ];

  useEffect(() => {
    if (open) {
      if (supplier) {
        form.setFieldsValue({
          company_name: supplier.company_name,
          tax_code: supplier.tax_code,
          address: supplier.address,
          contact_name: supplier.contact_name,
          phone: supplier.phone,
          email: supplier.email,
          payment_terms: supplier.payment_terms,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, supplier, form]);

  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();

  const loading = createMutation.isPending || updateMutation.isPending;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit) {
        updateMutation.mutate({ id: supplier!.id, data: values }, { onSuccess: () => onSuccess() });
      } else {
        createMutation.mutate(values, { onSuccess: () => onSuccess() });
      }
    } catch {
      // validation errors shown by form
    }
  };

  return (
    <Modal
      title={isEdit ? t('supplier.editSupplier') : t('supplier.addSupplier')}
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
        <Form.Item
          name="company_name"
          label={t('supplier.supplierName')}
          rules={[{ required: true, message: t('validation.supplierNameRequired') }]}
        >
          <Input placeholder={t('supplier.supplierNamePlaceholder')} style={{ borderRadius: 8 }} />
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
          name="payment_terms"
          label={t('supplier.paymentTerms')}
        >
          <Select popupMatchSelectWidth={false}
            allowClear
            placeholder={t('supplier.paymentTermsPlaceholder')}
            options={paymentTermsOptions}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SupplierFormModal;
