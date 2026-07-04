import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (partial: Record<string, unknown>) => ipcRenderer.invoke('update-config', partial),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  omnibarHide: () => ipcRenderer.send('omnibar-hide'),

  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getRecentActivities: (limit?: number) => ipcRenderer.invoke('get-recent-activities', limit),

  getTimeline: (date: string) => ipcRenderer.invoke('get-timeline', date),

  chat: (message: string) => ipcRenderer.invoke('chat', message),

  search: (query: string) => ipcRenderer.invoke('search', query),

  getSessions: (limit?: number) => ipcRenderer.invoke('get-sessions', limit),

  getReports: () => ipcRenderer.invoke('get-reports'),

  getScreenshotsByDate: (date: string) => ipcRenderer.invoke('get-screenshots-by-date', date),

  restoreContext: (projectPath: string) => ipcRenderer.invoke('restore-context', projectPath),

  getScreenshotImage: (filename: string) => ipcRenderer.invoke('get-screenshot-image', filename),

  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),

  getActivityLog: (options?: { limit?: number; offset?: number; appFilter?: string }) =>
    ipcRenderer.invoke('get-activity-log', options),
});
