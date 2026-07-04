# RewindX - Complete Feature Documentation

> **Version:** 0.2.0  
> **Last Updated:** July 5, 2026  
> **Platform:** Windows 10/11  
> **Architecture:** Electron + React + TypeScript + SQLite + Cognitive Engine

---

## Executive Summary

RewindX is an AI-powered work memory assistant that transforms from a simple event logger into a **cognitive brain**. It doesn't just record what you do — it **understands**, **learns**, **predicts**, and **remembers** everything that matters.

```
Traditional Memory Apps:  Event → Store → Search
RewindX Brain:           Event → Understand → Learn → Predict → Remember
```

---

## Core Architecture

### The Cognitive Pipeline

```
┌─────────────┐
│  Collectors │  Window, Keyboard, Mouse, Screenshot, Git, Browser
└──────┬──────┘
       ↓
┌─────────────┐
│  Normalize  │  Standardize events into cognitive format
└──────┬──────┘
       ↓
┌─────────────┐
│  Understand │  Intent detection, entity extraction
└──────┬──────┘
       ↓
┌─────────────┐
│  Knowledge  │  Graph updates, fact learning
│  Graph      │
└──────┬──────┘
       ↓
┌─────────────┐
│  Episode    │  Session building, context grouping
│  Builder    │
└──────┬──────┘
       ↓
┌─────────────┐
│  Pattern    │  Sequence detection, habit learning
│  Learner    │
└──────┬──────┘
       ↓
┌─────────────┐
│  Prediction │  Next action prediction
│  Engine     │
└──────┬──────┘
       ↓
┌─────────────┐
│  Long-term  │  Importance scoring, memory decay
│  Memory     │
└──────┬──────┘
       ↓
┌─────────────┐
│  Chat/Query │  AI-powered answers with confidence
└─────────────┘
```

---

## Feature Inventory

### 🧠 Cognitive Engine (The Brain)

| Module | Status | Description |
|--------|--------|-------------|
| Cognitive Engine | ✅ Working | Main brain orchestrator - processes every event |
| Knowledge Graph | ✅ Working | Entity relationships with nodes, edges, facts |
| Long-Term Memory | ✅ Working | Importance-based memory with automatic decay |
| Concept Learner | ✅ Working | Auto-learns topics from activity patterns |
| Intent Engine | ✅ Working | Detects coding, debugging, meeting, research, etc. |
| Pattern Learner | ✅ Working | Finds recurring sequences automatically |
| Prediction Engine | ✅ Working | Predicts next action based on patterns |
| Memory Compressor | ✅ Working | Compresses old data into knowledge |
| Confidence System | ✅ Working | Multi-factor confidence scoring |
| Curiosity Engine | ✅ Working | Asks questions, tracks learning progress |

#### How the Brain Works

**Every event changes what RewindX knows:**

```
Screenshot arrives
    ↓
Understand: "User is debugging React app"
    ↓
Extract: [App: VS Code, Project: RewindX, Task: debugging]
    ↓
Combine: Link to existing knowledge about RewindX project
    ↓
Learn: "User frequently debugs React apps at 2pm"
    ↓
Predict: "Next action: likely terminal or git commit"
    ↓
Remember: Store with importance score 0.8
```

#### Knowledge Graph

Every entity becomes a node with relationships:

```
Project: RewindX
    ↓
Repository: github.com/chetanupare/rewind
    ↓
File: main.ts
    ↓
Contains: Ollama Integration
    ↓
Mentioned In: Meeting (July 4)
    ↓
Fixed By: Commit abc123
    ↓
Opened From: VS Code
    ↓
Explained On: StackOverflow
```

#### Memory Importance Scoring

| Event | Importance | Reason |
|-------|------------|--------|
| Fixed production bug | 97 | Critical work |
| Salary discussion | 95 | Personal importance |
| Git commit | 80 | Work artifact |
| Coding session | 70 | Productive work |
| Research | 50 | Learning |
| Opened calculator | 2 | Trivial |
| Mouse movement | 1 | Noise |

**Memory decays over time** — important things persist, trivial things fade.

#### Concept Learning

When you keep working with certain technologies:

```
Day 1: Open Qdrant docs
Day 2: Read about embeddings
Day 3: Implement vector search
Day 4: Debug similarity queries

RewindX learns: "User is learning Vector Databases"
Confidence: 85%
Resources: 12 interactions
```

#### Curiosity Engine

RewindX asks questions like:
- "Are you learning Redis? I can track your progress."
- "You've been researching Rust for 2 weeks. Want to start a project?"
- "This bug resembles one you fixed 3 months ago. Want to see the solution?"

---

### 📸 Collectors (Data Collection Layer)

#### 1. Window Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Method** | Persistent PowerShell process |
| **Poll Rate** | 2 seconds |
| **Data Captured** | App name, window title, PID, executable, bounds, monitor info |
| **Events** | `WINDOW_CHANGED` |

