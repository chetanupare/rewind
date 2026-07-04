# RewindX - Complete Feature Documentation

> **Version:** 0.3.0  
> **Last Updated:** July 5, 2026  
> **Platform:** Windows 10/11  
> **Architecture:** Electron + React + TypeScript + SQLite + Cognitive Brain

---

## Executive Summary

RewindX is a **cognitive brain** for your computer. It doesn't just record what you do — it **understands**, **learns**, **predicts**, and **remembers** everything.

```
Traditional Tools:  Record → Store → Search
RewindX:           Perceive → Understand → Learn → Predict → Remember
```

---

## 🧠 Cognitive Brain (22 Modules)

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
│  ├─ Personality├─ Memory      ├─ Reflection             │
│  └─ Curiosity  │  Intelligence└─ Goals                  │
│                └─ Compression                            │
└─────────────────────────────────────────────────────────┘
```

### Core Modules

| Module | Purpose |
|--------|---------|
| Cognitive Engine | Main orchestrator |
| Knowledge Graph | Entity relationships |
| Long-Term Memory | Importance-based with decay |
| Episodic Memory | Episodes, not events |
| Working Memory | Current context |
| Concept Learner | Auto-learns topics |
| Intent Engine | Detects what you're doing |
| Pattern Learner | Finds sequences |
| Prediction Engine | Predicts next action |
| Decision Tracker | Remembers decisions |
| Mistake Learner | Personal error database |
| Confidence Evolution | Dynamic scoring |
| User Personality | Adapts to your style |
| AI Reflection | Nightly thinking |
| Reasoning Engine | Evidence-based answers |
| AI Mentor | Proactive suggestions |
| Curiosity Engine | Asks questions |
| Feedback Loop | Self-improving |
| Cognitive Pipeline | Orchestrates all |
| Memory Intelligence | Advanced memory features |
| Confidence System | Prevents hallucination |

### Memory Intelligence Features

| Feature | Description |
|---------|-------------|
| Confidence Decay | Memories fade if not accessed |
| Memory Reinforcement | Frequently accessed memories get stronger |
| Contradiction Detection | Detects when knowledge conflicts |
| Memory Aging | Fresh → Warm → Cold → Archived |
| Topic Evolution | Tracks how technologies stack grows |
| Relationship Discovery | Auto-links related entities |
| Knowledge Validation | Multi-source verification |
| Event Fusion | Combines events into workflows |
| Automatic Tags | Auto-tags activities |
| Episode Rating | Rates episodes (useful/failed/etc) |
| Smart Forgetting | Compresses old memories |
| Self Diagnosis | Checks brain accuracy |
| Knowledge Gaps | Suggests what to learn |
| Duplicate Merge | Merges similar entries |
| Memory Health Dashboard | Brain stats UI |
| AI Self-Explanation | Explains confidence |
| Memory DNA | Fingerprints every memory |
| Cognitive Metrics | Brain performance stats |

---

## 📸 Collectors (10)

| Collector | Captures | Method |
|-----------|----------|--------|
| Window Tracker | App, title, PID, bounds | PowerShell (persistent) |
| Keyboard | Keys, shortcuts, speed | PowerShell hook |
| Mouse | Clicks, scrolls | PowerShell hook |
| Screenshot | Images with AI analysis | PowerShell + Sharp |
| Clipboard | Text, code, URLs | PowerShell polling |
| Git | Commits, branches, files | simple-git |
| Browser | Tabs, URLs, sites | Process detection |
| Terminal | Commands, errors | Window title parsing |
| System | Power, lock, sleep | Electron powerMonitor |
| Filesystem | File changes | Chokidar |

---

## 🧪 AI Pipeline

| Component | Model | Purpose |
|-----------|-------|---------|
| Vision Analyzer | qwen2.5-vl:3b | Screenshot analysis |
| OCR Service | Tesseract/EasyOCR/PaddleOCR | Text extraction |
| Embedding Generator | nomic-embed-text | Semantic search |
| Text Generator | qwen2.5-coder:3b | Summaries, chat |
| Multi-Engine OCR | Auto-selects best | Intelligent OCR |
| Document Intelligence | PyMuPDF, python-docx | PDF/DOCX extraction |
| Speech Recognition | Whisper | Audio transcription |
| Code Intelligence | tree-sitter patterns | Code analysis |
| Entity Recognition | spaCy/regex | People, projects, tech |
| Enhanced Search | BM25 + Embeddings + Reranker | Smart search |

---

## ⚡ Features (28+)

### Context & Awareness
- **Context Switch Detection** — Intentional vs distraction
- **Smart Session Detection** — Auto-detects coding/meeting/debugging
- **Adaptive Screenshot Capture** — 20s code, 1min meetings, pause gaming
- **Privacy Guard** — Incognito, DRM, banking detection

### Intelligence
- **Browser Intelligence** — GitHub, SO, ChatGPT, Linear, Jira
- **Meeting Intelligence** — Auto-detects meetings, generates notes
- **Deep Git Integration** — Tracks repos, branches, commits
- **Terminal Command Capture** — Extracts commands and errors

### Productivity
- **Focus Mode (Pomodoro)** — 25min work / 5min break
- **Focus Analytics** — Deep work, interruptions, scoring
- **Smart Notifications** — Distraction alerts, commit reminders
- **Battery Awareness** — 4 power profiles

### Memory
- **Daily Journal Generator** — AI-generated summaries
- **Memory Bookmarks** — Save important moments
- **Cross-Memory Linking** — Links screenshots ↔ commits
- **Session Replay** — Reconstruct coding sessions

### Automation
- **Natural Language Automation** — "Remind me tomorrow..."
- **Learning Patterns** — Learns habits and patterns
- **Project Detector** — Auto-detects projects

### Integration
- **Windows Integration** — Jump Lists, Toast notifications
- **Browser Extension** — Chrome/Edge tab tracking
- **Memory API** — HTTP API on port 48291
- **Smart Clipboard** — History, pin, favorites

---

## 🖥️ UI Pages (16)

| Page | Description |
|------|-------------|
| Dashboard | Stats, activity feed, time travel |
| Chat | AI conversation with context |
| Memory | Bookmark management |
| Memory Health | Brain stats and metrics |
| Search | Full-text and semantic search |
| Timeline | Hourly activity view |
| Screenshots | Gallery with AI analysis |
| Developer Mode | Git, terminal correlation |
| Focus Analytics | Productivity metrics |
| Session Replay | Playback sessions |
| Browser Extension | Install guide + data view |
| Notes | Bookmark-based notes |
| Reports | Daily/weekly summaries |
| Settings | Configuration |
| Omnibar | Quick search (Alt+Space) |
| Splash Screen | Animated startup |

---

## 🎨 Design System

- **Font:** Jost (geometric sans-serif)
- **Colors:** Purple (#5B2EFF), Pink (#FF4FA3), Navy (#111827)
- **Style:** Dark theme, glass morphism, premium SaaS
- **Animations:** Framer Motion, smooth transitions
- **Background:** Deep navy with radial glows

---

## 📁 File Structure

```
rewindx/
├── packages/
│   ├── shared/              # Types, DB, config
│   ├── background-service/  # Collectors, AI, Brain
│   │   └── src/
│   │       ├── collectors/  # 10 data collectors
│   │       ├── ai/          # Vision, OCR, embeddings, NER
│   │       ├── features/    # 28+ features
│   │       ├── brain/       # 22 cognitive modules
│   │       └── pipeline/    # Session builder
│   ├── ui/                  # React frontend
│   │   └── src/
│   │       ├── pages/       # 16 pages
│   │       ├── components/  # Shared components
│   │       └── styles/      # CSS with Jost font
│   └── electron-app/        # Electron main
├── browser-extension/       # Chrome/Edge
├── installer.iss            # Inno Setup
├── setup-python.bat         # Python deps installer
├── python-requirements.txt  # Python packages
├── FEATURES.md              # This file
├── ROADMAP.md               # Development plan
├── CHANGELOG.md             # Version history
├── CONTRIBUTING.md          # How to contribute
├── SECURITY.md              # Security policy
├── CODE_OF_CONDUCT.md       # Community guidelines
└── AGENTS.md                # AI context
```

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | localhost | Ollama host |
| `OLLAMA_PORT` | 11434 | Ollama port |
| `OLLAMA_VISION_MODEL` | qwen2.5-vl:3b | Vision model |
| `OLLAMA_TEXT_MODEL` | qwen2.5-coder:3b | Text model |
| `OLLAMA_EMBEDDING_MODEL` | nomic-embed-text | Embedding model |
| `QDRANT_URL` | http://localhost:6333 | Vector DB URL |
| `QDRANT_API_KEY` | (empty) | Qdrant API key |

---

## 📊 Performance

| Metric | Target | Current |
|--------|--------|---------|
| CPU | < 5% | ~3% |
| RAM | < 300 MB | ~300 MB |
| Startup | < 3s | ~1.5s |
| Screenshot | < 1s | ~500ms |
| AI Analysis | < 30s | ~20-60s |
| Search | < 100ms | ~50ms |
| Window Tracking | < 5ms | ~1ms |

---

## 🗺️ Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Cognitive Core | ✅ Done |
| 2 | Goal Engine | 🔨 In Progress |
| 3 | Active Memory | ✅ Done |
| 4 | Planning Engine | 📋 Planned |
| 5 | Self Reflection | ✅ Done |
| 6 | Memory Consolidation | ✅ Done |
| 7 | Autonomous Research | 🔨 In Progress |
| 8 | Skill Graph | 📋 Planned |
| 9 | Personal Documentation | 📋 Planned |
| 10 | Autonomous Improvements | 📋 Planned |
| 11 | Agent System | 📋 Planned |
| 12 | Digital Twin | 📋 Vision |

---

## 📚 Documentation

- [README.md](README.md) — Getting started
- [FEATURES.md](FEATURES.md) — This file
- [ROADMAP.md](ROADMAP.md) — Development plan
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [CONTRIBUTING.md](CONTRIBUTING.md) — How to contribute
- [SECURITY.md](SECURITY.md) — Security policy
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community guidelines
- [AGENTS.md](AGENTS.md) — AI context for development

---

## 🏆 What Makes RewindX Unique

1. **It's a Brain** — Not storage, but understanding
2. **Episodic Memory** — Remembers episodes, not screenshots
3. **Decision Tracking** — Remembers why, not just what
4. **Learns from Mistakes** — Personal error database
5. **Confidence Evolution** — AI knows when it's wrong
6. **User Personality** — Adapts to your work style
7. **AI Reflection** — Thinks every night
8. **Reasoning Engine** — Actually infers answers
9. **AI Mentor** — Proactively helps you improve
10. **Memory Decays** — Important things persist, trivial fades
11. **Contradiction Detection** — Knows when knowledge conflicts
12. **Knowledge Gaps** — Suggests what to learn next
13. **Smart Forgetting** — Compresses 500 screenshots → 18 episodes
14. **Memory Health Dashboard** — See your brain grow
15. **AI Self-Explanation** — Shows why it answered that way

---

*RewindX v0.3.0 — Your AI-Powered Second Brain*
