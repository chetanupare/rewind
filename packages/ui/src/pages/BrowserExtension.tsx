import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Clock,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  Settings,
  Check,
  ArrowRight,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getMemoryApiPort: () => Promise<number>;
    };
  }
}

interface BrowserTab {
  url: string;
  title: string;
  timestamp: string;
  duration?: number;
}

export default function BrowserExtension() {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [stats, setStats] = useState({ totalTabs: 0, totalTime: 0, topSites: [] as Array<{ site: string; count: number }> });
  const [loading, setLoading] = useState(true);
  const [apiPort, setApiPort] = useState(48291);

  useEffect(() => {
    loadBrowserData();
    const interval = setInterval(loadBrowserData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadBrowserData = async () => {
    try {
      const port = await window.electronAPI.getMemoryApiPort();
      setApiPort(port);

      const response = await fetch(`http://localhost:${port}/activities?limit=50`);
      if (response.ok) {
        const data = await response.json() as any;
        if (data.success && data.data) {
          const browserActivities = data.data.filter((a: any) => {
            const app = (a.app_name || '').toLowerCase();
            return app.includes('chrome') || app.includes('edge') || app.includes('firefox') || app.includes('brave');
          });

          const tabsData: BrowserTab[] = browserActivities.map((a: any) => ({
            url: a.window_title || '',
            title: a.window_title || 'Unknown',
            timestamp: a.timestamp,
            duration: a.duration_seconds,
          }));

          setTabs(tabsData);

          // Calculate stats
          const siteCounts: Record<string, number> = {};
          tabsData.forEach(t => {
            try {
              const hostname = new URL(t.url).hostname.replace('www.', '');
              siteCounts[hostname] = (siteCounts[hostname] || 0) + 1;
            } catch {
              // Not a valid URL
            }
          });

          const topSites = Object.entries(siteCounts)
            .map(([site, count]) => ({ site, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

          setStats({
            totalTabs: tabsData.length,
            totalTime: tabsData.reduce((sum, t) => sum + (t.duration || 0), 0),
            topSites,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load browser data:', err);
    }
    setLoading(false);
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  const extractSite = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url.substring(0, 30);
    }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Globe style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Browser Activity</h1>
          </div>
          <button className="btn btn-secondary" onClick={loadBrowserData} style={{ fontSize: '12px', padding: '8px 16px' }}>
            <RefreshCw style={{ width: 14, height: 14, marginRight: 6 }} /> Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(109,76,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe style={{ width: 18, height: 18, color: '#6D4CFF' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Pages Tracked</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>{stats.totalTabs}</div>
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(255,79,163,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock style={{ width: 18, height: 18, color: '#FF4FA3' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Time Browsing</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>{formatDuration(stats.totalTime)}</div>
          </div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(0,212,126,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp style={{ width: 18, height: 18, color: '#00D47E' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Top Sites</span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-text)' }}>{stats.topSites.length}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          {/* Browser History */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Recent Browser Activity</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Loading...</div>
            ) : tabs.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
                <Globe style={{ width: 40, height: 40, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No browser activity yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Start browsing to see your activity here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tabs.map((tab, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="card card-interactive"
                    style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Globe style={{ width: 16, height: 16, color: '#3B82F6' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tab.title || 'Untitled'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {extractSite(tab.url)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {new Date(tab.timestamp).toLocaleTimeString()}
                      </div>
                      {tab.duration && (
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {formatDuration(tab.duration)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Top Sites */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Top Sites</h3>
            <div className="card" style={{ padding: '16px' }}>
              {stats.topSites.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>No data yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stats.topSites.map((site, i) => {
                    const colors = ['#6D4CFF', '#FF4FA3', '#3B82F6', '#00D47E', '#FBBF24'];
                    const color = colors[i % colors.length];
                    return (
                      <div key={site.site} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15`, fontSize: '11px', fontWeight: 800, color }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.site}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500 }}>{site.count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
