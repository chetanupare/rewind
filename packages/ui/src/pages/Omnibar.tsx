import { useState, useEffect, useRef } from 'react';
import '../styles/globals.css';

declare global {
  interface Window {
    electronAPI?: {
      chat: (message: string) => Promise<{ role: string; content: string }>;
      omnibarHide: () => void;
      [key: string]: any;
    };
  }
}

export default function Omnibar() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input whenever the component mounts (which is when the window shows)
    if (inputRef.current) {
      inputRef.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuery('');
        setResponse('');
        window.electronAPI?.omnibarHide?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !window.electronAPI) return;

    setLoading(true);
    setResponse('');
    try {
      const res = await window.electronAPI.chat(query);
      setResponse(res.content);
    } catch (err: any) {
      setResponse('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg)',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      color: 'var(--text)',
      padding: '24px'
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask your AI Work Memory..."
          style={{
            flex: 1,
            padding: '16px 20px',
            fontSize: '18px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg2)',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'inherit'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </form>
      {loading && <div style={{ marginTop: '16px', color: 'var(--text3)' }}>Thinking...</div>}
      {response && (
        <div style={{
          marginTop: '16px',
          padding: '20px',
          backgroundColor: 'var(--bg2)',
          borderRadius: '8px',
          overflowY: 'auto',
          maxHeight: '400px',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          border: '1px solid var(--border)'
        }}>
          {response}
        </div>
      )}
    </div>
  );
}
