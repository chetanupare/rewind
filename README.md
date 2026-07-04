<div align="center">

<img src="packages/ui/public/assets/brand/text-logo.png" alt="RewindX" width="400" />

### Your AI-Powered Second Brain

**RewindX doesn't just remember what you did — it understands why, learns how, and predicts what's next.**

[![Windows](https://img.shields.io/badge/Platform-Windows-5B2EFF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/chetanupare/rewind/releases)
[![Version](https://img.shields.io/badge/Version-0.2.0-8A3FFC?style=for-the-badge)](https://github.com/chetanupare/rewind/releases)
[![License](https://img.shields.io/badge/License-AGPL--3.0-00D47E?style=for-the-badge)](LICENSE)

<br />

[![Features](https://img.shields.io/badge/28_Features-5B2EFF?style=for-the-badge)](#features)
[![Brain Modules](https://img.shields.io/badge/21_Brain_Modules-FF4FA3?style=for-the-badge)](#cognitive-brain)
[![Download](https://img.shields.io/badge/Download-Installer-00D47E?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/chetanupare/rewind/releases)

</div>

---

## What is RewindX?

RewindX is a **cognitive brain** for your computer. It watches what you do, understands why you do it, learns your patterns, and builds a searchable memory of your entire work life.

```
Traditional Tools:  Record → Store → Search
RewindX:           Perceive → Understand → Learn → Predict → Remember
```

**It's not a logger. It's a brain.**

---

## Download

### Installer (Recommended)
Download `RewindX-Setup-0.2.0.exe` from [Releases](https://github.com/chetanupare/rewind/releases)

### From Source
```bash
git clone https://github.com/chetanupare/rewind.git
cd rewind
npm install
npm run build
npm run package -w packages/electron-app
```

---

## Prerequisites

### Ollama (Required)
```bash
# Install from https://ollama.com/download

# Pull required models
ollama pull qwen2.5-vl:3b      # Vision (2GB)
ollama pull qwen2.5-coder:3b   # Text (2GB)
ollama pull nomic-embed-text    # Embeddings (275MB)
```

### Python Dependencies (Optional - for advanced features)

The installer includes a setup script for Python dependencies. If you skipped it during installation:

```bash
# Run the setup script
setup-python.bat
```

Or manually install:
```bash
pip install paddleocr easyocr pytesseract PyMuPDF python-docx spacy networkx
python -m spacy download en_core_web_sm
```

**What each dependency enables:**

| Dependency | Feature | Size |
|------------|---------|------|
| PaddleOCR | Best OCR accuracy | ~80 MB |
| EasyOCR | Lightweight OCR fallback | ~80 MB |
| Tesseract | Fast offline OCR | ~50 MB |
| PyMuPDF | PDF text extraction | ~15 MB |
| python-docx | DOCX extraction | ~1 MB |
| spaCy | Entity recognition | ~40 MB |
| NetworkX | Knowledge graph algorithms | ~10 MB |

**Without Python:** Core features work 100%. OCR uses Windows native. No document/entity extraction.

### Optional
- **Tesseract OCR** - Text extraction from screenshots
- **Qdrant** - Vector database for semantic search

---

## Cognitive Brain

RewindX has **21 brain modules** that think, learn, and predict.

```
┌─────────────────────────────────────────────────────────┐
│                     REWINDX BRAIN                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Perception    Memory         Reasoning                  │
│  ├─ Intent     ├─ Working     ├─ Prediction             │
│  ├─ Concept    ├─ Episodes    ├─ Confidence             │
│  └─ Pattern    ├─ Long-term   └─ Feedback Loop          │
│                ├─ Knowledge                               │
│  Learning      │  Graph       Action                     │
│  ├─ Mistakes   ├─ Decisions   ├─ AI Mentor              │
│  ├─ Personality└─ Compression ├─ Reflection             │
│  └─ Curiosity                  └─ Goals                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### How It Thinks

```
Event arrives
    ↓
Understand: "User is debugging React app"
    ↓
Extract: [VS Code, RewindX, debugging]
    ↓
Combine: Link to existing knowledge
    ↓
Learn: "User debugs React at 2pm often"
    ↓
Predict: "Next: terminal or commit"
    ↓
Remember: Store with importance 0.8
```

---

## Features

### 🧠 Intelligence (21 Brain Modules)

| Module | What It Does |
|--------|--------------|
| Cognitive Engine | Main orchestrator |
| Knowledge Graph | Entity relationships |
| Long-Term Memory | Importance-based with decay |
| Episodic Memory | Remembers episodes, not events |
| Working Memory | Current context |
| Concept Learner | Auto-learns topics |
| Intent Engine | Detects what you're doing |
| Pattern Learner | Finds recurring sequences |
| Prediction Engine | Predicts next action |
| Decision Tracker | Remembers decisions |
| Mistake Learner | Personal error database |
| Confidence Evolution | Learns from outcomes |
| User Personality | Adapts to your style |
| AI Reflection | Thinks every night |
| Reasoning Engine | Evidence-based answers |
| AI Mentor | Proactive suggestions |
| Curiosity Engine | Asks questions |
| Memory Compressor | Reduces storage |
| Feedback Loop | Self-improving |
| Cognitive Pipeline | Orchestrates all |
| Confidence System | Prevents hallucination |

### 📸 Collectors (10)

| Collector | Captures |
|-----------|----------|
| Window Tracker | App, title, PID, bounds |
| Keyboard | Keys, shortcuts, speed |
| Mouse | Clicks, scrolls |
| Screenshot | Images with AI analysis |
| Clipboard | Text, code, URLs |
| Git | Commits, branches, files |
| Browser | Tabs, URLs, sites |
| Terminal | Commands, errors |
| System | Power, lock, sleep |
| Filesystem | File changes |

### ⚡ Features (28)

**Context & Awareness**
- Context Switch Detection
- Smart Session Detection
- Adaptive Screenshot Capture
- Privacy Guard (incognito, DRM, banking)

**Intelligence**
- Browser Intelligence (GitHub, SO, ChatGPT, etc.)
- Meeting Intelligence
- Deep Git Integration
- Terminal Command Capture

**Productivity**
- Focus Mode (Pomodoro)
- Focus Analytics
- Smart Notifications
- Battery Awareness

**Memory**
- Daily Journal Generator
- Memory Bookmarks
- Cross-Memory Linking
- Session Replay

**Automation**
- Natural Language Automation
- Learning Patterns
- Project Detector

**Integration**
- Windows Integration (Jump Lists, Toasts)
- Browser Extension
- Memory API
- Smart Clipboard

---

## UI Pages (15)

| Page | Description |
|------|-------------|
| Dashboard | Stats, activity feed, time travel |
| Chat | AI conversation with context |
| Memory | Bookmark management |
| Search | Full-text and semantic |
| Timeline | Hourly activity view |
| Screenshots | Gallery with AI analysis |
| Developer Mode | Git, terminal correlation |
| Focus Analytics | Productivity metrics |
| Session Replay | Playback sessions |
| Browser Extension | Install guide |
| Notes | Bookmark-based notes |
| Reports | Daily/weekly summaries |
| Settings | Configuration |
| Omnibar | Quick search (Alt+Space) |
| Splash Screen | Animated startup |

---

## Design

- **Font:** Jost
- **Colors:** Purple (#5B2EFF), Pink (#FF4FA3), Navy (#111827)
- **Style:** Glass morphism, dark theme, premium SaaS
- **Animations:** Framer Motion, smooth transitions

---

## Environment Variables

```env
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_VISION_MODEL=qwen2.5-vl:3b
OLLAMA_TEXT_MODEL=qwen2.5-coder:3b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

---

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Cognitive Core | ✅ Done |
| 2 | Goal Engine | 🔨 In Progress |
| 3 | Active Memory | 📋 Planned |
| 4 | Planning Engine | 📋 Planned |
| 5 | Self Reflection | ✅ Partial |
| 6 | Memory Consolidation | ✅ Done |
| 7 | Autonomous Research | 📋 Planned |
| 8 | Skill Graph | 📋 Planned |
| 9 | Personal Documentation | 📋 Planned |
| 10 | Autonomous Improvements | 📋 Planned |
| 11 | Agent System | 📋 Planned |
| 12 | Digital Twin | 📋 Vision |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 33 |
| Frontend | React 18 + TypeScript |
| Styling | TailwindCSS + Jost font |
| Build | Vite + esbuild |
| Database | SQLite (better-sqlite3) |
| Search | SQLite FTS5 + Qdrant |
| AI | Ollama (local) |
| Vision | qwen2.5-vl:3b |
| Text | qwen2.5-coder:3b |
| Embeddings | nomic-embed-text |
| Images | Sharp |
| Git | simple-git |
| Files | Chokidar |
| Logging | Pino |
| Animations | Framer Motion |

---

## File Structure

```
rewindx/
├── packages/
│   ├── shared/              # Types, DB, config
│   ├── background-service/  # Collectors, AI, Brain
│   │   └── src/
│   │       ├── collectors/  # 10 data collectors
│   │       ├── ai/          # Vision, OCR, embeddings
│   │       ├── features/    # 28 features
│   │       ├── brain/       # 21 cognitive modules
│   │       └── pipeline/    # Session builder
│   ├── ui/                  # React frontend
│   │   └── src/
│   │       ├── pages/       # 15 pages
│   │       ├── components/  # Shared components
│   │       └── styles/      # CSS
│   └── electron-app/        # Electron main
├── browser-extension/       # Chrome/Edge
├── installer.iss            # Inno Setup
├── FEATURES.md              # Feature docs
├── ROADMAP.md               # Roadmap
├── CHANGELOG.md             # Changes
├── CONTRIBUTING.md          # How to contribute
├── SECURITY.md              # Security policy
├── CODE_OF_CONDUCT.md       # Code of conduct
└── AGENTS.md                # AI context
```

---

## Documentation

- [Features](FEATURES.md) - Complete feature documentation
- [Roadmap](ROADMAP.md) - 12-phase development plan
- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - How to contribute
- [Security](SECURITY.md) - Security policy
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the AGPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## Author

**Chetan Upare**

[![GitHub](https://img.shields.io/badge/GitHub-chetanupare-111827?style=for-the-badge&logo=github)](https://github.com/chetanupare)

---

<div align="center">

**RewindX** — Your AI-Powered Second Brain

</div>
