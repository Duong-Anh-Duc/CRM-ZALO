import React, { useEffect } from 'react';
import { Tabs, Card, Form, Input, Button, Row, Col, Badge, Spin, Divider, Switch, Typography } from 'antd';
import { BankOutlined, EnvironmentOutlined, PhoneOutlined, MailOutlined, SettingOutlined, RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common';
import { toast } from 'react-toastify';
import { useZaloConfig, useSaveZaloConfig } from '@/features/zalo/hooks';

const cardStyle: React.CSSProperties = {
  borderRadius: 12,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};

/* ---- Company Info Tab ---- */
const CompanyInfoTab: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card style={cardStyle}>
      <Form layout="vertical" initialValues={{
        name: 'CÔNG TY TNHH TECHLA AI',
        address: 'Tầng 8, Tòa Licogi, số 164 Khuất Duy Tiến, Hà Nội',
        phone: '0868287651',
        email: 'admin@techlaai.com',
      }} onFinish={(values) => {
        localStorage.setItem('company_info', JSON.stringify(values));
        toast.success(t('common.save') + ' OK');
      }}>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item label={t('settings.companyName')} name="name">
              <Input prefix={<BankOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('settings.address')} name="address">
              <Input prefix={<EnvironmentOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('settings.phone')} name="phone">
              <Input prefix={<PhoneOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('settings.email')} name="email">
              <Input prefix={<MailOutlined />} style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" htmlType="submit" style={{ borderRadius: 8 }}>{t('settings.saveInfo')}</Button>
      </Form>
    </Card>
  );
};

/* ---- Zalo API Config Tab ---- */
const ApiConfigItem: React.FC<{ name: string; label: string; urlField: string; tokenField: string }> = ({ name, label, urlField, tokenField }) => {
  const { t } = useTranslation();
  return (
    <Card size="small" title={<span style={{ color: '#1677ff', fontWeight: 600 }}>{name}</span>} style={{ ...cardStyle, marginBottom: 12 }}>
      <Form.Item name={urlField} label={`${label} URL`} rules={[{ required: true, message: t('zalo.urlRequired') }]} style={{ marginBottom: 8 }}>
        <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
      </Form.Item>
      <Form.Item name={tokenField} label="API Token" rules={[{ required: true, message: t('zalo.tokenRequired') }]} style={{ marginBottom: 0 }}>
        <Input.Password placeholder="eyJhbGci..." style={{ borderRadius: 8 }} />
      </Form.Item>
    </Card>
  );
};

const ZaloConfigTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { data: configData, isLoading } = useZaloConfig();
  const saveMutation = useSaveZaloConfig();
  const config = configData?.data;

  useEffect(() => {
    if (config) form.setFieldsValue(config);
  }, [config, form]);

  if (isLoading) return <Spin tip={t('common.loading')}><div style={{ padding: 50 }} /></Spin>;

  return (
    <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
      <Card
        title={t('zalo.apiConfig')}
        style={cardStyle}
        extra={config?.is_active
          ? <Badge status="success" text={t('zalo.connected')} />
          : <Badge status="default" text={t('zalo.notConnected')} />
        }
      >
        <ApiConfigItem name="FUNC_GET_THREADS" label="Get Threads" urlField="get_threads_url" tokenField="get_threads_token" />
        <ApiConfigItem name="FUNC_GET_MESSAGES" label="Get Messages" urlField="get_messages_url" tokenField="get_messages_token" />
        <ApiConfigItem name="GET_GROUP_INFO" label="Group Info" urlField="get_group_info_url" tokenField="get_group_info_token" />
        <ApiConfigItem name="GET_USER_INFO_V2" label="User Info" urlField="get_user_info_url" tokenField="get_user_info_token" />

        <Divider />

        {/* Send / Reply / Typing API for auto-reply */}
        <Card
          size="small"
          title={<span style={{ color: '#1677ff', fontWeight: 600 }}>USER_SEND_MESSAGE</span>}
          style={{ ...cardStyle, marginBottom: 12 }}
        >
          <Form.Item name="send_message_url" label={t('zalo.sendMessageUrl')} style={{ marginBottom: 8 }}>
            <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="send_message_token" label={t('zalo.sendMessageToken')} style={{ marginBottom: 0 }}>
            <Input.Password placeholder="eyJhbGci..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Card>

        <Card
          size="small"
          title={<span style={{ color: '#1677ff', fontWeight: 600 }}>USER_REPLY_MESSAGE</span>}
          style={{ ...cardStyle, marginBottom: 12 }}
        >
          <Form.Item name="reply_message_url" label={t('zalo.replyMessageUrl')} style={{ marginBottom: 8 }}>
            <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="reply_message_token" label={t('zalo.replyMessageToken')} style={{ marginBottom: 0 }}>
            <Input.Password placeholder="eyJhbGci..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Card>

        <Card
          size="small"
          title={<span style={{ color: '#1677ff', fontWeight: 600 }}>USER_SEND_TYPING</span>}
          style={{ ...cardStyle, marginBottom: 12 }}
        >
          <Form.Item name="send_typing_url" label={t('zalo.sendTypingUrl')} style={{ marginBottom: 8 }}>
            <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="send_typing_token" label={t('zalo.sendTypingToken')} style={{ marginBottom: 0 }}>
            <Input.Password placeholder="eyJhbGci..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Card>

        <Divider />

        {/* Auto-reply section */}
        <Card
          size="small"
          title={<span style={{ color: '#667eea', fontWeight: 600 }}><RobotOutlined style={{ marginRight: 6 }} />{t('zalo.autoReply')}</span>}
          style={{ ...cardStyle, marginBottom: 12 }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="auto_reply_enabled"
                label={t('zalo.autoReplyEnabled')}
                valuePropName="checked"
                style={{ marginBottom: 8 }}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="auto_reply_off_hours_only"
                label={t('zalo.autoReplyOffHoursOnly')}
                valuePropName="checked"
                style={{ marginBottom: 8 }}
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="auto_reply_prompt" label={t('zalo.autoReplyPrompt')} style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={4}
              placeholder={t('zalo.autoReplyPromptPlaceholder')}
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            {t('zalo.autoReplyHint')}
          </Typography.Text>
        </Card>

        <Divider />
        <Button type="primary" htmlType="submit" loading={saveMutation.isPending} style={{ borderRadius: 8 }}>
          {t('zalo.saveConfig')}
        </Button>
      </Card>
    </Form>
  );
};

/* ---- Main Settings Page ---- */
const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const tabItems = [
    { key: 'company', label: <span><BankOutlined /> {t('settings.companyInfo')}</span>, children: <CompanyInfoTab /> },
    { key: 'zalo-config', label: <span><SettingOutlined /> {t('zalo.apiConfig')}</span>, children: <ZaloConfigTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ borderRadius: 12 }}>
        <PageHeader title={t('settings.title')} />
        <Tabs items={tabItems} defaultActiveKey="company" />
      </Card>
    </div>
  );
};

export default SettingsPage;
