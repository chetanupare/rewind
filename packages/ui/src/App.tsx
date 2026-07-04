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
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Memory from './pages/Memory';
import SearchPage from './pages/Search';
import Timeline from './pages/Timeline';
import Notes from './pages/Notes';
import SettingsPage from './pages/Settings';

type Page = 'dashboard' | 'chat' | 'memory' | 'search' | 'timeline' | 'notes' | 'settings';

const navItems = [
  { id: 'dashboard' as Page, icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'chat' as Page, icon: MessageSquare, label: 'Chat' },
  { id: 'memory' as Page, icon: Brain, label: 'Memory' },
  { id: 'search' as Page, icon: Search, label: 'Search' },
  { id: 'timeline' as Page, icon: Clock, label: 'Timeline' },
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
        return <Chat onToggleMemory={() => {}} />;
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
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="relative min-h-screen bg-bg overflow-hidden">
      {/* Background Effects - CSS only */}
      <div className="bg-glow-purple" />
      <div className="bg-glow-pink" />
      <div className="noise-overlay" />

      {/* Sidebar */}
      <nav className="sidebar-nav">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple flex items-center justify-center glow-purple">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Nav Items */}
        <div className="flex-1 flex flex-col items-center gap-2">
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </motion.button>
          ))}
        </div>

        {/* User Avatar */}
        <div className="mt-auto">
          <div className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center">
            <User className="w-4 h-4 text-text-secondary" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="ml-[72px] h-screen overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
