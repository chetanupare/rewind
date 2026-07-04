# RewindX - Feature Analysis & Documentation

> **Version:** 0.1.0  
> **Last Updated:** July 5, 2026  
> **Platform:** Windows 10/11  
> **Architecture:** Electron + React + TypeScript + SQLite

---

## Executive Summary

RewindX is an AI-powered work memory assistant that automatically observes computer activity, learns workflows, and builds a searchable memory of your work day. It runs silently in the background, capturing context without manual input.

---

## Feature Inventory

### Core Infrastructure

| Feature | Status | File | Description |
|---------|--------|------|-------------|
| Event Bus | ✅ Working | `event-bus.ts` | Pub/sub system for inter-module communication |
| SQLite Database | ✅ Working | `database.ts` | Local storage with FTS5 full-text search |
| Configuration | ✅ Working | `config.ts` | JSON-based config with env variable support |
| Memory API | ✅ Working | `memory-api.ts` | HTTP API on port 48291 for external access |
| Logger | ✅ Working | `logger.ts` | Pino-based structured logging |

---

### Collectors (Data Collection Layer)

#### 1. Window Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `window-tracker.ts` |
| **Method** | Persistent PowerShell process |
| **Poll Rate** | 2 seconds |
| **Data Captured** | App name, window title, PID, executable path, window bounds, monitor info |
| **Events Emitted** | `WINDOW_CHANGED` |
| **DB Table** | `activities` |

**How it works:**
- Spawns a long-running PowerShell process
- Uses Windows API (`GetForegroundWindow`, `GetWindowText`)
- Detects window changes and records duration
- Auto-restarts on process crash

---

#### 2. Keyboard Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `keyboard-tracker.ts` |
| **Method** | PowerShell with `GetAsyncKeyState` |
| **Poll Rate** | 500ms batch, 5s emit |
| **Data Captured** | Keystroke count, shortcuts (Ctrl+X, Alt+Tab), typing speed |
| **Events Emitted** | `KEYSTROKE_BATCH`, `SHORTCUT_PRESSED`, `MOUSE_IDLE` |

**How it works:**
- Polls all virtual key codes every 500ms
- Detects modifier keys (Ctrl, Alt, Shift) for shortcuts
- Batches keystrokes and emits every 5 seconds
- Detects idle after 30 seconds of inactivity

---

#### 3. Mouse Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `mouse-tracker.ts` |
| **Method** | PowerShell with `GetAsyncKeyState` |
| **Data Captured** | Click count, scroll events, button type |
| **Events Emitted** | `MOUSE_CLICKED`, `MOUSE_SCROLLED` |

---

#### 4. Screenshot Service
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `screenshot-service.ts` |
| **Capture Method** | PowerShell `CopyFromScreen` |
| **Format** | WebP (converted from JPEG) |
| **Quality** | 80% |
| **Max Width** | 1024px (resized) |
| **Default Interval** | 2 minutes |
| **Triggers** | Timer + App change |
| **Events Emitted** | `SCREENSHOT_CAPTURED`, `SCREENSHOT_PROCESSED` |

