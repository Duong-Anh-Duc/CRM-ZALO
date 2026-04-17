import React, { useState } from 'react';
import { Modal, Form, InputNumber, DatePicker, Select, Input, Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { receivableApi, payableApi } from '@/features/debts/api';
import { PaymentMethod } from '@/types';
import { formatVND } from '@/utils/format';
import { PaymentModalProps } from './types';

const { Dragger } = Upload;

const PaymentModal: React.FC<PaymentModalProps> = ({
  open, onClose, type, debtId, maxAmount,
}) => {
  const [form] = Form.useForm();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  const methodOptions = [
    { label: t('payment.methodCash'), value: 'CASH' as PaymentMethod },
    { label: t('payment.methodBankTransfer'), value: 'BANK_TRANSFER' as PaymentMethod },
    { label: t('payment.methodOther'), value: 'OTHER' as PaymentMethod },
  ];

  const mutation = useMutation({
    mutationFn: (values: any) => {
      const payload: any = {
        amount: values.amount,
        payment_date: values.payment_date?.format('YYYY-MM-DD'),
        method: values.method,
        reference: values.reference,
        evidence_url: evidenceUrl || undefined,
      };

      if (type === 'receivable') {
        payload.customer_id = debtId;
        return receivableApi.recordPayment(payload);
      }
      payload.supplier_id = debtId;
      return payableApi.recordPayment(payload);
    },
    onSuccess: () => {
      toast.success(t('debt.recordPaymentSuccess'));
      qc.invalidateQueries({ queryKey: ['receivables'] });
      qc.invalidateQueries({ queryKey: ['receivables-by-customer'] });
      qc.invalidateQueries({ queryKey: ['customer-debt'] });
      qc.invalidateQueries({ queryKey: ['receivable-summary'] });
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['payables-by-supplier'] });
      qc.invalidateQueries({ queryKey: ['supplier-debt'] });
      qc.invalidateQueries({ queryKey: ['payable-summary'] });
      qc.invalidateQueries({ queryKey: ['cash-book'] });
      qc.invalidateQueries({ queryKey: ['cash-summary'] });
      form.resetFields();
      setEvidenceUrl(null);
      onClose();
    },
    onError: () => {
      toast.error(t('debt.recordPaymentFailed'));
    },
  });

  const handleOk = () => {
    form.validateFields().then((values) => {
      mutation.mutate(values);
    });
  };

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setEvidenceUrl(reader.result as string);
      message.success(t('payment.evidenceUploaded'));
    };
    reader.readAsDataURL(file);
    return false;
  };

  return (
    <Modal
      title={type === 'receivable' ? t('debt.recordReceivable') : t('debt.recordPayment')}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); setEvidenceUrl(null); onClose(); }}
      confirmLoading={mutation.isPending}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      styles={{ body: { paddingTop: 16 } }}
      style={{ borderRadius: 12 }}
    >
      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
        {t('payment.fifoNote', { max: formatVND(maxAmount) })}
      </div>
      <Form form={form} layout="vertical" initialValues={{ method: 'BANK_TRANSFER', payment_date: dayjs() }}>
        <Form.Item label={t('payment.amount')} name="amount"
          rules={[{ required: true, message: t('payment.amountRequired') }, { type: 'number', max: maxAmount, message: t('payment.amountMax', { max: formatVND(maxAmount) }) }]}
        >
          <InputNumber style={{ width: '100%', borderRadius: 8 }} min={1} max={maxAmount}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(v) => Number(v?.replace(/\./g, '') ?? 0)}
            placeholder={t('payment.amountPlaceholder')} addonAfter="VND" />
        </Form.Item>

        <Form.Item label={t('payment.paymentDate')} name="payment_date" rules={[{ required: true, message: t('payment.dateRequired') }]}>
          <DatePicker style={{ width: '100%', borderRadius: 8 }} format="DD/MM/YYYY" placeholder={t('payment.datePlaceholder')} />
        </Form.Item>

        <Form.Item label={t('payment.method')} name="method" rules={[{ required: true, message: t('payment.methodRequired') }]}>
          <Select options={methodOptions} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item label={t('payment.reference')} name="reference">
          <Input placeholder={t('payment.referencePlaceholder')} style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item label={t('payment.evidence')}>
          {evidenceUrl ? (
            <div style={{ textAlign: 'center' }}>
              <img src={evidenceUrl} alt="evidence" style={{ maxHeight: 120, borderRadius: 8, marginBottom: 8 }} />
              <br />
              <a onClick={() => setEvidenceUrl(null)} style={{ color: '#ff4d4f', fontSize: 12 }}>{t('common.delete')}</a>
            </div>
          ) : (
            <Dragger accept="image/*,.pdf" showUploadList={false} beforeUpload={handleUpload as any} style={{ borderRadius: 8 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text" style={{ fontSize: 12 }}>{t('payment.evidenceUploadHint')}</p>
            </Dragger>
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PaymentModal;
