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

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (isPlaying && selectedSession) {
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
  }, [isPlaying, selectedSession, steps.length]);

  const loadSessions = async () => {
    const mockSessions: ReplaySession[] = [
      {
        id: 1,
        start_time: new Date(Date.now() - 7200000).toISOString(),
        end_time: new Date().toISOString(),
        project: 'rewindx',
        step_count: 45,
        summary: '45 activities across 5 apps. 3 commits, 8 screenshots.',
        duration_minutes: 120,
      },
      {
        id: 2,
        start_time: new Date(Date.now() - 14400000).toISOString(),
        end_time: new Date(Date.now() - 7200000).toISOString(),
        project: 'api-service',
        step_count: 28,
        summary: '28 activities across 3 apps. 2 commits, 5 screenshots.',
        duration_minutes: 90,
      },
    ];
    setSessions(mockSessions);
  };

  const loadSteps = async (session: ReplaySession) => {
    const mockSteps: ReplayStep[] = [
      { timestamp: session.start_time, type: 'activity', app: 'VS Code', title: 'main.ts', description: 'Editing main.ts' },
      { timestamp: new Date(new Date(session.start_time).getTime() + 300000).toISOString(), type: 'screenshot', app: 'VS Code', title: 'Screenshot', description: 'Screenshot captured' },
      { timestamp: new Date(new Date(session.start_time).getTime() + 600000).toISOString(), type: 'commit', app: 'git', title: 'feat: add feature', description: 'Git commit' },
      { timestamp: new Date(new Date(session.start_time).getTime() + 900000).toISOString(), type: 'terminal', app: 'Terminal', title: 'npm test', description: 'Running tests' },
      { timestamp: new Date(new Date(session.start_time).getTime() + 1200000).toISOString(), type: 'file_change', app: 'VS Code', title: 'index.ts', description: 'Editing index.ts' },
    ];
    setSteps(mockSteps);
    setCurrentStep(0);
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
    ? sessions.filter(s => s.summary.toLowerCase().includes(searchQuery.toLowerCase()) || s.project.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Play style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Session Replay</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', height: 'calc(100vh - 200px)' }}>
          {/* Session List */}
          <div style={{ overflowY: 'auto' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px' }}>Sessions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  className={`card card-interactive ${selectedSession?.id === session.id ? 'active' : ''}`}
                  style={{
                    padding: '14px',
                    cursor: 'pointer',
                    borderColor: selectedSession?.id === session.id ? 'var(--color-purple)' : undefined,
                    background: selectedSession?.id === session.id ? 'var(--color-purple-subtle)' : undefined,
                  }}
                  onClick={() => {
                    setSelectedSession(session);
                    loadSteps(session);
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>
                    {session.project || 'Unknown Project'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    {session.summary}
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      <Clock style={{ width: 10, height: 10, verticalAlign: 'middle', marginRight: 4 }} />
                      {session.duration_minutes}min
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {session.step_count} steps
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
                        max={steps.length - 1}
                        value={currentStep}
                        onChange={(e) => setCurrentStep(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--color-purple)' }}
                      />
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                      {currentStep + 1} / {steps.length}
                    </span>
                  </div>
                </div>

                {/* Current Step */}
                {steps[currentStep] && (
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
