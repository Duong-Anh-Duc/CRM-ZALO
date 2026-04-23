import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Spin, Typography, Tooltip, Popover, theme } from 'antd';
import { SendOutlined, CloseOutlined, MinusOutlined, DeleteOutlined, ArrowRightOutlined, PaperClipOutlined, AudioOutlined, SmileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import chatbotIcon from '/chatbot.png';
import { useChatAttachments } from '../hooks/useChatAttachments';
import { useDragDrop } from '../hooks/useDragDrop';
import { useSpeechToText } from '../hooks/useSpeechToText';
import EmojiPicker, { EmojiStyle, Theme as EmojiTheme } from 'emoji-picker-react';
import type { Message } from '../types/chat';
import ProductCardList, { type ProductCard } from './ProductCard';

const { Text } = Typography;

const STORAGE_KEY = 'packflow_chatbot_history';

// Parse action buttons from response: [action:/path|Label]
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ID_REQUIRED_PREFIXES = ['/receivables/customer/', '/payables/supplier/', '/sales-orders/', '/purchase-orders/', '/customers/', '/suppliers/', '/products/'];

function isValidActionPath(path: string): boolean {
  const needsId = ID_REQUIRED_PREFIXES.find((p) => path.startsWith(p));
  if (!needsId) return true;
  const tail = path.slice(needsId.length).split(/[/?#]/)[0];
  if (!tail) return false;
  return UUID_RE.test(tail);
}

function parseActions(text: string): { cleanText: string; actions: { path: string; label: string }[]; productCards: ProductCard[] } {
  const actions: { path: string; label: string }[] = [];
  const productCards: ProductCard[] = [];

  // Extract <product-cards>[...]</product-cards> block (optional, non-breaking if absent)
  const cardsStripped = text.replace(/<product-cards>([\s\S]*?)<\/product-cards>/g, (_, json: string) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (c && typeof c === 'object' && typeof c.id === 'string' && typeof c.sku === 'string' && typeof c.name === 'string') {
            productCards.push(c as ProductCard);
          }
        }
      }
    } catch { /* malformed block — ignore, keep text fallback */ }
    return '';
  });

  const cleanText = cardsStripped.replace(/\[action:([^\]|]+)\|([^\]]+)\]/g, (_, path, label) => {
    const p = path.trim();
    if (isValidActionPath(p)) actions.push({ path: p, label: label.trim() });
    return '';
  }).replace(/\s*\[id:[^\]]+\]/g, '').trim();
  return { cleanText, actions, productCards };
}

