import { useState, useEffect } from 'react';
import { GlassCard, AuroraBackground } from '../components';

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

function inferProject(title: string, app: string): string {
  const m = title.match(/([A-Z][a-zA-Z]+(?:CRM|API|App|Web|UI|Service|Module))/);
  if (m) return m[1];
  const p = title.match(/([a-zA-Z_-]+(?:\\[a-zA-Z_-]+)+)/);
  if (p) { const parts = p[1].split(/[/\\]/); return parts[parts.length - 1]; }
  return app;
}

const ACCENT_COLORS: Record<string, string> = {
  Coding: '#818cf8',
  Terminal: '#34d399',
  Research: '#60a5fa',
  Communication: '#fbbf24',
  Design: '#f472b6',
  Email: '#38bdf8',
  Meeting: '#a78bfa',
  Working: '#94a3b8',
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
    <div className="dash" style={{ position: 'relative' }}>
      <AuroraBackground className="dashboard-aurora" />
      
      <header className="dash-greeting" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <img 
            src="./assets/brand/text-logo.png" 
            alt="RewindX" 
            style={{ height: '32px', width: 'auto' }}
          />
        </div>
        <h1>{getGreeting()}</h1>
        <p>Here's what's happening with your work</p>
      </header>

      <div className="bento-grid" style={{ position: 'relative', zIndex: 1 }}>
        {screenshots.length > 0 ? (
          <GlassCard gradient className="bento-hero" style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 4' } as any}>
            <div className="pulse-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-dot" />
                <span className="pulse-label">Time Travel - {date}</span>
              </div>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="glass-input"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '8px' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ 
                flex: 1, 
                background: 'var(--bg3)', 
                borderRadius: '12px', 
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                minHeight: '240px'
              }}>
                {imgSrc ? (
                  <img 
                    src={imgSrc} 
                    alt="Screenshot" 
                    style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} 
                  />
                ) : (
                  <div style={{ color: 'var(--text3)' }}>Loading image...</div>
                )}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h2 className="ctx-project" style={{ margin: 0, fontSize: '1.2rem' }}>
                    {screenshots[currentIndex]?.ai_project || inferProject(screenshots[currentIndex]?.window_title || '', screenshots[currentIndex]?.app_name || '')}
                  </h2>
                  <p className="ctx-app" style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                    {screenshots[currentIndex] ? new Date(screenshots[currentIndex].timestamp).toLocaleTimeString() : ''} &middot; {screenshots[currentIndex]?.app_name} &middot; {screenshots[currentIndex]?.window_title || 'No title'}
                  </p>
                </div>
                <button 
                  className="btn glass-btn btn-primary" 
                  onClick={() => {
                    if (!screenshots[currentIndex]) return;
                    const ss = screenshots[currentIndex];
                    const title = ss.window_title || '';
                    const appName = ss.app_name || '';
                    const pathMatch = title.match(/([a-zA-Z]:\\[a-zA-Z0-9_\-\\]+)/);
                    const projectPath = pathMatch ? pathMatch[1] : 'C:\\Users\\User\\Projects\\' + (ss.ai_project || inferProject(title, appName));
                    window.electronAPI.restoreContext(projectPath);
                  }}
                >
                  Restore Context
                </button>
              </div>
              
              <input 
                type="range" 
                min="0" 
                max={screenshots.length - 1} 
                value={currentIndex}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--brand)', marginTop: '8px' }}
              />
            </div>
          </GlassCard>
        ) : (
          <GlassCard gradient className="bento-hero" style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 4' } as any}>
            <div className="pulse-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-dot" />
                <span className="pulse-label">Time Travel - {date}</span>
              </div>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="glass-input"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '8px' }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', minHeight: '240px' }}>
              No screenshots found for {date}
            </div>
          </GlassCard>
        )}

        <div style={{ gridColumn: 'span 4', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            { label: 'Coding', value: `${codingMin}m`, color: ACCENT_COLORS.Coding },
            { label: 'Research', value: `${researchMin}m`, color: ACCENT_COLORS.Research },
            { label: 'Meetings', value: `${commMin}m`, color: ACCENT_COLORS.Communication },
            { label: 'Screenshots', value: stats.totalScreenshots, color: '#94a3b8' },
          ].map(s => (
            <GlassCard key={s.label} className="stat-card" style={{ padding: '20px 16px' } as any}>
              <div className="stat-value" style={{ color: s.color, fontSize: '24px' }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </GlassCard>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '16px', position: 'relative', zIndex: 1 }}>
        <section className="feed-section" style={{ gridColumn: 'span 8' }}>
          <h3>Recent Activity</h3>
          {activities.length === 0 && !loading ? (
            <GlassCard>
              <p style={{ textAlign: 'center', color: 'var(--text3)' }}>Start using your computer — activity will appear here</p>
            </GlassCard>
          ) : (
            <div className="feed">
              {activities.slice(0, 10).map((a, i) => {
                const act = inferActivity(a.app_name);
                const color = ACCENT_COLORS[act] || '#94a3b8';
                return (
                  <div key={a.id} className={`feed-row ${i === 0 ? 'feed-row-live' : ''}`}>
                    <span className="feed-time">{timeAgo(a.timestamp)}</span>
                    <div className="feed-body">
                      <span className="feed-app">{a.app_name}</span>
                      <span className="feed-title">{a.window_title || 'No title'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span className="feed-dur">{a.duration_seconds ? fmtDur(a.duration_seconds) : ''}</span>
                      <span className="feed-act" style={{ color }}>{act}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {stats.topApps.length > 0 && (
          <section className="feed-section" style={{ gridColumn: 'span 4' }}>
            <h3>Most Used Today</h3>
            <div className="top-apps">
              {stats.topApps.map((a, i) => (
                <div key={a.name} className="top-app-row">
                  <span className="top-rank">#{i + 1}</span>
                  <span className="top-name">{a.name}</span>
                  <span className="top-count">{a.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
