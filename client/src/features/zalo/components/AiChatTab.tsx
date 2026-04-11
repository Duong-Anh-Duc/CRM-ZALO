import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Card, Spin, Typography, Row, Col, Modal, Form, Space } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined, ThunderboltOutlined, FileTextOutlined, ShoppingCartOutlined, QuestionCircleOutlined, BulbOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { zaloApi } from '../api';
import { useZaloAiChat, useAiTrainingList, useCreateAiTraining, useRemoveAiTraining } from '../hooks';

const { Text } = Typography;

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const AiChatTab: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState('');
  const { data: trainingData } = useAiTrainingList();
  const createTraining = useCreateAiTraining();
  const removeTraining = useRemoveAiTraining();
  const [trainingForm] = Form.useForm();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = useZaloAiChat();
  const [trainingOpen, setTrainingOpen] = useState(false);

  const QUICK_QUESTIONS = [
    { icon: <ShoppingCartOutlined />, label: t('zalo.newOrders'), question: 'Có tin nhắn nào đặt hàng hoặc hỏi mua sản phẩm không?' },
    { icon: <FileTextOutlined />, label: t('zalo.summaryToday'), question: 'Tóm tắt tất cả tin nhắn Zalo hôm nay' },
    { icon: <QuestionCircleOutlined />, label: t('zalo.needsReply'), question: 'Tin nhắn nào từ khách hàng chưa được trả lời và cần phản hồi gấp?' },
    { icon: <ThunderboltOutlined />, label: t('zalo.analyze'), question: 'Phân tích xu hướng: khách hàng đang quan tâm sản phẩm gì nhiều nhất?' },
  ];


  // Load chat history from DB on mount
  useEffect(() => {
    if (!historyLoaded) {
      zaloApi.getChatHistory().then((res) => {
        const history = (res.data?.data || []).map((m: any) => ({
          role: m.role as 'user' | 'ai',
          content: m.content,
          timestamp: new Date(m.created_at),
        }));
        if (history.length > 0) setMessages(history);
        setHistoryLoaded(true);
      }).catch(() => setHistoryLoaded(true));
    }
  }, [historyLoaded]);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const trainingEntries = (trainingData?.data || []) as any[];

  const sendMessage = (question: string) => {
    if (!question.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: question, timestamp: new Date() }]);
    setInput('');

    chatMutation.mutate(question, {
      onSuccess: (res: any) => {
        setMessages((prev) => [...prev, { role: 'ai', content: res.data?.answer || t('zalo.noAiResponse'), timestamp: new Date() }]);
      },
      onError: () => {
        setMessages((prev) => [...prev, { role: 'ai', content: t('zalo.aiConnectionError'), timestamp: new Date() }]);
      },
    });
  };


  return (
    <>
    <Row gutter={16}>
      {/* AI Chat */}
      <Col xs={24}>
        <Card
          size="small"
          title={<span><RobotOutlined style={{ color: '#667eea', marginRight: 8 }} />{t('zalo.aiAssistant')}</span>}
          extra={
            <Space size={4}>
              <Button size="small" type="text" icon={<BulbOutlined />} onClick={() => setTrainingOpen(true)} style={{ borderRadius: 8, color: '#faad14' }}>
                {t('zalo.trainAiAgent')}
              </Button>
              {messages.length > 0 && (
                <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => { setMessages([]); zaloApi.clearChatHistory(); }} style={{ borderRadius: 8, color: '#999' }}>
                  {t('zalo.clearChat')}
                </Button>
              )}
            </Space>
          }
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Quick questions */}
          {messages.length === 0 && (
            <div style={{ padding: '20px 0' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{t('zalo.quickAsk')}</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_QUESTIONS.map((q, i) => (
                  <Button
                    key={i}
                    icon={q.icon}
                    onClick={() => sendMessage(q.question)}
                    style={{ borderRadius: 20, fontSize: 13 }}
                  >
                    {q.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div style={{ height: 'min(420px, 55vh)', overflowY: 'auto', padding: '8px 0' }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                  padding: '0 4px',
                }}
              >
                {msg.role === 'ai' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: 16, background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0,
                  }}>
                    <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? '#667eea' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#000',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: 16, background: '#e6f4ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0,
                  }}>
                    <UserOutlined style={{ color: '#667eea', fontSize: 14 }} />
                  </div>
                )}
              </div>
            ))}
            {chatMutation.isPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
                </div>
                <Spin size="small" /> <Text type="secondary">{t('zalo.aiAnalyzing')}</Text>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={() => sendMessage(input)}
              placeholder={t('zalo.askAiPlaceholder')}
              disabled={chatMutation.isPending}
              style={{ borderRadius: 20 }}
              size="large"
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => sendMessage(input)}
              loading={chatMutation.isPending}
              style={{ borderRadius: 20, background: '#667eea', borderColor: '#667eea' }}
              size="large"
            />
          </div>
        </Card>
      </Col>


    </Row>

    {/* Training Modal - simple text input */}
    <Modal
      open={trainingOpen}
      onCancel={() => setTrainingOpen(false)}
      footer={null}
      width={window.innerWidth < 640 ? '95vw' : 500}
      title={<span><BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />{t('zalo.trainAiAgent')}</span>}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        Nhập kiến thức để AI học. Ví dụ: "Khách hỏi chai 5 lít tức là can HDPE 5L", "Giá sỉ từ 500 cái trở lên"...
      </Text>

      <Form form={trainingForm} onFinish={(v) => {
        createTraining.mutate(
          { category: 'BUSINESS_RULE', title: (v.text || '').substring(0, 50), content: v.text },
          { onSuccess: () => trainingForm.resetFields() },
        );
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="text" style={{ flex: 1, marginBottom: 0 }} rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={2} placeholder="Nhập kiến thức cho AI..." style={{ borderRadius: 8 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createTraining.isPending} style={{ borderRadius: 8, height: 'auto' }}>
            {t('common.add')}
          </Button>
        </div>
      </Form>

      {trainingEntries.length > 0 && (
        <div style={{ marginTop: 16, maxHeight: 250, overflowY: 'auto' }}>
          {trainingEntries.map((e: any) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <Text style={{ flex: 1, fontSize: 13 }}>{e.content || e.title}</Text>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTraining.mutate(e.id)} />
            </div>
          ))}
        </div>
      )}
    </Modal>
    </>
  );
};

export default AiChatTab;
