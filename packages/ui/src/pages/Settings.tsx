import { useState, useEffect } from 'react';
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
  Camera,
  Clock,
  HardDrive,
  Cpu,
  MemoryStick,
  Zap,
  Link,
  ExternalLink,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      updateConfig: (partial: any) => Promise<any>;
      getServiceStatus: () => Promise<{ running: boolean; ollama: boolean }>;
    };
  }
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState({ running: false, ollama: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cfg, st] = await Promise.all([
        window.electronAPI.getConfig(),
        window.electronAPI.getServiceStatus(),
      ]);
      setConfig(cfg);
      setStatus(st);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.updateConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const sections = [
    { id: 'general', icon: SettingsIcon, label: 'General' },
    { id: 'ai', icon: Brain, label: 'AI Models' },
    { id: 'screenshots', icon: Camera, label: 'Screenshots' },
    { id: 'privacy', icon: Shield, label: 'Privacy' },
    { id: 'performance', icon: Zap, label: 'Performance' },
    { id: 'storage', icon: HardDrive, label: 'Storage' },
    { id: 'about', icon: User, label: 'About' },
  ];

  if (!config) return <div style={{ padding: '40px', color: 'var(--color-text-muted)' }}>Loading settings...</div>;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <div style={{ width: 220, borderRight: '1px solid var(--color-border)', padding: '20px 12px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '20px', padding: '0 8px' }}>Settings</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeSection === section.id ? 'var(--color-purple-subtle)' : 'transparent',
                color: activeSection === section.id ? 'var(--color-purple)' : 'var(--color-text-secondary)',
                fontSize: '13px',
                fontWeight: activeSection === section.id ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <section.icon style={{ width: 16, height: 16 }} />
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)' }}>
                {sections.find(s => s.id === activeSection)?.label}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                Manage your {activeSection} preferences
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="btn btn-primary"
              onClick={handleSave}
            >
              {saved ? <><Check style={{ width: 14, height: 14 }} /> Saved</> : <><Save style={{ width: 14, height: 14 }} /> Save</>}
            </motion.button>
          </div>

          {/* General */}
          {activeSection === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Application">
                <SettingRow label="Start with Windows" description="Launch RewindX on system startup">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Minimize to tray" description="Keep running in background when closed">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Show notifications" description="Display system notifications">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Service Status">
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <StatusItem label="Background Service" active={status.running} />
                    <StatusItem label="Ollama AI" active={status.ollama} />
                    <StatusItem label="Memory API" active={true} />
                  </div>
                </div>
              </SettingGroup>
            </div>
          )}

          {/* AI Models */}
          {activeSection === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Ollama Configuration">
                <SettingRow label="Host" description="Ollama server address">
                  <input className="input" style={{ width: 200, textAlign: 'right' }} defaultValue={config.ai?.ollamaHost || 'localhost'} />
                </SettingRow>
                <SettingRow label="Port" description="Ollama server port">
                  <input className="input" style={{ width: 100, textAlign: 'right' }} defaultValue={config.ai?.ollamaPort || '11434'} />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Models">
                <SettingRow label="Vision Model" description="For analyzing screenshots">
                  <select className="input" style={{ width: 200 }} defaultValue={config.ai?.visionModel}>
                    <option>qwen2.5-vl:3b</option>
                    <option>qwen2.5-vl:7b</option>
                    <option>llava:7b</option>
                  </select>
                </SettingRow>
                <SettingRow label="Text Model" description="For chat and summaries">
                  <select className="input" style={{ width: 200 }} defaultValue={config.ai?.textModel}>
                    <option>qwen2.5-coder:3b</option>
                    <option>qwen2.5-coder:7b</option>
                    <option>llama3:8b</option>
                  </select>
                </SettingRow>
                <SettingRow label="Embedding Model" description="For semantic search">
                  <select className="input" style={{ width: 200 }} defaultValue={config.ai?.embeddingModel}>
                    <option>nomic-embed-text</option>
                    <option>mxbai-embed-large</option>
                  </select>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Connected Services">
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <ServiceItem name="Ollama" url="http://localhost:11434" connected={status.ollama} />
                    <ServiceItem name="Qdrant" url={config.qdrant?.url || 'Not configured'} connected={false} />
                  </div>
                </div>
              </SettingGroup>
            </div>
          )}

          {/* Screenshots */}
          {activeSection === 'screenshots' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Capture Settings">
                <SettingRow label="Capture interval" description="Time between screenshots">
                  <select className="input" style={{ width: 150 }} defaultValue={config.screenshot?.intervalMs}>
                    <option value={60000}>1 minute</option>
                    <option value={120000}>2 minutes</option>
                    <option value={300000}>5 minutes</option>
                    <option value={600000}>10 minutes</option>
                  </select>
                </SettingRow>
                <SettingRow label="Image quality" description="JPEG compression quality">
                  <select className="input" style={{ width: 150 }} defaultValue={config.screenshot?.quality}>
                    <option value={40}>Low (40%)</option>
                    <option value={60}>Medium (60%)</option>
                    <option value={80}>High (80%)</option>
                    <option value={100}>Maximum (100%)</option>
                  </select>
                </SettingRow>
                <SettingRow label="Max width" description="Resize screenshots to max width">
                  <select className="input" style={{ width: 150 }} defaultValue={config.screenshot?.maxWidth}>
                    <option value={1024}>1024px</option>
                    <option value={1280}>1280px</option>
                    <option value={1920}>1920px</option>
                    <option value={2560}>2560px</option>
                  </select>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="AI Analysis">
                <SettingRow label="Auto-analyze" description="Automatically analyze screenshots with AI">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="OCR text extraction" description="Extract text from screenshots">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Retention">
                <SettingRow label="Keep screenshots" description="Delete old screenshots after">
                  <select className="input" style={{ width: 150 }} defaultValue={config.screenshot?.retentionDays}>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Privacy */}
          {activeSection === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Data Collection">
                <SettingRow label="Track window titles" description="Record active window titles">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Track keyboard" description="Monitor keyboard activity">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Track mouse" description="Monitor mouse activity">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Track clipboard" description="Monitor clipboard changes">
                  <Toggle checked={config.privacy?.storeClipboard || false} onChange={() => {}} />
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Blacklisted Applications">
                <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                  These applications will not be tracked
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(config.privacy?.blacklistApps || []).map((app: string) => (
                    <span key={app} style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text-secondary)',
                    }}>
                      {app}
                    </span>
                  ))}
                </div>
              </SettingGroup>

              <SettingGroup title="Sensitive Content">
                <SettingRow label="Blur sensitive apps" description="Blur screenshots of banking apps">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Filter passwords" description="Don't store clipboard with passwords">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Performance */}
          {activeSection === 'performance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Resource Limits">
                <SettingRow label="Max CPU usage" description="Pause collection if exceeded">
                  <select className="input" style={{ width: 150 }} defaultValue={config.performance?.maxCpuPercent}>
                    <option value={10}>10%</option>
                    <option value={15}>15%</option>
                    <option value={20}>20%</option>
                    <option value={30}>30%</option>
                  </select>
                </SettingRow>
                <SettingRow label="Max RAM usage" description="Pause collection if exceeded">
                  <select className="input" style={{ width: 150 }} defaultValue={config.performance?.maxRamMb}>
                    <option value={200}>200 MB</option>
                    <option value={300}>300 MB</option>
                    <option value={500}>500 MB</option>
                    <option value={1000}>1 GB</option>
                  </select>
                </SettingRow>
              </SettingGroup>

              <SettingGroup title="Polling Intervals">
                <SettingRow label="Window tracker" description="How often to check active window">
                  <select className="input" style={{ width: 150 }} defaultValue={config.collectors?.windowPollMs}>
                    <option value={1000}>1 second</option>
                    <option value={2000}>2 seconds</option>
                    <option value={5000}>5 seconds</option>
                  </select>
                </SettingRow>
                <SettingRow label="Keyboard tracker" description="Keystroke batch interval">
                  <select className="input" style={{ width: 150 }} defaultValue={config.collectors?.keyboardPollMs}>
                    <option value={3000}>3 seconds</option>
                    <option value={5000}>5 seconds</option>
                    <option value={10000}>10 seconds</option>
                  </select>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* Storage */}
          {activeSection === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <SettingGroup title="Database">
                <div className="card" style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Location</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text)', fontFamily: 'monospace' }}>{config.dbPath || '%APPDATA%/RewindX/db/workmemory.db'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Screenshots</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>{config.screenshotsDir || '%APPDATA%/RewindX/screenshots'}</span>
                    </div>
                  </div>
                </div>
              </SettingGroup>

              <SettingGroup title="Cleanup">
                <SettingRow label="Auto-cleanup" description="Delete old data automatically">
                  <Toggle checked={true} onChange={() => {}} />
                </SettingRow>
                <SettingRow label="Keep data for" description="Delete activities older than">
                  <select className="input" style={{ width: 150 }}>
                    <option>7 days</option>
                    <option>14 days</option>
                    <option>30 days</option>
                    <option>90 days</option>
                    <option>Forever</option>
                  </select>
                </SettingRow>
              </SettingGroup>
            </div>
          )}

          {/* About */}
          {activeSection === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'linear-gradient(135deg, #6D4CFF, #FF4FA3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Zap style={{ width: 32, height: 32, color: 'white' }} />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>RewindX</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '16px' }}>AI-Powered Work Memory</p>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Version 0.1.0</div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '12px' }}>Links</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a href="https://github.com/chetanupare/rewind" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-purple)', textDecoration: 'none' }}>
                    <ExternalLink style={{ width: 14, height: 14 }} /> GitHub Repository
                  </a>
                  <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-purple)', textDecoration: 'none' }}>
                    <ExternalLink style={{ width: 14, height: 14 }} /> Ollama
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
      <div className="card" style={{ padding: '4px 0' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  const [isEnabled, setIsEnabled] = useState(checked);
  return (
    <button
      onClick={() => { setIsEnabled(!isEnabled); onChange(); }}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: isEnabled ? 'var(--color-purple)' : 'var(--color-surface)',
        border: `1px solid ${isEnabled ? 'var(--color-purple)' : 'var(--color-border)'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s',
      }}
    >
      <div style={{
        width: 18,
        height: 18,
        borderRadius: 9,
        background: 'white',
        position: 'absolute',
        top: 2,
        left: isEnabled ? 22 : 2,
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function StatusItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: active ? '#00D47E' : '#EF4444' }} />
        <span style={{ fontSize: '12px', color: active ? '#00D47E' : '#EF4444', fontWeight: 600 }}>{active ? 'Running' : 'Stopped'}</span>
      </div>
    </div>
  );
}

function ServiceItem({ name, url, connected }: { name: string; url: string; connected: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{name}</div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{url}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: 8, height: 8, borderRadius: 4, background: connected ? '#00D47E' : '#EF4444' }} />
        <span style={{ fontSize: '12px', color: connected ? '#00D47E' : '#EF4444', fontWeight: 600 }}>{connected ? 'Connected' : 'Disconnected'}</span>
      </div>
    </div>
  );
}
