import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Code,
  Globe,
  MessageSquare,
  Image,
  Brain,
  Sparkles,
  Activity,
} from 'lucide-react';
import { GlassCard } from '../components';

declare global {
  interface Window {
    electronAPI: {
      getDashboardStats: () => Promise<{
        totalActivities: number;
        totalScreenshots: number;
        totalSessions: number;
        topApps: Array<{ name: string; count: number }>;
      }>;
      getRecentActivities: (limit?: number) => Promise<Array<{
        id: number;
        app_name: string;
        window_title: string;
        timestamp: string;
        duration_seconds: number;
      }>>;
      restoreContext: (projectPath: string) => Promise<boolean>;
      getScreenshotsByDate: (date: string) => Promise<any[]>;
      getScreenshotImage: (filePath: string) => Promise<ArrayBuffer>;
    };
  }
}

interface Activity {
  id: number;
  app_name: string;
  window_title: string;
  timestamp: string;
  duration_seconds: number;
}

interface Stats {
  totalActivities: number;
  totalScreenshots: number;
  totalSessions: number;
  topApps: Array<{ name: string; count: number }>;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function timeAgo(ts: string): string {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function inferActivity(app: string): string {
  const l = app.toLowerCase();
  if (l.includes('code') || l.includes('visual studio') || l.includes('cursor')) return 'Coding';
  if (l.includes('terminal') || l.includes('powershell') || l.includes('cmd')) return 'Terminal';
  if (l.includes('chrome') || l.includes('edge') || l.includes('firefox')) return 'Research';
  if (l.includes('slack') || l.includes('teams') || l.includes('discord')) return 'Communication';
  if (l.includes('figma') || l.includes('sketch')) return 'Design';
  if (l.includes('mail') || l.includes('outlook')) return 'Email';
  if (l.includes('zoom') || l.includes('meet')) return 'Meeting';
  return 'Working';
}

const ACTIVITY_ICONS: Record<string, typeof Activity> = {
  Coding: Code,
  Terminal: Code,
  Research: Globe,
  Communication: MessageSquare,
  Design: Sparkles,
  Email: MessageSquare,
  Meeting: MessageSquare,
  Working: Activity,
};

const ACCENT_COLORS: Record<string, string> = {
  Coding: '#6D4CFF',
  Terminal: '#10B981',
  Research: '#3B82F6',
  Communication: '#F59E0B',
  Design: '#EC4899',
  Email: '#06B6D4',
  Meeting: '#8B5CF6',
  Working: '#6B7280',
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalActivities: 0, totalScreenshots: 0, totalSessions: 0, topApps: [] });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([
          window.electronAPI.getDashboardStats(),
          window.electronAPI.getRecentActivities(15),
        ]);
        setStats(s);
        setActivities(a);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    async function load() {
      if (window.electronAPI?.getScreenshotsByDate) {
        const data = await window.electronAPI.getScreenshotsByDate(date);
        setScreenshots(data);
        if (data.length > 0) {
          setCurrentIndex(data.length - 1);
        } else {
          setImgSrc(null);
        }
      }
    }
    load();
  }, [date]);

  useEffect(() => {
    async function loadImage() {
      if (screenshots.length > 0 && screenshots[currentIndex] && window.electronAPI?.getScreenshotImage) {
        const currentSS = screenshots[currentIndex];
        const buffer = await window.electronAPI.getScreenshotImage(currentSS.file_path);
        if (buffer) {
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          setImgSrc(url);
          return () => URL.revokeObjectURL(url);
        }
      }
    }
    loadImage();
  }, [currentIndex, screenshots]);

  const codingMin = Math.round(activities.filter(a => inferActivity(a.app_name) === 'Coding').reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);
  const researchMin = Math.round(activities.filter(a => inferActivity(a.app_name) === 'Research').reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);
  const commMin = Math.round(activities.filter(a => ['Communication', 'Email', 'Meeting'].includes(inferActivity(a.app_name))).reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">{getGreeting()}</h1>
            <p className="text-text-secondary mt-1">Here's your work summary</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-text-secondary">Tracking</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Activities', value: stats.totalActivities, icon: Activity, color: '#6D4CFF' },
            { label: 'Screenshots', value: stats.totalScreenshots, icon: Image, color: '#FF4FA3' },
            { label: 'Sessions', value: stats.totalSessions, icon: Clock, color: '#3B82F6' },
            { label: 'Coding Time', value: `${codingMin}m`, icon: Code, color: '#10B981' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl font-bold text-text">{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Recent Activity */}
          <div className="col-span-2">
            <h2 className="text-sm font-semibold text-text mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {activities.slice(0, 8).map((a, i) => {
                const act = inferActivity(a.app_name);
                const Icon = ACTIVITY_ICONS[act] || Activity;
                const color = ACCENT_COLORS[act] || '#6B7280';
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="card p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text">{a.app_name}</div>
                      <div className="text-xs text-text-secondary truncate">{a.window_title || 'No title'}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-semibold" style={{ color }}>{act}</div>
                      <div className="text-xs text-text-muted">{a.duration_seconds ? fmtDur(a.duration_seconds) : ''}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Top Apps */}
          <div>
            <h2 className="text-sm font-semibold text-text mb-4">Top Apps Today</h2>
            <div className="space-y-2">
              {stats.topApps.map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple/20 flex items-center justify-center text-purple font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{a.name}</div>
                    <div className="text-xs text-text-muted">{a.count} activities</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Time Travel */}
            <h2 className="text-sm font-semibold text-text mt-6 mb-4">Time Travel</h2>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-text-muted" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm text-text"
                />
              </div>
              {screenshots.length > 0 ? (
                <div>
                  <div className="aspect-video rounded-xl bg-surface overflow-hidden mb-3">
                    {imgSrc && (
                      <img src={imgSrc} alt="Screenshot" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={screenshots.length - 1}
                    value={currentIndex}
                    onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                    className="w-full accent-purple"
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted text-sm">
                  No screenshots for this date
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
