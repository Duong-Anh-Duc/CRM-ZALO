import React, { useState, useRef, useEffect } from 'react';
import { Tabs, Card, Form, Input, Button, Row, Col, Statistic, Space, Typography, Badge, Empty, Spin, Avatar, Divider } from 'antd';
import { SettingOutlined, MessageOutlined, WechatOutlined, ArrowLeftOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useZaloConfig, useSaveZaloConfig, useZaloThreads, useZaloThreadMessages } from '../hooks';
import AiChatTab from '../components/AiChatTab';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);

const { Text } = Typography;
const cardStyle: React.CSSProperties = { borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' };

// ── API Config Item ──
const ApiConfigItem: React.FC<{ name: string; label: string; urlField: string; tokenField: string }> = ({ name, label, urlField, tokenField }) => {
  const { t } = useTranslation();
  return (
    <Card size="small" title={<Text strong style={{ color: '#1677ff' }}>{name}</Text>} style={{ ...cardStyle, marginBottom: 12 }}>
      <Form.Item name={urlField} label={`${label} URL`} rules={[{ required: true, message: t('zalo.urlRequired') }]} style={{ marginBottom: 8 }}>
        <Input placeholder="https://public-api.func.vn/functions/xxxxxx" style={{ borderRadius: 8 }} />
      </Form.Item>
      <Form.Item name={tokenField} label="API Token" rules={[{ required: true, message: t('zalo.tokenRequired') }]} style={{ marginBottom: 0 }}>
        <Input.Password placeholder="eyJhbGci..." style={{ borderRadius: 8 }} />
      </Form.Item>
    </Card>
  );
};

// ── Config Tab ──
const ConfigTab: React.FC = () => {
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
        <Button type="primary" htmlType="submit" loading={saveMutation.isPending} style={{ borderRadius: 8 }}>
          {t('zalo.saveConfig')}
        </Button>
      </Card>

    </Form>
  );
};

