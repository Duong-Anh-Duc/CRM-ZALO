import React, { useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useCashCategories, useCreateCashTransaction } from '../hooks';

const { TextArea } = Input;

interface Props {
  open: boolean;
  defaultType?: 'INCOME' | 'EXPENSE';
  onClose: () => void;
  onSuccess: () => void;
}

const CashTransactionFormModal: React.FC<Props> = ({ open, defaultType, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const type = Form.useWatch('type', form) || defaultType || 'EXPENSE';
  const { data: categories } = useCashCategories(type);
  const createMutation = useCreateCashTransaction();

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (defaultType) form.setFieldValue('type', defaultType);
    }
  }, [open, defaultType, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await createMutation.mutateAsync({
      ...values,
      date: values.date?.format('YYYY-MM-DD'),
    });
    onSuccess();
  };

  const categoryOptions = (categories?.data ?? categories ?? []).map((c: any) => ({ value: c.id, label: c.name }));

  return (
    <Modal
      open={open}
      title={t('cashBook.createTransaction')}
      okText={t('common.save')}
      cancelText={t('common.cancel')}
      width={500}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={createMutation.isPending}
    >
      <Form form={form} layout="vertical" initialValues={{ type: defaultType || 'EXPENSE', date: dayjs(), payment_method: 'CASH' }}>
        <Form.Item name="type" label={t('cashBook.type')} rules={[{ required: true }]}>
          <Radio.Group>
            <Radio.Button value="INCOME" style={{ color: '#52c41a' }}>{t('cashBook.income')}</Radio.Button>
            <Radio.Button value="EXPENSE" style={{ color: '#cf1322' }}>{t('cashBook.expense')}</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="category_id" label={t('cashBook.category')} rules={[{ required: true }]}>
          <Select options={categoryOptions} placeholder={t('cashBook.selectCategory')} showSearch optionFilterProp="label" />
        </Form.Item>
        <Form.Item name="date" label={t('cashBook.date')} rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="amount" label={t('cashBook.amount')} rules={[{ required: true }]}>
          <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => Number(v!.replace(/,/g, '')) as any} addonAfter="VND" />
        </Form.Item>
        <Form.Item name="description" label={t('cashBook.description')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="payment_method" label={t('payment.method')}>
          <Select options={[
            { value: 'CASH', label: t('payment.methodCash') },
            { value: 'BANK_TRANSFER', label: t('payment.methodBankTransfer') },
          ]} />
        </Form.Item>
        <Form.Item name="reference" label={t('cashBook.reference')}>
          <Input />
        </Form.Item>
        <Form.Item name="notes" label={t('cashBook.notes')}>
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CashTransactionFormModal;
