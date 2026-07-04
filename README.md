# Rewind - AI Work Memory

A personal Windows AI assistant that continuously observes your computer activity, understands what you're doing, learns your workflow over time, and builds a searchable memory of your work.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/electron-33-47848F)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Activity Tracking** - Monitors active applications, window titles, and time spent
- **Screenshot Capture** - Periodic screenshots with AI-powered analysis
- **Vision AI** - Analyzes screenshots to understand what you're working on
- **OCR** - Extracts text from screenshots for searchable memory
- **Keyboard & Mouse Tracking** - Monitors input patterns and shortcuts
- **Browser Tracking** - Detects browser windows and URLs
- **Git Integration** - Auto-detects repositories, branches, and commits
- **Knowledge Graph** - Builds relationships between projects, apps, and technologies
- **Smart Search** - Full-text search with vector embeddings
- **AI Chat** - Ask questions about your work history
- **Time Travel** - Browse screenshots by date with context restoration
- **Reports** - Auto-generated daily standups and weekly summaries
- **Omnibar** - Quick search with `Alt+Space`

## Architecture

```
┌─────────────────────────────────────────┐
│           Electron App (Main)           │
├─────────────────────────────────────────┤
│  React UI  │  IPC Handlers  │  Tray     │
├─────────────────────────────────────────┤
│         Background Service              │
├──────┬──────┬──────┬──────┬─────────────┤
│Window│Mouse │Key   │Screen│  Browser    │
│Track │Track │Track │shot  │  Track      │
├──────┴──────┴──────┴──────┴─────────────┤
│  Session Builder │ AI Pipeline │ Search │
├──────────────────┴─────────────┴────────┤
│   SQLite + FTS5  │  Qdrant Vectors      │
├──────────────────┴──────────────────────┤
│           Ollama (Local AI)             │
└─────────────────────────────────────────┘
```

## Prerequisites

### 1. Node.js

Download and install Node.js v20 or later:
- https://nodejs.org/

### 2. Ollama (Local AI)

Ollama runs AI models locally on your machine.

#### Install Ollama

Download from: https://ollama.com/download

#### Pull Required Models

After installing Ollama, open a terminal and run:

```bash
# Vision model - for analyzing screenshots
ollama pull qwen2.5-vl:3b

# Text model - for generating summaries and chat
ollama pull qwen2.5-coder:3b

# Embedding model - for semantic search
ollama pull nomic-embed-text
```

#### Verify Ollama is Running

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Or open in browser
http://localhost:11434
```

#### Ollama Configuration

By default, Ollama runs on `localhost:11434`. If you need to change this, set environment variables:

```bash
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
```

#### Model Requirements

| Model | Size | Purpose | VRAM |
|-------|------|---------|------|
| `qwen2.5-vl:3b` | ~2GB | Screenshot analysis | ~4GB |
| `qwen2.5-coder:3b` | ~2GB | Text generation | ~4GB |
| `nomic-embed-text` | ~275MB | Semantic search | ~1GB |

**Minimum GPU**: 8GB VRAM recommended for smooth operation  
**CPU Mode**: Works without GPU but will be slower

### 3. Tesseract OCR (Optional)

For OCR text extraction from screenshots:

1. Download Tesseract: https://github.com/UB-Mannheim/tesseract/wiki
2. Install to default location: `C:\Program Files\Tesseract-OCR`
3. The app will auto-detect it

Alternative: Python with pytesseract
```bash
pip install pytesseract Pillow
```

### 4. Qdrant Vector Database (Optional)

For semantic search with embeddings:

**Option A: Local Qdrant (Docker)**
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**Option B: Qdrant Cloud**
1. Sign up at https://cloud.qdrant.io
2. Create a cluster
3. Get your API key and URL

Set environment variables:
```bash
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

## Installation

### From Release

1. Download `AI Work Memory 0.1.0.exe` from releases
2. Run the installer
3. The app starts minimized in the system tray

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

# Or package as executable
npm run package -w packages/electron-app
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_VISION_MODEL=qwen2.5-vl:3b
OLLAMA_TEXT_MODEL=qwen2.5-coder:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=aiworkmemory
```

## Usage

### System Tray

The app runs in the system tray. Right-click the icon to:
- Show Dashboard
- Quit

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Space` | Open Omnibar (quick search) |

### Dashboard

The main dashboard shows:
- **Time Travel** - Browse screenshots by date
- **Activity Feed** - Recent application usage
- **Stats** - Coding time, research time, meetings

### Search

Search your work history using:
- Keywords (full-text search)
- Natural language (semantic search with Qdrant)
- Filter by app, project, or date

### AI Chat

Ask questions like:
- "What did I work on today?"
- "Show me React-related work"
- "When did I fix that bug?"
- "Summarize my week"

## Data Storage

All data is stored locally in:
```
%APPDATA%\AIWorkMemory\
├── db\
│   └── workmemory.db    # SQLite database
├── screenshots\          # Captured screenshots
│   └── 2024-01-15\      # Organized by date
├── logs\                 # Application logs
└── config.json           # User configuration
```

## Privacy

- All data stays on your machine
- No telemetry or analytics
- Sensitive content (passwords, tokens) is filtered from clipboard
- Apps like password managers are blacklisted by default
- Screenshots can be disabled in settings

## Development

### Project Structure

```
packages/
├── shared/              # Shared types, database, config
│   └── src/
│       ├── types/       # TypeScript interfaces
│       ├── database.ts  # SQLite wrapper
│       ├── config.ts    # Configuration management
│       └── event-bus.ts # Event system
├── background-service/  # Data collection & AI
│   └── src/
│       ├── collectors/  # Activity trackers
│       ├── ai/          # Ollama integration
│       ├── pipeline/    # Session builder
│       ├── search/      # Text & vector search
│       └── memory/      # Knowledge graph
├── ui/                  # React frontend
│   └── src/
│       └── pages/       # Dashboard, Search, Chat, etc.
└── electron-app/        # Electron main process
    └── src/
        ├── main.ts      # App entry point
        └── preload.ts   # IPC bridge
```

### Build Commands

```bash
# Build all
npm run build

# Build individual packages
npm run build:shared
npm run build:background
npm run build:ui
npm run build:electron

# Development mode
npm run dev:ui          # Vite dev server
npm run dev:electron    # Electron with hot reload
```

## Troubleshooting

### Ollama Not Connected

```
Error: Cannot connect to Ollama
```

**Solution:**
1. Check if Ollama is running: `curl http://localhost:11434`
2. Start Ollama if stopped
3. Verify port: `netstat -ano | findstr :11434`

### Slow AI Responses

- Reduce vision model size: Use `qwen2.5-vl:1b` instead of `3b`
- Increase Ollama timeout in config
- Ensure GPU is being used: `ollama list` shows GPU status

### Screenshots Not Capturing

1. Check privacy settings: `storeScreenshots` must be `true`
2. Verify screenshots directory exists and is writable
3. Check Windows permissions for screen capture

### High CPU Usage

- Increase screenshot interval in config
- Disable collectors you don't need
- Reduce AI model sizes

## License

MIT License

## Acknowledgments

- [Ollama](https://ollama.com) - Local AI runtime
- [Qdrant](https://qdrant.tech) - Vector database
- [Electron](https://electronjs.org) - Desktop framework
- [React](https://react.dev) - UI framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite driver
- [sharp](https://sharp.pixelplumbing.com) - Image processing