#### 2. Keyboard Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Method** | PowerShell with `GetAsyncKeyState` |
| **Data Captured** | Keystroke count, shortcuts, typing speed |
| **Events** | `KEYSTROKE_BATCH`, `SHORTCUT_PRESSED` |

#### 3. Mouse Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Method** | PowerShell with `GetAsyncKeyState` |
| **Data Captured** | Click count, scroll events, button type |
| **Events** | `MOUSE_CLICKED`, `MOUSE_SCROLLED` |

#### 4. Screenshot Service
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Capture** | PowerShell + Sharp (WebP conversion) |
| **Adaptive** | 20s code, 1min meetings, pause gaming/idle |
| **Triggers** | Timer + App change |
| **Events** | `SCREENSHOT_CAPTURED`, `SCREENSHOT_PROCESSED` |

#### 5. Clipboard Monitor
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Types** | text, code, URL, image, file |
| **Features** | Pin, favorites, search, sensitive filtering |
| **Events** | `CLIPBOARD_CHANGED` |

#### 6. Git Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Detection** | Auto-detects from window titles and file paths |
| **Data** | Repo, branch, commit, files changed |
| **Events** | `GIT_COMMIT`, `GIT_BRANCH_CHANGED` |

#### 7. Browser Tracker
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Intelligence** | Recognizes GitHub, StackOverflow, ChatGPT, etc. |
| **Metadata** | PR numbers, issue IDs, page titles |
| **Events** | `BROWSER_TAB_CHANGED`, `BROWSER_URL_CHANGED` |

#### 8. Terminal Capture
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Terminals** | PowerShell, CMD, Git Bash, WSL, Windows Terminal |
| **Data** | Commands, errors, stack traces |
| **Events** | `TERMINAL_COMMAND` |

#### 9. System Events
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Events** | Boot, Shutdown, Sleep, Resume, Lock, Unlock |
| **Resources** | CPU, RAM every 30 seconds |
| **Battery** | 4 power profiles (charging/high/medium/low) |

#### 10. Filesystem Watcher
| Aspect | Details |
|--------|---------|
| **Status** | ✅ Working |
| **Library** | Chokidar |
| **Events** | `FILE_OPENED`, `FILE_MODIFIED`, `FILE_DELETED` |

---

### 🧪 AI Pipeline

#### Vision Analyzer
| Aspect | Details |
|--------|---------|
| **Model** | qwen2.5vl:3b (via Ollama) |
| **Queue** | Max 50, sequential processing |
| **Output** | App, task, project, language, framework, state, description |
| **Status Codes** | -1=queued, 0=pending, 1=analyzed |

#### OCR Service
| Aspect | Details |
|--------|---------|
| **Methods** | PowerShell, Tesseract, Python fallback |
| **Status** | ⚠️ Requires Tesseract installation |

#### Embedding Generator
| Aspect | Details |
|--------|---------|
| **Model** | nomic-embed-text |
| **Vector DB** | Qdrant (optional) |
| **Dimensions** | 768 |

---

### 🚀 Advanced Features

#### 11. Context Switch Detector
- Classifies switches: intentional/distraction/reference
- Productivity impact: positive/neutral/negative
- Thrashing detection after 3+ negative switches

#### 12. Daily Journal Generator
- AI-generated daily summaries
- Time block analysis
- Export to Markdown files
- Projects and highlights extraction

#### 13. Focus Mode (Pomodoro)
- 25min work / 5min break cycles
- Block distracting apps
- Session tracking with focus score
- Long break after 4 sessions

#### 14. Smart Notifications
- Distraction alerts (15min, 30min)
- Commit reminders (2hr gap)
- Focus session complete alerts
- Daily summary at 5pm

#### 15. Meeting Intelligence
- Detects Zoom, Teams, Meet, Webex, Skype, Discord, Slack
- Auto-generates meeting summaries
- Extracts action items and topics
- Sentiment analysis

#### 16. Deep Git Integration
- Tracks repos, branches, commits
- File change tracking
- Commit stats (insertions/deletions)
- Auto-detect repos from file paths

#### 17. Learning Patterns
- App usage patterns by hour
- Distraction trigger detection
- Commit time patterns
- Focus pattern learning
- Auto-generated productivity insights

#### 18. Project Detector
- Auto-detects from window titles, git repos, file paths
- Technology detection based on extensions
- Activity grouping by project

#### 19. Session Replay
- Reconstructs coding sessions step by step
- Playback controls
- Timeline view

#### 20. Cross-Memory Linking
- Auto-links screenshots ↔ commits ↔ activities
- Relationships: co_occurred, related_to, during
- Strength scoring (0-10)

#### 21. Natural Language Automation
- "Remind me tomorrow about..."
- "When I open VS Code, ..."
- Rule-based automation

#### 22. Semantic Timeline
- Search by intent (fixing, coding, reading)
- Jump to specific moments
- Relevance scoring

