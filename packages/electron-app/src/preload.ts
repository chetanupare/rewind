import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  updateConfig: (partial: Record<string, unknown>) => ipcRenderer.invoke('update-config', partial),

  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  omnibarHide: () => ipcRenderer.send('omnibar-hide'),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getRecentActivities: (limit?: number) => ipcRenderer.invoke('get-recent-activities', limit),

  // Timeline
  getTimeline: (date: string) => ipcRenderer.invoke('get-timeline', date),

  // Chat
  chat: (message: string) => ipcRenderer.invoke('chat', message),

  // Search
  search: (query: string) => ipcRenderer.invoke('search', query),

  // Sessions
  getSessions: (limit?: number) => ipcRenderer.invoke('get-sessions', limit),

  // Reports
  getReports: (options?: { type?: string; limit?: number; date?: string }) => ipcRenderer.invoke('get-reports', options),

  // Screenshots
  getScreenshotsByDate: (date: string) => ipcRenderer.invoke('get-screenshots-by-date', date),
  getScreenshotImage: (filename: string) => ipcRenderer.invoke('get-screenshot-image', filename),

  // Context
  restoreContext: (projectPath: string) => ipcRenderer.invoke('restore-context', projectPath),

  // Service
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),

  // Activity Log
  getActivityLog: (options?: { limit?: number; offset?: number; appFilter?: string }) =>
    ipcRenderer.invoke('get-activity-log', options),

  // Memory
  getMemories: (options?: { type?: string; limit?: number }) => ipcRenderer.invoke('get-memories', options),
  createBookmark: (data: { type: string; title: string; description?: string; tags?: string[] }) =>
    ipcRenderer.invoke('create-bookmark', data),
  getBookmarks: (options?: { limit?: number }) => ipcRenderer.invoke('get-bookmarks', options),
  toggleBookmarkPin: (id: number) => ipcRenderer.invoke('toggle-bookmark-pin', id),
  deleteBookmark: (id: number) => ipcRenderer.invoke('delete-bookmark', id),

  // Developer Mode
  getDevEvents: (options?: { type?: string; limit?: number; date?: string }) =>
    ipcRenderer.invoke('get-dev-events', options),
  getDevStats: (date: string) => ipcRenderer.invoke('get-dev-stats', date),

  // Focus Analytics
  getFocusStats: (date: string) => ipcRenderer.invoke('get-focus-stats', date),
  getFocusSessions: (options?: { limit?: number; date?: string }) =>
    ipcRenderer.invoke('get-focus-sessions', options),
  getWeeklyFocusTrend: () => ipcRenderer.invoke('get-weekly-focus-trend'),

  // Meetings
  getMeetings: (date?: string) => ipcRenderer.invoke('get-meetings', date),
  getMeetingNotes: (meetingId: number) => ipcRenderer.invoke('get-meeting-notes', meetingId),

  // Projects
  getProjects: () => ipcRenderer.invoke('get-projects'),
  getProjectActivities: (projectId: number, limit?: number) =>
    ipcRenderer.invoke('get-project-activities', projectId, limit),

  // Session Replay
  getReplays: (limit?: number) => ipcRenderer.invoke('get-replays', limit),
  getReplay: (id: number) => ipcRenderer.invoke('get-replay', id),
  createReplay: (startTime: string, endTime: string, project?: string) =>
    ipcRenderer.invoke('create-replay', startTime, endTime, project),

  // NL Automation
  processNLCommand: (input: string) => ipcRenderer.invoke('process-nl-command', input),
  getReminders: (includeCompleted?: boolean) => ipcRenderer.invoke('get-reminders', includeCompleted),
  getAutomationRules: () => ipcRenderer.invoke('get-automation-rules'),
  completeReminder: (id: number) => ipcRenderer.invoke('complete-reminder', id),

  // Knowledge Graph
  getKnowledgeGraph: (type: string, id: number, depth?: number) =>
    ipcRenderer.invoke('get-knowledge-graph', type, id, depth),
  getLinkedMemories: (type: string, id: number) =>
    ipcRenderer.invoke('get-linked-memories', type, id),

  // Memory API
  getMemoryApiPort: () => ipcRenderer.invoke('get-memory-api-port'),
});
