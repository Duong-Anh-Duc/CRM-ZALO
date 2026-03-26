import React, { useEffect } from 'react';
import { Modal, Form, DatePicker, Select, Input, InputNumber, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useCostCategories, useCreateCost, useUpdateCost } from '../hooks';
import { OperatingCost, OperatingCostCategory } from '@/types';

interface CostFormModalProps {
  open: boolean;
  editingCost: OperatingCost | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const CostFormModal: React.FC<CostFormModalProps> = ({
  open,
  editingCost,
  onCancel,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditing = !!editingCost;

  const { data: categoriesData } = useCostCategories();
  const categories = (categoriesData?.data ?? []) as OperatingCostCategory[];

  useEffect(() => {
    if (open && editingCost) {
      form.setFieldsValue({
        date: dayjs(editingCost.date),
        category_id: editingCost.category_id,
        description: editingCost.description,
        amount: editingCost.amount,
      });
    } else if (open) {
      form.resetFields();
      form.setFieldsValue({ date: dayjs() });
    }
  }, [open, editingCost, form]);

  const createMutation = useCreateCost();
  const updateMutation = useUpdateCost();

  const handleFinish = (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      date: (values.date as dayjs.Dayjs).format('YYYY-MM-DD'),
    };
    if (isEditing) {
      updateMutation.mutate({ id: editingCost!.id, data: payload }, { onSuccess: () => onSuccess() });
    } else {
      createMutation.mutate(payload, { onSuccess: () => onSuccess() });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      open={open}
      title={isEditing ? t('cost.editCost') : t('cost.addCost')}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={isSubmitting}
      okText={isEditing ? t('common.update') : t('common.add')}
      cancelText={t('common.cancel')}
      destroyOnClose
      styles={{ body: { paddingTop: 16 } }}
      style={{ borderRadius: 12 }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{ date: dayjs() }}
      >
        <Form.Item
          name="date"
          label={t('common.date')}
          rules={[{ required: true, message: t('cost.dateRequired') }]}
        >
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: '100%', borderRadius: 8 }}
            placeholder={t('common.selectDate')}
          />
        </Form.Item>

        <Form.Item
          name="category_id"
          label={t('cost.category')}
          rules={[{ required: true, message: t('cost.categoryRequired') }]}
        >
          <Select
            placeholder={t('cost.selectCategory')}
            style={{ borderRadius: 8 }}
            options={(categories ?? [])
              .filter((c) => c.is_active)
              .map((c) => ({ label: c.name, value: c.id }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>

        <Form.Item
          name="description"
          label={t('common.description')}
        >
          <Input.TextArea
            rows={3}
            placeholder={t('cost.descriptionPlaceholder')}
            style={{ borderRadius: 8 }}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label={t('cost.amountVnd')}
          rules={[{ required: true, message: t('cost.amountRequired') }]}
        >
          <InputNumber
            min={0}
            step={1000}
            style={{ width: '100%', borderRadius: 8 }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            parser={(v: string | undefined) => v ? Number(v.replace(/\./g, '')) : 0}
            placeholder="0"
            addonAfter="VND"
          />
        </Form.Item>

        <Form.Item
          name="receipt"
          label={t('cost.receipt')}
        >
          <Upload
            maxCount={1}
            beforeUpload={() => false}
            accept="image/*"
          >
            <Button icon={<UploadOutlined />} style={{ borderRadius: 8 }}>
              {t('cost.selectReceipt')}
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CostFormModal;
