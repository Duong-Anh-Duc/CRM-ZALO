import React from 'react';
import { Form, Input, Button, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLogin } from '../hooks';
import type { LoginInput } from '@/types';
import logoImg from '@/assets/images/logo.jpg';

const { Text } = Typography;

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const loginMutation = useLogin();

  const handleSubmit = (values: LoginInput) => {
    loginMutation.mutate(values);
  };

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />
        <div className="login-blob login-blob-3" />
      </div>

      {/* Floating particles */}
      <div className="login-particles">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="login-particle" style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 8}s`,
            animationDuration: `${6 + Math.random() * 8}s`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
          }} />
        ))}
      </div>

      {/* Card */}
      <div className="login-card-wrapper">
        {/* Logo */}
        <div className="login-logo">
          <img src={logoImg} alt="UNIKI" className="login-logo-img" />
          <Text className="login-subtitle">
            {t('auth.loginTitle')}
          </Text>
        </div>

        {/* Form */}
        <div className="login-form-container">
          <Form layout="vertical" onFinish={handleSubmit} autoComplete="off" size="large">
            <Form.Item
              name="email"
              rules={[
                { required: true, message: t('auth.emailRequired') },
                { type: 'email', message: t('auth.emailInvalid') },
              ]}
            >
              <Input
                prefix={<MailOutlined className="login-input-icon" />}
                placeholder={t('auth.emailPlaceholder')}
                className="login-input"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.passwordRequired') }]}
            >
              <Input.Password
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder={t('auth.passwordPlaceholder')}
                className="login-input"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loginMutation.isPending}
                block
                size="large"
                className="login-button"
              >
                {loginMutation.isPending ? t('common.loading') : t('auth.login')}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>

      {/* Footer */}
      <div className="login-footer">
        <Text className="login-footer-text">
          {t('auth.companyInfo')}
        </Text>
      </div>
    </div>
  );
};

export default LoginPage;
