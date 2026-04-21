import React, { useEffect, useMemo } from 'react';
import { Modal, Form, Input, Typography, Button, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Role } from '../types';

const { Text } = Typography;

interface RoleFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialValues?: Pick<Role, 'slug' | 'name' | 'description'> | null;
  roles?: Role[];
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    slug: string;
    name: string;
    description?: string;
  }) => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({
  open,
  mode,
  initialValues,
  roles,
  loading,
  onCancel,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isCreate = mode === 'create';

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        description: initialValues.description || '',
      });
    } else {
      form.resetFields();
    }
  }, [open, mode, initialValues, form]);

  const existingSlugs = useMemo(
    () =>
      new Set(
        (roles ?? [])
          .filter((r) => !initialValues || r.id !== (initialValues as Role).id)
          .map((r) => r.slug),
      ),
    [roles, initialValues],
  );

  const uniqueSlug = (base: string): string => {
    if (!base) return '';
    if (!existingSlugs.has(base)) return base;
    let i = 2;
    while (existingSlugs.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  };

  const handleSubmit = (values: { name: string; description?: string }) => {
    const name = values.name?.trim() ?? '';
    const slug = isCreate
      ? uniqueSlug(slugify(name))
      : (initialValues?.slug ?? '');
    onSubmit({
      slug,
      name,
      description: values.description?.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      width={560}
      title={mode === 'edit' ? t('role.editRole') : t('role.createRole')}
      onCancel={onCancel}
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onCancel} style={{ borderRadius: 8 }}>
            {t('common.cancel')}
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={() => form.submit()}
            icon={<CheckCircleOutlined />}
            style={{ borderRadius: 8 }}
          >
            {mode === 'edit' ? t('common.save') : t('common.create')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label={<Text strong>{t('role.name')}</Text>}
          rules={[{ required: true, message: t('role.nameRequired') }]}
        >
          <Input
            style={{ borderRadius: 8 }}
            placeholder={t('role.namePlaceholder')}
            autoFocus
          />
        </Form.Item>
        <Form.Item
          name="description"
          label={<Text strong>{t('role.description')}</Text>}
        >
          <Input.TextArea
            rows={3}
            style={{ borderRadius: 8 }}
            placeholder={t('role.descriptionPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleFormModal;
