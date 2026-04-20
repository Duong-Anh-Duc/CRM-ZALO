import React, { useEffect } from 'react';
import { Modal, Form, Input, Tag, Descriptions } from 'antd';
import { UserOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useUpdateProfile } from '../hooks';

const ROLE_COLORS: Record<string, string> = { ADMIN: 'red', STAFF: 'blue', VIEWER: 'default' };
const ROLE_KEYS: Record<string, string> = { ADMIN: 'user.roleAdmin', STAFF: 'user.roleStaff', VIEWER: 'user.roleViewer' };

interface Props { open: boolean; onClose: () => void; }

const ProfileModal: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [form] = Form.useForm();
  const mutation = useUpdateProfile();
  const role = user?.role ? { label: t(ROLE_KEYS[user.role] || ''), color: ROLE_COLORS[user.role] || 'default' } : null;

  useEffect(() => {
    if (open && user) form.setFieldsValue({ full_name: user.full_name });
  }, [open, user, form]);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      mutation.mutate(values, { onSuccess: () => onClose() });
    });
  };

  return (
    <Modal open={open} title={t('auth.profile')} onCancel={onClose} onOk={handleSubmit}
      okText={t('common.update')} cancelText={t('common.cancel')} confirmLoading={mutation.isPending}
      destroyOnClose width={480} styles={{ body: { paddingTop: 8 } }}>
      <Descriptions column={1} bordered size="small" style={{ marginBottom: 20, borderRadius: 8 }}>
        <Descriptions.Item label={t('auth.email')}>
          <MailOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />{user?.email}
        </Descriptions.Item>
        <Descriptions.Item label={t('auth.role')}>
          {role && <Tag color={role.color} style={{ borderRadius: 8 }}>{role.label}</Tag>}
        </Descriptions.Item>
      </Descriptions>
      <Form form={form} layout="vertical">
        <Form.Item name="full_name" label={t('auth.fullName')} rules={[{ required: true, message: t('user.fullNameRequired') }]}>
          <Input prefix={<UserOutlined />} placeholder={t('auth.fullNamePlaceholder')} style={{ borderRadius: 8 }} size="large" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProfileModal;
