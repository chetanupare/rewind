import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon,
  Clock,
  FileText,
  Code,
  Globe,
  MessageSquare,
  GitCommit,
  Image,
  ArrowRight,
  X,
  Brain,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      search: (query: string) => Promise<Array<{
        type: string;
        id: number;
        title: string;
        snippet: string;
        timestamp: string;
      }>>;
      getRecentActivities: (limit?: number) => Promise<any[]>;
      getScreenshotsByDate: (date: string) => Promise<any[]>;
    };
  }
}

interface SearchResult {
  type: string;
  id: number;
  title: string;
  snippet: string;
  timestamp: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [recentScreenshots, setRecentScreenshots] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadRecentData();
  }, []);

  const loadRecentData = async () => {
    try {
      const [activities, screenshots] = await Promise.all([
        window.electronAPI.getRecentActivities(5),
        window.electronAPI.getScreenshotsByDate(new Date().toISOString().split('T')[0]),
      ]);
      setRecentActivities(activities);
      setRecentScreenshots(screenshots.slice(0, 5));
    } catch (err) {
      console.error('Failed to load recent data:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const r = await window.electronAPI.search(query);
      setResults(r);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'activity': return Clock;
      case 'screenshot': return Image;
      case 'session': return Code;
      case 'commit': return GitCommit;
      case 'browser': return Globe;
      case 'document': return FileText;
      default: return FileText;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'activity': return '#6D4CFF';
      case 'screenshot': return '#FF4FA3';
      case 'session': return '#3B82F6';
      case 'commit': return '#00D47E';
      case 'browser': return '#FBBF24';
      case 'document': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Navigate to relevant page based on type
    console.log('Clicked result:', result);
  };

  return (
    <>
      <div className="page-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>
              Search your memory
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
              Find anything in your work history
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="card" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SearchIcon style={{ width: 20, height: 20, color: 'var(--color-text-muted)', marginLeft: '12px' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search activities, screenshots, commits..."
                style={{
                  flex: 1,
                  padding: '12px',
                  fontSize: '15px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              {query && (
                <button onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }} className="btn-icon">
                  <X style={{ width: 16, height: 16 }} />
                </button>
              )}
              <button onClick={handleSearch} disabled={!query.trim() || loading} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {!hasSearched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              {/* Recent Activities */}
              {recentActivities.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recent Activity
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {recentActivities.map((a, i) => (
                      <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        onClick={() => { setQuery(a.app_name || a.window_title); handleSearch(); }}>
                        <Clock style={{ width: 16, height: 16, color: 'var(--color-text-muted)' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{a.app_name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{a.window_title || 'No title'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Screenshots */}
              {recentScreenshots.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recent Screenshots
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    {recentScreenshots.map((s, i) => (
                      <div key={i} className="card" style={{ padding: '8px', cursor: 'pointer' }}
                        onClick={() => { setQuery(s.ai_app || 'screenshot'); handleSearch(); }}>
                        <div style={{ aspectRatio: '16/10', background: 'var(--color-bg)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
                          {s.file_path && <img src={`file://${s.file_path}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{s.ai_app || 'Unknown'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {hasSearched && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {results.length} results found
                </span>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Searching your memory...</p>
                </div>
              ) : results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <SearchIcon style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No results found</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Try different keywords</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {results.map((result, i) => {
                    const Icon = getIcon(result.type);
                    const color = getTypeColor(result.type);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="card card-interactive"
                        style={{ padding: '16px 20px', cursor: 'pointer' }}
                        onClick={() => handleResultClick(result)}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                          <div style={{ width: 40, height: 40, borderRadius: '12px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon style={{ width: 18, height: 18, color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{result.type}</span>
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                {result.timestamp ? new Date(result.timestamp).toLocaleDateString() : ''}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{result.title}</div>
                            {result.snippet && (
                              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
                                dangerouslySetInnerHTML={{ __html: result.snippet }} />
                            )}
                          </div>
                          <ArrowRight style={{ width: 16, height: 16, color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 4 }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        mark {
          background: rgba(109, 76, 255, 0.2);
          color: var(--color-purple);
          padding: 0 4px;
          border-radius: 4px;
          font-weight: 600;
        }
      `}</style>
    </>
  );
}
