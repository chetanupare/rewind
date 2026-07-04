import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Code,
  Globe,
  MessageSquare,
  Image,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getTimeline: (date: string) => Promise<any[]>;
      getScreenshotsByDate: (date: string) => Promise<any[]>;
      getScreenshotImage: (filePath: string) => Promise<ArrayBuffer>;
    };
  }
}

interface TimelineEntry {
  hour: number;
  activity_summary: string;
  primary_app: string;
  primary_project: string;
  total_mouse_clicks: number;
  total_keystrokes: number;
  total_screenshots: number;
  productivity_score: number;
}

export default function Timeline() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [date]);

  useEffect(() => {
    if (screenshots.length > 0 && screenshots[currentIndex]) {
      loadImage();
    }
  }, [currentIndex, screenshots]);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const [timeline, shots] = await Promise.all([
        window.electronAPI.getTimeline(date),
        window.electronAPI.getScreenshotsByDate(date),
      ]);
      setEntries(timeline);
      setScreenshots(shots);
      if (shots.length > 0) setCurrentIndex(shots.length - 1);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    }
    setLoading(false);
  };

  const loadImage = async () => {
    try {
      const buffer = await window.electronAPI.getScreenshotImage(screenshots[currentIndex].file_path);
      if (buffer) {
        const blob = new Blob([buffer], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setImgSrc(url);
      }
    } catch {}
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const getAppIcon = (app: string) => {
    if (!app) return Clock;
    const lower = app.toLowerCase();
    if (lower.includes('code') || lower.includes('studio')) return Code;
    if (lower.includes('chrome') || lower.includes('edge') || lower.includes('firefox')) return Globe;
    if (lower.includes('slack') || lower.includes('teams')) return MessageSquare;
    return Clock;
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Timeline</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn-icon" onClick={() => changeDate(-1)}>
              <ChevronLeft style={{ width: 18, height: 18 }} />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
              style={{ width: 150, fontSize: '12px', padding: '6px 10px' }}
            />
            <button className="btn-icon" onClick={() => changeDate(1)}>
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>Loading timeline...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
            {/* Timeline */}
            <div>
              {entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <Clock style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No activity for this date</h3>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Start using your computer to build a timeline</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {entries.map((entry, i) => {
                    const Icon = getAppIcon(entry.primary_app);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="card"
                        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
                      >
                        <div style={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
                            {entry.hour.toString().padStart(2, '0')}:00
                          </span>
                        </div>
                        <div style={{ width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-purple-subtle)' }}>
                          <Icon style={{ width: 16, height: 16, color: 'var(--color-purple)' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                            {entry.primary_app || 'Unknown App'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {entry.activity_summary || 'No activity summary'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {entry.total_screenshots} screenshots
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                            {entry.total_keystrokes} keystrokes
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Time Travel */}
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>Time Travel</h3>
              <div className="card" style={{ padding: '16px' }}>
                {screenshots.length > 0 ? (
                  <div>
                    <div style={{ aspectRatio: '16/10', borderRadius: '10px', background: 'var(--color-bg)', overflow: 'hidden', marginBottom: '12px', border: '1px solid var(--color-border)' }}>
                      {imgSrc && <img src={imgSrc} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={screenshots.length - 1}
                      value={currentIndex}
                      onChange={(e) => setCurrentIndex(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--color-purple)' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {screenshots[currentIndex]?.ai_app || 'Unknown'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        {currentIndex + 1} / {screenshots.length}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                    No screenshots for this date
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
