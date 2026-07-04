import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Paperclip,
  Mic,
  Camera,
  Brain,
  Sparkles,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Loader2,
  MessageSquare,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      chat: (message: string) => Promise<{ role: string; content: string }>;
    };
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages((p) => [...p, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await window.electronAPI.chat(msg);
      setMessages((p) => [...p, { role: 'assistant', content: r.content }]);
    } catch {
      setMessages((p) => [...p, { role: 'assistant', content: 'Error: Could not get response.' }]);
    }
    setLoading(false);
  };

  const suggestions = [
    'What did I work on today?',
    'Show me all React work',
    'Find screenshots from yesterday',
    'Summarize this week',
  ];

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>AI Chat</h1>
          </div>
          <div className="badge badge-info">qwen2.5-coder:3b</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', maxWidth: 480, margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: 'center', marginBottom: 40 }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'var(--color-purple-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 25px var(--color-purple-glow)' }}>
                <Sparkles style={{ width: 28, height: 28, color: 'var(--color-purple)' }} />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>Ask RewindX anything</h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                I can help you find information about your work, meetings, code, and more.
              </p>
            </motion.div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
              {suggestions.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card card-interactive"
                  style={{ padding: '14px', textAlign: 'left' }}
                  onClick={() => setInput(s)}
                >
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{s}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
              >
                <div className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  {msg.role === 'assistant' && (
                    <div style={{ display: 'flex', gap: '4px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
                      <button className="btn-icon" style={{ width: 28, height: 28 }}><Copy style={{ width: 14, height: 14 }} /></button>
                      <button className="btn-icon" style={{ width: 28, height: 28 }}><ThumbsUp style={{ width: 14, height: 14 }} /></button>
                      <button className="btn-icon" style={{ width: 28, height: 28 }}><ThumbsDown style={{ width: 14, height: 14 }} /></button>
                      <button className="btn-icon" style={{ width: 28, height: 28 }}><RotateCcw style={{ width: 14, height: 14 }} /></button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex' }}>
                <div className="message message-assistant">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Loader2 style={{ width: 16, height: 16, color: 'var(--color-purple)' }} className="animate-spin" />
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Thinking...</span>
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '0 28px 20px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
            <button className="btn-icon"><Paperclip style={{ width: 18, height: 18 }} /></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask RewindX anything..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--color-text)', fontSize: '13px', fontFamily: 'var(--font-sans)', resize: 'none', minHeight: 20, maxHeight: 80, lineHeight: 1.5 }}
              rows={1}
              disabled={loading}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn-icon"><Mic style={{ width: 18, height: 18 }} /></button>
              <button className="btn-icon"><Camera style={{ width: 18, height: 18 }} /></button>
              <button className="btn-icon" onClick={() => setMemoryEnabled(!memoryEnabled)} style={{ color: memoryEnabled ? 'var(--color-purple)' : undefined }}>
                <Brain style={{ width: 18, height: 18 }} />
              </button>
              <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()} style={{ padding: '8px 12px' }}>
                <Send style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{memoryEnabled ? 'Memory on' : 'Memory off'}</span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Enter to send · Shift+Enter for new line</span>
          </div>
        </div>
      </div>
    </>
  );
}
