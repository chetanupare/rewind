import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  MessageSquare,
  GitCommit,
  Code,
  Globe,
  FileText,
  Clock,
  Search,
  Filter,
} from 'lucide-react';

interface MemoryItem {
  id: number;
  type: 'meeting' | 'commit' | 'session' | 'browser' | 'document';
  title: string;
  source: string;
  timestamp: string;
  preview: string;
}

export default function Memory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    // Mock data for demo
    const mockMemories: MemoryItem[] = [
      {
        id: 1,
        type: 'meeting',
        title: 'Team Standup',
        source: 'Zoom',
        timestamp: '2 hours ago',
        preview: 'Discussed Q3 roadmap and sprint planning...',
      },
      {
        id: 2,
        type: 'commit',
        title: 'feat: add user authentication',
        source: 'GitHub',
        timestamp: '3 hours ago',
        preview: 'Added JWT token validation and refresh logic...',
      },
      {
        id: 3,
        type: 'session',
        title: 'VS Code - RewindX',
        source: 'VS Code',
        timestamp: '4 hours ago',
        preview: 'Working on UI components and styling...',
      },
      {
        id: 4,
        type: 'browser',
        title: 'React Documentation',
        source: 'Chrome',
        timestamp: '5 hours ago',
        preview: 'Reading about hooks and state management...',
      },
      {
        id: 5,
        type: 'document',
        title: 'Project Proposal.pdf',
        source: 'Adobe Acrobat',
        timestamp: 'Yesterday',
        preview: 'Reviewed Q3 project proposal and budget...',
      },
    ];
    setMemories(mockMemories);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return MessageSquare;
      case 'commit':
        return GitCommit;
      case 'session':
        return Code;
      case 'browser':
        return Globe;
      case 'document':
        return FileText;
      default:
        return Brain;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500/20 text-blue-400';
      case 'commit':
        return 'bg-green-500/20 text-green-400';
      case 'session':
        return 'bg-purple/20 text-purple';
      case 'browser':
        return 'bg-orange-500/20 text-orange-400';
      case 'document':
        return 'bg-pink/20 text-pink';
      default:
        return 'bg-surface text-text-secondary';
    }
  };

  const filteredMemories = memories.filter((m) => {
    if (filter !== 'all' && m.type !== filter) return false;
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">Memory</h1>
            <p className="text-text-secondary mt-1">
              Your AI remembers everything you've worked on
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-area pl-10 pr-4 py-2 w-64 text-sm"
              />
            </div>
            <button className="btn-ghost flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          {['all', 'meeting', 'commit', 'session', 'browser', 'document'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f
                  ? 'bg-purple text-white'
                  : 'bg-surface text-text-secondary hover:text-text'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* Memory Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMemories.map((memory, i) => {
            const Icon = getIcon(memory.type);
            return (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.2 }}
                className="card p-5 cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTypeColor(memory.type)}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-text truncate group-hover:text-purple transition-colors">
                      {memory.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-text-muted">{memory.source}</span>
                      <span className="text-xs text-text-muted">•</span>
                      <span className="text-xs text-text-muted flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {memory.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-2 line-clamp-2">
                      {memory.preview}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredMemories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Brain className="w-12 h-12 text-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-text mb-2">No memories found</h3>
            <p className="text-sm text-text-secondary">
              {searchQuery ? 'Try a different search term' : 'Start working to build your memory'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
