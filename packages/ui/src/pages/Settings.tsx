import { useState, useEffect } from 'react';

declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      updateConfig: (partial: Record<string, unknown>) => Promise<any>;
    };
  }
}

export default function Settings() {
  const [cfg, setCfg] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { window.electronAPI.getConfig().then(setCfg).catch(() => {}); }, []);

  const update = async (path: string, value: unknown) => {
    const parts = path.split('.');
    const partial: Record<string, unknown> = {};
    let cur = partial;
    for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = {}; cur = cur[parts[i]] as any; }
    cur[parts[parts.length - 1]] = value;
    await window.electronAPI.updateConfig(partial);
    const c = await window.electronAPI.getConfig();
    setCfg(c);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!cfg) return <div className="glass-card empty-state"><p>Loading...</p></div>;

  return (
    <div className="settings">
      <header className="settings-header">
        <h2>Settings</h2>
        {saved && <span className="save-badge">Saved</span>}
      </header>

      <section className="settings-group">
        <h3>Screenshots</h3>
        <div className="setting glass-card">
          <label>Interval (seconds)</label>
          <input type="number" value={cfg.screenshot.intervalMs / 1000}
            onChange={e => update('screenshot.intervalMs', Number(e.target.value) * 1000)} className="glass-input-sm" />
        </div>
        <div className="setting glass-card">
          <label>Retention (days)</label>
          <input type="number" value={cfg.screenshot.retentionDays}
            onChange={e => update('screenshot.retentionDays', Number(e.target.value))} className="glass-input-sm" />
        </div>
        <div className="setting glass-card">
          <label>Store Screenshots</label>
          <input type="checkbox" checked={cfg.privacy.storeScreenshots}
            onChange={e => update('privacy.storeScreenshots', e.target.checked)} />
        </div>
      </section>

      <section className="settings-group">
        <h3>AI (Ollama)</h3>
        <div className="setting glass-card">
          <label>Host</label>
          <input type="text" value={cfg.ai.ollamaHost}
            onChange={e => update('ai.ollamaHost', e.target.value)} className="glass-input-sm" />
        </div>
        <div className="setting glass-card">
          <label>Port</label>
          <input type="number" value={cfg.ai.ollamaPort}
            onChange={e => update('ai.ollamaPort', Number(e.target.value))} className="glass-input-sm" />
        </div>
        <div className="setting glass-card">
          <label>Vision Model</label>
          <input type="text" value={cfg.ai.visionModel}
            onChange={e => update('ai.visionModel', e.target.value)} className="glass-input-sm" />
        </div>
        <div className="setting glass-card">
          <label>Text Model</label>
          <input type="text" value={cfg.ai.textModel}
            onChange={e => update('ai.textModel', e.target.value)} className="glass-input-sm" />
        </div>
      </section>

      <section className="settings-group">
        <h3>Privacy</h3>
        <div className="setting glass-card">
          <label>Store Clipboard</label>
          <input type="checkbox" checked={cfg.privacy.storeClipboard}
            onChange={e => update('privacy.storeClipboard', e.target.checked)} />
        </div>
        <div className="setting glass-card">
          <label>Blacklisted Apps</label>
          <div className="tag-row">
            {cfg.privacy.blacklistApps.map((a: string) => (
              <span key={a} className="tag">{a}</span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