// ── Chat Tab (Zalo mini) ──
const ChatTab: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [chatType, setChatType] = useState<'personal' | 'group'>('personal');
  const [selected, setSelected] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: threadsData, isLoading: threadsLoading } = useZaloThreads(chatType);
  const rawThreads = (threadsData?.data ?? []) as any[];

  const { data: msgData, isLoading: msgLoading } = useZaloThreadMessages(selected?.pid);
  const messages = (msgData?.data ?? []) as any[];

  // Patch sidebar: update last_content from loaded messages
  const threads = rawThreads.map((th: any) => {
    if (selected?.pid === th.pid && messages.length > 0) {
      const newest = messages[0];
      const lastText = newest.text || newest.content || (newest.type === 'STICKER' ? '[Sticker]' : (newest.type === 'ATTACHMENT' ? '[File]' : '')) || th.last_content;
      return { ...th, last_content: lastText, last_content_at: newest.sent_at ? new Date(newest.sent_at).toISOString() : newest.created_at || th.last_content_at };
    }
    return th;
  });

  // Also load ALL threads for stats (no type filter)
  const { data: allThreadsData } = useZaloThreads();
  const allThreads = (allThreadsData?.data ?? []) as any[];

  dayjs.locale(i18n.language === 'en' ? 'en' : 'vi');

  useEffect(() => {
    if (selected && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selected]);

  // Chat bubbles
  const renderChat = () => {
    const sorted = [...messages].reverse();
    return (
      <div style={{ height: 500, overflowY: 'auto', padding: '8px 0' }}>
        {msgLoading ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> :
         sorted.length === 0 ? <Empty description={t('zalo.noMessages')} /> :
         sorted.map((msg: any) => {
           const senderName = msg.sender?.name || msg.origin?.dName || '';
           const senderPic = msg.sender?.picture;
           const content = msg.text || msg.content || '';
           const hasImage = msg.attachments?.length > 0 && msg.attachments[0]?.type === 'image';
           const hasSticker = msg.type === 'STICKER' || msg.origin?.msgType === 'chat.sticker';
           const stickerUrl = hasSticker ? (msg.origin?.content?.href || msg.origin?.content?.thumb || msg.attachments?.[0]?.url) : null;
           const hasFile = msg.type === 'ATTACHMENT' && msg.attachments?.length > 0 && msg.attachments[0]?.type !== 'image';
           const isMe = msg.sender_pid === `zu${selected?.origin_id}` && selected?.type === 'PRIVATE_MESSAGING';
           const time = msg.sent_at ? dayjs(msg.sent_at) : dayjs(msg.created_at);
           const hasPic = senderPic && !senderPic.includes('no-picture');

           // Deleted message
           if (msg.is_deleted) {
             return (
               <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 6, padding: '0 8px' }}>
                 {!isMe && <Avatar size={30} src={hasPic ? senderPic : undefined} icon={!hasPic ? <UserOutlined /> : undefined} style={{ marginRight: 6, flexShrink: 0, marginTop: 4, opacity: 0.4 }} />}
                 <div style={{ padding: '6px 12px', border: '1px dashed #d9d9d9', borderRadius: 14, color: '#bfbfbf', fontStyle: 'italic', fontSize: 13 }}>
                   {t('zalo.messageDeleted')}
                 </div>
               </div>
             );
           }

           // Skip completely empty messages
           if (!content && !hasImage && !hasSticker && !hasFile) return null;

           return (
             <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 6, padding: '0 8px' }}>
               {!isMe && <Avatar size={30} src={hasPic ? senderPic : undefined} icon={!hasPic ? <UserOutlined /> : undefined} style={{ marginRight: 6, flexShrink: 0, marginTop: 4 }} />}
               <div style={{ maxWidth: '70%' }}>
                 {!isMe && selected?.type === 'GROUP_MESSAGING' && (
                   <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 1 }}>{senderName}</Text>
                 )}
                 {hasImage && <img src={msg.attachments[0].url} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 2 }} />}
                 {hasSticker && stickerUrl && <img src={stickerUrl} alt="sticker" style={{ width: 100, height: 100, objectFit: 'contain' }} />}
                 {hasSticker && !stickerUrl && <Text type="secondary">[Sticker]</Text>}
                 {hasFile && <Text type="secondary">[File]</Text>}
                 {content && !hasSticker && (
                   <div style={{
                     background: isMe ? '#1677ff' : '#f0f0f0', color: isMe ? '#fff' : '#000',
                     padding: '6px 12px', borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                     fontSize: 14, lineHeight: 1.4, wordBreak: 'break-word',
                   }}>{content}</div>
                 )}
                 <Text type="secondary" style={{ fontSize: 10, textAlign: isMe ? 'right' : 'left', display: 'block', marginTop: 1 }}>
                   {time.format('HH:mm')}
                 </Text>
               </div>
             </div>
           );
         })}
        <div ref={chatEndRef} />
      </div>
    );
  };

  return (
    <div>
      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card style={cardStyle} size="small">
            <Statistic title={t('zalo.totalConversations')} value={allThreads.length} prefix={<WechatOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card style={cardStyle} size="small">
            <Statistic title={t('zalo.personal')} value={allThreads.filter((th: any) => th.type === 'PRIVATE_MESSAGING' && th.last_content).length} prefix={<UserOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card style={cardStyle} size="small">
            <Statistic title={t('zalo.group')} value={allThreads.filter((th: any) => th.type === 'GROUP_MESSAGING').length} prefix={<WechatOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        {/* Sidebar */}
        <Col xs={24} md={8}>
          <Card
            size="small"
            style={{ ...cardStyle, marginBottom: 12 }}
            title={
              <Space size={4}>
                <Button type={chatType === 'personal' ? 'primary' : 'default'} size="small" icon={<UserOutlined />}
                  onClick={() => { setChatType('personal'); setSelected(null); }} style={{ borderRadius: 8 }}>
                  {t('zalo.personal')}
                </Button>
                <Button type={chatType === 'group' ? 'primary' : 'default'} size="small" icon={<WechatOutlined />}
                  onClick={() => { setChatType('group'); setSelected(null); }} style={{ borderRadius: 8 }}>
                  {t('zalo.group')}
                </Button>
              </Space>
            }
          >
            <div style={{ height: 500, overflowY: 'auto' }}>
              {threadsLoading ? <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div> :
               threads.length === 0 ? <Empty description={t('zalo.noConversations')} /> :
               threads.map((thread: any) => {
                 const isGroup = thread.type === 'GROUP_MESSAGING';
                 const hasPic = thread.picture && !thread.picture.includes('no-picture');
                 const isSel = selected?.pid === thread.pid;

                 return (
                   <div key={thread.pid} onClick={() => setSelected(thread)} style={{
                     padding: '8px 10px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer',
                     background: isSel ? '#e6f4ff' : 'transparent',
                     borderLeft: isSel ? '3px solid #1677ff' : '3px solid transparent',
                   }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                       <Avatar size={36} src={hasPic ? thread.picture : undefined}
                         icon={!hasPic ? (isGroup ? <WechatOutlined /> : <UserOutlined />) : undefined}
                         style={{ flexShrink: 0, background: isGroup ? '#722ed1' : undefined }} />
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                           <Text strong ellipsis style={{ fontSize: 13 }}>{thread.name}</Text>
                           {thread.is_new && <Badge dot status="processing" />}
                         </div>
                         {thread.last_content && <Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block' }}>{thread.last_content}</Text>}
                         {thread.last_content_at && <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(thread.last_content_at).fromNow()}</Text>}
                       </div>
                     </div>
                   </div>
                 );
               })}
            </div>
          </Card>
        </Col>

        {/* Chat area */}
        <Col xs={24} md={16}>
          <Card
            size="small"
            style={cardStyle}
            title={selected ? (
              <Space>
                <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => setSelected(null)} />
                <Avatar size={28} src={selected.picture && !selected.picture.includes('no-picture') ? selected.picture : undefined} icon={<UserOutlined />} />
                <Text strong>{selected.name}</Text>
                {selected.type === 'GROUP_MESSAGING' && <Badge count="Nhóm" style={{ backgroundColor: '#722ed1' }} />}
              </Space>
            ) : t('zalo.messageHistory')}
          >
            {selected ? renderChat() : (
              <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={t('zalo.selectConversation')} />
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ── Main Page ──
const ZaloPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20 }}>{t('zalo.title')}</h2>
      <Tabs items={[
        { key: 'chat', label: <span><MessageOutlined /> {t('zalo.messages')}</span>, children: <ChatTab /> },
        { key: 'ai', label: <span><RobotOutlined /> AI Assistant</span>, children: <AiChatTab /> },
        { key: 'config', label: <span><SettingOutlined /> {t('zalo.config')}</span>, children: <ConfigTab /> },
      ]} defaultActiveKey="chat" />
    </div>
  );
};

export default ZaloPage;
