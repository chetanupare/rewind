# Contributing

> How to help build RewindX.

---

## Where to Contribute

Pick what interests you:

| Area | Skills Needed | Difficulty |
|------|---------------|------------|
| **Windows APIs** | C++, Rust, or Node.js native | Hard |
| **Brain Modules** | TypeScript, AI/ML concepts | Medium |
| **AI Integration** | Python, Ollama, models | Medium |
| **OCR/Document** | Python, image processing | Medium |
| **Frontend** | React, TypeScript, CSS | Easy |
| **Search** | SQLite, FTS5, embeddings | Medium |
| **Git Integration** | Node.js, simple-git | Easy |
| **Documentation** | Markdown, technical writing | Easy |

---

## Quick Start

```bash
# Clone
git clone https://github.com/chetanupare/rewind.git
cd rewind

# Install
npm install

# Build
npm run build

# Run
npm run start -w packages/electron-app
```

---

## Project Structure

```
packages/
├── shared/              # Types, DB, config
├── background-service/  # Collectors, AI, Brain
│   └── src/
│       ├── collectors/  # Data collection
│       ├── ai/          # AI processing
│       ├── features/    # User features
│       ├── brain/       # Cognitive engine
│       └── plugins/     # Plugin system
├── ui/                  # React frontend
└── electron-app/        # Electron main
```

---

## Adding a Feature

1. **Create a plugin** in `packages/background-service/src/features/`
2. **Register it** in `packages/background-service/src/index.ts`
3. **Add IPC handler** in `packages/electron-app/src/main.ts`
4. **Create UI** in `packages/ui/src/pages/`
5. **Update navigation** in `packages/ui/src/App.tsx`

---

## Code Style

- TypeScript
- ESLint for linting
- Prettier for formatting
- No comments unless necessary

---

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## Questions?

Open a [GitHub Discussion](https://github.com/chetanupare/rewind/discussions).

---

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 License.
