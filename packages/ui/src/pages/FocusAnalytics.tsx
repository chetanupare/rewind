import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Clock,
  Brain,
  Coffee,
  Users,
  TrendingUp,
  Activity,
  BarChart3,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getFocusStats: (date: string) => Promise<FocusStats>;
      getFocusSessions: (options?: { limit?: number; date?: string }) => Promise<FocusSession[]>;
      getWeeklyFocusTrend: () => Promise<Array<{ date: string; focusMinutes: number; score: number }>>;
    };
  }
}

interface FocusStats {
  totalFocusMinutes: number;
  deepWorkMinutes: number;
  shallowWorkMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  averageSessionLength: number;
  longestSession: number;
  interruptionCount: number;
  focusScore: number;
  productiveHours: Record<string, number>;
}

interface FocusSession {
  id: number;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  type: string;
  score: number;
  interruptions: number;
}

export default function FocusAnalytics() {
  const [stats, setStats] = useState<FocusStats>({
    totalFocusMinutes: 0,
    deepWorkMinutes: 0,
    shallowWorkMinutes: 0,
    breakMinutes: 0,
    meetingMinutes: 0,
    averageSessionLength: 0,
    longestSession: 0,
    interruptionCount: 0,
    focusScore: 0,
    productiveHours: {},
  });
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, sessionsData] = await Promise.all([
        window.electronAPI.getFocusStats(date),
        window.electronAPI.getFocusSessions({ date, limit: 20 }),
      ]);
      setStats(statsData);
      setSessions(sessionsData);
    } catch (err) {
      console.error('Failed to load focus data:', err);
    }
    setLoading(false);
  };

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}h ${min % 60}m`;
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'deep_work': return '#6D4CFF';
      case 'shallow_work': return '#3B82F6';
      case 'break': return '#00D47E';
      case 'meeting': return '#FBBF24';
      default: return '#6B7280';
    }
  };

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'deep_work': return Brain;
      case 'shallow_work': return Activity;
      case 'break': return Coffee;
      case 'meeting': return Users;
      default: return Clock;
    }
  };

  const maxProductivity = Math.max(...Object.values(stats.productiveHours), 1);

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Focus Analytics</h1>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
            style={{ width: 150, fontSize: '12px', padding: '6px 10px' }}
          />
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>Loading focus data...</div>
        ) : (
          <>
            {/* Main Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '12px', background: 'rgba(109,76,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap style={{ width: 20, height: 20, color: '#6D4CFF' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Focus Score</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#6D4CFF' }}>{stats.focusScore}</div>
                  </div>
                </div>
                <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${stats.focusScore}%`, background: 'linear-gradient(90deg, #6D4CFF, #FF4FA3)', borderRadius: 3 }} />
                </div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Brain style={{ width: 18, height: 18, color: '#6D4CFF' }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Deep Work</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)' }}>{formatMinutes(stats.deepWorkMinutes)}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Activity style={{ width: 18, height: 18, color: '#3B82F6' }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Shallow Work</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)' }}>{formatMinutes(stats.shallowWorkMinutes)}</div>
              </div>

              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Users style={{ width: 18, height: 18, color: '#FBBF24' }} />
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Meetings</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)' }}>{formatMinutes(stats.meetingMinutes)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
              {/* Left */}
              <div>
                {/* Productive Hours */}
                <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px' }}>
                    <BarChart3 style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 8 }} />
                    Productive Hours
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: 120 }}>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      const value = stats.productiveHours[hour] || 0;
                      const height = maxProductivity > 0 ? (value / maxProductivity) * 100 : 0;
                      return (
                        <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '100%', height: `${height}px`, background: value > 0 ? 'linear-gradient(180deg, #6D4CFF, #FF4FA3)' : 'var(--color-surface)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease' }} />
                          <span style={{ fontSize: '9px', color: 'var(--color-text-muted)' }}>{hour}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Sessions */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Recent Sessions</h3>
                  {sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>No focus sessions today</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sessions.map((session, i) => {
                        const Icon = getSessionTypeIcon(session.type);
                        const color = getSessionTypeColor(session.type);
                        return (
                          <motion.div
                            key={session.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="card"
                            style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}
                          >
                            <div style={{ width: 36, height: 36, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}15` }}>
                              <Icon style={{ width: 16, height: 16, color }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
                                {session.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                                {session.duration_minutes}min • {session.interruptions} interruptions
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '16px', fontWeight: 700, color }}>{session.score}</div>
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>score</div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Session Stats</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Average Length', value: formatMinutes(stats.averageSessionLength), icon: Clock },
                      { label: 'Longest Session', value: formatMinutes(stats.longestSession), icon: TrendingUp },
                      { label: 'Interruptions', value: stats.interruptionCount.toString(), icon: Activity },
                      { label: 'Total Focus', value: formatMinutes(stats.totalFocusMinutes), icon: Zap },
                    ].map((item) => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <item.icon style={{ width: 14, height: 14, color: 'var(--color-text-muted)' }} />
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.label}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '14px' }}>Time Distribution</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { label: 'Deep Work', value: stats.deepWorkMinutes, color: '#6D4CFF' },
                      { label: 'Shallow Work', value: stats.shallowWorkMinutes, color: '#3B82F6' },
                      { label: 'Meetings', value: stats.meetingMinutes, color: '#FBBF24' },
                      { label: 'Breaks', value: stats.breakMinutes, color: '#00D47E' },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{item.label}</span>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: item.color }}>{formatMinutes(item.value)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-bg)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${stats.totalFocusMinutes > 0 ? (item.value / stats.totalFocusMinutes) * 100 : 0}%`, background: item.color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
