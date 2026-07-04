import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Brain,
  Key,
  Monitor,
  Keyboard,
  Save,
  Check,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      updateConfig: (partial: any) => Promise<any>;
    };
  }
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('general');

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { id: 'general', icon: SettingsIcon, label: 'General' },
    { id: 'appearance', icon: Palette, label: 'Appearance' },
    { id: 'ai', icon: Brain, label: 'AI Models' },
    { id: 'privacy', icon: Shield, label: 'Privacy' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'shortcuts', icon: Keyboard, label: 'Shortcuts' },
    { id: 'storage', icon: Database, label: 'Storage' },
  ];

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <div className="w-56 border-r border-border p-4">
        <h1 className="text-lg font-bold text-text mb-6 px-2">Settings</h1>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                activeSection === section.id
                  ? 'bg-purple/10 text-purple'
                  : 'text-text-secondary hover:text-text hover:bg-surface'
              }`}
            >
              <section.icon className="w-4 h-4" />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-text capitalize">{activeSection}</h2>
              <p className="text-sm text-text-secondary mt-1">
                Manage your {activeSection} preferences
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary flex items-center gap-2"
              onClick={handleSave}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </motion.button>
          </div>

          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-6">
              <SettingGroup title="Profile">
                <SettingRow
                  label="Display Name"
                  description="Your name shown in the app"
                >
                  <input
                    type="text"
                    defaultValue="User"
                    className="input-area py-2 px-3 text-sm w-48"
                  />
                </SettingRow>
                <SettingRow
                  label="Email"
                  description="Your email address"
                >
                  <input
                    type="email"
                    placeholder="user@example.com"
                    className="input-area py-2 px-3 text-sm w-48"
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Behavior">
                <SettingRow
                  label="Start on Boot"
                  description="Launch RewindX when Windows starts"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Minimize to Tray"
                  description="Keep running in the background"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Auto-update"
                  description="Automatically download updates"
                >
                  <Toggle defaultChecked />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Appearance Settings */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <SettingGroup title="Theme">
                <SettingRow
                  label="Color Theme"
                  description="Choose your preferred theme"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>Dark</option>
                    <option>Light</option>
                    <option>System</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Accent Color"
                  description="Primary color for highlights"
                >
                  <div className="flex gap-2">
                    {['#6D4CFF', '#FF4FA3', '#3B82F6', '#10B981', '#F59E0B'].map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded-lg border-2 border-transparent hover:border-white/20 transition-colors"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Layout">
                <SettingRow
                  label="Font Size"
                  description="Adjust text size"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>Small</option>
                    <option>Medium</option>
                    <option>Large</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Compact Mode"
                  description="Reduce spacing between elements"
                >
                  <Toggle />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* AI Settings */}
          {activeSection === 'ai' && (
            <div className="space-y-6">
              <SettingGroup title="Ollama Configuration">
                <SettingRow
                  label="Ollama Host"
                  description="Ollama server address"
                >
                  <input
                    type="text"
                    defaultValue="localhost"
                    className="input-area py-2 px-3 text-sm w-48"
                  />
                </SettingRow>
                <SettingRow
                  label="Ollama Port"
                  description="Ollama server port"
                >
                  <input
                    type="number"
                    defaultValue="11434"
                    className="input-area py-2 px-3 text-sm w-48"
                  />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Models">
                <SettingRow
                  label="Vision Model"
                  description="Model for analyzing screenshots"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>qwen2.5-vl:3b</option>
                    <option>qwen2.5-vl:7b</option>
                    <option>llava:7b</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Text Model"
                  description="Model for chat and summaries"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>qwen2.5-coder:3b</option>
                    <option>qwen2.5-coder:7b</option>
                    <option>llama3:8b</option>
                  </select>
                </SettingRow>
                <SettingRow
                  label="Embedding Model"
                  description="Model for semantic search"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>nomic-embed-text</option>
                    <option>mxbai-embed-large</option>
                  </select>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <div className="space-y-6">
              <SettingGroup title="Data Collection">
                <SettingRow
                  label="Store Screenshots"
                  description="Save screenshots for analysis"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Store Clipboard"
                  description="Track clipboard history"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Track Keyboard"
                  description="Monitor keyboard activity"
                >
                  <Toggle defaultChecked />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Blacklisted Apps">
                <SettingRow
                  label="Password Managers"
                  description="Skip 1Password, Bitwarden, etc."
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Banking Apps"
                  description="Skip financial applications"
                >
                  <Toggle defaultChecked />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Notifications Settings */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <SettingGroup title="Alerts">
                <SettingRow
                  label="Daily Summary"
                  description="Get notified at end of day"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="Weekly Report"
                  description="Receive weekly productivity report"
                >
                  <Toggle defaultChecked />
                </SettingRow>
                <SettingRow
                  label="System Notifications"
                  description="Show desktop notifications"
                >
                  <Toggle defaultChecked />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Shortcuts Settings */}
          {activeSection === 'shortcuts' && (
            <div className="space-y-6">
              <SettingGroup title="Global Shortcuts">
                <SettingRow
                  label="Open Omnibar"
                  description="Quick search and chat"
                >
                  <kbd className="px-3 py-1.5 text-xs font-semibold bg-surface rounded-lg border border-border">
                    Alt + Space
                  </kbd>
                </SettingRow>
                <SettingRow
                  label="Take Screenshot"
                  description="Capture current screen"
                >
                  <kbd className="px-3 py-1.5 text-xs font-semibold bg-surface rounded-lg border border-border">
                    Alt + Shift + S
                  </kbd>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Storage Settings */}
          {activeSection === 'storage' && (
            <div className="space-y-6">
              <SettingGroup title="Database">
                <SettingRow
                  label="Database Location"
                  description="SQLite database path"
                >
                  <span className="text-xs text-text-muted font-mono bg-surface px-3 py-1.5 rounded-lg">
                    %APPDATA%/RewindX/db
                  </span>
                </SettingRow>
                <SettingRow
                  label="Screenshots"
                  description="Number of screenshots stored"
                >
                  <span className="text-xs text-text-muted">
                    1,247 files (2.3 GB)
                  </span>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Cleanup">
                <SettingRow
                  label="Retention Period"
                  description="Delete screenshots after"
                >
                  <select className="input-area py-2 px-3 text-sm w-48">
                    <option>7 days</option>
                    <option>14 days</option>
                    <option>30 days</option>
                    <option>Never</option>
                  </select>
                </SettingRow>
              </SettingGroup>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text mb-4">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-surface transition-colors">
      <div>
        <div className="text-sm font-medium text-text">{label}</div>
        <div className="text-xs text-text-muted mt-0.5">{description}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      onClick={() => setChecked(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-purple' : 'bg-surface border border-border'
      }`}
    >
      <motion.div
        className="absolute top-1 w-4 h-4 rounded-full bg-white"
        animate={{ left: checked ? 24 : 4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}
