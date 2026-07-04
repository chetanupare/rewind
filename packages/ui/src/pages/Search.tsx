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
  Sparkles,
  X,
  Filter,
  SlidersHorizontal,
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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  const recentSearches = [
    'React components',
    'MongoDB errors',
    'meeting notes',
    'invoice module',
    'authentication fix',
    'VS Code sessions',
  ];

  const filteredResults = selectedFilter === 'all'
    ? results
    : results.filter(r => r.type === selectedFilter);

  return (
    <>
      <div className="page-header" style={{ borderBottom: 'none', background: 'transparent' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', paddingTop: '40px' }}>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>
              Search your memory
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
              Find anything in your work history - activities, screenshots, commits, and more
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ position: 'relative', maxWidth: 600, margin: '0 auto' }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: '16px',
              padding: '4px',
              transition: 'border-color 0.2s',
              boxShadow: loading ? '0 0 0 4px var(--color-purple-glow)' : 'none',
            }}>
              <SearchIcon style={{ width: 20, height: 20, color: 'var(--color-text-muted)', marginLeft: '16px' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search activities, screenshots, commits..."
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: '15px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setResults([]); setHasSearched(false); }}
                  style={{
                    background: 'var(--color-bg)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px',
                    cursor: 'pointer',
                    marginRight: '8px',
                  }}
                >
                  <X style={{ width: 16, height: 16, color: 'var(--color-text-muted)' }} />
                </button>
              )}
              <button
                onClick={handleSearch}
                disabled={!query.trim() || loading}
                className="btn btn-primary"
                style={{ padding: '12px 24px', borderRadius: '12px' }}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          {!hasSearched && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div style={{ marginBottom: '32px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recent Searches
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setQuery(s); handleSearch(); }}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '10px' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {[
                  { icon: Code, label: 'Activities', desc: 'App usage and window titles', color: '#6D4CFF' },
                  { icon: Image, label: 'Screenshots', desc: 'Visual history with AI analysis', color: '#FF4FA3' },
                  { icon: GitCommit, label: 'Commits', desc: 'Git commits and branches', color: '#00D47E' },
                ].map((item) => (
                  <div key={item.label} className="card" style={{ padding: '20px', cursor: 'pointer' }} onClick={() => setSelectedFilter(item.label.toLowerCase())}>
                    <div style={{ width: 40, height: 40, borderRadius: '12px', background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                      <item.icon style={{ width: 20, height: 20, color: item.color }} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {hasSearched && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {filteredResults.length} results
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['all', 'activity', 'screenshot', 'commit'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setSelectedFilter(f)}
                        className={selectedFilter === f ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ fontSize: '11px', padding: '6px 10px' }}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-purple)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                  <p style={{ color: 'var(--color-text-secondary)' }}>Searching your memory...</p>
                </div>
              ) : filteredResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <SearchIcon style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No results found</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Try different keywords or broaden your search</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredResults.map((result, i) => {
                    const Icon = getIcon(result.type);
                    const color = getTypeColor(result.type);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="card card-interactive"
                        style={{ padding: '16px 20px' }}
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
                              <div
                                style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
                                dangerouslySetInnerHTML={{ __html: result.snippet }}
                              />
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
