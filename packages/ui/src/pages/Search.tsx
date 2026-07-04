import { useState } from 'react';
import { motion } from 'framer-motion';
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

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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
      case 'activity':
        return Clock;
      case 'screenshot':
        return Image;
      case 'session':
        return Code;
      case 'commit':
        return GitCommit;
      case 'browser':
        return Globe;
      case 'document':
        return FileText;
      default:
        return FileText;
    }
  };

  const recentSearches = [
    'React components',
    'MongoDB errors',
    'meeting notes',
    'invoice module',
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border">
        <h1 className="text-2xl font-bold text-text mb-1">Search</h1>
        <p className="text-text-secondary">
          Find anything in your work history
        </p>
      </header>

      {/* Search Area */}
      <div className="px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your work history..."
              className="input-area pl-12 pr-4 py-4 text-base"
              autoFocus
            />
          </div>

          {!hasSearched && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6"
            >
              <p className="text-xs text-text-muted mb-3 font-semibold uppercase tracking-wider">
                Recent Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      handleSearch();
                    }}
                    className="px-3 py-1.5 rounded-lg text-sm bg-surface text-text-secondary hover:text-text hover:bg-surface-hover transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="text-center py-12">
              <SearchIcon className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">No results found</h3>
              <p className="text-sm text-text-secondary">
                Try different keywords or broaden your search
              </p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-text-muted font-semibold">
                {results.length} results found
              </p>
              {results.map((result, i) => {
                const Icon = getIcon(result.type);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="card p-4 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-purple uppercase">
                            {result.type}
                          </span>
                          <span className="text-xs text-text-muted">
                            {new Date(result.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-text group-hover:text-purple transition-colors">
                          {result.title}
                        </h3>
                        <p
                          className="text-xs text-text-secondary mt-1 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      </div>
                      <ArrowRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
