import React, { useEffect } from 'react';
import { Modal, Form, Input, Tabs, Tag, Descriptions } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { useUpdateProfile, useChangePassword } from '../hooks';
import { ProfileModalProps } from '../types';

const roleLabels: Record<string, { vi: string; en: string; color: string }> = {
  ADMIN: { vi: 'Quản trị viên', en: 'Admin', color: 'red' },
  STAFF: { vi: 'Nhân viên', en: 'Staff', color: 'blue' },
  VIEWER: { vi: 'Xem', en: 'Viewer', color: 'default' },
};

const ProfileModal: React.FC<ProfileModalProps> = ({ open, defaultTab = 'profile', onClose }) => {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();

  useEffect(() => {
    if (open && user) {
      profileForm.setFieldsValue({ full_name: user.full_name });
      passwordForm.resetFields();
    }
  }, [open, user, profileForm, passwordForm]);

  const handleProfileSubmit = () => {
    profileForm.validateFields().then((values) => {
      updateProfileMutation.mutate(values, { onSuccess: () => onClose() });
    });
  };

  const handlePasswordSubmit = () => {
    passwordForm.validateFields().then((values) => {
      changePasswordMutation.mutate(
        { old_password: values.old_password, new_password: values.new_password },
        { onSuccess: () => { passwordForm.resetFields(); onClose(); } },
      );
    });
  };

  const lang = i18n.language === 'en' ? 'en' : 'vi';
  const role = user?.role ? roleLabels[user.role] : null;

  const tabItems = [
    {
      key: 'profile',
      label: t('auth.profile'),
      children: (
        <>
          <Descriptions
            column={1}
            bordered
            size="small"
            style={{ marginBottom: 20, borderRadius: 8 }}
          >
            <Descriptions.Item label={t('auth.email')}>
              <MailOutlined style={{ marginRight: 8, color: '#8c8c8c' }} />
              {user?.email}
            </Descriptions.Item>
            <Descriptions.Item label={t('auth.role')}>
              {role && (
                <Tag color={role.color} style={{ borderRadius: 8 }}>
                  {role[lang]}
                </Tag>
              )}
            </Descriptions.Item>
          </Descriptions>

          <Form form={profileForm} layout="vertical">
            <Form.Item
              name="full_name"
              label={t('auth.fullName')}
              rules={[{ required: true, message: t('user.fullNameRequired') }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder={t('auth.fullNamePlaceholder')}
                style={{ borderRadius: 8 }}
                size="large"
              />
            </Form.Item>
          </Form>
        </>
      ),
    },
    {
      key: 'password',
      label: t('auth.changePassword'),
      children: (
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="old_password"
            label={t('auth.currentPassword')}
            rules={[{ required: true, message: t('auth.passwordRequired') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.currentPasswordPlaceholder')}
              style={{ borderRadius: 8 }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="new_password"
            label={t('auth.newPassword')}
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              { min: 6, message: t('user.passwordMin') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.newPasswordPlaceholder')}
              style={{ borderRadius: 8 }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label={t('auth.confirmPassword')}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('auth.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('auth.confirmPasswordPlaceholder')}
              style={{ borderRadius: 8 }}
              size="large"
            />
          </Form.Item>
        </Form>
      ),
    },
  ];

  const [activeTab, setActiveTab] = React.useState(defaultTab);

  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  const isLoading = updateProfileMutation.isPending || changePasswordMutation.isPending;

  return (
    <Modal
      open={open}
      title={t('auth.profile')}
      onCancel={onClose}
      onOk={activeTab === 'profile' ? handleProfileSubmit : handlePasswordSubmit}
      okText={activeTab === 'profile' ? t('common.update') : t('auth.changePassword')}
      cancelText={t('common.cancel')}
      confirmLoading={isLoading}
      destroyOnClose
      width={500}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Tabs
        items={tabItems}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'profile' | 'password')}
      />
    </Modal>
  );
};

export default ProfileModal;
