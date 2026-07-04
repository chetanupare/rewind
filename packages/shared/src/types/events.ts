export type EventType =
  | 'WINDOW_CHANGED'
  | 'WINDOW_CLOSED'
  | 'MOUSE_CLICKED'
  | 'MOUSE_SCROLLED'
  | 'MOUSE_MOVED'
  | 'MOUSE_IDLE'
  | 'KEYSTROKE_BATCH'
  | 'SHORTCUT_PRESSED'
  | 'SCREENSHOT_CAPTURED'
  | 'SCREENSHOT_PROCESSED'
  | 'BROWSER_TAB_CHANGED'
  | 'BROWSER_URL_CHANGED'
  | 'BROWSER_DOWNLOAD_STARTED'
  | 'BROWSER_SEARCH_QUERY'
  | 'OCR_COMPLETED'
  | 'CLIPBOARD_CHANGED'
  | 'FILE_OPENED'
  | 'FILE_SAVED'
  | 'FILE_DELETED'
  | 'FILE_RENAMED'
  | 'FILE_MODIFIED'
  | 'GIT_COMMIT'
  | 'GIT_BRANCH_CHANGED'
  | 'GIT_REPO_DETECTED'
  | 'SYSTEM_BOOT'
  | 'SYSTEM_SHUTDOWN'
  | 'SYSTEM_SLEEP'
  | 'SYSTEM_RESUME'
  | 'SYSTEM_LOCK'
  | 'SYSTEM_UNLOCK'
  | 'SYSTEM_RESOURCE_UPDATE'
  | 'SESSION_STARTED'
  | 'SESSION_ENDED'
  | 'SESSION_UPDATED'
  | 'PROJECT_DETECTED'
  | 'PROJECT_UPDATED'
  | 'AI_ANALYSIS_COMPLETE'
  | 'EMBEDDING_GENERATED'
  | 'KNOWLEDGE_GRAPH_UPDATED'
  | 'FLOW_STATE_CHANGED'
  | 'STANDUP_READY'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'BOOKMARK_CREATED'
  | 'FOCUS_SESSION_STARTED'
  | 'FOCUS_SESSION_ENDED'
  | 'REMINDER_DUE'
  | 'NOTIFICATION'
  | 'CREATE_BOOKMARK'
  | 'CONTEXT_SWITCH'
  | 'THRASHING_DETECTED'
  | 'FOCUS_STARTED'
  | 'FOCUS_COMPLETED'
  | 'FOCUS_STOPPED'
  | 'FOCUS_BLOCKED_APP'
  | 'BREAK_STARTED'
  | 'BREAK_ENDED'
  | 'JOURNAL_GENERATED'
  | 'NOTIFICATION_SENT'
  | 'GIT_COMMIT_DEEP'
  | 'PREDICTION'
  | 'PREDICTION_MADE'
  | 'PREDICTION_VERIFIED'
  | 'DECISION_RECORDED'
  | 'EPISODE_COMPLETED'
  | 'TERMINAL_COMMAND'
  | 'BROWSER_CONTEXT'
  | 'SESSION_DETECTED'
  | 'MENTOR_SUGGESTION'
  | 'REFLECTION_COMPLETED'
  | 'SCREENSHOT_BLOCKED'
  | 'PRIVACY_PAUSE'
  | 'PRIVACY_BLUR'
  | 'PRIVACY_SKIP'
  | 'PRIVACY_ALERT'
  | 'POWER_PROFILE_CHANGED'
  | 'BATTERY_UNPLUGGED'
  | 'BATTERY_PLUGGED'
  | 'BATTERY_LOW'
  | 'BATTERY_CRITICAL'
  | 'CODE_ANALYZED'
  | 'DOCUMENT_PROCESSED'
  | 'TRANSCRIPT_READY';

export type CollectorSource =
  | 'window-tracker'
  | 'mouse-tracker'
  | 'keyboard-tracker'
  | 'screenshot-service'
  | 'browser-tracker'
  | 'ocr-service'
  | 'clipboard-monitor'
  | 'filesystem-watcher'
  | 'git-tracker'
  | 'system-events'
  | 'session-builder'
  | 'ai-pipeline'
  | 'learning-engine'
  | 'flow-state-tracker'
  | 'thrashing-detector'
  | 'scheduler'
  | 'project-detector'
  | 'meeting-intelligence'
  | 'memory-bookmarks'
  | 'focus-analytics'
  | 'nl-automation'
  | 'cross-memory-linking'
  | 'context-detector'
  | 'focus-mode'
  | 'daily-journal'
  | 'smart-notifications'
  | 'git-integration'
  | 'learning-patterns'
  | 'cognitive-engine'
  | 'episodic-memory'
  | 'decision-tracker'
  | 'feedback-loop'
  | 'ai-reflection'
  | 'ai-mentor'
  | 'battery-awareness'
  | 'browser-intelligence'
  | 'privacy-guard'
  | 'session-detector'
  | 'terminal-capture';

export interface EventPayload {
  id: string;
  timestamp: string;
  type: EventType;
  source: CollectorSource;
  payload: Record<string, unknown>;
}

export interface WindowEvent {
  appName: string;
  executable: string;
  pid: number;
  windowTitle: string;
  windowBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MouseEvent {
  type: 'click' | 'scroll' | 'move' | 'idle';
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  position: { x: number; y: number };
  scrollDelta?: { x: number; y: number };
  idleDurationMs?: number;
}

export interface KeyboardEvent {
  keystrokeCount: number;
  shortcuts: string[];
  typingSpeed: number;
  idleDurationMs: number;
  activeApp: string;
}

export interface ScreenshotData {
  filePath: string;
  filePathCompressed: string;
  width: number;
  height: number;
  imageHash: string;
}

export interface ScreenshotAnalysis {
  ocrText: string;
  aiDescription: string;
  aiApp: string;
  aiTask: string;
  aiProject: string;
  aiLanguage: string;
  aiFramework: string;
  aiState: ActivityState;
  aiTags: string[];
}

export type ActivityState =
  | 'coding'
  | 'debugging'
  | 'reading'
  | 'browsing'
  | 'designing'
  | 'meeting'
  | 'email'
  | 'terminal'
  | 'testing'
  | 'deploying'
  | 'documenting'
  | 'communicating'
  | 'idle'
  | 'other';

export interface BrowserEvent {
  browser: 'chrome' | 'edge' | 'firefox';
  tabId?: number;
  url?: string;
  pageTitle?: string;
  searchQuery?: string;
  type: 'tab_changed' | 'url_changed' | 'download' | 'new_tab' | 'closed_tab';
}

export interface ClipboardEvent {
  contentType: 'text' | 'code' | 'image';
  contentHash: string;
  contentPreview: string;
  isSensitive: boolean;
  sourceApp: string;
}

export interface FileEvent {
  type: 'opened' | 'saved' | 'deleted' | 'renamed' | 'modified';
  filePath: string;
  oldPath?: string;
  fileSize?: number;
  extension?: string;
}

export interface GitEvent {
  repoPath: string;
  branch: string;
  commitHash?: string;
  commitMessage?: string;
  filesChanged?: string[];
  author?: string;
}

export interface SystemEvent {
  type: 'boot' | 'shutdown' | 'sleep' | 'resume' | 'lock' | 'unlock';
  battery?: number;
  cpu?: number;
  ram?: number;
  network?: boolean;
}
