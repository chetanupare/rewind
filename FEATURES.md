# RewindX - Complete Feature Documentation

> **Version:** 0.3.0  
> **Last Updated:** July 5, 2026  
> **Platform:** Windows 10/11  
> **Architecture:** Electron + React + TypeScript + SQLite + Cognitive Engine

---

## Executive Summary

RewindX is not just a work memory assistant — it's a **cognitive brain** that thinks, learns, predicts, and remembers like a human.

```
Traditional Apps:    Record → Store → Search
RewindX:            Perceive → Understand → Learn → Predict → Remember → Reflect
```

**The Brain has 19 modules** that transform raw events into knowledge, episodes, decisions, and wisdom.

---

## 🧠 The Cognitive Brain

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        REWINDX BRAIN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Sensory    │───▶│  Working    │───▶│  Episode    │        │
│  │  Memory     │    │  Memory     │    │  Memory     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Intent     │    │  Goal       │    │  Pattern    │        │
│  │  Engine     │    │  Detection  │    │  Learner    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Concept    │    │  Decision   │    │  Mistake    │        │
│  │  Learner    │    │  Tracker    │    │  Learner    │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Knowledge  │    │  Long-Term  │    │  Confidence │        │
│  │  Graph      │    │  Memory     │    │  Evolution  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Prediction │    │  Reasoning  │    │  Curiosity  │        │
│  │  Engine     │    │  Engine     │    │  Engine     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Memory     │    │  AI         │    │  User       │        │
│  │  Compressor │    │  Reflection │    │  Personality│        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     AI MENTOR                           │  │
│  │          Proactive guidance and suggestions             │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1. Episodic Memory ⭐⭐⭐⭐⭐

**Humans don't remember screenshots — we remember episodes.**

```
Instead of: Screenshot → Window → Git → Browser
RewindX:    Episode: "Implement JWT Authentication"
            Start: 10:15 | End: 11:45
            Goal: Add Refresh Token
            Outcome: Completed
            Problems: Token expired
            Solution: Changed middleware
            Confidence: 97%
```

Every day becomes 20-50 meaningful episodes.

| Feature | Details |
|---------|---------|
| Auto-generation | Episodes created from activity patterns |
| Goal detection | AI detects what you're trying to accomplish |
| Outcome tracking | Completed, abandoned, blocked |
| Problem/Solution | Records issues and how they were fixed |
| Lessons learned | Extracts knowledge from episodes |
| Confidence | Each episode has confidence score |

---

### 2. Working Memory

**Short-term context — what you're doing RIGHT NOW.**

```
Current State:
├── Project: RewindX
├── Task: OCR Pipeline
├── File: vision.ts
├── App: VS Code
├── Recent Decisions: Changed OCR Engine
├── Pending: Test PDF support
└── Blocked By: Tesseract issue
```

When chatting, AI already knows your context — no search needed.

---

### 3. Decision Tracking ⭐⭐⭐⭐⭐

**Remember decisions, not just code.**

```
Decision: Moved to SQLite
Reason: Performance
Alternatives: DuckDB
Outcome: Successful
Confidence: 92%

Months later:
Q: "Why did I switch to SQLite?"
A: "You switched for performance reasons. DuckDB was the alternative.
    The decision was successful with 92% confidence."
```

---

### 4. Learning from Mistakes

**Personal error database — your own StackOverflow.**

```
Error: npm install failed
Solution: Delete node_modules, clear cache
Occurrences: 5 times
Confidence: 95%

Next time AI recognizes:
"Seen before. Same error. Same fix."
```

| Feature | Details |
|---------|---------|
| Error detection | From terminal, screenshots, logs |
| Solution tracking | Records what fixed it |
| Pattern recognition | Recognizes repeated errors |
| Confidence growth | Increases with successful fixes |

---

### 5. Confidence Evolution

**AI learns whether it was right.**

```
Prediction: 80% confidence
If correct → 92%
If wrong → 45%

AI continuously calibrates.
```

---

### 6. User Personality Model

**Understands how you work.**

```
Developer Style:
- Night coder
- Long focus sessions
- Rare commits
- Heavy research
- Uses AI frequently
- Prefers keyboard shortcuts
- Debugs before writing tests
```

AI adapts to your style.

---

### 7. AI Reflection ⭐⭐⭐⭐⭐

