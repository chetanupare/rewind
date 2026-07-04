import { useState, useRef, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      chat: (message: string) => Promise<{ role: string; content: string }>;
    };
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const r = await window.electronAPI.chat(msg);
      setMessages(p => [...p, { role: 'assistant', content: r.content }]);
    } catch {
      setMessages(p => [...p, { role: 'assistant', content: 'Error connecting to Ollama.' }]);
    }
    setLoading(false);
  };

  const suggestions = [
    'What did I work on today?',
    'When did I fix that bug?',
    'Summarize this week',
    'Show all React work',
  ];

  return (
    <div className="chat">
      <div className="chat-msgs">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>AI Work Memory</h3>
            <p>Ask me anything about your work</p>
            <div className="chat-suggestions">
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)} className="glass-btn suggestion">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <div className="msg-content">{m.content}</div>
          </div>
        ))}
        {loading && <div className="msg msg-assistant"><div className="msg-content typing"><span/><span/><span/></div></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-input-row">
        <input
          type="text"
          className="glass-input chat-input"
          placeholder="Ask about your work..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()} className="glass-btn chat-send">Send</button>
      </div>
    </div>
  );
}