**How it works:**
1. Captures screen via PowerShell
2. Resizes to max 1024px width
3. Converts to WebP using Sharp
4. Stores in `%APPDATA%\RewindX\screenshots\{date}\`
5. Records hash for deduplication
6. Emits event for AI analysis

---

#### 5. Clipboard Monitor
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `clipboard-monitor.ts` |
| **Poll Rate** | 5 seconds |
| **Data Captured** | Content type, hash, preview (first 200 chars) |
| **Events Emitted** | `CLIPBOARD_CHANGED` |
| **Privacy** | Filters sensitive content (passwords, tokens, keys) |

---

#### 6. Git Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `git-tracker.ts` |
| **Detection** | Auto-detects repos from window titles and file paths |
| **Data Captured** | Repo path, branch, commit hash, message, files changed |
| **Events Emitted** | `GIT_COMMIT`, `GIT_BRANCH_CHANGED`, `GIT_REPO_DETECTED` |

---

#### 7. Filesystem Watcher
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `filesystem-watcher.ts` |
| **Library** | Chokidar |
| **Watch Paths** | Desktop, Projects (configurable) |
| **Events Emitted** | `FILE_OPENED`, `FILE_MODIFIED`, `FILE_DELETED` |

---

#### 8. System Events
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `system-events.ts` |
| **Detection** | Electron `powerMonitor` + PowerShell |
| **Events Captured** | Boot, Shutdown, Sleep, Resume, Lock, Unlock |
| **Resource Polling** | CPU, RAM every 30 seconds |
| **Events Emitted** | `SYSTEM_BOOT`, `SYSTEM_SLEEP`, `SYSTEM_RESUME`, `SYSTEM_LOCK`, `SYSTEM_UNLOCK`, `SYSTEM_RESOURCE_UPDATE` |

---

#### 9. Browser Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `browser-tracker.ts` |
| **Method** | PowerShell process detection |
| **Browsers** | Chrome, Edge, Firefox |
| **Data Captured** | Browser name, window title, URL extraction |
| **Events Emitted** | `BROWSER_TAB_CHANGED`, `BROWSER_URL_CHANGED` |

---

### AI Pipeline

#### 10. Vision Analyzer
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `vision-analyzer.ts` |
| **Model** | qwen2.5vl:3b (via Ollama) |
| **Queue Size** | Max 50 screenshots |
| **Processing** | Sequential, one at a time |
| **Output** | App, task, project, language, framework, state, description |
| **DB Fields** | `ai_app`, `ai_task`, `ai_project`, `ai_state`, `ai_description` |

**How it works:**
1. Receives `SCREENSHOT_PROCESSED` event
2. Adds to processing queue
3. Converts WebP to JPEG, then base64
4. Sends to Ollama vision model with structured prompt
5. Parses JSON response
6. Updates database with analysis
7. Generates embedding for semantic search

**Status Codes:**
- `0` = Pending
- `-1` = Queued for processing
- `1` = Analysis complete

---

#### 11. OCR Service
| Aspect | Details |
|--------|---------|
| **Status** | ⚠️ Partial |
| **File** | `ocr-service.ts` |
| **Methods** | PowerShell script, Tesseract fallback, Python fallback |
| **DB Fields** | `ocr_text`, `ocr_processed` |

---

#### 12. Embedding Generator
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `embedding-generator.ts` |
| **Model** | nomic-embed-text (via Ollama) |
| **Vector DB** | Qdrant (optional) |
| **Dimensions** | 768 |

---

### Advanced Features

#### 13. Context Switch Detector
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `context-switch-detector.ts` |
| **Detection** | Classifies switches as intentional/distraction/reference |
| **Productivity Impact** | Positive/Neutral/Negative |
| **Thrashing Detection** | Alerts after 3+ negative switches |
| **DB Tables** | `context_switches`, `focus_sessions` |

**Switch Reasons:**
- `intentional` - Moving between productive apps
- `distraction` - Switching to social media, entertainment
- `notification` - Responding to alerts
- `reference` - Looking up documentation
- `unknown` - Unclassified

---

#### 14. Daily Journal Generator
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `daily-journal.ts` |
| **Generation** | AI-powered via Ollama |
| **Output** | Markdown files in `%APPDATA%\RewindX\journals\` |
| **Content** | Summary, activities, projects, highlights |
| **DB Table** | `daily_journals` |

---

#### 15. Focus Mode (Pomodoro)
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `focus-mode.ts` |
| **Work Duration** | 25 minutes |
| **Break Duration** | 5 minutes |
| **Long Break** | 15 minutes (after 4 sessions) |
| **App Blocking** | Alerts when opening blocked apps |
| **DB Table** | `pomodoro_sessions` |

**Blocked Apps (default):**
- Browsers (Chrome, Edge, Firefox)
- Communication (Slack, Discord, Teams)
- Social Media (Twitter, Facebook, YouTube, Reddit)

---

#### 16. Smart Notifications
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `smart-notifications.ts` |
| **Triggers** | Distraction (15min), Extended distraction (30min), Commit reminder (2hr), Focus complete, Break end |
| **System Notifications** | Electron `Notification` API |
| **DB Table** | `notifications` |

---

#### 17. Meeting Intelligence
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `meeting-intelligence-v2.ts` |
| **Platforms** | Zoom, Teams, Meet, Webex, Skype, Discord, Slack |
| **Detection** | Window title analysis with confidence scoring |
| **AI Summary** | Auto-generated via Ollama |
| **Output** | Summary, topics, action items, sentiment |
| **DB Table** | `meetings_detected` |

---

#### 18. Deep Git Integration
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `deep-git-integration.ts` |
| **Library** | simple-git |
| **Tracking** | Repos, branches, commits, file changes |
| **Stats** | Insertions, deletions, commit frequency |
| **DB Tables** | `git_repos`, `git_branches`, `git_commits`, `git_file_changes` |

---

#### 19. Learning Patterns
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `learning-patterns.ts` |
| **Patterns Learned** | App usage by hour, switch patterns, commit patterns, focus patterns |
| **Confidence** | 0.0 - 1.0 scale |
| **Insights** | Auto-generated productivity insights |
| **DB Tables** | `learning_patterns`, `pattern_events`, `work_insights` |

**Pattern Types:**
- `app_usage` - When you use specific apps
- `app_switch` - Common app transitions
- `distraction_trigger` - What causes distractions
- `commit_time` - When you commit code
- `focus_time` - Your most focused hours
- `project_context` - Project-app relationships

---

#### 20. Memory Bookmarks
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `memory-bookmarks.ts` |
| **Types** | moment, screenshot, commit, session, meeting |
| **Features** | Pin, tags, search |
| **DB Table** | `bookmarks` |

---

#### 21. Project Detector
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `project-detector.ts` |
| **Detection Methods** | Window titles, git repos, file paths, package.json |
| **Technology Detection** | Based on file extensions |
| **DB Tables** | `detected_projects`, `project_activities` |

---

#### 22. Session Replay
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `session-replay.ts` |
| **Replay** | Reconstructs sessions from activities, screenshots, commits |
| **DB Table** | `replay_sessions` |

---

#### 23. Cross-Memory Linking
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `cross-memory-linking.ts` |
| **Auto-linking** | Screenshots ↔ Commits ↔ Activities |
| **Relationships** | co_occurred, related_to, during |
| **Strength** | 0.0 - 10.0 scale |
| **DB Table** | `memory_links` |

---

#### 24. Natural Language Automation
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `nl-automation.ts` |
| **Commands** | "Remind me tomorrow about...", "When I open VS Code..." |
| **Reminders** | Time-based with auto-trigger |
| **Rules** | Event-based automation |
| **DB Tables** | `reminders`, `automation_rules`, `nl_commands` |

---

#### 25. Semantic Timeline
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `semantic-timeline.ts` |
| **Search** | Intent-based (fixing, coding, reading, etc.) |
| **Sources** | Activities, screenshots, commits |
| **Relevance Scoring** | Multi-factor scoring algorithm |
| **DB Table** | `timeline_moments` |

---

#### 26. Focus Analytics
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **File** | `focus-analytics.ts` |
| **Metrics** | Deep work, shallow work, breaks, meetings |
| **Focus Score** | 0-100 based on interruptions and duration |
| **Productive Hours** | Hourly breakdown |
| **DB Table** | `focus_sessions` |

---

### UI Pages

| Page | Status | Description |
|------|--------|-------------|
| Dashboard | ✅ | Stats, activity feed, time travel, top apps |
| Chat | ✅ | AI chat with Ollama, context-aware |
| Memory | ✅ | Bookmark management with filters |
| Search | ✅ | Full-text and semantic search |
| Timeline | ✅ | Hourly activity timeline |
| Screenshots | ✅ | Gallery with AI analysis, grid/timeline view |
| Developer Mode | ✅ | Git, terminal, file change correlation |
| Focus Analytics | ✅ | Productivity metrics and charts |
| Session Replay | ✅ | Playback coding sessions |
| Browser Extension | ✅ | Install guide for Chrome/Edge extension |
| Notes | ✅ | Bookmark-based note taking |
| Reports | ✅ | Generated daily/weekly reports |
| Settings | ✅ | Configuration with sections |
| Omnibar | ✅ | Quick search with Alt+Space |

---

### Browser Extension

| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Location** | `browser-extension/` |
| **Browsers** | Chrome, Edge (Manifest V3) |
| **Features** | Tab tracking, time spent, history sync |
| **API** | Communicates with Memory API (port 48291) |
| **Install** | Load unpacked in developer mode |

---

## Data Flow

```
Collectors → Event Bus → Processors → Database
                ↓
        AI Pipeline (Ollama)
                ↓
        SQLite + Qdrant
                ↓
        UI (React) ← IPC → Electron Main