**Every night, the AI thinks.**

```
Today's Reflection:
- What surprised me?
- What did I learn?
- Which memories became stronger?
- Which became weaker?
- Any repeated mistakes?
- Any new habits?
- Anything worth bookmarking?
- Should memories merge?
- Did predictions improve?
```

No user interaction required.

---

### 8. Reasoning Engine

**Actually infers answers.**

```
Q: "Why was productivity low yesterday?"

AI Reasons:
- 3 meetings → context switches
- 42 app switches → no focus
- Slack open → distractions
- No focus sessions
- No commits

Conclusion: "Productivity was low due to meetings and context switching."
```

---

### 9. AI Mentor

**Proactively helps you improve.**

```
"You've been researching Redis for 2 weeks.
 Want me to create a practice project?"

"You solved 5 JWT bugs this month.
 Should I generate your authentication guide?"

"You abandoned 3 tasks today.
 Consider breaking them into smaller pieces."
```

---

## 📸 Collectors (Data Collection)

| Collector | Status | Method | Data |
|-----------|--------|--------|------|
| Window Tracker | ✅ | PowerShell | App, title, PID, bounds |
| Keyboard Tracker | ✅ | PowerShell | Keys, shortcuts, speed |
| Mouse Tracker | ✅ | PowerShell | Clicks, scrolls |
| Screenshot Service | ✅ | PowerShell + Sharp | Images with AI analysis |
| Clipboard Monitor | ✅ | PowerShell | Text, code, URLs |
| Git Tracker | ✅ | simple-git | Commits, branches, files |
| Browser Tracker | ✅ | PowerShell | Tabs, URLs, sites |
| Terminal Capture | ✅ | PowerShell | Commands, errors |
| System Events | ✅ | Electron | Power, lock, sleep |
| Filesystem Watcher | ✅ | Chokidar | File changes |

---

## 🧪 AI Pipeline

| Component | Status | Model | Purpose |
|-----------|--------|-------|---------|
| Vision Analyzer | ✅ | qwen2.5vl:3b | Screenshot analysis |
| OCR Service | ⚠️ | Tesseract/Python | Text extraction |
| Embedding Generator | ✅ | nomic-embed-text | Semantic search |
| Text Generator | ✅ | qwen2.5-coder:3b | Summaries, chat |

---

## 🚀 Features (28 Total)

### Context & Awareness
1. **Context Switch Detection** — Detects intentional vs distraction switches
2. **Smart Session Detection** — Auto-detects coding/meeting/research/debugging
3. **Adaptive Screenshot Capture** — 20s code, 1min meetings, pause gaming
4. **Privacy Guard** — Incognito, DRM, banking detection

### Intelligence
5. **Browser Intelligence** — Recognizes GitHub, SO, ChatGPT, Linear, etc.
6. **Meeting Intelligence** — Auto-detects meetings, generates summaries
7. **Deep Git Integration** — Tracks repos, branches, commits, files
8. **Terminal Command Capture** — Extracts commands and errors

### Productivity
9. **Focus Mode (Pomodoro)** — 25min work / 5min break cycles
10. **Focus Analytics** — Deep work, interruptions, productivity scoring
11. **Smart Notifications** — Distraction alerts, commit reminders
12. **Battery Awareness** — 4 power profiles, auto-adjusts

### Memory
13. **Daily Journal Generator** — AI-generated daily summaries
14. **Memory Bookmarks** — Save important moments
15. **Cross-Memory Linking** — Links screenshots ↔ commits ↔ activities
16. **Session Replay** — Reconstruct coding sessions

### Automation
17. **Natural Language Automation** — "Remind me tomorrow about..."
18. **Learning Patterns** — Learns habits and patterns
19. **Project Detector** — Auto-detects projects from activity

### Integration
20. **Windows Integration** — Jump Lists, Toast notifications
21. **Browser Extension** — Chrome/Edge tab tracking
22. **Memory API** — HTTP API for external access
23. **Smart Clipboard** — History, pin, favorites, search

---

## 🖥️ UI Pages (15)

