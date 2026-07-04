# RewindX

> **A local-first cognitive workspace that observes, understands, remembers, and assists your daily work. It transforms raw computer activity into structured knowledge that grows smarter over time.**

[![Windows](https://img.shields.io/badge/Platform-Windows-5B2EFF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/chetanupare/rewind/releases)
[![Version](https://img.shields.io/badge/Version-0.3.0-8A3FFC?style=for-the-badge)](https://github.com/chetanupare/rewind/releases)
[![License](https://img.shields.io/badge/License-AGPL--3.0-00D47E?style=for-the-badge)](LICENSE)

---

## What RewindX Can Do

- **Ask "What was I working on yesterday?"** — Get instant answers from your activity
- **Restore your entire coding workspace** — One click to reopen everything
- **Find where you solved a bug months ago** — Search across screenshots, commits, terminal
- **Remember why you made technical decisions** — AI tracks your reasoning
- **Summarize your workday automatically** — Daily journals, weekly reports
- **Learn your workflow over time** — Gets smarter every day

---

## How It Works

```
Your Activity → RewindX Brain → Knowledge → Answers
```

1. **Collectors** observe your activity (windows, keyboard, screenshots, git, browser)
2. **Brain** understands what you're doing (coding, debugging, meeting, research)
3. **Memory** stores knowledge (not raw data — structured understanding)
4. **AI** answers questions and predicts what you need

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

| Principle | What It Means |
|-----------|---------------|
| **Privacy First** | All data stays on your machine. No cloud, no telemetry. |
| **Local First** | Works completely offline. No internet required. |
| **Evidence First** | Every answer is backed by actual data. No hallucination. |
| **Composable** | Plugin architecture. Add features without changing core. |
| **Event Driven** | Everything communicates through events. Easy to debug. |
| **Windows Native** | Uses Win32 APIs. Fast, efficient, reliable. |

---

## Non-Goals

- ❌ Cloud sync or remote storage
- ❌ User tracking or analytics
- ❌ Selling data or ads
- ❌ Vendor lock-in
- ❌ Always-on internet requirement

---

## What Makes RewindX Different

| Other Tools | RewindX |
|-------------|---------|
| Store raw data | Stores **knowledge** |
| Search by keyword | Search by **meaning** |
| Show screenshots | Shows **episodes** |
| Log events | **Understands** events |
| Static memory | **Evolving** memory |
| Generic AI | **Your** AI (learns you) |

---

## Learn More

- [Features](FEATURES.md) — What you can do with RewindX
- [Architecture](ARCHITECTURE.md) — How the system works
- [Brain](BRAIN.md) — The cognitive engine
- [Roadmap](ROADMAP.md) — What's coming next
- [Contributing](CONTRIBUTING.md) — How to help build RewindX

---

## Community

- [GitHub Issues](https://github.com/chetanupare/rewind/issues) — Report bugs, request features
- [Discussions](https://github.com/chetanupare/rewind/discussions) — Ask questions, share ideas

---

## License

AGPL-3.0 — See [LICENSE](LICENSE)

---

<div align="center">

**[Download](https://github.com/chetanupare/rewind/releases)** · **[Docs](FEATURES.md)** · **[Contribute](CONTRIBUTING.md)**

</div>
