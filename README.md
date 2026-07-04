<div align="center">

<img src="packages/ui/public/assets/brand/text-logo.png" alt="RewindX" width="400" />

### Your AI-Powered Second Brain

**RewindX continuously understands your computer activity and turns it into searchable knowledge.**

Instead of simply recording screenshots, RewindX connects your code, browser history, terminal sessions, meetings, documents, and decisions into a memory you can chat with.

[![Windows](https://img.shields.io/badge/Download-v0.3.0-5B2EFF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/chetanupare/rewind/releases)
[![License](https://img.shields.io/badge/License-AGPL--3.0-00D47E?style=for-the-badge)](LICENSE)

</div>

---

## Ask RewindX

> "What was I debugging yesterday?"

> "Where did I first see this error?"

> "Continue my work from Friday."

> "Why did I switch to SQLite?"

> "Summarize today's work."

> "Show every discussion about OAuth."

> "Find the commit related to this screenshot."

> "What have I learned this week?"

**RewindX doesn't just search — it remembers, reasons, and connects.**

---

## Why RewindX?

| | RewindX | Windows Recall | Rewind |
|---|---------|----------------|--------|
| **100% Local** | ✅ | ⚠️ Cloud | ⚠️ Cloud |
| **Open Source** | ✅ | ❌ | ❌ |
| **Knowledge Graph** | ✅ | ❌ | ❌ |
| **Developer Intelligence** | ✅ | ❌ | ❌ |
| **Cognitive Memory** | ✅ | ❌ | ❌ |
| **Decision Tracking** | ✅ | ❌ | ❌ |
| **AI Reflection** | ✅ | ❌ | ❌ |
| **Free Forever** | ✅ | ❌ | ❌ |

---

## How It Works

```
Your Activity → Brain → Knowledge → Answers
```

1. **Observe** — Tracks windows, keyboard, screenshots, git, browser
2. **Understand** — Detects coding, debugging, meetings, research
3. **Connect** — Links related events into episodes
4. **Learn** — Builds knowledge graph over time
5. **Predict** — Anticipates what you need next
6. **Remember** — Stores knowledge, not raw data

---

## What You Can Do

### 🔍 Search Your Memory

```
"React hooks"           → All related work
"MongoDB errors"        → Screenshots, terminal, commits
"authentication"        → Everything about auth
"What was I doing at 2pm?" → Exact moment replay
```

### 💬 Chat With Your Work

```
You: What did I work on today?
AI:  You implemented JWT authentication, debugged a token 
     refresh issue, and committed 3 changes to the auth module.

You: Why did I switch to SQLite?
AI:  You switched for performance reasons on July 3rd.
     The decision was logged after testing with 10k records.
```

### ⏰ Time Travel

Browse your work day as a visual timeline:
- Scrub through screenshots
- See what you were doing at any moment
- One-click to restore your workspace

### 📊 Focus Analytics

See your productivity patterns:
- Deep work vs shallow work
- Peak productivity hours
- Interruption frequency
- Focus score trends

### 🧠 Smart Memory

- **Episodic Memory** — Remembers episodes, not screenshots
- **Decision Tracking** — Remembers why you made choices
- **Mistake Learning** — Personal error database
- **Knowledge Gaps** — Suggests what to learn next

---

## Quick Start

### 1. Install Ollama

```bash
# Download from https://ollama.com/download
ollama pull qwen2.5-vl:3b
ollama pull qwen2.5-coder:3b
ollama pull nomic-embed-text
```

### 2. Install RewindX

Download `RewindX-Setup-0.3.0.exe` from [Releases](https://github.com/chetanupare/rewind/releases)

### 3. Start Using

- Press `Alt+Space` to open quick search
- Ask questions about your work
- Check the Dashboard for daily insights

---

## Design Principles

- **Privacy First** — All data stays on your machine
- **Local First** — Works completely offline
- **Evidence First** — Every answer is backed by data
- **Composable** — Plugin architecture
- **Event Driven** — Easy to debug and extend

---

## Non-Goals

- ❌ Cloud sync or remote storage
- ❌ User tracking or analytics
- ❌ Selling data or ads
- ❌ Vendor lock-in
- ❌ Always-on internet requirement

---

## Performance

| Metric | Value |
|--------|-------|
| CPU | < 5% |
| RAM | < 300 MB |
| Startup | < 2s |
| Search | < 100ms |
| Window Tracking | < 5ms |

---

## Screenshots

<div align="center">

**Dashboard**
![Dashboard](screenshots/dashboard.png)

**Chat**
![Chat](screenshots/chat.png)

**Timeline**
![Timeline](screenshots/timeline.png)

**Search**
![Search](screenshots/search.png)

</div>

---

## Road to v1.0

| Milestone | Goal |
|-----------|------|
| ⭐ 100 Stars | Plugin SDK |
| ⭐ 500 Stars | Linux Support |
| ⭐ 1000 Stars | macOS Support |
| ⭐ 5000 Stars | Mobile Companion |

---

## Learn More

- [Features](FEATURES.md) — What you can do
- [Architecture](ARCHITECTURE.md) — How it works
- [Brain](BRAIN.md) — The cognitive engine
- [Roadmap](ROADMAP.md) — What's coming
- [Contributing](CONTRIBUTING.md) — How to help

---

## Community

- [GitHub Issues](https://github.com/chetanupare/rewind/issues) — Report bugs
- [GitHub Discussions](https://github.com/chetanupare/rewind/discussions) — Ask questions

---

## License

AGPL-3.0 — See [LICENSE](LICENSE)

---

<div align="center">

**[Download](https://github.com/chetanupare/rewind/releases)** · **[Docs](FEATURES.md)** · **[Contribute](CONTRIBUTING.md)**

**Made with ❤️ by [Chetan Upare](https://github.com/chetanupare)**

</div>
