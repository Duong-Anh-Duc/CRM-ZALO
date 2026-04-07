import { useEffect, useRef, useState } from 'react';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, ConfigProvider, Form, Input, Typography, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLogin } from '../hooks';
import LoginBackground from '../components/LoginBackground';
import LoginBrandPanel from '../components/LoginBrandPanel';
import type { LoginInput } from '@/types';
import '@/styles/login.css';

const { Text } = Typography;

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const loginMutation = useLogin();
  const [visible, setVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  const handleSubmit = (values: LoginInput) => {
    loginMutation.mutate(values);
  };

  return (
    <div className="lp-root" ref={rootRef}>
      <LoginBackground mousePos={mousePos} />

      {/* Card */}
      <div className={`lp-wrap ${visible ? 'lp-wrap--in' : ''}`}>
        <div className="lp-glow-border" />
        <div className="lp-card">
          <LoginBrandPanel />

          {/* Form panel */}
          <div className="lp-form-side">
            <p className={`lp-welcome ${visible ? 'lp-stagger-1' : ''}`}>{t('auth.login')}</p>

            <ConfigProvider
              theme={{
                algorithm: antTheme.darkAlgorithm,
                token: {
                  colorPrimary: '#667eea',
                  colorBgContainer: 'rgba(255,255,255,0.04)',
                  colorBorder: 'rgba(102,126,234,0.25)',
                  colorText: '#f1f5f9',
                  colorTextPlaceholder: '#64748b',
                  borderRadius: 10,
                  fontSize: 15,
                },
              }}
            >
              <Form layout="vertical" onFinish={handleSubmit} autoComplete="off" style={{ marginTop: 28 }}>
                <div className={`lp-field-wrap ${visible ? 'lp-stagger-2' : ''}`}>
                  <Form.Item
                    name="email"
                    rules={[
                      { required: true, message: t('auth.emailRequired') },
                      { type: 'email', message: t('auth.emailInvalid') },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined className="lp-input-icon" />}
                      placeholder={t('auth.emailPlaceholder')}
                      size="large"
                      className="lp-input"
                    />
                  </Form.Item>
                </div>

                <div className={`lp-field-wrap ${visible ? 'lp-stagger-3' : ''}`}>
                  <Form.Item
                    name="password"
                    rules={[{ required: true, message: t('auth.passwordRequired') }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined className="lp-input-icon" />}
                      placeholder={t('auth.passwordPlaceholder')}
                      size="large"
                      className="lp-input"
                    />
                  </Form.Item>
                </div>

                <div className={`lp-field-wrap ${visible ? 'lp-stagger-4' : ''}`}>
                  <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      block
                      size="large"
                      loading={loginMutation.isPending}
                      className="lp-btn"
                      style={{
                        height: 50,
                        fontWeight: 700,
                        fontSize: 15,
                        letterSpacing: '0.3px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        boxShadow: '0 4px 20px rgba(102,126,234,0.35)',
                      }}
                    >
                      {t('auth.login')}
                    </Button>
                  </Form.Item>
                </div>
              </Form>
            </ConfigProvider>

            <div className={`lp-footer ${visible ? 'lp-stagger-5' : ''}`}>
              <Text className="lp-company-info">{t('auth.companyInfo')}</Text>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
