import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Spin, Typography, Tooltip, theme } from 'antd';
import { SendOutlined, CloseOutlined, MinusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import apiClient from '@/lib/api-client';
import chatbotIcon from '/chatbot.png';

const { Text } = Typography;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'packflow_chatbot_history';

const Chatbot: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();

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
            background: token.colorBgContainer, borderRadius: 20, padding: '8px 16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.2s', minWidth: 200, border: `1px solid ${token.colorBorderSecondary}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(22,119,255,0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)'; }}
        >
          <Text style={{ fontSize: 13, color: token.colorPrimary, fontWeight: 500, opacity: hintFade ? 1 : 0, transition: 'opacity 0.3s ease' }}>
            {hints[hintIndex]}
          </Text>
        </div>
        <div
          onClick={() => setOpen(true)}
          style={{
            width: 56, height: 56, borderRadius: '50%', cursor: 'pointer',
            background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
            boxShadow: '0 4px 20px rgba(22,119,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(22,119,255,0.5)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(22,119,255,0.4)'; }}
        >
          <img src={chatbotIcon} alt="Aura" style={{ width: 34, height: 34, borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      width: 400, height: 560, borderRadius: 20,
      boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`,
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
        padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: 72, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
          <img src={chatbotIcon} alt="Aura" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0 }} />
          <div>
            <Text strong style={{ color: '#fff', fontSize: 14, display: 'block', lineHeight: 1.2 }}>{t('chatbot.name')}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#52c41a', flexShrink: 0 }} />
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{t('chatbot.subtitle')}</Text>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title={t('chatbot.clearHistory')}>
            <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: 'rgba(255,255,255,0.7)' }} onClick={clearHistory} />
          </Tooltip>
          <Button type="text" size="small" icon={<MinusOutlined />} style={{ color: '#fff' }} onClick={() => setOpen(false)} />
          <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: '#fff' }} onClick={() => setOpen(false)} />
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        background: token.colorBgLayout,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
            {msg.role === 'assistant' && (
              <img src={chatbotIcon} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
            )}
            <div style={{
              maxWidth: '80%', padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)'
                : token.colorBgContainer,
              color: msg.role === 'user' ? '#fff' : token.colorText,
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: msg.role === 'user' ? '0 2px 8px rgba(22,119,255,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
              wordBreak: 'break-word',
              border: msg.role === 'assistant' ? `1px solid ${token.colorBorderSecondary}` : 'none',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {showSuggestions && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {suggestions.map((s, i) => (
              <Button key={i} size="small"
                style={{ borderRadius: 16, fontSize: 12, color: token.colorPrimary, borderColor: token.colorPrimary, background: token.colorBgContainer }}
                onClick={() => handleSend(s)}>{s}</Button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <img src={chatbotIcon} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{
              padding: '10px 16px', background: token.colorBgContainer, borderRadius: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${token.colorBorderSecondary}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>{t('chatbot.searching')}</Text>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 14px', display: 'flex', gap: 8,
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}>
        <Input
          value={input} onChange={(e) => setInput(e.target.value)}
          onPressEnter={() => handleSend()}
          placeholder={t('chatbot.placeholder')}
          style={{ borderRadius: 20, fontSize: 13, padding: '6px 16px' }}
          disabled={loading}
        />
        <Button type="primary" shape="circle" icon={<SendOutlined />} onClick={() => handleSend()} loading={loading}
          style={{ flexShrink: 0, boxShadow: '0 2px 8px rgba(22,119,255,0.3)' }} />
      </div>
    </div>
  );
};

export default Chatbot;
