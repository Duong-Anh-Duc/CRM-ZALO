import React, { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, InputNumber, Radio, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useCashCategories, useCreateCashTransaction } from '../hooks';

const { TextArea } = Input;
const { Dragger } = Upload;

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
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setEvidenceUrl(null);
      if (defaultType) form.setFieldValue('type', defaultType);
    }
  }, [open, defaultType, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await createMutation.mutateAsync({
      ...values,
      date: values.date?.format('YYYY-MM-DD'),
      evidence_url: evidenceUrl || undefined,
    });
    onSuccess();
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Use a simple endpoint or Cloudinary direct upload
      // For now, convert to base64 data URL as fallback
      const reader = new FileReader();
      reader.onload = () => {
        setEvidenceUrl(reader.result as string);
        setUploading(false);
        message.success(t('cashBook.evidenceUploaded'));
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    return false; // prevent default upload
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
        <Form.Item name="description" label={t('cashBook.content')} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="payment_method" label={t('payment.method')}>
          <Select options={[
            { value: 'CASH', label: t('payment.methodCash') },
            { value: 'BANK_TRANSFER', label: t('payment.methodBankTransfer') },
          ]} />
        </Form.Item>
        <Form.Item label={t('cashBook.evidence')}>
          {evidenceUrl ? (
            <div style={{ textAlign: 'center' }}>
              <img src={evidenceUrl} alt="evidence" style={{ maxHeight: 150, borderRadius: 8, marginBottom: 8 }} />
              <br />
              <a onClick={() => setEvidenceUrl(null)} style={{ color: '#ff4d4f', fontSize: 12 }}>{t('common.delete')}</a>
            </div>
          ) : (
            <Dragger
              accept="image/*"
              showUploadList={false}
              beforeUpload={handleUpload as any}
              disabled={uploading}
              style={{ borderRadius: 8 }}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text" style={{ fontSize: 13 }}>{t('cashBook.evidenceUpload')}</p>
            </Dragger>
          )}
        </Form.Item>
        <Form.Item name="notes" label={t('cashBook.notes')}>
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CashTransactionFormModal;
