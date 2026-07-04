import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Brain,
  Search,
  Clock,
  FileText,
  Settings,
  User,
  Sparkles,
  LayoutDashboard,
  Code,
  Zap,
  Play,
  Bell,
  Camera,
  Globe,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Memory from './pages/Memory';
import SearchPage from './pages/Search';
import Timeline from './pages/Timeline';
import Notes from './pages/Notes';
import SettingsPage from './pages/Settings';
import DeveloperMode from './pages/DeveloperMode';
import FocusAnalytics from './pages/FocusAnalytics';
import SessionReplay from './pages/SessionReplay';
import Screenshots from './pages/Screenshots';
import BrowserExtension from './pages/BrowserExtension';
import MemoryDashboard from './pages/MemoryDashboard';

type Page = 'dashboard' | 'chat' | 'memory' | 'search' | 'timeline' | 'screenshots' | 'developer' | 'focus' | 'replay' | 'browser' | 'notes' | 'settings' | 'memory-health';

const navItems = [
  { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'chat' as Page, icon: MessageSquare, label: 'Chat' },
  { id: 'memory' as Page, icon: Brain, label: 'Memory' },
  { id: 'memory-health' as Page, icon: Sparkles, label: 'Brain' },
  { id: 'search' as Page, icon: Search, label: 'Search' },
  { id: 'timeline' as Page, icon: Clock, label: 'Timeline' },
  { id: 'screenshots' as Page, icon: Camera, label: 'Screenshots' },
  { id: 'developer' as Page, icon: Code, label: 'Developer' },
  { id: 'focus' as Page, icon: Zap, label: 'Focus' },
  { id: 'replay' as Page, icon: Play, label: 'Replay' },
  { id: 'browser' as Page, icon: Globe, label: 'Browser' },
  { id: 'notes' as Page, icon: FileText, label: 'Notes' },
  { id: 'settings' as Page, icon: Settings, label: 'Settings' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'chat':
        return <Chat />;
      case 'memory':
        return <Memory />;
      case 'search':
        return <SearchPage />;
      case 'timeline':
        return <Timeline />;
      case 'notes':
        return <Notes />;
      case 'settings':
        return <SettingsPage />;
      case 'screenshots':
        return <Screenshots />;
      case 'developer':
        return <DeveloperMode />;
      case 'focus':
        return <FocusAnalytics />;
      case 'replay':
        return <SessionReplay />;
      case 'browser':
        return <BrowserExtension />;
      case 'memory-health':
        return <MemoryDashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <div className="bg-glow" />
      <div className="noise-overlay" />

      <nav className="sidebar">
        <div className="sidebar-logo">
          <Sparkles />
        </div>

        <div className="sidebar-items">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
              data-tooltip={item.label}
            >
              <item.icon />
            </button>
          ))}
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">
            <User />
          </div>
        </div>
      </nav>

      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
