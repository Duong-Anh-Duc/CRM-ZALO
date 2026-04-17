import React, { useEffect } from 'react';
import { Modal, Form, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useChangePassword } from '../hooks';

interface Props { open: boolean; onClose: () => void; }

const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const mutation = useChangePassword();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      mutation.mutate(
        { old_password: values.old_password, new_password: values.new_password },
        { onSuccess: () => { form.resetFields(); onClose(); } },
      );
    });
  };

  return (
    <Modal open={open} title={t('auth.changePassword')} onCancel={onClose} onOk={handleSubmit}
      okText={t('auth.changePassword')} cancelText={t('common.cancel')} confirmLoading={mutation.isPending}
      destroyOnClose width={450} styles={{ body: { paddingTop: 8 } }}>
      <Form form={form} layout="vertical">
        <Form.Item name="old_password" label={t('auth.currentPassword')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('auth.currentPasswordPlaceholder')} style={{ borderRadius: 8 }} size="large" />
        </Form.Item>
        <Form.Item name="new_password" label={t('auth.newPassword')} rules={[{ required: true, message: t('auth.passwordRequired') }, { min: 6, message: t('user.passwordMin') }]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('auth.newPasswordPlaceholder')} style={{ borderRadius: 8 }} size="large" />
        </Form.Item>
        <Form.Item name="confirm_password" label={t('auth.confirmPassword')} dependencies={['new_password']}
          rules={[{ required: true, message: t('auth.passwordRequired') }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('new_password') === value) return Promise.resolve(); return Promise.reject(new Error(t('auth.passwordMismatch'))); } })]}>
          <Input.Password prefix={<LockOutlined />} placeholder={t('auth.confirmPasswordPlaceholder')} style={{ borderRadius: 8 }} size="large" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;
