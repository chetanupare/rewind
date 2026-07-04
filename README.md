<div align="center">

# ⏪ RewindX

### Your AI-Powered Work Memory

**Never lose track of what you worked on again.**

RewindX silently observes your computer activity, understands what you're doing, and builds a searchable memory of your entire work day — powered by local AI.

[![Windows](https://img.shields.io/badge/Platform-Windows-5B2EFF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/chetanupare/rewind)
[![Electron](https://img.shields.io/badge/Electron-33-8A3FFC?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![Ollama](https://img.shields.io/badge/AI-Ollama-FF4D9D?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

<br />

[![RewindX Dashboard](https://img.shields.io/badge/Dashboard-Live-5B2EFF?style=for-the-badge)](#-features)
[![AI Chat](https://img.shields.io/badge/AI_Chat-Ready-8A3FFC?style=for-the-badge)](#-ai-chat)
[![Time Travel](https://img.shields.io/badge/Time_Travel-Enabled-FF4D9D?style=for-the-badge)](#-time-travel)

</div>

---

## ✨ What is RewindX?

RewindX is a **personal AI assistant** that lives on your Windows machine. It watches what you do, learns your patterns, and creates a searchable timeline of your entire work day.

Think of it as a **personal productivity black box** — it captures everything so you don't have to remember anything.

```
You open VS Code → RewindX knows you're coding
You switch to Chrome → RewindX knows you're researching  
You open Figma → RewindX knows you're designing
You commit code → RewindX knows what you changed
```

**Ask it:** *"What did I work on this morning?"* → Get an instant answer.

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 📸 Smart Screenshots
Captures your screen periodically and uses **Vision AI** to understand exactly what you're working on — not just which app, but *what project*, *what task*, *what code*.

</td>
<td width="50%">

### 🧠 AI Analysis
Every screenshot is analyzed by a local AI model. It detects your IDE, reads your code, identifies your project, and understands the context of your work.

</td>
</tr>
<tr>
<td width="50%">

### ⏰ Time Travel
Browse your entire work day as a visual timeline. Scrub through screenshots, see what you were doing at any moment, and restore context with one click.

</td>
<td width="50%">

### 🔍 Universal Search
Search through everything — window titles, OCR text, AI descriptions, git commits. Find that error message you saw at 2pm or that React component you edited.

</td>
</tr>
<tr>
<td width="50%">

### 💬 AI Chat
Ask questions in natural language: *"What did I work on today?"*, *"Show me React work"*, *"When did I fix that bug?"* — get instant answers from your work history.

</td>
<td width="50%">

### 📊 Auto Reports
Automatically generates daily standups and weekly summaries. Never struggle to remember what you did in a meeting again.

</td>
</tr>
<tr>
<td width="50%">

### ⌨️ Input Tracking
Monitors keyboard shortcuts, mouse activity, and typing patterns to understand your productivity flow and detect when you're in the zone.

</td>
<td width="50%">

### 🌐 Browser Tracking
Detects browser windows and URLs to understand your research patterns. Knows when you're reading docs vs browsing social media.

</td>
</tr>
<tr>
<td width="50%">

### 🔗 Git Integration
Auto-detects repositories, tracks branches, and logs commits. Correlates your coding activity with version control events.

</td>
<td width="50%">

### 🕸️ Knowledge Graph
Builds relationships between projects, apps, and technologies. Understands that *"RepairCRM"* uses React, Node.js, and MongoDB.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ⏪ RewindX                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  React UI    │  │  Electron    │  │  System Tray         │  │
│  │  Dashboard   │  │  Main Process│  │  Background Service  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └─────────────────┼──────────────────────┘              │
│                           │                                     │
│                    ┌──────▼───────┐                             │
│                    │   Event Bus  │                             │
│                    └──────┬───────┘                             │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                   │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐           │
│  │  Collectors │  │  AI Pipeline│  │  Knowledge  │           │
│  │             │  │             │  │  Graph      │           │
│  │ • Window    │  │ • Vision AI │  │             │           │
│  │ • Keyboard  │  │ • OCR       │  │ • Projects  │           │
│  │ • Mouse     │  │ • Embeddings│  │ • Apps      │           │
│  │ • Browser   │  │ • Summaries │  │ • Tech      │           │
│  │ • Git       │  │             │  │ • Files     │           │
│  │ • Files     │  │             │  │             │           │
│  └─────────────┘  └─────────────┘  └─────────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Storage Layer                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │  SQLite  │  │  Qdrant  │  │  Ollama  │  │ Files  │ │   │
│  │  │  + FTS5  │  │ Vectors  │  │   AI     │  │        │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

### 1. Node.js (v20+)

```bash
# Download from https://nodejs.org
node --version  # Should be v20 or higher
```

### 2. Ollama (Local AI Runtime)

Ollama runs AI models directly on your machine — **no cloud, no API keys, no data leaving your computer**.

#### Install Ollama

```bash
# Windows: Download from https://ollama.com/download
# Or use winget:
winget install Ollama.Ollama
```

#### Pull Required Models

```bash
# Vision model — analyzes screenshots (2GB)
ollama pull qwen2.5-vl:3b

# Text model — generates summaries & chat (2GB)  
ollama pull qwen2.5-coder:3b

# Embedding model — powers semantic search (275MB)
ollama pull nomic-embed-text
```

#### Verify Installation

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Should return list of installed models
```

#### Model Requirements

| Model | Size | Purpose | VRAM |
|-------|------|---------|------|
| `qwen2.5-vl:3b` | ~2GB | Screenshot analysis | ~4GB |
| `qwen2.5-coder:3b` | ~2GB | Text generation | ~4GB |
| `nomic-embed-text` | ~275MB | Semantic search | ~1GB |

> **💡 Tip:** Works on CPU too, just slower. 8GB+ VRAM recommended for smooth GPU operation.

### 3. Tesseract OCR (Optional)

For text extraction from screenshots:

```bash
# Download from https://github.com/UB-Mannheim/tesseract/wiki
# Install to: C:\Program Files\Tesseract-OCR
```

### 4. Qdrant Vector Database (Optional)

For semantic search with embeddings:

```bash
# Option A: Docker (recommended)
docker run -p 6333:6333 qdrant/qdrant

# Option B: Qdrant Cloud — https://cloud.qdrant.io
```

---

## 📦 Installation

### From Release

1. Download `RewindX-Setup-0.1.0.exe` from [Releases](https://github.com/chetanupare/rewind/releases)
2. Run the installer
3. RewindX starts minimized in your system tray

### From Source

```bash
# Clone the repository
git clone https://github.com/chetanupare/rewind.git
cd rewind

# Install dependencies
npm install

# Build all packages
npm run build

# Run the app
npm run start -w packages/electron-app

# Or build the executable
npm run package -w packages/electron-app
```

---

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# ═══════════════════════════════════════════
#  Ollama Configuration
# ═══════════════════════════════════════════
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_VISION_MODEL=qwen2.5-vl:3b
OLLAMA_TEXT_MODEL=qwen2.5-coder:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# ═══════════════════════════════════════════
#  Qdrant Vector Database (Optional)
# ═══════════════════════════════════════════
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=rewindx
```

---

## 🎯 Usage

### System Tray

RewindX lives in your system tray. Right-click to:
- **Show Dashboard** — Open the main interface
- **Quit** — Stop all tracking

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Open Omnibar (quick search & AI chat) |

### Dashboard Features

#### 📸 Time Travel
Browse your work day visually. Select a date, scrub through screenshots, and see exactly what you were doing at any moment.

**One-click Context Restore** — Click "Restore Context" to reopen the project you were working on.

#### 📊 Activity Feed
Real-time stream of your computer activity with:
- Application names and window titles
- Duration spent in each app
- Activity type (Coding, Research, Communication, etc.)

#### 📈 Stats
- Coding time vs Research time
- Meeting duration
- Screenshots captured today

### 🔍 Search

Search your entire work history:

```
"React"           → Find all React-related work
"MongoDB error"   → Find when you saw that error
"invoice module"  → Find invoice-related screenshots
"what did I do"   → Get a summary of recent work
```

### 💬 AI Chat

Ask questions in natural language:

| Question | What Happens |
|----------|--------------|
| *"What did I work on today?"* | Summarizes your activities |
| *"Show me React work"* | Finds all React-related activity |
| *"When did I fix that bug?"* | Searches for bug-fixing patterns |
| *"Summarize this week"* | Generates a weekly report |
| *"What was I doing at 2pm?"* | Shows screenshots from that time |

### 📊 Auto-Generated Reports

| Report | When | What |
|--------|------|------|
| Daily Standup | 5:00 PM weekdays | What you did, blockers, next steps |
| Weekly Summary | Friday 5:00 PM | Accomplishments, focus areas, patterns |

---

## 🗂️ Data Storage

All data stays on your machine:

```
%APPDATA%\RewindX\
├── db\
│   └── workmemory.db        # SQLite database
├── screenshots\              # Captured screenshots
│   └── 2024-01-15\          # Organized by date
│       ├── 09-15-30.webp
│       ├── 09-17-45.webp
│       └── ...
├── logs\                     # Application logs
└── config.json               # User configuration
```

---

## 🔒 Privacy

| Feature | Status |
|---------|--------|
| All data stored locally | ✅ |
| No telemetry or analytics | ✅ |
| No cloud connections (by default) | ✅ |
| Password managers blacklisted | ✅ |
| Sensitive content filtered from clipboard | ✅ |
| Screenshots can be disabled | ✅ |
| AI runs 100% locally via Ollama | ✅ |

---

## 🛠️ Development

### Project Structure

```
rewindx/
├── packages/
│   ├── shared/              # Shared types, database, config
│   │   └── src/
│   │       ├── types/       # TypeScript interfaces
│   │       ├── database.ts  # SQLite wrapper + migrations
│   │       ├── config.ts    # Configuration management
│   │       └── event-bus.ts # Event system
│   │
│   ├── background-service/  # Data collection & AI
│   │   └── src/
│   │       ├── collectors/  # Activity trackers
│   │       │   ├── window-tracker.ts
│   │       │   ├── keyboard-tracker.ts
│   │       │   ├── mouse-tracker.ts
│   │       │   ├── browser-tracker.ts
│   │       │   ├── git-tracker.ts
│   │       │   ├── screenshot-service.ts
│   │       │   ├── clipboard-monitor.ts
│   │       │   ├── filesystem-watcher.ts
│   │       │   └── system-events.ts
│   │       ├── ai/          # Ollama integration
│   │       │   ├── ollama-client.ts
│   │       │   ├── vision-analyzer.ts
│   │       │   ├── ocr-service.ts
│   │       │   └── embedding-generator.ts
│   │       ├── pipeline/    # Session builder
│   │       ├── search/      # Text & vector search
│   │       └── memory/      # Knowledge graph
│   │
│   ├── ui/                  # React frontend
│   │   └── src/
│   │       ├── pages/       # Dashboard, Search, Chat, etc.
│   │       └── styles/      # CSS with brand colors
│   │
│   └── electron-app/        # Electron main process
│       └── src/
│           ├── main.ts      # App entry point + IPC
│           └── preload.ts   # Context bridge
│
├── .env.example             # Environment variables template
└── README.md                # This file
```

### Build Commands

```bash
# Build everything
npm run build

# Build individual packages
npm run build:shared
npm run build:background
npm run build:ui
npm run build:electron

# Development
npm run dev:ui          # Vite dev server with HMR
npm run dev:electron    # Electron with hot reload

# Package executable
npm run package -w packages/electron-app
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 33 |
| Frontend | React 18 + TypeScript |
| Build Tool | Vite + esbuild |
| Styling | Custom CSS (Manrope font) |
| Database | SQLite (better-sqlite3) |
| Full-Text Search | SQLite FTS5 |
| Vector Database | Qdrant |
| AI Runtime | Ollama |
| Vision Model | Qwen2.5-VL |
| Text Model | Qwen2.5-Coder |
| Embedding Model | Nomic Embed Text |
| Image Processing | Sharp |
| Git Integration | simple-git |
| File Watching | Chokidar |
| Logging | Pino |

---

## 🐛 Troubleshooting

<details>
<summary><b>Ollama Not Connected</b></summary>

```
Error: Cannot connect to Ollama
```

**Fix:**
1. Check if Ollama is running: `curl http://localhost:11434`
2. Start Ollama if stopped
3. Verify port: `netstat -ano | findstr :11434`
4. Check Windows Firewall settings

</details>

<details>
<summary><b>Slow AI Responses</b></summary>

- Use smaller models: `qwen2.5-vl:1b` instead of `3b`
- Ensure GPU is being used: `ollama list`
- Close other GPU-intensive applications
- Increase timeout in config

</details>

<details>
<summary><b>Screenshots Not Capturing</b></summary>

1. Check privacy settings: `storeScreenshots` must be `true`
2. Verify screenshots directory exists
3. Check Windows permissions for screen capture
4. Look at logs: `%APPDATA%\RewindX\logs\`

</details>

<details>
<summary><b>High CPU Usage</b></summary>

- Increase screenshot interval (default: 2 minutes)
- Disable collectors you don't need
- Use smaller AI models
- Check for runaway processes in Task Manager

</details>

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Ollama](https://ollama.com) — Local AI runtime
- [Qdrant](https://qdrant.tech) — Vector database
- [Electron](https://electronjs.org) — Desktop framework
- [React](https://react.dev) — UI framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — SQLite driver
- [sharp](https://sharp.pixelplumbing.com) — Image processing
- [Manrope](https://manropefont.com) — Beautiful geometric sans-serif font

---

<div align="center">

**Built with 💜 by [Chetan Pare](https://github.com/chetanupare)**

[![GitHub](https://img.shields.io/badge/GitHub-chetanupare-111827?style=for-the-badge&logo=github)](https://github.com/chetanupare)
[![RewindX](https://img.shields.io/badge/RewindX-v0.1.0-5B2EFF?style=for-the-badge)](https://github.com/chetanupare/rewind)

</div>
