import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Code,
  GitCommit,
  Terminal,
  Image,
  FileText,
  Clock,
  Activity,
  Zap,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getDevEvents: (options?: { type?: string; limit?: number; date?: string }) => Promise<any[]>;
      getDevStats: (date: string) => Promise<{
        commits: number;
        screenshots: number;
        terminalSessions: number;
        fileChanges: number;
        activeHours: number;
      }>;
    };
  }
}

interface DevEvent {
  id: number;
  timestamp: string;
  type: string;
  app: string;
  project: string;
  description: string;
}

interface DevStats {
  commits: number;
  screenshots: number;
  terminalSessions: number;
  fileChanges: number;
  activeHours: number;
}

export default function DeveloperMode() {
  const [events, setEvents] = useState<DevEvent[]>([]);
  const [stats, setStats] = useState<DevStats>({
    commits: 0,
    screenshots: 0,
    terminalSessions: 0,
    fileChanges: 0,
    activeHours: 0,
  });
  const [filter, setFilter] = useState('all');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [date, filter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsData, statsData] = await Promise.all([
        window.electronAPI.getDevEvents({
          type: filter === 'all' ? undefined : filter,
          date,
          limit: 100,
        }),
        window.electronAPI.getDevStats(date),
      ]);
      setEvents(eventsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load dev data:', err);
    }
    setLoading(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'commit': return GitCommit;
      case 'screenshot': return Image;
      case 'terminal': return Terminal;
      case 'file_change': return FileText;
      default: return Activity;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'commit': return '#00D47E';
      case 'screenshot': return '#FF4FA3';
      case 'terminal': return '#FBBF24';
      case 'file_change': return '#6D4CFF';
      default: return '#6B7280';
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Developer Mode</h1>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            style={{ width: 150, fontSize: '12px', padding: '6px 10px' }}
          />
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Commits', value: stats.commits, icon: GitCommit, color: '#00D47E' },
            { label: 'Screenshots', value: stats.screenshots, icon: Image, color: '#FF4FA3' },
            { label: 'Terminal', value: stats.terminalSessions, icon: Terminal, color: '#FBBF24' },
            { label: 'File Changes', value: stats.fileChanges, icon: FileText, color: '#6D4CFF' },
            { label: 'Active Hours', value: stats.activeHours, icon: Clock, color: '#3B82F6' },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${stat.color}15` }}>
                  <stat.icon style={{ width: 16, height: 16, color: stat.color }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {['all', 'commit', 'screenshot', 'terminal', 'file_change'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ fontSize: '11px', padding: '6px 12px' }}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Event Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Loading events...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Code style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No developer events</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Start coding to see your developer activity</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {events.map((event, i) => {
              const Icon = getTypeIcon(event.type);
              const color = getTypeColor(event.type);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="card"
                  style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, flexShrink: 0 }}>
                    <Icon style={{ width: 16, height: 16, color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{event.description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      {event.app} {event.project && `• ${event.project}`}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
