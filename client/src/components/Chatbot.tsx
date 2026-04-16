import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Spin, Typography, Tooltip } from 'antd';
import { RobotOutlined, SendOutlined, CloseOutlined, MinusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/api-client';

const { Text } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'packflow_chatbot_history';

const Chatbot: React.FC = () => {
  const { t } = useTranslation();

  const welcomeMsg: Message = { role: 'assistant', content: t('chatbot.welcome') };

  const loadHistory = (): Message[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [welcomeMsg];
  };

  const hints = [
    t('chatbot.hint1'), t('chatbot.hint2'), t('chatbot.hint3'),
    t('chatbot.hint4'), t('chatbot.hint5'), t('chatbot.hint6'), t('chatbot.hint7'),
  ];

  const suggestions = [
    t('chatbot.suggestion1'), t('chatbot.suggestion2'), t('chatbot.suggestion3'),
    t('chatbot.suggestion4'), t('chatbot.suggestion5'),
  ];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [hintFade, setHintFade] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch { /* */ }
  }, [messages]);

  useEffect(() => {
    if (open) return;
    const interval = setInterval(() => {
      setHintFade(false);
      setTimeout(() => {
        setHintIndex((prev) => (prev + 1) % hints.length);
        setHintFade(true);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [open, hints.length]);

  const handleSend = async (text?: string) => {
    const question = (text || input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/chatbot/chat', { question, history: messages.slice(-10) });
      const answer = res.data?.data?.answer || t('chatbot.errorDefault');
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chatbot.errorConnection') }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([welcomeMsg]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const showSuggestions = messages.length <= 1;

  if (!open) {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          onClick={() => setOpen(true)}
          style={{
            background: '#fff', borderRadius: 20, padding: '8px 16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'box-shadow 0.2s', minWidth: 200,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,119,255,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'; }}
        >
          <Text style={{ fontSize: 13, color: '#1677ff', fontWeight: 500, opacity: hintFade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            {hints[hintIndex]}
          </Text>
        </div>
        <Button type="primary" shape="circle" size="large" icon={<RobotOutlined style={{ fontSize: 24 }} />} onClick={() => setOpen(true)}
          style={{ width: 56, height: 56, background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', boxShadow: '0 4px 16px rgba(22,119,255,0.4)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 400, height: 550, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RobotOutlined style={{ fontSize: 20, color: '#fff' }} />
          </div>
          <div>
            <Text strong style={{ color: '#fff', fontSize: 14, display: 'block', lineHeight: 1.3 }}>{t('chatbot.name')}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{t('chatbot.subtitle')}</Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title={t('chatbot.clearHistory')}><Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: 'rgba(255,255,255,0.7)' }} onClick={clearHistory} /></Tooltip>
          <Button type="text" size="small" icon={<MinusOutlined />} style={{ color: '#fff' }} onClick={() => setOpen(false)} />
          <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: '#fff' }} onClick={() => setOpen(false)} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f5f5f5' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? '#1677ff' : '#fff',
              color: msg.role === 'user' ? '#fff' : '#333',
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {showSuggestions && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {suggestions.map((s, i) => (
              <Button key={i} size="small" style={{ borderRadius: 16, fontSize: 12, color: '#1677ff', borderColor: '#1677ff' }} onClick={() => handleSend(s)}>{s}</Button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '8px 16px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}>
              <Spin size="small" /> <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>{t('chatbot.searching')}</Text>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, background: '#fff' }}>
        <Input value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={() => handleSend()} placeholder={t('chatbot.placeholder')} style={{ borderRadius: 20, fontSize: 13 }} disabled={loading} />
        <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={() => handleSend()} loading={loading} style={{ flexShrink: 0 }} />
      </div>
    </div>
  );
};

export default Chatbot;
