import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getTimeline: (date: string) => Promise<Array<{
        hour: number;
        activity_summary: string;
        primary_app: string;
        primary_project: string;
        total_screenshots: number;
        productivity_score: number;
      }>>;
    };
  }
}

export default function Timeline() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.electronAPI.getTimeline(date).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [date]);

  const get = (h: number) => data.find(e => e.hour === h);

  return (
    <div className="tl">
      <header className="tl-header">
        <h2>Timeline</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="glass-input" />
      </header>

      {!loading && data.length === 0 && (
        <div className="glass-card empty-state"><p>No data for this date yet</p></div>
      )}

      <div className="tl-grid">
        {Array.from({ length: 24 }, (_, h) => {
          const e = get(h);
          return (
            <div key={h} className={`tl-row ${e ? 'tl-row-active' : ''}`}>
              <span className="tl-hour">{h.toString().padStart(2, '0')}:00</span>
              <div className="tl-bar">
                {e ? (
                  <div className="tl-fill" style={{ width: `${Math.max(10, (e.productivity_score || 0.5) * 100)}%` }}>
                    <span className="tl-app">{e.primary_app}</span>
                    {e.activity_summary && <span className="tl-sum">{e.activity_summary}</span>}
                  </div>
                ) : <div className="tl-empty" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
