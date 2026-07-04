# Architecture

> How RewindX works under the hood.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        RewindX                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Collection Layer          Processing Layer                │
│   ┌──────────────┐         ┌──────────────┐                │
│   │ Window API   │         │ Brain        │                │
│   │ Input API    │────────▶│ Memory       │                │
│   │ Screenshots  │         │ Learning     │                │
│   │ Git          │         │ Reasoning    │                │
│   │ Browser      │         └──────────────┘                │
│   └──────────────┘                │                        │
│                                   ▼                        │
│   Storage Layer            ┌──────────────┐                │
│   ┌──────────────┐         │ Knowledge    │                │
│   │ SQLite       │◀───────▶│ Graph        │                │
│   │ FTS5         │         └──────────────┘                │
│   │ Qdrant       │                │                        │
│   └──────────────┘                ▼                        │
│                            ┌──────────────┐                │
│                            │ Actions      │                │
│                            │ UI           │                │
│                            │ API          │                │
│                            └──────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Desktop | Electron 33 | Cross-platform window |
| Frontend | React 18 + TypeScript | UI components |
| Styling | TailwindCSS + Jost | Design system |
| Build | Vite + esbuild | Fast bundling |
| Database | SQLite (better-sqlite3) | Local storage |
| Search | SQLite FTS5 + Qdrant | Full-text + semantic |
| AI | Ollama (local) | Vision, text, embeddings |
| Native | koffi | Windows API calls |
| Logging | Pino | Structured logging |

---

## Data Flow

```
1. COLLECT
   Window API → App name, title, bounds
   Input API → Keyboard, mouse events
   Screenshots → Screen capture
   Git API → Commits, branches
   Browser → Tabs, URLs

2. NORMALIZE
   Convert to standard events
   Add timestamps
   Extract entities

3. UNDERSTAND
   Detect intent (coding, debugging, meeting)
   Identify project
   Assess importance

4. REMEMBER
   Store in SQLite
   Update knowledge graph
   Generate embeddings

5. RESPOND
   Answer questions
   Predict next action
   Generate insights
```

---

## Database Schema

### Core Tables
- `activities` — Window/app usage with duration
- `screenshots` — Images with AI analysis
- `sessions` — Work sessions with summaries
- `projects` — Detected projects

### Brain Tables
- `kg_nodes` — Knowledge graph entities
- `kg_edges` — Entity relationships
- `ltm_memories` — Long-term memories
- `concepts` — Learned concepts
- `episodes` — Work episodes
- `predictions` — AI predictions

### Feature Tables
- `context_switches` — App switching patterns
- `focus_sessions` — Pomodoro sessions
- `daily_journals` — Generated summaries
- `meetings_detected` — Meeting records
- `git_events` — Git activity
- `bookmarks` — Saved moments

---

## Event System

Everything communicates through events:

```typescript
// Emit event
bus.emit('WINDOW_CHANGED', 'window-tracker', {
  appName: 'VS Code',
  windowTitle: 'main.ts - RewindX',
  windowBounds: { x: 0, y: 0, width: 1920, height: 1080 }
});

// Listen for events
bus.on('WINDOW_CHANGED', (event) => {
  // Process window change
});
```

### Event Types
- `WINDOW_CHANGED` — Active window changed
- `SCREENSHOT_CAPTURED` — New screenshot
- `GIT_COMMIT` — New commit
- `KEYSTROKE_BATCH` — Keyboard activity
- `FOCUS_STARTED` — Focus session began
- `MEETING_DETECTED` — Meeting detected

---

## Plugin Architecture

```
plugins/
├── plugin-manager.ts    # Register, start, stop plugins
└── index.ts             # Exports

// Create plugin
const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  type: 'collector',
  enabled: true,
  
  async initialize(ctx) { /* Setup */ },
  async start() { /* Start collecting */ },
  async stop() { /* Cleanup */ },
  onEvent(type, payload) { /* Handle events */ }
};

// Register plugin
await pluginManager.register(myPlugin);
await pluginManager.start('my-plugin');
```

---

## Native APIs

Uses koffi for direct Windows API calls:

```typescript
import koffi from 'koffi';

const user32 = koffi.load('user32.dll');
const GetForegroundWindow = user32.func('intptr_t GetForegroundWindow()');

// Direct API call - no PowerShell spawning
const hwnd = GetForegroundWindow();
```

### Benefits
- 5x lower CPU usage
- Faster polling (200ms vs 3000ms)
- Better battery life
- More reliable

---

## AI Pipeline

```
Screenshot → Vision Model → Analysis → Storage
                ↓
         OCR (if needed)
                ↓
         Embeddings
                ↓
         Knowledge Graph
```

### Models
- **Vision:** qwen2.5-vl:3b (screenshot analysis)
- **Text:** qwen2.5-coder:3b (summaries, chat)
- **Embeddings:** nomic-embed-text (semantic search)

---

## Security

- All data stored in `%APPDATA%\RewindX`
- No network calls (except Ollama on localhost)
- Sensitive content filtered (passwords, tokens)
- App blacklist (password managers)
- Incognito detection

---

*For feature details, see [Features](FEATURES.md)*
