import { useState, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getActivityLog: (options?: { limit?: number; offset?: number; appFilter?: string }) => Promise<{
        activities: any[];
        screenshots: any[];
        total: number;
      }>;
      getScreenshotImage: (filename: string) => Promise<ArrayBuffer | null>;
    };
  }
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDur(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
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

const COLORS: Record<string, string> = {
  Coding: '#818cf8', Terminal: '#34d399', Research: '#60a5fa',
  Communication: '#fbbf24', Design: '#f472b6', Email: '#38bdf8',
  Meeting: '#a78bfa', Working: '#94a3b8',
};

export default function ActivityLog() {
  const [activities, setActivities] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState('');
  const [images, setImages] = useState<Record<number, string>>({});
  const [selectedScreenshot, setSelectedScreenshot] = useState<any>(null);

  const load = useCallback(async (reset: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await window.electronAPI.getActivityLog({
        limit: 30, offset: reset ? 0 : activities.length, appFilter: filter || undefined,
      });
      setActivities(reset ? r.activities : [...activities, ...r.activities]);
      setScreenshots(r.screenshots);
      setTotal(r.total);
      setHasMore(r.activities.length === 30);
    } catch {}
    setLoading(false);
  }, [activities.length, filter, loading]);

  useEffect(() => { load(true); }, [filter]);

  useEffect(() => {
    let active = true;
    const loadImages = async () => {
      const toLoad = screenshots.filter(ss => ss.file_path && !images[ss.id]);
      if (toLoad.length === 0) return;
      
      const newImages = { ...images };
      for (const ss of toLoad) {
        try {
          const buf = await window.electronAPI.getScreenshotImage(ss.file_path);
          if (buf && active) {
            const blob = new Blob([buf as any], { type: 'image/png' });
            newImages[ss.id] = URL.createObjectURL(blob);
          }
        } catch (e) {
          console.error(e);
        }
      }
      if (active) setImages(newImages);
    };
    loadImages();
    return () => { active = false; };
  }, [screenshots]);

  const grouped = activities.reduce((g: Record<string, any[]>, a: any) => {
    const d = new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    (g[d] || (g[d] = [])).push(a);
    return g;
  }, {});

  const apps = [...new Set(activities.map((a: any) => a.app_name))] as string[];

  return (
    <div className="actlog">
      <header className="actlog-header">
        <h2>Activity Log</h2>
        <div className="actlog-controls">
          <select value={filter} onChange={e => setFilter(e.target.value)} className="glass-select">
            <option value="">All Apps</option>
            {apps.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="actlog-count">{total} activities</span>
        </div>
      </header>

      {screenshots.length > 0 && (
        <section className="ss-section">
          <h3>Screenshots</h3>
          <div className="ss-grid">
            {screenshots.map(ss => (
              <div key={ss.id} className="glass-card ss-card" onClick={() => setSelectedScreenshot(ss)}>
                <div className="ss-preview">
                  <img 
                    src={images[ss.id] || ''}
                    alt="Screenshot"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                    style={{ display: images[ss.id] ? 'block' : 'none' }}
                  />
                  {!images[ss.id] && <span>{fmtTime(ss.timestamp)}</span>}
                </div>
                {ss.ai_processed === 1 && ss.ai_description && (
                  <div className="ss-ai">
                    <span className="ss-badge">{ss.ai_state || 'Analyzed'}</span>
                    <p>{ss.ai_description}</p>
                  </div>
                )}
                {ss.ai_processed === 0 && (
                  <div className="ss-ai">
                    <span className="ss-badge" style={{ backgroundColor: '#f59e0b' }}>Pending</span>
                    <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>Pending AI Analysis...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="log-timeline">
        {Object.entries(grouped).map(([date, dayActs]: [string, any[]]) => (
          <div key={date} className="log-day">
            <div className="log-date">{date}</div>
            {dayActs.map((a: any) => {
              const act = inferActivity(a.app_name);
              const c = COLORS[act] || '#94a3b8';
              return (
                <div key={a.id} className="log-entry">
                  <span className="log-time" style={{ color: c }}>{fmtTime(a.timestamp)}</span>
                  <div className="log-body">
                    <span className="log-app">{a.app_name}</span>
                    <span className="log-win">{a.window_title || 'No title'}</span>
                    <div className="log-meta">
                      <span className="log-tag" style={{ color: c, borderColor: c }}>{act}</span>
                      {a.duration_seconds > 0 && <span className="log-dur">{fmtDur(a.duration_seconds)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="load-more">
          <button onClick={() => load(false)} disabled={loading} className="glass-btn">
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {!loading && activities.length === 0 && (
        <div className="glass-card empty-state"><p>No activity recorded yet</p></div>
      )}

      {selectedScreenshot && (
        <div className="ss-modal-overlay" onClick={() => setSelectedScreenshot(null)}>
          <div className="ss-modal-content" onClick={e => e.stopPropagation()}>
            <button className="ss-modal-close" onClick={() => setSelectedScreenshot(null)}>&times;</button>
            <div className="ss-modal-body">
              <div className="ss-modal-img-wrap">
                <img src={images[selectedScreenshot.id] || ''} alt="Full Screenshot" />
              </div>
              <div className="ss-modal-ai">
                <h3>AI Context</h3>
                {selectedScreenshot.ai_description ? (
                  <>
                    <p><strong>App:</strong> {selectedScreenshot.ai_app || 'N/A'}</p>
                    <p><strong>Project:</strong> {selectedScreenshot.ai_project || 'N/A'}</p>
                    <p><strong>Task:</strong> {selectedScreenshot.ai_task || 'N/A'}</p>
                    <p><strong>Language:</strong> {selectedScreenshot.ai_language || 'N/A'}</p>
                    <p><strong>Framework:</strong> {selectedScreenshot.ai_framework || 'N/A'}</p>
                    <p><strong>State:</strong> {selectedScreenshot.ai_state || 'N/A'}</p>
                    {selectedScreenshot.ai_tags && (
                      <p><strong>Tags:</strong> {selectedScreenshot.ai_tags}</p>
                    )}
                    <div className="ss-modal-desc">
                      <strong>Description:</strong>
                      <p>{selectedScreenshot.ai_description}</p>
                    </div>
                  </>
                ) : (
                  <p>No AI analysis available yet for this screenshot.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}