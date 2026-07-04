document.addEventListener('DOMContentLoaded', async () => {
  const historyDiv = document.getElementById('history');
  const tabCountEl = document.getElementById('tabCount');
  const timeSpentEl = document.getElementById('timeSpent');

  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.connected) {
      tabCountEl.textContent = response.historyCount || 0;
      
      const totalSeconds = (response.history || []).reduce((sum, h) => sum + (h.duration || 0), 0);
      const minutes = Math.round(totalSeconds / 60);
      timeSpentEl.textContent = minutes > 60 ? `${Math.round(minutes/60)}h` : `${minutes}m`;
    }
  });

  chrome.runtime.sendMessage({ action: 'getHistory' }, (response) => {
    if (response && response.history && response.history.length > 0) {
      const sortedHistory = response.history
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 20);

      historyDiv.innerHTML = sortedHistory.map(item => `
        <div class="history-item">
          <div class="history-title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="history-url">${escapeHtml(truncateUrl(item.url))}</div>
        </div>
      `).join('');
    }
  });

  function truncateUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.substring(0, 30);
    } catch {
      return url.substring(0, 50);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
