import { useState } from 'react';

declare global {
  interface Window {
    electronAPI: {
      search: (query: string) => Promise<Array<{
        type: string; id: number; title: string; snippet: string; timestamp: string; rank: number;
      }>>;
    };
  }
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [done, setDone] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setDone(false);
    try {
      setResults(await window.electronAPI.search(query));
    } catch {}
    setSearching(false);
    setDone(true);
  };

  return (
    <div className="search">
      <div className="search-bar-wrap">
        <input
          type="text"
          className="glass-input search-bar"
          placeholder="Search your work history..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <button onClick={search} disabled={searching} className="glass-btn search-go">
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {searching && <div className="glass-card empty-state"><p>Searching...</p></div>}

      {!searching && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <div key={`${r.type}-${r.id}-${i}`} className="glass-card search-result">
              <span className="sr-badge">{r.type}</span>
              <div className="sr-title">{r.title}</div>
              <div className="sr-snippet" dangerouslySetInnerHTML={{ __html: r.snippet }} />
              <div className="sr-time">{new Date(r.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {!searching && done && results.length === 0 && (
        <div className="glass-card empty-state"><p>No results found for "{query}"</p></div>
      )}

      {!done && !searching && (
        <div className="glass-card empty-state">
          <p>Search across activities, screenshots, and sessions</p>
          <p className="empty-hint">Try: "invoice bug", "React code", "MongoDB error"</p>
        </div>
      )}
    </div>
  );
}
