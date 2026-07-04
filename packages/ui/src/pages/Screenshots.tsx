import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Clock,
  Brain,
  Code,
  Globe,
  FileText,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Eye,
  Sparkles,
  Image,
  X,
  Maximize2,
  Loader2,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getScreenshotsWithReviews: (options?: { date?: string; limit?: number }) => Promise<any[]>;
      getScreenshotImage: (filePath: string) => Promise<ArrayBuffer>;
      getScreenshotStats: (date: string) => Promise<{ total: number; analyzed: number; pending: number; withOcr: number }>;
    };
  }
}

interface Screenshot {
  id: number;
  timestamp: string;
  file_path: string;
  ai_description: string | null;
  ai_app: string | null;
  ai_task: string | null;
  ai_project: string | null;
  ai_state: string | null;
  ai_processed: number;
  ocr_text: string | null;
  width: number;
  height: number;
}

export default function Screenshots() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [stats, setStats] = useState({ total: 0, analyzed: 0, pending: 0, withOcr: 0 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  useEffect(() => {
    loadScreenshots();
  }, [date]);

  useEffect(() => {
    if (selectedIndex !== null && screenshots[selectedIndex]) {
      loadImage(screenshots[selectedIndex]);
    }
  }, [selectedIndex]);

  const loadScreenshots = async () => {
    setLoading(true);
    try {
      const [data, st] = await Promise.all([
        window.electronAPI.getScreenshotsWithReviews({ date, limit: 100 }),
        window.electronAPI.getScreenshotStats(date),
      ]);
      setScreenshots(data);
      setStats(st);
      if (data.length > 0 && selectedIndex === null) {
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    }
    setLoading(false);
  };

  const loadImage = async (screenshot: Screenshot) => {
    try {
      const buffer = await window.electronAPI.getScreenshotImage(screenshot.file_path);
      if (buffer) {
        const blob = new Blob([buffer], { type: 'image/webp' });
        const url = URL.createObjectURL(blob);
        setImgSrc(url);
      }
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  };

  const getStateColor = (state: string | null) => {
    switch (state) {
      case 'coding': return '#6D4CFF';
      case 'debugging': return '#EF4444';
      case 'browsing': return '#3B82F6';
      case 'reading': return '#00D47E';
      case 'designing': return '#FF4FA3';
      case 'meeting': return '#FBBF24';
      case 'terminal': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getAiStatusStyle = (aiProcessed: number) => {
    switch (aiProcessed) {
      case -1: // Pending/In Queue
        return { background: 'rgba(251, 191, 36, 0.15)', color: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.3)' };
      case 0: // Not processed
        return { background: 'rgba(107, 114, 128, 0.15)', color: '#6B7280', border: '1px solid rgba(107, 114, 128, 0.3)' };
      case 1: // Processed
        return { background: 'rgba(0, 212, 126, 0.15)', color: '#00D47E', border: '1px solid rgba(0, 212, 126, 0.3)' };
      default:
        return { background: 'rgba(107, 114, 128, 0.15)', color: '#6B7280', border: '1px solid rgba(107, 114, 128, 0.3)' };
    }
  };

  const getAiStatusText = (aiProcessed: number) => {
    switch (aiProcessed) {
      case -1: return 'Queued';
      case 0: return 'Pending';
      case 1: return 'Analyzed';
      default: return 'Unknown';
    }
  };

  const getAiStatusIcon = (aiProcessed: number) => {
    switch (aiProcessed) {
      case -1: return <Clock style={{ width: 10, height: 10 }} />;
      case 0: return <Brain style={{ width: 10, height: 10 }} />;
      case 1: return <Sparkles style={{ width: 10, height: 10 }} />;
      default: return null;
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
    setSelectedIndex(null);
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Screenshots</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={viewMode === 'grid' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewMode('grid')}
              >Grid</button>
              <button
                className={viewMode === 'timeline' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ fontSize: '11px', padding: '6px 10px' }}
                onClick={() => setViewMode('timeline')}
              >Timeline</button>
            </div>
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
            
            {/* Queue Status */}
            {stats.pending > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#FBBF24',
              }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                {stats.pending} pending analysis
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total', value: stats.total, icon: Image, color: '#6D4CFF' },
            { label: 'Analyzed', value: stats.analyzed, icon: Brain, color: '#00D47E' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: '#FBBF24' },
            { label: 'With OCR', value: stats.withOcr, icon: FileText, color: '#3B82F6' },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '8px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <stat.icon style={{ width: 16, height: 16, color: stat.color }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{stat.label}</span>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>Loading screenshots...</div>
        ) : screenshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Camera style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No screenshots</h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No screenshots captured for this date</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedIndex !== null ? '1fr 400px' : '1fr', gap: '20px' }}>
            {/* Grid/Timeline View */}
            <div>
              {viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {screenshots.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="card card-interactive"
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        borderColor: selectedIndex === i ? 'var(--color-purple)' : undefined,
                      }}
                      onClick={() => setSelectedIndex(i)}
                    >
                      <div style={{ aspectRatio: '16/10', background: 'var(--color-bg)', position: 'relative' }}>
                        <ScreenshotThumb filePath={s.file_path} />
                        
                        {/* AI Status Badge */}
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          padding: '3px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          ...getAiStatusStyle(s.ai_processed),
                        }}>
                          {getAiStatusIcon(s.ai_processed)}
                          {getAiStatusText(s.ai_processed)}
                        </div>

                        {s.ai_state && s.ai_processed === 1 && (
                          <div style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 700,
                            background: `${getStateColor(s.ai_state)}20`,
                            color: getStateColor(s.ai_state),
                            borderRadius: '6px',
                            textTransform: 'capitalize',
                          }}>
                            {s.ai_state}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {new Date(s.timestamp).toLocaleTimeString()}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
                          {s.ai_app || 'Unknown'}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {screenshots.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="card card-interactive"
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        cursor: 'pointer',
                        borderColor: selectedIndex === i ? 'var(--color-purple)' : undefined,
                      }}
                      onClick={() => setSelectedIndex(i)}
                    >
                      <div style={{ width: 80, height: 50, borderRadius: '8px', overflow: 'hidden', background: 'var(--color-bg)', flexShrink: 0 }}>
                        <ScreenshotThumb filePath={s.file_path} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{s.ai_app || 'Unknown'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{s.ai_task || 'No task detected'}</div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString()}</div>
                        <div style={{
                          padding: '2px 6px',
                          fontSize: '9px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          ...getAiStatusStyle(s.ai_processed),
                        }}>
                          {getAiStatusIcon(s.ai_processed)}
                          {getAiStatusText(s.ai_processed)}
                        </div>
                        {s.ai_state && s.ai_processed === 1 && (
                          <div style={{ fontSize: '10px', fontWeight: 600, color: getStateColor(s.ai_state), textTransform: 'capitalize' }}>{s.ai_state}</div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            {selectedIndex !== null && screenshots[selectedIndex] && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="card"
                style={{ padding: '20px', position: 'sticky', top: 20, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>AI Analysis</h3>
                  <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={() => setSelectedIndex(null)}>
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>

                {/* Screenshot Preview */}
                <div style={{ aspectRatio: '16/10', borderRadius: '10px', overflow: 'hidden', background: 'var(--color-bg)', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                  {imgSrc && <img src={imgSrc} alt="Screenshot" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>

                {/* AI Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <InfoRow label="Time" value={new Date(screenshots[selectedIndex].timestamp).toLocaleTimeString()} />
                  <InfoRow label="App" value={screenshots[selectedIndex].ai_app || 'Unknown'} />
                  <InfoRow label="Task" value={screenshots[selectedIndex].ai_task || 'Not detected'} />
                  <InfoRow label="Project" value={screenshots[selectedIndex].ai_project || 'Not detected'} />
                  {screenshots[selectedIndex].ai_state && (
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '4px' }}>State</div>
                      <span style={{
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: `${getStateColor(screenshots[selectedIndex].ai_state)}15`,
                        color: getStateColor(screenshots[selectedIndex].ai_state),
                        borderRadius: '8px',
                        textTransform: 'capitalize',
                      }}>
                        {screenshots[selectedIndex].ai_state}
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Description */}
                {screenshots[selectedIndex].ai_description && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles style={{ width: 12, height: 12 }} /> AI Description
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                      {screenshots[selectedIndex].ai_description}
                    </div>
                  </div>
                )}

                {/* OCR Text */}
                {screenshots[selectedIndex].ocr_text && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText style={{ width: 12, height: 12 }} /> Extracted Text
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.6,
                      maxHeight: 200,
                      overflowY: 'auto',
                      padding: '12px',
                      background: 'var(--color-bg)',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                    }}>
                      {screenshots[selectedIndex].ocr_text}
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                    disabled={selectedIndex === 0}
                  >
                    <ChevronLeft style={{ width: 14, height: 14 }} /> Previous
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                    {selectedIndex + 1} / {screenshots.length}
                  </span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '12px', padding: '8px 12px' }}
                    onClick={() => setSelectedIndex(Math.min(screenshots.length - 1, selectedIndex + 1))}
                    disabled={selectedIndex === screenshots.length - 1}
                  >
                    Next <ChevronRight style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ScreenshotThumb({ filePath }: { filePath: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      try {
        const buffer = await window.electronAPI.getScreenshotImage(filePath);
        if (buffer) {
          const blob = new Blob([buffer], { type: 'image/webp' });
          url = URL.createObjectURL(blob);
          setSrc(url);
        }
      } catch {}
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [filePath]);

  return src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
