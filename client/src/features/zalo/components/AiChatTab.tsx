import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Card, Spin, Typography, Tag, Empty, Row, Col, Divider, Segmented, Collapse, Form } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined, ThunderboltOutlined, FileTextOutlined, ShoppingCartOutlined, QuestionCircleOutlined, SyncOutlined, BulbOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { zaloApi } from '../api';
import { useZaloAiChat, useZaloSyncMessages, useAiTrainingList, useCreateAiTraining, useRemoveAiTraining } from '../hooks';

const { Text, Paragraph } = Typography;

const PERIOD_OPTIONS = [
  { label: 'Hôm nay', value: 'today' },
  { label: '3 ngày', value: '3d' },
  { label: '7 ngày', value: '7d' },
  { label: '30 ngày', value: '30d' },
  { label: 'Tất cả', value: 'all' },
];

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

const QUICK_QUESTIONS = [
  { icon: <ShoppingCartOutlined />, label: 'Đơn hàng mới', question: 'Có tin nhắn nào đặt hàng hoặc hỏi mua sản phẩm không?' },
  { icon: <FileTextOutlined />, label: 'Tóm tắt hôm nay', question: 'Tóm tắt tất cả tin nhắn Zalo hôm nay' },
  { icon: <QuestionCircleOutlined />, label: 'Cần trả lời', question: 'Tin nhắn nào từ khách hàng chưa được trả lời và cần phản hồi gấp?' },
  { icon: <ThunderboltOutlined />, label: 'Phân tích', question: 'Phân tích xu hướng: khách hàng đang quan tâm sản phẩm gì nhiều nhất?' },
];

