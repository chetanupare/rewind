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

interface TimelineEntry {
  hour: number;
  app: string;
  activity: string;
  duration: string;
  type: 'coding' | 'browsing' | 'meeting' | 'other';
}

export default function Timeline() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  useEffect(() => {
    loadTimeline();
  }, [date]);

  const loadTimeline = async () => {
    // Mock data
    const mockEntries: TimelineEntry[] = [
      { hour: 9, app: 'VS Code', activity: 'Working on RewindX UI', duration: '2h 15m', type: 'coding' },
      { hour: 11, app: 'Chrome', activity: 'Reading React docs', duration: '45m', type: 'browsing' },
      { hour: 12, app: 'Slack', activity: 'Team standup', duration: '30m', type: 'meeting' },
      { hour: 13, app: 'VS Code', activity: 'Implementing features', duration: '3h', type: 'coding' },
      { hour: 16, app: 'Figma', activity: 'Design review', duration: '1h', type: 'meeting' },
      { hour: 17, app: 'Terminal', activity: 'Running tests', duration: '30m', type: 'coding' },
    ];
    setEntries(mockEntries);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'coding':
        return 'bg-purple/20 text-purple border-purple/30';
      case 'browsing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'meeting':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-surface text-text-secondary border-border';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'coding':
        return Code;
      case 'browsing':
        return Globe;
      case 'meeting':
        return MessageSquare;
      default:
        return Clock;
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text">Timeline</h1>
            <p className="text-text-secondary mt-1">
              Your work day at a glance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border">
              <Calendar className="w-4 h-4 text-text-secondary" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-text"
              />
            </div>
            <button className="btn-icon" onClick={() => changeDate(1)}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl mx-auto">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Time', value: '7h 45m', color: 'text-text' },
              { label: 'Coding', value: '5h 45m', color: 'text-purple' },
              { label: 'Meetings', value: '1h 30m', color: 'text-green-400' },
              { label: 'Research', value: '45m', color: 'text-blue-400' },
            ].map((stat) => (
              <div key={stat.label} className="card p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Timeline Entries */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {entries.map((entry, i) => {
                const Icon = getTypeIcon(entry.type);
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4"
                  >
                    <div className="w-16 text-right flex-shrink-0">
                      <span className="text-sm font-semibold text-text-secondary">
                        {entry.hour.toString().padStart(2, '0')}:00
                      </span>
                    </div>
                    <div className="relative flex-shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getTypeColor(entry.type)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="flex-1 card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-text">{entry.app}</h3>
                          <p className="text-xs text-text-secondary mt-0.5">{entry.activity}</p>
                        </div>
                        <span className="text-xs font-semibold text-text-muted bg-surface px-2 py-1 rounded-lg">
                          {entry.duration}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
