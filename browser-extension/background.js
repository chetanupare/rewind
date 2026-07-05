// RewindX Browser Extension - Background Service Worker

const API_URL = 'http://localhost:48291';
let isConnected = false;
let currentTab = null;
let tabStartTime = null;
let browsingHistory = [];

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log('RewindX Browser Extension installed');
  checkConnection();
});

// Track tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await handleTabChange(tab);
  } catch (err) {
    console.error('Error handling tab activation:', err);
  }
});

// Track URL changes
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    await handleTabChange(tab);
  }
});

// Track tab close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (currentTab && currentTab.id === tabId) {
    recordTimeSpent();
    currentTab = null;
  }
});

async function handleTabChange(tab) {
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    return;
  }

  // Record time on previous tab
  if (currentTab) {
    recordTimeSpent();
  }

  currentTab = {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    windowId: tab.windowId
  };
  tabStartTime = Date.now();

  // Send to RewindX
  await sendToRewindX('BROWSER_TAB_CHANGED', {
    browser: detectBrowser(),
    tabId: tab.id,
    url: tab.url,
    pageTitle: tab.title,
    type: 'tab_changed'
  });
}

function recordTimeSpent() {
  if (!currentTab || !tabStartTime) return;

  const duration = Math.round((Date.now() - tabStartTime) / 1000);
  if (duration < 2) return;

  const entry = {
    url: currentTab.url,
    title: currentTab.title,
    duration: duration,
    timestamp: new Date().toISOString()
  };

  browsingHistory.push(entry);

  // Keep last 200 entries
  if (browsingHistory.length > 200) {
    browsingHistory = browsingHistory.slice(-200);
  }

  // Store locally
  try {
    chrome.storage.local.set({ browsingHistory });
  } catch (err) {
    console.error('Error storing history:', err);
  }

  // Send to RewindX
  sendToRewindX('BROWSER_TIME_SPENT', {
    browser: detectBrowser(),
    url: currentTab.url,
    pageTitle: currentTab.title,
    durationSeconds: duration
  });
}

async function sendToRewindX(eventType, payload) {
  try {
    const response = await fetch(`${API_URL}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: eventType,
        source: 'browser-extension',
        payload: payload
      })
    });

    if (response.ok) {
      isConnected = true;
    } else {
      console.error('Failed to send event:', response.status);
    }
  } catch (err) {
    isConnected = false;
    // Silently fail - RewindX might not be running
  }
}

function detectBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('edg')) return 'edge';
  if (userAgent.includes('chrome')) return 'chrome';
  if (userAgent.includes('firefox')) return 'firefox';
  return 'unknown';
}

// Check connection periodically
async function checkConnection() {
  try {
    const response = await fetch(`${API_URL}/health`);
    isConnected = response.ok;
    console.log('RewindX connection:', isConnected ? 'OK' : 'Failed');
  } catch {
    isConnected = false;
    console.log('RewindX not available');
  }
}

// Sync history periodically
chrome.alarms.create('syncHistory', { periodInMinutes: 1 });
chrome.alarms.create('checkConnection', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'syncHistory') {
    await syncBrowsingHistory();
  } else if (alarm.name === 'checkConnection') {
    await checkConnection();
  }
});

async function syncBrowsingHistory() {
  if (!isConnected) return;

  try {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const historyItems = await chrome.history.search({
      text: '',
      startTime: oneHourAgo,
      maxResults: 50
    });

    const formattedItems = historyItems.map(item => ({
      url: item.url,
      title: item.title,
      visitCount: item.visitCount,
      lastVisit: new Date(item.lastVisitTime).toISOString()
    }));

    await sendToRewindX('BROWSER_HISTORY_SYNC', {
      browser: detectBrowser(),
      items: formattedItems,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error syncing history:', err);
  }
}

// Load stored history on startup
try {
  chrome.storage.local.get(['browsingHistory'], (result) => {
    if (result.browsingHistory) {
      browsingHistory = result.browsingHistory;
    }
  });
} catch (err) {
  console.error('Error loading history:', err);
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getHistory') {
    sendResponse({ history: browsingHistory });
  } else if (request.action === 'getStatus') {
    sendResponse({
      connected: isConnected,
      currentTab: currentTab,
      historyCount: browsingHistory.length
    });
  } else if (request.action === 'checkConnection') {
    checkConnection().then(() => {
      sendResponse({ connected: isConnected });
    });
    return true; // Keep message channel open for async response
  }
  return true;
});

console.log('RewindX Browser Extension loaded');