const AiChatTab: React.FC = () => {
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
        setMessages((prev) => [...prev, { role: 'ai', content: res.data?.answer || 'Không có phản hồi.', timestamp: new Date() }]);
      },
      onError: () => {
        setMessages((prev) => [...prev, { role: 'ai', content: 'Lỗi kết nối AI. Vui lòng thử lại.', timestamp: new Date() }]);
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
      setSummaryData({ error: 'Không thể tải tóm tắt.' });
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
            <Text type="secondary">AI phân tích dựa trên tin nhắn đã đồng bộ vào DB. Nhấn "Đồng bộ" để cập nhật tin nhắn mới nhất từ Zalo.</Text>
            <Button
              icon={<SyncOutlined spin={syncMutation.isPending} />}
              onClick={() => syncMutation.mutate()}
              loading={syncMutation.isPending}
              style={{ borderRadius: 8 }}
            >
              Đồng bộ tin nhắn
            </Button>
          </div>
        </Card>
      </Col>

      {/* AI Chat */}
      <Col xs={24} md={14}>
        <Card
          size="small"
          title={<span><RobotOutlined style={{ color: '#667eea', marginRight: 8 }} />AI Assistant - Zalo</span>}
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          {/* Quick questions */}
          {messages.length === 0 && (
            <div style={{ padding: '20px 0' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Hỏi nhanh:</Text>
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
                <Spin size="small" /> <Text type="secondary">Đang phân tích...</Text>
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
              placeholder="Hỏi AI về tin nhắn Zalo..."
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
          title={<span><ThunderboltOutlined style={{ color: '#faad14', marginRight: 8 }} />Tóm tắt AI</span>}
          extra={<Button size="small" onClick={() => loadSummary()} loading={summaryLoading} style={{ borderRadius: 8 }}>Phân tích</Button>}
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
              <div style={{ textAlign: 'center', padding: 60 }}><Spin tip="AI đang phân tích..." /></div>
            ) : !summaryData ? (
              <Empty description={`Nhấn Phân tích để AI tóm tắt tin nhắn ${summaryPeriod === 'today' ? 'hôm nay' : summaryPeriod === 'all' ? 'tất cả' : summaryPeriod.replace('d', ' ngày qua')}`} />
            ) : summaryData.error ? (
              <Text type="danger">{summaryData.error}</Text>
            ) : (
              <>
                {summaryData.summary && (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ display: 'block', marginBottom: 4 }}>Tổng quan</Text>
                    <Paragraph style={{ margin: 0, background: '#f6f8fa', padding: 12, borderRadius: 8 }}>
                      {summaryData.summary}
                    </Paragraph>
                  </div>
                )}

                {summaryData.potential_orders?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="green">Đơn hàng tiềm năng ({summaryData.potential_orders.length})</Tag>
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
                    <Tag color="blue">Yêu cầu báo giá ({summaryData.quote_requests.length})</Tag>
                    {summaryData.quote_requests.map((q: any, i: number) => (
                      <div key={i} style={{ background: '#e6f7ff', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{q.customer}</Text>: {q.products}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.issues?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="red">Vấn đề ({summaryData.issues.length})</Tag>
                    {summaryData.issues.map((iss: any, i: number) => (
                      <div key={i} style={{ background: '#fff2f0', padding: 8, borderRadius: 8, marginTop: 6, fontSize: 13 }}>
                        <Text strong>{iss.customer}</Text>: {iss.issue}
                      </div>
                    ))}
                  </div>
                )}

                {summaryData.needs_reply?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="orange">Cần trả lời ({summaryData.needs_reply.length})</Tag>
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
                      Đã phân tích: {summaryData.stats.total_messages || 0} tin nhắn
                      ({summaryData.stats.incoming || 0} nhận / {summaryData.stats.outgoing || 0} gửi)
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
              <span><BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />Huấn luyện AI Agent ({trainingEntries.length} kiến thức)</span>
            ),
            children: (
              <div>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Thêm kiến thức để AI ngày càng thông minh hơn. AI sẽ học từ tất cả dữ liệu bên dưới.
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
                        <Form.Item name="category" label="Loại" rules={[{ required: true, message: 'Chọn loại' }]}>
                          <Input.TextArea rows={1} style={{ borderRadius: 8 }} placeholder="Chọn bên dưới" disabled />
                        </Form.Item>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: -12, marginBottom: 12 }}>
                          {[
                            { key: 'PRODUCT_ALIAS', label: 'Tên SP khác', color: 'blue' },
                            { key: 'ORDER_EXAMPLE', label: 'Ví dụ đơn hàng', color: 'green' },
                            { key: 'CORRECTION', label: 'Sửa lỗi AI', color: 'red' },
                            { key: 'BUSINESS_RULE', label: 'Quy tắc KD', color: 'orange' },
                            { key: 'CUSTOMER_INFO', label: 'Thông tin KH', color: 'purple' },
                          ].map((c) => (
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
                        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
                          <Input placeholder='VD: "chai nước suối" = chai PET 500ml' style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={9}>
                        <Form.Item name="content" label="Nội dung chi tiết" rules={[{ required: true, message: 'Nhập nội dung' }]}>
                          <Input.TextArea rows={1} placeholder="VD: Khi khách nói chai nước suối, hiểu là sản phẩm chai PET 500ml, SKU: PLB-PET-2026-001" style={{ borderRadius: 8 }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={3} style={{ display: 'flex', alignItems: 'end', paddingBottom: 24 }}>
                        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createTraining.isPending} block style={{ borderRadius: 8 }}>
                          Thêm
                        </Button>
                      </Col>
                    </Row>
                  </Form>
                </Card>

                {/* Existing entries */}
                {trainingEntries.length === 0 ? (
                  <Empty description="Chưa có kiến thức nào. Thêm để AI thông minh hơn!" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {trainingEntries.map((e: any) => {
                      const colors: Record<string, string> = { PRODUCT_ALIAS: 'blue', ORDER_EXAMPLE: 'green', CORRECTION: 'red', BUSINESS_RULE: 'orange', CUSTOMER_INFO: 'purple' };
                      const labels: Record<string, string> = { PRODUCT_ALIAS: 'Tên SP khác', ORDER_EXAMPLE: 'Ví dụ đơn hàng', CORRECTION: 'Sửa lỗi AI', BUSINESS_RULE: 'Quy tắc KD', CUSTOMER_INFO: 'Thông tin KH' };
                      return (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                          <Tag color={colors[e.category] || 'default'} style={{ borderRadius: 6, margin: 0 }}>{labels[e.category] || e.category}</Tag>
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
