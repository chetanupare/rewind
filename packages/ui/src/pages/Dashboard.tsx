import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Clock,
  Code,
  Globe,
  MessageSquare,
  Image,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  Zap,
} from 'lucide-react';

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
      getScreenshotsByDate: (date: string) => Promise<any[]>;
      getScreenshotImage: (filePath: string) => Promise<ArrayBuffer>;
    };
  }
}

interface ActivityItem {
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

const ACTIVITY_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
  Coding: { icon: Code, color: '#6D4CFF' },
  Terminal: { icon: Code, color: '#10B981' },
  Research: { icon: Globe, color: '#3B82F6' },
  Communication: { icon: MessageSquare, color: '#FBBF24' },
  Design: { icon: Image, color: '#EC4899' },
  Email: { icon: MessageSquare, color: '#06B6D4' },
  Meeting: { icon: MessageSquare, color: '#8B5CF6' },
  Working: { icon: Activity, color: '#6B7280' },
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalActivities: 0, totalScreenshots: 0, totalSessions: 0, topApps: [] });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
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
    (async () => {
      if (window.electronAPI?.getScreenshotsByDate) {
        const data = await window.electronAPI.getScreenshotsByDate(date);
        setScreenshots(data);
        if (data.length > 0) setCurrentIndex(data.length - 1);
        else setImgSrc(null);
      }
    })();
  }, [date]);

  useEffect(() => {
    (async () => {
      if (screenshots.length > 0 && screenshots[currentIndex] && window.electronAPI?.getScreenshotImage) {
        const buffer = await window.electronAPI.getScreenshotImage(screenshots[currentIndex].file_path);
        if (buffer) {
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          setImgSrc(url);
          return () => URL.revokeObjectURL(url);
        }
      }
    })();
  }, [currentIndex, screenshots]);

  const codingMin = Math.round(activities.filter(a => inferActivity(a.app_name) === 'Coding').reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);
  const researchMin = Math.round(activities.filter(a => inferActivity(a.app_name) === 'Research').reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);
  const meetingMin = Math.round(activities.filter(a => inferActivity(a.app_name) === 'Meeting').reduce((s, a) => s + (a.duration_seconds || 0), 0) / 60);

  const statCards = [
    { label: 'Activities', value: stats.totalActivities, icon: Activity, color: '#6D4CFF', trend: '+12%' },
    { label: 'Screenshots', value: stats.totalScreenshots, icon: Image, color: '#FF4FA3', trend: '+8%' },
    { label: 'Sessions', value: stats.totalSessions, icon: Clock, color: '#3B82F6', trend: '+5%' },
    { label: 'Focus Time', value: `${codingMin + researchMin}m`, icon: Zap, color: '#00D47E', trend: '+18%' },
  ];

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1>{getGreeting()}</h1>
            <p>Here's your work summary for today</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="badge badge-success">
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D47E', marginRight: 6 }} />
              Tracking
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--color-surface)', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
              <Calendar style={{ width: 14, height: 14, color: 'var(--color-text-muted)' }} />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="page-body">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${stat.color}15` }}>
                  <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#00D47E' }}>
                  <TrendingUp style={{ width: 12, height: 12 }} />
                  {stat.trend}
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.5px', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', fontWeight: 500 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Left: Activity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>Recent Activity</h2>
              <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 10px' }}>
                View All <ArrowUpRight style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activities.slice(0, 8).map((a, i) => {
                const act = inferActivity(a.app_name);
                const config = ACTIVITY_CONFIG[act] || ACTIVITY_CONFIG.Working;
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="card card-interactive"
                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${config.color}15`, flexShrink: 0 }}>
                      <config.icon style={{ width: 18, height: 18, color: config.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{a.app_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.window_title || 'No title'}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: config.color }}>{act}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{a.duration_seconds ? fmtDur(a.duration_seconds) : ''}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Top Apps */}
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Top Apps</h2>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.topApps.slice(0, 5).map((a, i) => {
                    const colors = ['#6D4CFF', '#FF4FA3', '#3B82F6', '#00D47E', '#FBBF24'];
                    const color = colors[i] || '#6B7280';
                    return (
                      <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, fontSize: '11px', fontWeight: 800, color }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{a.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time Breakdown */}
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Time Breakdown</h2>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Coding', value: codingMin, color: '#6D4CFF', icon: Code },
                    { label: 'Research', value: researchMin, color: '#3B82F6', icon: Globe },
                    { label: 'Meetings', value: meetingMin, color: '#8B5CF6', icon: MessageSquare },
                  ].map((item) => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <item.icon style={{ width: 14, height: 14, color: item.color }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: item.color }}>{item.value}m</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--color-bg)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (item.value / Math.max(codingMin, researchMin, meetingMin, 1)) * 100)}%`, background: item.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Time Travel */}
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Time Travel</h2>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="input"
                    style={{ fontSize: '12px', padding: '6px 10px' }}
                  />
                </div>
                {screenshots.length > 0 ? (
                  <div>
                    <div style={{ aspectRatio: '16/10', borderRadius: '10px', background: 'var(--color-bg)', overflow: 'hidden', marginBottom: '10px', border: '1px solid var(--color-border)' }}>
                      {imgSrc && <img src={imgSrc} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={screenshots.length - 1}
                      value={currentIndex}
                      onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                      style={{ width: '100%', accentColor: 'var(--color-purple)', height: '4px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{screenshots.length} screenshots</span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{currentIndex + 1} / {screenshots.length}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: '12px' }}>No screenshots for this date</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