| Page | Features |
|------|----------|
| Dashboard | Stats, activity feed, time travel, top apps |
| Chat | AI chat with context awareness |
| Memory | Bookmark management with filters |
| Search | Full-text and semantic search |
| Timeline | Hourly activity timeline |
| Screenshots | Gallery with AI analysis |
| Developer Mode | Git, terminal, file correlation |
| Focus Analytics | Productivity metrics |
| Session Replay | Playback coding sessions |
| Browser Extension | Install guide |
| Notes | Bookmark-based notes |
| Reports | Daily/weekly reports |
| Settings | Configuration |
| Omnibar | Quick search (Alt+Space) |
| Splash Screen | Animated startup |

---

## 🗄️ Database Schema

### Core Tables
- `activities` — Window/app usage
- `screenshots` — Images with AI analysis
- `sessions` — Work sessions
- `projects` — Detected projects

### Brain Tables
- `kg_nodes`, `kg_edges`, `kg_facts` — Knowledge graph
- `ltm_memories` — Long-term memory
- `concepts` — Learned concepts
- `learned_patterns` — Detected patterns
- `episodes`, `episode_events` — Episodic memory
- `working_memory_snapshots` — Working memory
- `decisions`, `decision_outcomes` — Decision tracking
- `mistakes`, `mistake_solutions` — Mistake learning
- `confidence_history`, `confidence_models` — Confidence evolution
- `user_personality` — User personality
- `reflections` — AI reflections
- `curiosity_questions`, `learning_topics` — Curiosity engine
- `mentor_suggestions` — AI mentor

### Feature Tables
- `context_switches` — Context switching
- `focus_sessions`, `pomodoro_sessions` — Focus mode
- `daily_journals` — Daily journals
- `meetings_detected` — Meeting intelligence
- `git_repos`, `git_commits` — Git integration
- `clipboard_history` — Clipboard
- `browser_contexts` — Browser intelligence
- `terminal_commands` — Terminal capture
- `memory_links` — Cross-memory linking
- `reminders`, `automation_rules` — NL automation
- `notifications` — Smart notifications
- `privacy_events` — Privacy guard
- `battery_events` — Battery awareness

---

## ⚡ Performance

| Metric | Target | Current |
|--------|--------|---------|
| CPU | < 5% | ~3% |
| RAM | < 300 MB | ~300 MB |
| Startup | < 3s | ~1.5s |
| Screenshot | < 1s | ~500ms |
| AI Analysis | < 30s | ~20-60s |
| Search | < 100ms | ~50ms |

---

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | localhost | Ollama host |
| `OLLAMA_PORT` | 11434 | Ollama port |
| `OLLAMA_VISION_MODEL` | qwen2.5vl:3b | Vision model |
| `OLLAMA_TEXT_MODEL` | qwen2.5-coder:3b | Text model |
| `OLLAMA_EMBEDDING_MODEL` | nomic-embed-text | Embedding model |
| `QDRANT_URL` | http://localhost:6333 | Vector DB URL |
| `QDRANT_API_KEY` | (empty) | Qdrant API key |

---

## 📁 File Structure

```
rewindx/
├── packages/
│   ├── shared/              # Types, DB, config
│   ├── background-service/  # Collectors, AI, Brain
│   │   └── src/
│   │       ├── collectors/  # 10 data collectors
│   │       ├── ai/          # Vision, OCR, embeddings
│   │       ├── features/    # 28 features
│   │       ├── brain/       # 19 cognitive modules
│   │       └── pipeline/    # Session builder
│   ├── ui/                  # React frontend
│   │   └── src/
│   │       ├── pages/       # 15 pages
│   │       ├── components/  # Shared components
│   │       └── styles/      # CSS
│   └── electron-app/        # Electron main
├── browser-extension/       # Chrome/Edge
└── installer.iss            # Inno Setup
```

---

## 🏆 What Makes RewindX Unique

1. **It's a Brain** — Not just storage, but understanding
2. **Episodic Memory** — Remembers episodes, not screenshots
3. **Decision Tracking** — Remembers why, not just what
4. **Learns from Mistakes** — Personal error database
5. **Confidence Evolution** — AI knows when it's wrong
6. **User Personality** — Adapts to your work style
7. **AI Reflection** — Thinks every night
8. **Reasoning Engine** — Actually infers answers
9. **AI Mentor** — Proactively helps you improve
10. **Memory Decays** — Important things persist, trivial fades

---

*RewindX v0.3.0 — The Cognitive Brain*
