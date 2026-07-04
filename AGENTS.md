# RewindX - Project Context

## What Is This?
RewindX is an AI-powered work memory assistant for Windows. It observes computer activity, learns workflows, and builds searchable memory using a cognitive brain architecture.

## Architecture
- **Electron** (main process) + **React** (UI) + **SQLite** (storage)
- **Background Service** with 10 collectors, 28 features, 21 brain modules
- **Ollama** for local AI (vision, text, embeddings)
- **Event Bus** pattern for decoupled communication

## Key Directories
```
packages/
├── shared/              # Types, DB, config, event-bus
├── background-service/  # Collectors, AI, features, brain
│   └── src/
│       ├── collectors/  # 10 data collectors (window, keyboard, mouse, etc.)
│       ├── features/    # 28 advanced features
│       ├── brain/       # 21 cognitive modules (THE CORE)
│       └── ai/          # Ollama integration
├── ui/                  # React frontend (15 pages)
└── electron-app/        # Main process + IPC handlers
```

## Brain Modules (21)
1. Cognitive Engine - orchestrator
2. Knowledge Graph - entity relationships
3. Long-Term Memory - importance-based with decay
4. Concept Learner - auto-learns topics
5. Intent Engine - detects coding/debugging/meeting
6. Pattern Learner - finds sequences
7. Prediction Engine - predicts next action
8. Memory Compressor - compresses to knowledge
9. Confidence System - multi-factor scoring
10. Curiosity Engine - asks questions
11. Episodic Memory - episodes not events
12. Working Memory - current context
13. Decision Tracker - remembers decisions
14. Mistake Learner - personal error DB
15. Confidence Evolution - dynamic scoring
16. Personality Model - user work style
17. AI Reflection - nightly thinking
18. Reasoning Engine - evidence-based answers
19. AI Mentor - proactive suggestions
20. Feedback Loop - self-improving predictions
21. Cognitive Pipeline - orchestrates all

## Design System
- Font: Jost
- Colors: Purple (#5B2EFF), Pink (#FF4FA3), Navy (#111827)
- Background: #090B16 with radial glows
- Glass morphism effects

## Key Files
- `packages/shared/src/types/events.ts` - All event types
- `packages/electron-app/src/main.ts` - IPC handlers
- `packages/background-service/src/brain/index.ts` - Brain exports
- `packages/ui/src/styles/globals.css` - Design system

## Build & Run
```bash
npm run build           # Build all
npm run package -w packages/electron-app  # Create exe
```

## Repo
https://github.com/chetanupare/rewind