const Chatbot: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const welcomeMsg: Message = { role: 'assistant', content: t('chatbot.welcome') };

  const loadHistory = (): Message[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length > 0) return parsed; }
    } catch { /* ignore */ }
    return [welcomeMsg];
  };

  const hints = [t('chatbot.hint1'), t('chatbot.hint2'), t('chatbot.hint3'), t('chatbot.hint4'), t('chatbot.hint5'), t('chatbot.hint6'), t('chatbot.hint7')];
  const suggestions = [t('chatbot.suggestion1'), t('chatbot.suggestion2'), t('chatbot.suggestion3'), t('chatbot.suggestion4'), t('chatbot.suggestion5')];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [hintFade, setHintFade] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attach = useChatAttachments();
  const dnd = useDragDrop((files) => { attach.addFiles(files); });
  const stt = useSpeechToText(i18n.language === 'en' ? 'en-US' : 'vi-VN');

  const handleMicClick = () => {
    if (stt.listening) { stt.stop(); return; }
    stt.start((finalText) => {
      setInput((prev) => (prev ? `${prev} ${finalText}` : finalText));
    });
  };

  // Paste image from clipboard (Cmd/Ctrl+V) anywhere in the chatbot while open
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      attach.addFiles(files);
    }
  }, [attach]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingText]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50))); } catch { /* */ } }, [messages]);

  useEffect(() => {
    if (open) return;
    const interval = setInterval(() => {
      setHintFade(false);
      setTimeout(() => { setHintIndex((prev) => (prev + 1) % hints.length); setHintFade(true); }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [open, hints.length]);

  const handleSend = useCallback(async (text?: string) => {
    const question = (text || input).trim();
    const outgoingAttachments = attach.pending;
    if ((!question && outgoingAttachments.length === 0) || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: question,
      attachments: outgoingAttachments.length > 0 ? outgoingAttachments : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    attach.clear();
    setLoading(true);
    setStreamingText('');

    try {
      const token = localStorage.getItem('token');
      const body = JSON.stringify({ question, history: messages.slice(-10), attachments: outgoingAttachments });
      const res = await fetch('/api/chatbot/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
      });

      if (!res.ok || !res.body) {
        const fallback = await fetch('/api/chatbot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body,
        });
        const data = await fallback.json();
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data?.answer || t('chatbot.errorDefault') }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulated += parsed.content;
                setStreamingText(accumulated);
              }
            } catch { /* skip malformed */ }
          }
        }
      }

      if (accumulated) {
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: t('chatbot.errorConnection') }]);
    } finally {
      setLoading(false);
      setStreamingText('');
    }
  }, [input, loading, messages, t, attach]);

  const clearHistory = () => { setMessages([welcomeMsg]); localStorage.removeItem(STORAGE_KEY); };
  const showSuggestions = messages.length <= 1;

  const renderAttachments = (attachments: NonNullable<Message['attachments']>) => {
    const imgs = attachments.filter((a) => !a.name || /\.(jpe?g|png|gif|webp|avif)$/i.test(a.name) || a.url);
    const n = imgs.length;
    if (n === 0) return null;

    // Messenger-style grid: 1 → full; 2 → 2 cols; 3 → 1 large + 2 half; 4+ → 2x2 grid
    const gridStyle: React.CSSProperties = { display: 'grid', gap: 2, borderRadius: 14, overflow: 'hidden' };
    if (n === 1) gridStyle.gridTemplateColumns = '1fr';
    else if (n === 2) gridStyle.gridTemplateColumns = '1fr 1fr';
    else if (n === 3) gridStyle.gridTemplateColumns = '1fr 1fr';
    else gridStyle.gridTemplateColumns = '1fr 1fr';

    const thumbBase: React.CSSProperties = {
      width: '100%', objectFit: 'cover', display: 'block',
      cursor: 'pointer', background: '#f0f0f0',
    };

    return (
      <div style={gridStyle}>
        {imgs.slice(0, 4).map((a, j) => {
          let cellStyle: React.CSSProperties = { ...thumbBase };
          if (n === 1) cellStyle = { ...cellStyle, maxHeight: 260 };
          else if (n === 2) cellStyle = { ...cellStyle, height: 140 };
          else if (n === 3 && j === 0) {
            cellStyle = { ...cellStyle, height: 220, gridColumn: 'span 2' };
          } else cellStyle = { ...cellStyle, height: n === 3 ? 110 : 130 };

          return (
            <a key={j} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative', overflow: 'hidden' }}>
              <img src={a.url} alt={a.name || ''} style={cellStyle} />
              {j === 3 && imgs.length > 4 && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 600,
                }}>
                  +{imgs.length - 4}
                </div>
              )}
            </a>
          );
        })}
      </div>
    );
  };

  const renderMessage = (msg: Message, i: number) => {
    const isUser = msg.role === 'user';
    const { cleanText, actions, productCards } = isUser
      ? { cleanText: msg.content, actions: [] as { path: string; label: string }[], productCards: [] as ProductCard[] }
      : parseActions(msg.content);
    const hasAttach = msg.attachments && msg.attachments.length > 0;

    return (
      <div key={i}>
        <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
          {!isUser && <img src={chatbotIcon} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />}
          <div style={{
            maxWidth: '78%',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            background: isUser ? 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)' : token.colorBgContainer,
            color: isUser ? '#fff' : token.colorText,
            fontSize: 13.5, lineHeight: 1.5,
            boxShadow: isUser ? '0 2px 8px rgba(22,119,255,0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
            border: !isUser ? `1px solid ${token.colorBorderSecondary}` : 'none',
            overflow: 'hidden',
          }}>
            {cleanText && (
              <div style={{
                padding: hasAttach ? '9px 13px 8px' : '9px 13px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {cleanText}
              </div>
            )}
            {hasAttach && renderAttachments(msg.attachments!)}
          </div>
        </div>
        {productCards.length > 0 && (
          <ProductCardList
            cards={productCards}
            onSelect={(id) => { navigate(`/products/${id}`); setOpen(false); }}
          />
        )}
        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: 28, flexWrap: 'wrap' }}>
            {actions.map((a, j) => (
              <Button key={j} size="small" type="link" icon={<ArrowRightOutlined />}
                style={{ borderRadius: 12, fontSize: 12, padding: '2px 10px', border: `1px solid ${token.colorPrimary}`, color: token.colorPrimary }}
                onClick={() => { navigate(a.path); setOpen(false); }}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!open) {
    return (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div onClick={() => setOpen(true)}
          style={{ background: token.colorBgContainer, borderRadius: 20, padding: '8px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', minWidth: 200, border: `1px solid ${token.colorBorderSecondary}` }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(22,119,255,0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.12)'; }}>
          <Text style={{ fontSize: 13, color: token.colorPrimary, fontWeight: 500, opacity: hintFade ? 1 : 0, transition: 'opacity 0.3s ease' }}>{hints[hintIndex]}</Text>
        </div>
        <div onClick={() => setOpen(true)}
          style={{ width: 56, height: 56, borderRadius: '50%', cursor: 'pointer', background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', boxShadow: '0 4px 20px rgba(22,119,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
          <img src={chatbotIcon} alt="Aura" style={{ width: 34, height: 34, borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  return (
    <div {...dnd.handlers} onPaste={handlePaste}
      style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, width: 400, height: 580, borderRadius: 16, boxShadow: '0 20px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
      {dnd.isDragging && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22,119,255,0.08)', border: `2px dashed ${token.colorPrimary}`, borderRadius: 16, pointerEvents: 'none' }}>
          <div style={{ padding: '12px 20px', background: token.colorBgContainer, borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PaperClipOutlined style={{ color: token.colorPrimary, fontSize: 18 }} />
            <Text style={{ color: token.colorPrimary, fontWeight: 500 }}>{t('chatbot.dropHere')}</Text>
          </div>
        </div>
      )}
      {/* Header — clean modern style */}
      <div style={{
        padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', minWidth: 0 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img src={chatbotIcon} alt="Aura" style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #e6f4ff 0%, #f5f0ff 100%)',
              padding: 4, objectFit: 'contain',
            }} />
            <div style={{
              position: 'absolute', bottom: -1, right: -1,
              width: 10, height: 10, borderRadius: '50%',
              background: '#52c41a',
              border: `2px solid ${token.colorBgContainer}`,
            }} />
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <Text strong style={{ fontSize: 14, display: 'block', lineHeight: 1.2, color: token.colorText }}>
              {t('chatbot.name')}
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 1.3, color: token.colorTextTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t('chatbot.subtitle')}
            </Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
          <Tooltip title={t('chatbot.clearHistory')}>
            <Button type="text" size="small" icon={<DeleteOutlined />} onClick={clearHistory}
              style={{ color: token.colorTextTertiary }} />
          </Tooltip>
          <Tooltip title={t('common.close') || 'Thu gọn'}>
            <Button type="text" size="small" icon={<MinusOutlined />} onClick={() => setOpen(false)}
              style={{ color: token.colorTextTertiary }} />
          </Tooltip>
          <Tooltip title={t('common.close') || 'Đóng'}>
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setOpen(false)}
              style={{ color: token.colorTextTertiary }} />
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, background: token.colorBgLayout }}>
        {messages.map(renderMessage)}

        {/* Streaming text */}
        {loading && streamingText && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <img src={chatbotIcon} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ maxWidth: '78%', padding: '9px 13px', borderRadius: '18px 18px 18px 4px', background: token.colorBgContainer, color: token.colorText, fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${token.colorBorderSecondary}`, wordBreak: 'break-word' }}>
              {streamingText}<span style={{ animation: 'blink 1s infinite', opacity: 0.6, marginLeft: 1 }}>|</span>
            </div>
          </div>
        )}

        {/* Loading without stream yet — 3 dots typing indicator */}
        {loading && !streamingText && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            <img src={chatbotIcon} alt="" style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ padding: '10px 14px', background: token.colorBgContainer, borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="dot-typing" style={{ background: token.colorTextTertiary }} />
              <span className="dot-typing" style={{ background: token.colorTextTertiary, animationDelay: '0.15s' }} />
              <span className="dot-typing" style={{ background: token.colorTextTertiary, animationDelay: '0.3s' }} />
            </div>
          </div>
        )}

        {showSuggestions && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {suggestions.map((s, i) => (
              <Button key={i} size="small" style={{
                borderRadius: 20, fontSize: 12, height: 30,
                color: token.colorText,
                borderColor: token.colorBorderSecondary,
                background: token.colorBgContainer,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }} onClick={() => handleSend(s)}>{s}</Button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending attachments */}
      {(attach.pending.length > 0 || attach.uploading || attach.error) && (
        <div style={{ padding: '8px 14px 0', background: token.colorBgContainer, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {attach.pending.map((a, i) => (
            <div key={i} style={{ position: 'relative', width: 48, height: 48, borderRadius: 8, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}>
              <img src={a.url} alt={a.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Button type="primary" danger shape="circle" size="small" icon={<CloseOutlined style={{ fontSize: 10 }} />}
                onClick={() => attach.removeAt(i)}
                style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, minWidth: 18, padding: 0 }} />
            </div>
          ))}
          {attach.uploading && <Spin size="small" />}
          {attach.error && <Text type="danger" style={{ fontSize: 11 }}>{attach.error}</Text>}
        </div>
      )}

      {/* Live STT transcript banner */}
      {stt.listening && (
        <div style={{
          padding: '8px 14px',
          background: 'linear-gradient(90deg, #fff1f0 0%, #fff7e6 100%)',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#ff4d4f',
            animation: 'micDot 1s ease infinite', flexShrink: 0,
          }} />
          <Text style={{ fontSize: 12, color: '#ad6800', flexShrink: 0 }}>
            {t('chatbot.listening')}
          </Text>
          <Text style={{ fontSize: 13, fontStyle: 'italic', color: token.colorText, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stt.interim || '…'}
          </Text>
        </div>
      )}
      {stt.error && (
        <div style={{ padding: '6px 14px', background: '#fff1f0', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Text type="danger" style={{ fontSize: 12 }}>🎤 {stt.error}</Text>
        </div>
      )}

      {/* Input — Claude-style pill with inline buttons */}
      <div style={{ padding: '10px 12px 14px', background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
        <input ref={fileInputRef} type="file" accept={attach.accept} multiple hidden
          onChange={(e) => { if (e.target.files) attach.addFiles(e.target.files); e.target.value = ''; }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: token.colorBgLayout,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 22, padding: '4px 4px 4px 10px',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onFocus={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = token.colorPrimary; }}
        onBlur={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = token.colorBorderSecondary; }}
        >
          <Tooltip title={t('chatbot.attach')}>
            <Button type="text" shape="circle" size="small" icon={<PaperClipOutlined />}
              disabled={loading || attach.uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{ color: token.colorTextSecondary, flexShrink: 0 }} />
          </Tooltip>
          {stt.supported && (
            <Tooltip title={stt.listening ? t('chatbot.stopRecording') : t('chatbot.startRecording')}>
              <Button
                type="text" shape="circle" size="small"
                icon={<AudioOutlined />}
                onClick={handleMicClick}
                disabled={loading}
                style={{
                  color: stt.listening ? '#ff4d4f' : token.colorTextSecondary,
                  flexShrink: 0,
                  animation: stt.listening ? 'micPulse 1.4s ease infinite' : undefined,
                }}
              />
            </Tooltip>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => handleSend()}
            placeholder={stt.listening ? t('chatbot.listening') : t('chatbot.placeholder')}
            variant="borderless"
            style={{ fontSize: 14, padding: '4px 6px', background: 'transparent' }}
            disabled={loading}
          />
          <Popover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            trigger="click"
            placement="topRight"
            arrow={false}
            overlayInnerStyle={{ padding: 0, background: 'transparent', boxShadow: 'none' }}
            content={
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setInput((prev) => prev + emojiData.emoji);
                }}
                autoFocusSearch={false}
                emojiStyle={EmojiStyle.NATIVE}
                theme={token.colorBgContainer === '#ffffff' ? EmojiTheme.LIGHT : EmojiTheme.DARK}
                width={320}
                height={400}
                previewConfig={{ showPreview: false }}
                searchPlaceHolder={i18n.language === 'en' ? 'Search' : 'Tìm emoji'}
                lazyLoadEmojis
                skinTonesDisabled
              />
            }
          >
            <Button type="text" shape="circle" size="small" icon={<SmileOutlined />}
              disabled={loading}
              style={{ color: token.colorTextSecondary, flexShrink: 0 }} />
          </Popover>
          <Button
            type="primary" shape="circle" size="small"
            icon={<SendOutlined />}
            onClick={() => handleSend()}
            loading={loading}
            disabled={!input.trim() && attach.pending.length === 0}
            style={{ flexShrink: 0, width: 32, height: 32 }}
          />
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
        @keyframes dotTyping {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .dot-typing {
          width: 6px; height: 6px; border-radius: 50%;
          display: inline-block; animation: dotTyping 1.4s infinite;
        }
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(255, 77, 79, 0); }
        }
        @keyframes micDot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default Chatbot;
