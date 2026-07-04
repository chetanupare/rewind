import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ActivityLog from './pages/ActivityLog';
import Timeline from './pages/Timeline';
import Search from './pages/Search';
import Chat from './pages/Chat';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Omnibar from './pages/Omnibar';

export default function App() {
  const location = useLocation();
  const isOmnibar = location.pathname === '/omnibar';

  if (isOmnibar) {
    return (
      <Routes>
        <Route path="/omnibar" element={<Omnibar />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src="./assets/brand/icon.png" 
              alt="RewindX" 
              style={{ width: '32px', height: '32px', borderRadius: '8px' }}
            />
            <h1>RewindX</h1>
          </div>
        </div>
        <ul className="nav-links">
          <li><NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>Dashboard</NavLink></li>
          <li><NavLink to="/activity" className={({ isActive }) => isActive ? 'active' : ''}>Activity Log</NavLink></li>
          <li><NavLink to="/timeline" className={({ isActive }) => isActive ? 'active' : ''}>Timeline</NavLink></li>
          <li><NavLink to="/search" className={({ isActive }) => isActive ? 'active' : ''}>Search</NavLink></li>
          <li><NavLink to="/chat" className={({ isActive }) => isActive ? 'active' : ''}>AI Chat</NavLink></li>
          <li><NavLink to="/reports" className={({ isActive }) => isActive ? 'active' : ''}>Reports</NavLink></li>
          <li><NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>Settings</NavLink></li>
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/search" element={<Search />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
