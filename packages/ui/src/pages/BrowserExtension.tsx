import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Chrome,
  Download,
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  Puzzle,
  Settings,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export default function BrowserExtension() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const extensionPath = `${process.env.APPDATA || ''}\\RewindX\\browser-extension`;

  const copyPath = () => {
    navigator.clipboard.writeText(extensionPath);
    setCopiedStep(-1);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const steps = [
    {
      title: 'Open Extensions Page',
      description: 'Open your browser\'s extension management page',
      command: 'chrome://extensions',
      icon: Puzzle,
      color: '#6D4CFF',
    },
    {
      title: 'Enable Developer Mode',
      description: 'Toggle the "Developer mode" switch in the top right corner',
      icon: Settings,
      color: '#3B82F6',
    },
    {
      title: 'Load Unpacked Extension',
      description: 'Click "Load unpacked" and select the extension folder',
      command: extensionPath,
      icon: FolderOpen,
      color: '#00D47E',
    },
    {
      title: 'Verify Installation',
      description: 'The RewindX icon should appear in your browser toolbar',
      icon: Check,
      color: '#FF4FA3',
    },
  ];

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Globe style={{ width: 20, height: 20, color: 'var(--color-purple)' }} />
          <h1>Browser Extension</h1>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{
              padding: '32px',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, rgba(109,76,255,0.1) 0%, rgba(255,79,163,0.1) 100%)',
              border: '1px solid rgba(109,76,255,0.2)',
              textAlign: 'center',
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: '16px', background: 'linear-gradient(135deg, #6D4CFF, #FF4FA3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 25px rgba(109,76,255,0.3)' }}>
              <Globe style={{ width: 32, height: 32, color: 'white' }} />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', marginBottom: '8px' }}>
              Track Your Browsing Activity
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', maxWidth: 500, margin: '0 auto' }}>
              The RewindX browser extension tracks your browsing activity, time spent on websites, and syncs everything with your work memory.
            </p>
          </motion.div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card"
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  cursor: 'pointer',
                  borderColor: currentStep === i ? 'var(--color-purple)' : undefined,
                }}
                onClick={() => setCurrentStep(i)}
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  background: `${step.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <step.icon style={{ width: 22, height: 22, color: step.color }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: '6px',
                      background: step.color,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
                      {step.title}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: step.command ? '12px' : 0 }}>
                    {step.description}
                  </p>
                  {step.command && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 14px',
                      background: 'var(--color-bg)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                    }}>
                      <code style={{ flex: 1, fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text)' }}>
                        {step.command}
                      </code>
                      <button
                        className="btn-icon"
                        style={{ width: 28, height: 28 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyPath();
                        }}
                      >
                        {copiedStep === -1 ? (
                          <Check style={{ width: 14, height: 14, color: '#00D47E' }} />
                        ) : (
                          <Copy style={{ width: 14, height: 14 }} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features */}
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px' }}>
            What Gets Tracked
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { icon: Globe, title: 'Tab Changes', desc: 'When you switch between tabs' },
              { icon: Clock, title: 'Time Spent', desc: 'How long you spend on each page' },
              { icon: ExternalLink, title: 'URLs Visited', desc: 'Pages you visit (privacy-respecting)' },
              { icon: Sparkles, title: 'History Sync', desc: 'Syncs with RewindX memory' },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="card"
                style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--color-purple-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <feature.icon style={{ width: 18, height: 18, color: 'var(--color-purple)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{feature.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{feature.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Privacy Note */}
          <div className="card" style={{ padding: '16px 20px', background: 'rgba(0,212,126,0.05)', border: '1px solid rgba(0,212,126,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Check style={{ width: 20, height: 20, color: '#00D47E', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>Privacy First</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  All browsing data stays on your machine. The extension only communicates with your local RewindX instance. No data is sent to external servers.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Clock(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
