import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  MoreHorizontal,
  Image,
  Code,
  FileText,
  Table,
  ChevronDown,
  Loader2,
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
  timestamp: Date;
}

interface ChatProps {
  onToggleMemory: () => void;
}

export default function Chat({ onToggleMemory }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages((p) => [...p, { role: 'user', content: msg, timestamp: new Date() }]);
    setLoading(true);
    try {
      const r = await window.electronAPI.chat(msg);
      setMessages((p) => [...p, { role: 'assistant', content: r.content, timestamp: new Date() }]);
    } catch {
      setMessages((p) => [
        ...p,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() },
      ]);
    }
    setLoading(false);
  };

  const suggestions = [
    { icon: FileText, text: 'What did I work on today?' },
    { icon: Code, text: 'Show me all React work' },
    { icon: Image, text: 'Find screenshots from yesterday' },
    { icon: Table, text: 'Summarize this week\'s activity' },
  ];

  return (
    <div className="flex h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-text">New Conversation</h1>
            <span className="text-xs text-text-muted bg-surface px-2 py-1 rounded-lg">
              qwen2.5-coder:3b
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-icon" title="Search">
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              className="btn-icon"
              onClick={onToggleMemory}
              title="Toggle Memory"
            >
              <Brain className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center mb-12"
              >
                <div className="w-16 h-16 rounded-2xl bg-purple/20 flex items-center justify-center mx-auto mb-6 glow-purple">
                  <Sparkles className="w-8 h-8 text-purple" />
                </div>
                <h2 className="text-2xl font-bold text-text mb-2">Ask RewindX anything</h2>
                <p className="text-text-secondary text-base">
                  I can help you find information about your work, meetings, code, and more.
                </p>
              </motion.div>

              <div className="grid grid-cols-2 gap-3 w-full">
                {suggestions.map((s, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.2 }}
                    className="card p-4 text-left hover:border-purple/30 group"
                    onClick={() => setInput(s.text)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center group-hover:bg-purple/20 transition-colors">
                        <s.icon className="w-4 h-4 text-text-secondary group-hover:text-purple transition-colors" />
                      </div>
                      <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
                        {s.text}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={msg.role === 'user' ? 'message-user' : 'message-assistant'}>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                        <button className="btn-icon w-7 h-7" title="Copy">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-icon w-7 h-7" title="Good response">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-icon w-7 h-7" title="Bad response">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-icon w-7 h-7" title="Regenerate">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button className="btn-icon w-7 h-7" title="More">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="message-assistant">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple" />
                      <span className="text-sm text-text-secondary">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-8 pb-6">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <div className="input-area flex items-end gap-3">
                <button className="btn-icon mb-1" title="Attach file">
                  <Paperclip className="w-5 h-5" />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask RewindX anything..."
                  className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-text placeholder:text-text-muted min-h-[24px] max-h-[120px]"
                  rows={1}
                  style={{
                    height: 'auto',
                    overflow: input.split('\n').length > 3 ? 'auto' : 'hidden',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                  disabled={loading}
                />
                <div className="flex items-center gap-1 mb-1">
                  <button className="btn-icon" title="Voice input">
                    <Mic className="w-5 h-5" />
                  </button>
                  <button className="btn-icon" title="Screenshot">
                    <Camera className="w-5 h-5" />
                  </button>
                  <button
                    className={`btn-icon ${memoryEnabled ? 'text-purple' : ''}`}
                    onClick={() => setMemoryEnabled(!memoryEnabled)}
                    title="Memory"
                  >
                    <Brain className="w-5 h-5" />
                  </button>
                  <button
                    className="btn-primary flex items-center gap-2 ml-2"
                    onClick={send}
                    disabled={loading || !input.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[11px] text-text-muted">
                {memoryEnabled ? 'Memory enabled' : 'Memory disabled'}
              </span>
              <span className="text-[11px] text-text-muted">
                Press Enter to send, Shift+Enter for new line
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