```

---

## Database Schema

### Core Tables
- `activities` - Window/app usage
- `screenshots` - Captured images with AI analysis
- `sessions` - Work sessions
- `projects` - Detected projects
- `events` - Raw event log

### Feature Tables
- `context_switches` - App switching patterns
- `focus_sessions` - Pomodoro sessions
- `pomodoro_sessions` - Focus mode tracking
- `daily_journals` - Generated journals
- `meetings_detected` - Meeting records
- `git_repos`, `git_commits` - Git data
- `learning_patterns` - Behavioral patterns
- `bookmarks` - Saved moments
- `memory_links` - Cross-memory relationships
- `reminders`, `automation_rules` - NL automation
- `notifications` - Smart alerts

### Search Tables
- `activities_fts` - Full-text search on activities
- `screenshots_fts` - Full-text search on screenshots
- `sessions_fts` - Full-text search on sessions

---

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| CPU Usage | < 5% | ~3% |
| RAM Usage | < 300 MB | ~300 MB |
| Startup Time | < 3s | ~1.5s |
| Screenshot Capture | < 1s | ~500ms |
| AI Analysis | < 30s | ~20-60s (CPU) |
| Search Response | < 100ms | ~50ms |

---

## Known Limitations

1. **Vision AI requires GPU** - CPU-only mode is slow (20-60s per screenshot)
2. **PowerShell overhead** - Multiple processes consume ~300MB RAM
3. **Windows only** - No macOS/Linux support
4. **OCR not fully implemented** - Requires Tesseract installation
5. **Browser extension manual install** - No auto-deployment yet

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | localhost | Ollama server host |
| `OLLAMA_PORT` | 11434 | Ollama server port |
| `OLLAMA_VISION_MODEL` | qwen2.5vl:3b | Vision analysis model |
| `OLLAMA_TEXT_MODEL` | qwen2.5-coder:3b | Text generation model |
| `OLLAMA_EMBEDDING_MODEL` | nomic-embed-text | Embedding model |
| `QDRANT_URL` | http://localhost:6333 | Vector database URL |
| `QDRANT_API_KEY` | (empty) | Qdrant API key |

---

## IPC Endpoints

| Endpoint | Description |
|----------|-------------|
| `get-config` | Get app configuration |
| `update-config` | Update configuration |
| `get-dashboard-stats` | Dashboard statistics |
| `get-recent-activities` | Recent activity list |
| `search` | Full-text search |
| `chat` | AI chat with Ollama |
| `get-timeline` | Timeline data |
| `get-sessions` | Work sessions |
| `get-screenshots-by-date` | Screenshots for date |
| `get-screenshot-image` | Load screenshot image |
| `get-reports` | Generated reports |
| `get-activity-log` | Activity log with filters |
| `get-memories` | Bookmarks/memories |
| `create-bookmark` | Create bookmark |
| `get-dev-events` | Developer events |
| `get-dev-stats` | Developer statistics |
| `get-focus-stats` | Focus analytics |
| `get-focus-sessions` | Pomodoro sessions |
| `get-meetings` | Meeting records |
| `get-projects` | Detected projects |
| `get-replays` | Session replays |
| `process-nl-command` | Natural language command |
| `get-reminders` | Active reminders |
| `get-knowledge-graph` | Knowledge graph data |
| `get-memory-api-port` | Memory API port |

---

## File Structure

```
rewindx/
├── packages/
│   ├── shared/                    # Shared types & utilities
│   │   └── src/
│   │       ├── types/             # TypeScript interfaces
│   │       ├── database.ts        # SQLite wrapper
│   │       ├── config.ts          # Configuration
│   │       ├── event-bus.ts       # Event system
│   │       └── logger.ts          # Logging
│   │
│   ├── background-service/        # Data collection & AI
│   │   └── src/
│   │       ├── collectors/        # 9 data collectors
│   │       ├── ai/                # Vision, OCR, embeddings
│   │       ├── pipeline/          # Session builder
│   │       ├── search/            # Text & vector search
│   │       ├── features/          # 18 advanced features
│   │       └── cleanup/           # Retention manager
│   │
│   ├── ui/                        # React frontend
│   │   └── src/
│   │       ├── pages/             # 15 page components
│   │       ├── components/        # Shared components
│   │       └── styles/            # CSS with Jost font
│   │
│   └── electron-app/              # Electron main process
│       └── src/
│           ├── main.ts            # App entry + IPC
│           ├── preload.ts         # Context bridge
│           └── splash.ts          # Splash screen
│
├── browser-extension/             # Chrome/Edge extension
│   ├── manifest.json
│   ├── background.js
│   ├── popup.html
│   └── popup.js
│
└── installer.iss                  # Inno Setup script
```

---

## Dependencies

### Runtime
- Electron 33
- React 18
- SQLite (better-sqlite3)
- Sharp (image processing)
- simple-git (git integration)
- node-cron (scheduling)
- pino (logging)

### AI
- Ollama (local AI runtime)
- qwen2.5vl:3b (vision)
- qwen2.5-coder:3b (text)
- nomic-embed-text (embeddings)

### Optional
- Qdrant (vector database)
- Tesseract (OCR)

---

*Generated by BA Analysis - RewindX v0.1.0*
