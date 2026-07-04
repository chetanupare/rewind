import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock,
  Code,
  GitCommit,
  Image,
  Terminal,
  FileText,
  Search,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getReplays: (limit?: number) => Promise<any[]>;
      getReplay: (id: number) => Promise<any>;
      createReplay: (startTime: string, endTime: string, project?: string) => Promise<any>;
      getActivitiesByTimeRange?: (start: string, end: string) => Promise<any[]>;
      getScreenshotsByDate: (date: string) => Promise<any[]>;
    };
  }
}

interface ReplayStep {
  timestamp: string;
  type: string;
  app: string;
  title: string;
  description: string;
}

interface ReplaySession {
  id: number;
  start_time: string;
  end_time: string;
  project: string;
  step_count: number;
  summary: string;
  duration_minutes: number;
}

export default function SessionReplay() {
  const [sessions, setSessions] = useState<ReplaySession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ReplaySession | null>(null);
  const [steps, setSteps] = useState<ReplayStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (isPlaying && steps.length > 0) {
      const interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, steps.length]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.getReplays(20);
      setSessions(data);
    } catch (err) {
      console.error('Failed to load replays:', err);
    }
    setLoading(false);
  };

  const loadReplaySteps = async (session: ReplaySession) => {
    try {
      const replay = await window.electronAPI.getReplay(session.id);
      if (replay && replay.steps) {
        setSteps(replay.steps);
      } else {
        const today = new Date().toISOString().split('T')[0];
        const screenshots = await window.electronAPI.getScreenshotsByDate(today);
        const mockSteps: ReplayStep[] = screenshots.map((s: any) => ({
          timestamp: s.timestamp,
          type: 'screenshot',
          app: s.ai_app || 'Unknown',
          title: s.ai_task || 'Screenshot',
          description: s.ai_description || 'Screenshot captured',
        }));
        setSteps(mockSteps);
      }
      setCurrentStep(0);
    } catch (err) {
      console.error('Failed to load replay steps:', err);
      setSteps([]);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'commit': return GitCommit;
      case 'screenshot': return Image;
      case 'terminal': return Terminal;
      case 'file_change': return FileText;
      default: return Code;
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

  const filteredSessions = searchQuery
    ? sessions.filter(s => (s.summary || '').toLowerCase().includes(searchQuery.toLowerCase()) || (s.project || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Play style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Session Replay</h1>
          </div>
          <div className="input-icon">
            <Search />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ width: 200, fontSize: '12px', padding: '6px 10px 6px 36px' }}
            />
          </div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
          {/* Session List */}
          <div style={{ overflowY: 'auto' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>Sessions</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Loading...</div>
            ) : filteredSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Play style={{ width: 32, height: 32, color: 'var(--color-text-muted)', marginBottom: 12 }} />
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No replay sessions yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className="card card-interactive"
                    style={{
                      padding: '14px',
                      cursor: 'pointer',
                      borderColor: selectedSession?.id === session.id ? 'var(--color-purple)' : undefined,
                      background: selectedSession?.id === session.id ? 'var(--color-purple-subtle)' : undefined,
                    }}
                    onClick={() => {
                      setSelectedSession(session);
                      loadReplaySteps(session);
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                      {session.project || 'Unknown Project'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                      {session.summary || 'No summary'}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        <Clock style={{ width: 10, height: 10, verticalAlign: 'middle', marginRight: 4 }} />
                        {session.duration_minutes || 0}min
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {session.step_count || 0} steps
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Replay Viewer */}
          <div>
            {selectedSession ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Controls */}
                <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button className="btn-icon" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
                      <SkipBack style={{ width: 18, height: 18 }} />
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setIsPlaying(!isPlaying)}
                      style={{ width: 40, height: 40, padding: 0, borderRadius: '50%' }}
                    >
                      {isPlaying ? <Pause style={{ width: 18, height: 18 }} /> : <Play style={{ width: 18, height: 18 }} />}
                    </button>
                    <button className="btn-icon" onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}>
                      <SkipForward style={{ width: 18, height: 18 }} />
                    </button>
                    <div style={{ flex: 1 }}>
                      <input
                        type="range"
                        min="0"
                        max={Math.max(0, steps.length - 1)}
                        value={currentStep}
                        onChange={(e) => setCurrentStep(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-purple)' }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {steps.length > 0 ? `${currentStep + 1} / ${steps.length}` : '0 / 0'}
                    </span>
                  </div>
                </div>

                {/* Current Step */}
                {steps.length > 0 && steps[currentStep] && (
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                    style={{ padding: '24px', marginBottom: '16px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${getTypeColor(steps[currentStep].type)}15` }}>
                        {(() => {
                          const Icon = getTypeIcon(steps[currentStep].type);
                          return <Icon style={{ width: 20, height: 20, color: getTypeColor(steps[currentStep].type) }} />;
                        })()}
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>{steps[currentStep].title}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{steps[currentStep].app}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{steps[currentStep].description}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '12px' }}>
                      {new Date(steps[currentStep].timestamp).toLocaleTimeString()}
                    </div>
                  </motion.div>
                )}

                {/* Timeline */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>Timeline</h3>
                  {steps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>No steps in this session</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {steps.map((step, i) => {
                        const Icon = getTypeIcon(step.type);
                        const color = getTypeColor(step.type);
                        return (
                          <div
                            key={i}
                            className="card"
                            style={{
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              opacity: i === currentStep ? 1 : 0.6,
                              borderColor: i === currentStep ? 'var(--color-purple)' : undefined,
                            }}
                            onClick={() => setCurrentStep(i)}
                          >
                            <div style={{ width: 24, height: 24, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15` }}>
                              <Icon style={{ width: 12, height: 12, color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text)' }}>{step.title}</div>
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {new Date(step.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Play style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Select a session</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Choose a session from the list to replay it</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
