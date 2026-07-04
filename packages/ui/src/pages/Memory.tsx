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
  Bookmark,
  Pin,
  Trash2,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getMemories: (options?: { type?: string; limit?: number }) => Promise<any[]>;
      createBookmark: (data: { type: string; title: string; description?: string; tags?: string[] }) => Promise<number>;
      toggleBookmarkPin: (id: number) => Promise<boolean>;
      deleteBookmark: (id: number) => Promise<boolean>;
    };
  }
}

interface MemoryItem {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  tags: string[];
  pinned: boolean;
}

export default function Memory() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemories();
  }, [filter]);

  const loadMemories = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getMemories({
        type: filter === 'all' ? undefined : filter,
        limit: 100,
      });
      setMemories(data);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'meeting': return MessageSquare;
      case 'commit': return GitCommit;
      case 'session': return Code;
      case 'browser': return Globe;
      case 'document': return FileText;
      case 'screenshot': return FileText;
      default: return Brain;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'meeting': return '#3B82F6';
      case 'commit': return '#00D47E';
      case 'session': return '#6D4CFF';
      case 'browser': return '#F59E0B';
      case 'document': return '#FF4FA3';
      case 'screenshot': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const handleTogglePin = async (id: number) => {
    await window.electronAPI.toggleBookmarkPin(id);
    loadMemories();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteBookmark(id);
    loadMemories();
  };

  const filteredMemories = memories.filter((m) => {
    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const pinnedMemories = filteredMemories.filter(m => m.pinned);
  const otherMemories = filteredMemories.filter(m => !m.pinned);

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Memory</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="input-icon">
              <Search />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ width: 200, fontSize: '12px', padding: '6px 10px 6px 36px' }}
              />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {['all', 'meeting', 'commit', 'session', 'browser', 'document', 'screenshot'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>Loading memories...</div>
        ) : (
          <>
            {pinnedMemories.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pin style={{ width: 14, height: 14 }} /> Pinned
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  {pinnedMemories.map((memory, i) => (
                    <MemoryCard key={memory.id} memory={memory} index={i} getIcon={getIcon} getTypeColor={getTypeColor} onTogglePin={handleTogglePin} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}

            <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px' }}>
              {pinnedMemories.length > 0 ? 'All Memories' : 'Memories'}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {otherMemories.map((memory, i) => (
                <MemoryCard key={memory.id} memory={memory} index={i} getIcon={getIcon} getTypeColor={getTypeColor} onTogglePin={handleTogglePin} onDelete={handleDelete} />
              ))}
            </div>

            {filteredMemories.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <Brain style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No memories yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Start working to build your memory</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function MemoryCard({ memory, index, getIcon, getTypeColor, onTogglePin, onDelete }: {
  memory: MemoryItem;
  index: number;
  getIcon: (type: string) => any;
  getTypeColor: (type: string) => string;
  onTogglePin: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const Icon = getIcon(memory.type);
  const color = getTypeColor(memory.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="card card-interactive"
      style={{ padding: '16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, flexShrink: 0 }}>
          <Icon style={{ width: 16, height: 16, color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{memory.title}</div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            <Clock style={{ width: 10, height: 10, verticalAlign: 'middle', marginRight: 4 }} />
            {memory.timestamp ? new Date(memory.timestamp).toLocaleDateString() : ''}
          </div>
          {memory.description && (
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>{memory.description}</div>
          )}
          {memory.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
              {memory.tags.map((tag) => (
                <span key={tag} className="tag" style={{ fontSize: '10px' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => onTogglePin(memory.id)}>
            <Pin style={{ width: 14, height: 14, color: memory.pinned ? 'var(--color-purple)' : undefined }} />
          </button>
          <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => onDelete(memory.id)}>
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