#### 23. Focus Analytics
- Deep work vs shallow work tracking
- Interruption detection
- Productivity scoring (0-100)
- Hourly productivity chart

#### 24. Smart Session Detection
- Auto-detects: coding, meeting, research, email, design
- Also: debugging, testing, deployment, planning
- Confidence scoring

#### 25. Privacy Guard
- Incognito detection → pause capture
- DRM detection (Netflix, etc) → pause
- Banking detection → blur
- Password managers → skip

#### 26. Battery Awareness
- 4 power profiles (charging, high, medium, low)
- Auto-adjusts capture rate
- Pauses AI on low battery

#### 27. Adaptive Screenshot Capture
- Code changing rapidly → 20sec
- Idle → pause
- Meeting → 1min
- Gaming/Video → stop
- Presentation → 5sec

#### 28. Windows Integration
- Jump Lists (Recent Searches, Quick Actions)
- Actionable Toast Notifications
- Focus Mode notifications with actions

---

### 🖥️ UI Pages

| Page | Status | Features |
|------|--------|----------|
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

### 🌐 Browser Extension

| Aspect | Details |
|--------|---------|
| **Browsers** | Chrome, Edge (Manifest V3) |
| **Features** | Tab tracking, time spent, history sync |
| **API** | Communicates with Memory API (port 48291) |
| **Install** | Load unpacked in developer mode |
| **Intelligence** | Recognizes GitHub, SO, ChatGPT, Linear, Jira, Figma, Notion |

---

## Database Schema

### Core Tables
- `activities` - Window/app usage
- `screenshots` - Captured images with AI analysis
- `sessions` - Work sessions
- `projects` - Detected projects
- `events` - Raw event log

### Brain Tables
- `kg_nodes` - Knowledge graph nodes
- `kg_edges` - Knowledge graph edges
- `kg_facts` - Learned facts
- `ltm_memories` - Long-term memories
- `concepts` - Learned concepts
- `learned_patterns` - Detected patterns
- `curiosity_questions` - Generated questions
- `learning_topics` - Topics being learned

### Feature Tables
- `context_switches` - App switching patterns
- `focus_sessions` - Pomodoro sessions
- `daily_journals` - Generated journals
- `meetings_detected` - Meeting records
- `git_repos`, `git_commits` - Git data
- `clipboard_history` - Clipboard entries
- `browser_contexts` - Browser intelligence
- `terminal_commands` - Terminal capture
- `memory_links` - Cross-memory relationships
- `reminders`, `automation_rules` - NL automation
- `notifications` - Smart alerts
- `privacy_events` - Privacy guard events
- `battery_events` - Battery awareness

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
| `get-screenshots-with-reviews` | Screenshots with AI analysis |
| `get-screenshot-stats` | Screenshot statistics |

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

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| CPU Usage | < 5% | ~3% |
| RAM Usage | < 300 MB | ~300 MB |
| Startup Time | < 3s | ~1.5s |
| Screenshot Capture | < 1s | ~500ms |
| AI Analysis | < 30s | ~20-60s (CPU) |
| Search Response | < 100ms | ~50ms |
| Knowledge Graph Query | < 50ms | ~20ms |

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
│   │       ├── collectors/        # 10 data collectors
│   │       ├── ai/                # Vision, OCR, embeddings
│   │       ├── pipeline/          # Session builder
│   │       ├── search/            # Text & vector search
│   │       ├── features/          # 28 advanced features
│   │       ├── brain/             # 10 cognitive modules
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
- framer-motion (animations)

### AI
- Ollama (local AI runtime)
- qwen2.5vl:3b (vision)
- qwen2.5-coder:3b (text)
- nomic-embed-text (embeddings)

### Optional
- Qdrant (vector database)
- Tesseract (OCR)

---

## What Makes RewindX Unique

### 1. It's a Brain, Not a Logger
Every event changes what RewindX knows. It doesn't just store data — it **understands**, **learns**, and **predicts**.

### 2. Memory Has Importance
Not everything is equal. Fixing a production bug (importance: 97) matters more than opening calculator (importance: 2).

### 3. It Learns Your Patterns
After a few days, RewindX knows:
- "User codes most productively 9am-12pm"
- "User always checks GitHub before committing"
- "User gets distracted by YouTube after meetings"

### 4. It Asks Questions
The Curiosity Engine notices when you're learning something new and asks:
- "Are you learning Redis?"
- "Want me to track your progress on Rust?"

### 5. Memory Decays Naturally
Like human memory, unimportant things fade while important things persist.

### 6. Confidence Scoring
Every answer comes with a confidence score. RewindX won't hallucinate — it knows what it knows.

### 7. Knowledge Graph
Everything is connected. Ask "Show me everything about OAuth" and get:
- Git commits
- Screenshots
- Browser tabs
- Meetings
- Terminal commands
- Related files

---

*Generated by BA Analysis - RewindX v0.2.0*
