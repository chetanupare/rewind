# Brain

> The cognitive engine that makes RewindX think, learn, and remember.

---

## How It Thinks

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
Remember: Store with importance score
```

---

## Brain Modules

### Perception Layer

| Module | What It Does |
|--------|--------------|
| **Intent Engine** | Detects what you're doing (coding, debugging, meeting) |
| **Concept Learner** | Auto-learns topics from activity |
| **Pattern Learner** | Finds recurring sequences |

### Memory Layer

| Module | What It Does |
|--------|--------------|
| **Episodic Memory** | Remembers episodes, not raw events |
| **Working Memory** | Current context (project, task, file) |
| **Long-Term Memory** | Importance-based with decay |
| **Knowledge Graph** | Entity relationships |

### Learning Layer

| Module | What It Does |
|--------|--------------|
| **Decision Tracker** | Remembers why you made choices |
| **Mistake Learner** | Personal error database |
| **Confidence Evolution** | Learns from outcomes |
| **User Personality** | Adapts to your work style |

### Reasoning Layer

| Module | What It Does |
|--------|--------------|
| **Prediction Engine** | Predicts next action |
| **Reasoning Engine** | Evidence-based answers |
| **Feedback Loop** | Self-improving predictions |

### Action Layer

| Module | What It Does |
|--------|--------------|
| **AI Mentor** | Proactive suggestions |
| **AI Reflection** | Nightly thinking |
| **Curiosity Engine** | Asks questions |

---

## Key Concepts

### Episodic Memory

Humans don't remember screenshots — we remember **episodes**.

```
Instead of: Screenshot → Window → Git → Browser
RewindX:    Episode: "Implement JWT Authentication"
            Start: 10:15 | End: 11:45
            Goal: Add Refresh Token
            Outcome: Completed
```

### Importance Scoring

Not everything is equal:

| Event | Importance |
|-------|------------|
| Fixed production bug | 97 |
| Git commit | 80 |
| Coding session | 70 |
| Research | 50 |
| Opened calculator | 2 |

### Memory Decay

Like humans, memories fade:

- Accessed frequently → **Stronger**
- Never accessed → **Weaker**
- Important → **Persists**
- Trivial → **Forgotten**

### Confidence System

Every answer has confidence:

```
"I'm 95% sure this was your OAuth work"
Evidence: Git commit + Browser + VS Code + Screenshot
```

---

## Learning Process

### Pattern Recognition

After observing your work:
- "You code best 9am-12pm"
- "You always check GitHub before committing"
- "You get distracted by YouTube after meetings"

### Concept Learning

Automatically detects:
- Technologies you're using
- Projects you're working on
- Skills you're developing

### Decision Memory

Remembers your choices:
- "Why did you switch to SQLite?" → "Performance"
- "Why did you use React?" → "Team familiarity"

---

## Memory Intelligence

### Contradiction Detection

If you switch from SQLite to PostgreSQL:
- Previous: SQLite (confidence 90%)
- Current: PostgreSQL (confidence 95%)
- Action: Update knowledge, flag conflict

### Knowledge Gaps

Detects what you don't know:
- Working on OAuth
- Knows: JWT, Cookies, Sessions
- Missing: PKCE, SAML
- Suggests: "You may want to learn PKCE"

### Smart Forgetting

Compresses old data:
- 500 screenshots → 18 episodes → 6 memories → 2 lessons
- Storage stays tiny

---

## API

```typescript
// Query the brain
const result = await cognitiveEngine.query("What was I debugging?");

// Get memory health
const health = await memoryIntelligence.getMemoryHealth();

// Find knowledge gaps
const gaps = await memoryIntelligence.findKnowledgeGaps();

// Get cognitive metrics
const metrics = await memoryIntelligence.getCognitiveMetrics();
```

---

*For technical details, see [Architecture](ARCHITECTURE.md)*
