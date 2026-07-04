import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  BarChart3,
  Activity,
  Layers,
  Target,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      chat: (message: string) => Promise<{ role: string; content: string }>;
    };
  }
}

interface CognitiveMetrics {
  knowledge: string;
  predictionAccuracy: string;
  reasoningAccuracy: string;
  memoriesReinforced: number;
  memoriesForgotten: number;
  knowledgeConflicts: number;
  topicsLearned: number;
  goalsCompleted: number;
}

interface MemoryHealth {
  knowledge: number;
  episodes: number;
  patterns: number;
  mistakesLearned: number;
  predictions: number;
  accuracy: number;
  reflections: number;
  knowledgeGrowth: number;
}

export default function MemoryDashboard() {
  const [metrics, setMetrics] = useState<CognitiveMetrics>({
    knowledge: '0',
    predictionAccuracy: '0%',
    reasoningAccuracy: '0%',
    memoriesReinforced: 0,
    memoriesForgotten: 0,
    knowledgeConflicts: 0,
    topicsLearned: 0,
    goalsCompleted: 0,
  });
  const [health, setHealth] = useState<MemoryHealth>({
    knowledge: 0,
    episodes: 0,
    patterns: 0,
    mistakesLearned: 0,
    predictions: 0,
    accuracy: 0,
    reflections: 0,
    knowledgeGrowth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      // These would come from IPC calls in production
      // For now using mock data that represents the structure
      setMetrics({
        knowledge: '2.4K',
        predictionAccuracy: '89%',
        reasoningAccuracy: '92%',
        memoriesReinforced: 213,
        memoriesForgotten: 47,
        knowledgeConflicts: 2,
        topicsLearned: 5,
        goalsCompleted: 12,
      });

      setHealth({
        knowledge: 2430,
        episodes: 381,
        patterns: 82,
        mistakesLearned: 41,
        predictions: 1520,
        accuracy: 91,
        reflections: 29,
        knowledgeGrowth: 18,
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
    }
    setLoading(false);
  };

  const statCards = [
    { label: 'Knowledge', value: metrics.knowledge, icon: Database, color: '#6D4CFF', description: 'Total memories stored' },
    { label: 'Episodes', value: health.episodes.toString(), icon: Clock, color: '#3B82F6', description: 'Work sessions recorded' },
    { label: 'Patterns', value: health.patterns.toString(), icon: Activity, color: '#00D47E', description: 'Behavioral patterns learned' },
    { label: 'Accuracy', value: metrics.predictionAccuracy, icon: Target, color: '#FF4FA3', description: 'Prediction accuracy' },
  ];

  const brainStats = [
    { label: 'Memories Reinforced', value: metrics.memoriesReinforced, icon: TrendingUp, color: '#00D47E' },
    { label: 'Memories Forgotten', value: metrics.memoriesForgotten, icon: Clock, color: '#6B7280' },
    { label: 'Knowledge Conflicts', value: metrics.knowledgeConflicts, icon: AlertTriangle, color: '#FBBF24' },
    { label: 'Topics Learned', value: metrics.topicsLearned, icon: Layers, color: '#6D4CFF' },
    { label: 'Goals Completed', value: metrics.goalsCompleted, icon: CheckCircle, color: '#00D47E' },
    { label: 'Mistakes Learned', value: health.mistakesLearned, icon: GitBranch, color: '#FF4FA3' },
  ];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Brain style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
            <h1>Memory Health</h1>
          </div>
          <div className="badge badge-success">
            <Zap style={{ width: 12, height: 12, marginRight: 4 }} />
            Brain Active
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Main Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="card"
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '12px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <stat.icon style={{ width: 20, height: 20, color: stat.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{stat.label}</div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{stat.description}</div>
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Brain Stats */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain style={{ width: 16, height: 16, color: 'var(--color-purple)' }} />
              Brain Statistics
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {brainStats.map((stat) => (
                <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: `${stat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <stat.icon style={{ width: 16, height: 16, color: stat.color }} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{stat.label}</span>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Growth */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp style={{ width: 16, height: 16, color: '#00D47E' }} />
              Knowledge Growth
            </h3>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', fontWeight: 800, color: '#00D47E' }}>+{health.knowledgeGrowth}%</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>This week</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Total Knowledge</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{health.knowledge.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Episodes</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{health.episodes}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Patterns</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{health.patterns}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Reflections</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{health.reflections}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cognitive Metrics */}
        <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 style={{ width: 16, height: 16, color: 'var(--color-purple)' }} />
            Cognitive Metrics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#6D4CFF' }}>{metrics.knowledge}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Knowledge</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#3B82F6' }}>{metrics.predictionAccuracy}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Prediction</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#00D47E' }}>{metrics.reasoningAccuracy}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Reasoning</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#FF4FA3' }}>{metrics.topicsLearned}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Topics</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
