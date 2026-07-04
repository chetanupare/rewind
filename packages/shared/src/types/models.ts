export interface Activity {
  id: number;
  timestamp: string;
  appName: string;
  appExecutable: string | null;
  windowTitle: string | null;
  durationSeconds: number | null;
  projectId: number | null;
  sessionId: number | null;
  createdAt: string;
}

export interface ActivityInsert {
  timestamp: string;
  appName: string;
  appExecutable?: string;
  windowTitle?: string;
  durationSeconds?: number;
  projectId?: number;
  sessionId?: number;
}

export interface Screenshot {
  id: number;
  timestamp: string;
  filePath: string;
  filePathOriginal: string | null;
  imageHash: string | null;
  width: number | null;
  height: number | null;
  ocrText: string | null;
  aiDescription: string | null;
  aiApp: string | null;
  aiTask: string | null;
  aiProject: string | null;
  aiLanguage: string | null;
  aiFramework: string | null;
  aiState: string | null;
  ocrProcessed: number;
  aiProcessed: number;
  createdAt: string;
}

export interface ScreenshotInsert {
  timestamp: string;
  filePath: string;
  filePathOriginal?: string;
  imageHash?: string;
  width?: number;
  height?: number;
}

export interface Session {
  id: number;
  startTime: string;
  endTime: string | null;
  appName: string | null;
  projectId: number | null;
  taskType: string | null;
  summary: string | null;
  createdAt: string;
}

export interface SessionInsert {
  startTime: string;
  endTime?: string;
  appName?: string;
  projectId?: number;
  taskType?: string;
  summary?: string;
}

export interface Project {
  id: number;
  name: string;
  path: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  technologies: string | null;
  isManual: number;
  createdAt: string;
}

export interface ProjectInsert {
  name: string;
  path?: string;
  firstSeen?: string;
  lastSeen?: string;
  technologies?: string;
  isManual?: number;
}

export interface ProjectFile {
  id: number;
  projectId: number;
  filePath: string;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface KnowledgeNode {
  id: number;
  type: string;
  name: string;
  metadata: string | null;
  createdAt: string;
}

export interface KnowledgeEdge {
  id: number;
  sourceId: number;
  targetId: number;
  relationship: string;
  weight: number;
}

export interface Timeline {
  id: number;
  date: string;
  hour: number | null;
  activitySummary: string | null;
  primaryApp: string | null;
  primaryProject: string | null;
  totalMouseClicks: number;
  totalKeystrokes: number;
  totalScreenshots: number;
  productivityScore: number | null;
  createdAt: string;
}

export interface Report {
  id: number;
  type: string;
  date: string;
  content: string | null;
  summary: string | null;
  generatedAt: string;
}

export interface SystemEventRecord {
  id: number;
  timestamp: string;
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

export interface GitEventRecord {
  id: number;
  timestamp: string;
  repoPath: string | null;
  branch: string | null;
  commitHash: string | null;
  commitMessage: string | null;
  filesChanged: string | null;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: string;
  updatedAt: string;
}

export interface AppBlacklist {
  id: number;
  appName: string;
  reason: string | null;
  addedAt: string;
}

export interface ClipboardHistory {
  id: number;
  timestamp: string;
  contentType: string | null;
  contentHash: string | null;
  contentPreview: string | null;
  isSensitive: number;
  sourceApp: string | null;
  createdAt: string;
}
