import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getReports: () => Promise<Array<{
        id: number; type: string; date: string; summary: string; generated_at: string;
      }>>;
    };
  }
}

export default function Reports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.electronAPI.getReports().then(r => { setReports(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="reports">
      <h2>Reports</h2>
      {loading ? (
        <div className="glass-card empty-state"><p>Loading...</p></div>
      ) : reports.length === 0 ? (
        <div className="glass-card empty-state"><p>No reports generated yet</p></div>
      ) : (
        <div className="report-list">
          {reports.map(r => (
            <div key={r.id} className="glass-card report-card">
              <div className="rc-header">
                <span className="rc-type">{r.type}</span>
                <span className="rc-date">{r.date}</span>
              </div>
              <p className="rc-summary">{r.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
