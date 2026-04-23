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
const ApiConfigItem: React.FC<{
  titleKey: string;
  code: string;
  urlField: string;
  tokenField: string;
  enabledField?: string;
  required?: boolean;
}> = ({ titleKey, code, urlField, tokenField, enabledField, required = true }) => {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ color: '#1677ff', fontWeight: 600 }}>{t(titleKey)}</span>
          <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{code}</Typography.Text>
        </div>
      }
      extra={
        enabledField ? (
          <Form.Item name={enabledField} valuePropName="checked" noStyle>
            <Switch checkedChildren={t('zalo.actionEnabled')} unCheckedChildren={t('zalo.actionDisabled')} />
          </Form.Item>
        ) : null
      }
      style={{ ...cardStyle, marginBottom: 12 }}
    >
      <Form.Item
        name={urlField}
        label="URL"
        rules={required ? [{ required: true, message: t('zalo.urlRequired') }] : undefined}
        style={{ marginBottom: 8 }}
      >
        <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
      </Form.Item>
      <Form.Item
        name={tokenField}
        label={t('zalo.apiToken')}
        rules={required ? [{ required: true, message: t('zalo.tokenRequired') }] : undefined}
        style={{ marginBottom: 0 }}
      >
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
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>{t('zalo.sectionRead')}</Typography.Title>
        <ApiConfigItem titleKey="zalo.api.getThreads" code="FUNC_GET_THREADS" urlField="get_threads_url" tokenField="get_threads_token" />
        <ApiConfigItem titleKey="zalo.api.getMessages" code="FUNC_GET_MESSAGES" urlField="get_messages_url" tokenField="get_messages_token" />
        <ApiConfigItem titleKey="zalo.api.getGroupInfo" code="GET_GROUP_INFO" urlField="get_group_info_url" tokenField="get_group_info_token" />
        <ApiConfigItem titleKey="zalo.api.getUserInfo" code="GET_USER_INFO_V2" urlField="get_user_info_url" tokenField="get_user_info_token" />

        <Divider />

        {/* Send / Reply / Typing / Images API (user DM) */}
        <Typography.Title level={5} style={{ marginBottom: 12 }}>{t('zalo.sectionUser')}</Typography.Title>
        <ApiConfigItem
          titleKey="zalo.api.userSendMessage" code="USER_SEND_MESSAGE"
          urlField="send_message_url" tokenField="send_message_token"
          enabledField="send_message_enabled" required={false}
        />
        <ApiConfigItem
          titleKey="zalo.api.userReplyMessage" code="USER_REPLY_MESSAGE"
          urlField="reply_message_url" tokenField="reply_message_token"
          enabledField="reply_message_enabled" required={false}
        />
        <ApiConfigItem
          titleKey="zalo.api.userSendTyping" code="USER_SEND_TYPING"
          urlField="send_typing_url" tokenField="send_typing_token"
          enabledField="send_typing_enabled" required={false}
        />
        <ApiConfigItem
          titleKey="zalo.api.userSendImages" code="USER_SEND_IMAGES"
          urlField="send_images_url" tokenField="send_images_token"
          enabledField="send_images_enabled" required={false}
        />

        <Divider />

        {/* Group APIs */}
        <Typography.Title level={5} style={{ marginBottom: 12 }}>{t('zalo.sectionGroup')}</Typography.Title>
        <ApiConfigItem
          titleKey="zalo.api.groupSendMessage" code="GROUP_SEND_MESSAGE"
          urlField="group_send_message_url" tokenField="group_send_message_token"
          enabledField="group_send_message_enabled" required={false}
        />
        <ApiConfigItem
          titleKey="zalo.api.groupSendImage" code="GROUP_SEND_IMAGE"
          urlField="group_send_image_url" tokenField="group_send_image_token"
          enabledField="group_send_image_enabled" required={false}
        />
        <ApiConfigItem
          titleKey="zalo.api.groupReplyMessage" code="GROUP_REPLY_MESSAGE"
          urlField="group_reply_message_url" tokenField="group_reply_message_token"
          enabledField="group_reply_message_enabled" required={false}
        />

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
