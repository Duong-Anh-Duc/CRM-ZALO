import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Card, Spin, Typography, Tag, Empty, Row, Col, Divider, Segmented, Collapse, Form } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined, ThunderboltOutlined, FileTextOutlined, ShoppingCartOutlined, QuestionCircleOutlined, SyncOutlined, BulbOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { zaloApi } from '../api';
import { useZaloAiChat, useZaloSyncMessages, useAiTrainingList, useCreateAiTraining, useRemoveAiTraining } from '../hooks';

const { Text, Paragraph } = Typography;

function periodToHours(period: string): number {
  const now = new Date();
  if (period === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.ceil((now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60)) || 1;
  }
  if (period === '3d') return 72;
  if (period === '7d') return 168;
  if (period === '30d') return 720;
  return 8760; // all = 1 year
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const AiChatTab: React.FC = () => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const syncMutation = useZaloSyncMessages();
  const { data: trainingData } = useAiTrainingList();
  const createTraining = useCreateAiTraining();
  const removeTraining = useRemoveAiTraining();
  const [trainingForm] = Form.useForm();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<string>('today');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatMutation = useZaloAiChat();

  const PERIOD_OPTIONS = [
    { label: t('zalo.today'), value: 'today' },
    { label: t('zalo.days3'), value: '3d' },
    { label: t('zalo.days7'), value: '7d' },
    { label: t('zalo.days30'), value: '30d' },
    { label: t('zalo.allTime'), value: 'all' },
  ];

  const QUICK_QUESTIONS = [
    { icon: <ShoppingCartOutlined />, label: t('zalo.newOrders'), question: 'Có tin nhắn nào đặt hàng hoặc hỏi mua sản phẩm không?' },
    { icon: <FileTextOutlined />, label: t('zalo.summaryToday'), question: 'Tóm tắt tất cả tin nhắn Zalo hôm nay' },
    { icon: <QuestionCircleOutlined />, label: t('zalo.needsReply'), question: 'Tin nhắn nào từ khách hàng chưa được trả lời và cần phản hồi gấp?' },
    { icon: <ThunderboltOutlined />, label: t('zalo.analyze'), question: 'Phân tích xu hướng: khách hàng đang quan tâm sản phẩm gì nhiều nhất?' },
  ];

  const TRAINING_CATEGORIES = [
    { key: 'PRODUCT_ALIAS', label: t('zalo.productAlias'), color: 'blue' },
    { key: 'ORDER_EXAMPLE', label: t('zalo.orderExample'), color: 'green' },
    { key: 'CORRECTION', label: t('zalo.aiCorrection'), color: 'red' },
    { key: 'BUSINESS_RULE', label: t('zalo.businessRule'), color: 'orange' },
    { key: 'CUSTOMER_INFO', label: t('zalo.customerInfo'), color: 'purple' },
  ];

  const trainingLabels: Record<string, string> = {
    PRODUCT_ALIAS: t('zalo.productAlias'),
    ORDER_EXAMPLE: t('zalo.orderExample'),
    CORRECTION: t('zalo.aiCorrection'),
    BUSINESS_RULE: t('zalo.businessRule'),
    CUSTOMER_INFO: t('zalo.customerInfo'),
  };

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

  const loadSummary = async (period?: string) => {
    setSummaryLoading(true);
    setSummaryData(null);
    try {
      const hours = periodToHours(period || summaryPeriod);
      const res = await zaloApi.aiSummary(hours, 200);
      setSummaryData(res.data?.data);
    } catch {
      setSummaryData({ error: t('zalo.cannotLoadSummary') });
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <Row gutter={16}>
      {/* Sync banner */}
      <Col xs={24} style={{ marginBottom: 12 }}>
        <Card size="small" style={{ borderRadius: 12, background: '#f6f8fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text type="secondary">{t('zalo.syncBanner')}</Text>
            <Button
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
              style={{ borderRadius: 8 }}
            >
              {t('zalo.syncMessages')}
            </Button>
          </div>
        </Card>
      </Col>

      {/* AI Chat */}
      <Col xs={24} md={14}>
        <Card
          size="small"
          title={<span><RobotOutlined style={{ color: '#667eea', marginRight: 8 }} />{t('zalo.aiAssistant')}</span>}
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
          <div style={{ height: 420, overflowY: 'auto', padding: '8px 0' }}>
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

      {/* AI Summary */}
      <Col xs={24} md={10}>
        <Card
          size="small"
          title={<span><ThunderboltOutlined style={{ color: '#faad14', marginRight: 8 }} />{t('zalo.aiSummary')}</span>}
          extra={<Button size="small" onClick={() => loadSummary()} loading={summaryLoading} style={{ borderRadius: 8 }}>{t('zalo.analyze')}</Button>}
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Period selector */}
          <div style={{ marginBottom: 12 }}>
            <Segmented
              options={PERIOD_OPTIONS}
              value={summaryPeriod}
              onChange={(val) => { setSummaryPeriod(val as string); setSummaryData(null); }}
              size="small"
              style={{ borderRadius: 8 }}
            />
          </div>

          <div style={{ height: 460, overflowY: 'auto' }}>
            {summaryLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}><Spin tip={t('zalo.aiSummaryLoading')} /></div>
            ) : !summaryData ? (
              <Empty description={`${t('zalo.analyze')}...`} />
            ) : summaryData.error ? (
              <Text type="danger">{summaryData.error}</Text>
            ) : (
              <>
                {summaryData.summary && (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>{t('zalo.overview')}</Text>
                    <Paragraph style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8 }}>
                      {summaryData.summary}
                    </Paragraph>
                  </div>
                )}

                {summaryData.potential_orders?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="green">{t('zalo.potentialOrders')} ({summaryData.potential_orders.length})</Tag>
                    {summaryData.potential_orders.map((o: any, i: number) => (
                      <div key={i} style={{ background: '#f6ffed', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{o.customer}</Text>: {o.products} - SL: {o.quantity}
                        {o.message && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>"{o.message}"</Text>}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.quote_requests?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="blue">{t('zalo.quoteRequests')} ({summaryData.quote_requests.length})</Tag>
                    {summaryData.quote_requests.map((q: any, i: number) => (
                      <div key={i} style={{ background: '#e6f7ff', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{q.customer}</Text>: {q.products}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.issues?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="red">{t('zalo.issues')} ({summaryData.issues.length})</Tag>
                    {summaryData.issues.map((iss: any, i: number) => (
                      <div key={i} style={{ background: '#fff2f0', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{iss.customer}</Text>: {iss.issue}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.needs_reply?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="orange">{t('zalo.needsReply')} ({summaryData.needs_reply.length})</Tag>
                    {summaryData.needs_reply.map((nr: any, i: number) => (
                      <div key={i} style={{ background: '#fff7e6', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{nr.customer}</Text>: {nr.reason}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.stats && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('zalo.analyzed')}: {summaryData.stats.total_messages || 0} {t('zalo.messages_count')}
                      ({summaryData.stats.incoming || 0} {t('zalo.received')} / {summaryData.stats.outgoing || 0} {t('zalo.sent')})
                    </Text>
                  </>
                )}
              </>
            )}
          </div>
        </Card>
      </Col>

      {/* AI Training */}
      <Col xs={24} style={{ marginTop: 12 }}>
        <Collapse
          items={[{
            key: 'training',
            label: (
              <span><BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />{t('zalo.trainAiAgent')} ({trainingEntries.length} {t('zalo.knowledge')})</span>
            ),
            children: (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {t('zalo.trainDescription')}
                </Text>

                {/* Add new */}
                <Card size="small" style={{ borderRadius: 10, marginBottom: 16, border: '1px dashed #d9d9d9' }}>
                  <Form
                    form={trainingForm}
                    layout="vertical"
                    onFinish={(v) => {
                      createTraining.mutate(v, { onSuccess: () => trainingForm.resetFields() });
                    }}
                  >
                    <Row gutter={12}>
                      <Col xs={24} md={6}>
                        <Form.Item name="category" label={t('zalo.selectType')} rules={[{ required: true, message: t('zalo.selectType') }]}>
                          <Input.TextArea rows={1} style={{ borderRadius: 8 }} placeholder={t('zalo.selectType')} disabled />
                        </Form.Item>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: -12, marginBottom: 12 }}>
                          {TRAINING_CATEGORIES.map((c) => (
                            <Tag
                              key={c.key}
                              color={c.color}
                              style={{ cursor: 'pointer', borderRadius: 6 }}
                              onClick={() => trainingForm.setFieldValue('category', c.key)}
                            >
                              {c.label}
                            </Tag>
                          ))}
                        </div>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item name="title" label={t('zalo.enterTitle')} rules={[{ required: true, message: t('zalo.enterTitle') }]}>
                          <Input placeholder={t('zalo.enterTitle')} style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={9}>
                        <Form.Item name="content" label={t('zalo.enterContent')} rules={[{ required: true, message: t('zalo.enterContent') }]}>
                          <Input.TextArea rows={1} placeholder={t('zalo.enterContent')} style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={3} style={{ display: 'flex', alignItems: 'end', paddingBottom: 24 }}>
                        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createTraining.isPending} block style={{ borderRadius: 8 }}>
                          {t('common.add')}
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card>

                {/* Existing entries */}
                {trainingEntries.length === 0 ? (
                  <Empty description={t('zalo.noKnowledge')} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {trainingEntries.map((e: any) => {
                      const colors: Record<string, string> = { PRODUCT_ALIAS: 'blue', ORDER_EXAMPLE: 'green', CORRECTION: 'red', BUSINESS_RULE: 'orange', CUSTOMER_INFO: 'purple' };
                      return (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                          <Tag color={colors[e.category] || 'default'} style={{ borderRadius: 6, margin: 0 }}>{trainingLabels[e.category] || e.category}</Tag>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text strong style={{ fontSize: 13 }}>{e.title}</Text>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{e.content}</Text>
                          </div>
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeTraining.mutate(e.id)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          }]}
          style={{ borderRadius: 12, background: '#fff' }}
        />
      </Col>
    </Row>
  );
};

export default AiChatTab;
