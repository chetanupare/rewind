AI Work Memory - Product Understanding (v1)
Vision

Create a personal Windows AI assistant that continuously observes my computer activity, understands what I am doing, learns my workflow over time, and builds a searchable memory of my work.

This application is strictly for personal use on my own machine. It is not intended for employee monitoring or surveillance.

The goal is that I never have to manually remember or write what I worked on. The AI should automatically understand, organize, summarize, and help me recall any activity.

Core Objectives

The application should:

Run silently in the background after Windows startup.
Have minimal CPU and RAM usage.
Work completely offline by default.
Store all information locally.
Use local AI models whenever possible.
Learn my projects and workflow over time.
Build a complete searchable history of everything I do.
What the Application Should Observe
1. Desktop Activity

Continuously monitor:

Active application
Window title
Executable name
Process ID
Window position
Window size
Multi-monitor information
Focus changes
Time spent in every application

Example:

09:00
Visual Studio Code

09:25
Chrome

09:42
Terminal

10:05
Figma
2. Mouse Activity

Track:

Left click
Right click
Middle click
Double click
Mouse movement
Scroll wheel
Drag operations
Cursor position
Click heatmap
Idle time
3. Keyboard Activity

Observe:

Key count
Shortcut usage
Typing speed
Idle detection
Application where typing occurred

Do not permanently store sensitive credentials such as passwords or one-time codes.

4. Browser Activity

For Chrome, Edge and Firefox:

Track:

Current URL
Page title
Time on page
Tab switching
New tabs
Closed tabs
Downloads
Uploads
Search queries (when available)
Browser history correlation
5. Screenshots

Capture screenshots intelligently.

Requirements:

Configurable interval
Capture on major screen change
Capture on application change
Capture on idle resume
Capture before system shutdown

Store:

Full screenshot
Compressed version
OCR text
AI description
Timestamp
6. OCR

Extract:

Code
Text
Error messages
URLs
Console output
Terminal commands
Documentation

Everything searchable later.

7. Vision AI Analysis

Every screenshot should be analyzed.

AI should determine:

Which software is open
What task is happening
Which project
Programming language
Framework
Website
Error state
Reading documentation
Watching video
Meeting
Email
Designing
Debugging
Coding
Testing
Deployment
8. Development Tracking

Automatically detect:

VS Code
Visual Studio
Cursor
IntelliJ
Android Studio

Capture:

Workspace
Current project
Current folder
Current Git repository
Current branch
Current file (where available)
Build/test events
Terminal usage metadata
9. File System

Observe:

Opened files
Saved files
Renamed files
Deleted files
Folder navigation
Downloads
Recently modified files
10. Clipboard

Track:

Copy events
Paste events
Clipboard history (optional and encrypted)
11. System Events

Observe:

Boot
Shutdown
Sleep
Resume
Lock
Unlock
Battery
CPU
RAM
Internet connectivity
AI Understanding Layer

Raw tracking data should never be the final output.

Instead:

Screenshot

↓

OCR

↓

Vision AI

↓

Activity Detection

↓

Project Detection

↓

Task Detection

↓

Summary

↓

Store Structured Data

Example:

Screenshot

↓

VS Code

↓

RepairCRM

↓

Editing QR Module

↓

React

↓

Store
Learning Engine

The AI should learn over time.

Example:

Initially:

VS Code

After weeks:

VS Code

+

RepairCRM

+

InvoiceController

=

Invoice Module

Eventually:

RepairCRM

↓

Customer

↓

Invoice

↓

QR

↓

WhatsApp

↓

Reports

The AI should begin recognizing recurring work automatically.

Daily Timeline

Example:

09:00

VS Code

↓

Editing Invoice Module

↓

09:35

Chrome

↓

Laravel Documentation

↓

10:10

Terminal

↓

Running Tests

↓

10:30

VS Code

↓

Bug Fix

↓

11:00

Git Commit
AI Reports

Automatically generate:

Morning summary

Midday summary

Daily summary

Weekly summary

Monthly summary

Yearly productivity report

Example Daily Report

Today you worked for 8h 12m.

Primary Project:
Repair Management System

Completed:

• QR Code Generation
• Invoice API
• React UI Improvements

Research:

• WhatsApp Cloud API

Testing:

• Printing Module

Meetings:

1

Most productive period:

9:15 AM - 12:20 PM
Search

The application should answer:

"What did I work on yesterday?"

"Show QR related work."

"When did I fix that bug?"

"Find MongoDB errors."

"Show React work."

"Find Invoice screenshots."

"What was I doing on 12 June?"

AI Chat

The application should include an assistant.

Example:

Continue where I left yesterday.

Summarize today's work.

Show unfinished tasks.

Explain what I changed this week.

Which project consumed most time?

Find where I saw this error.

Storage

Local only.

Suggested:

SQLite

Activities

Screenshots

OCR

Embeddings

Projects

Timeline

Reports

Settings

Logs
AI

Local-first.

Possible components:

Ollama
Local vision-capable model
Local embedding model
Local text model

Everything should work without Internet whenever possible.

Performance Goals

CPU

<5%

RAM

<300 MB

Disk

Efficient compression

Background

Invisible

Future Features
Voice interaction
Natural language search
Git integration
Calendar integration
Jira integration
Email understanding
Meeting summaries
Automatic documentation
Project knowledge graph
Work replay
Productivity analytics
Personal knowledge base


Overall Architecture
                    ┌───────────────────────────┐
                    │        React UI           │
                    │ Dashboard + Timeline + AI │
                    └─────────────▲─────────────┘
                                  │ IPC/API
                                  │
────────────────────────────────────────────────────
                AI Work Memory Core
────────────────────────────────────────────────────
                                  │
                Event Bus / Message Queue
                                  │
      ┌──────────┬──────────┬──────────┬──────────┐
      │          │          │          │          │
 Window      Browser     Input      Screenshot   Files
 Tracker     Tracker     Tracker      Engine     Watcher
      │          │          │          │          │
      └──────────┴──────────┴──────────┴──────────┘
                     │
               Event Normalizer
                     │
             Session Detection
                     │
         AI Understanding Pipeline
                     │
       SQLite + Vector Database
                     │
          Local LLM (Ollama)
Layer 1 — Collectors

These only collect events. They never perform AI.

Example:

Window Changed

↓

{
 app:"VSCode",
 title:"RepairCRM"
}

Each collector is independent.

Suggested collectors:

Window Tracker

Browser Tracker

Mouse Tracker

Keyboard Tracker

Screenshot Service

OCR Service

Clipboard

Git

Filesystem

System Events

Audio (future)

If one crashes, the others keep running.

Layer 2 — Event Bus

Everything becomes an event.

Example

{
 "timestamp":"...",
 "type":"WINDOW_CHANGED",
 "payload":{}
}

Nothing talks directly to another module.

Everything goes through the event bus.

Benefits

Easy debugging
Easy replay
Easy plugins
Easy AI
Layer 3 — Event Store

Store raw events.

Window

Mouse

Keyboard

Browser

Screenshot

Clipboard

Never modify them.

Think of this as your "black box recorder."

Layer 4 — Session Builder

This is where intelligence starts.

Instead of

Mouse

Mouse

Mouse

Mouse

Keyboard

Mouse

Convert into

Coding Session

09:10-10:25

VS Code

RepairCRM

Huge difference.

Layer 5 — AI Pipeline

This should be separate.

Screenshot

↓

OCR

↓

Vision AI

↓

Context

↓

Summarize

↓

Embeddings

↓

Store

The collector should never call AI directly.

Layer 6 — Knowledge Graph

Instead of only saving text

Build relationships.

Example

Repair CRM
      │
      ├── Customers
      ├── Invoice
      ├── QR
      ├── MongoDB
      ├── Express
      └── React

Now AI understands projects.

Layer 7 — Memory

Think like ChatGPT memory.

Today

↓

Yesterday

↓

Last Week

↓

Project

↓

Feature

↓

Bug

↓

Commit

↓

Screenshot

Everything becomes connected.

Layer 8 — Search

Instead of SQL only

SQLite

+

FTS5

+

Embeddings

Now

Find QR Bug

works.

Layer 9 — AI

Have multiple models.

Small Model

↓

Classification

----------------

Vision Model

↓

Screenshots

----------------

Reasoning Model

↓

Reports

----------------

Embedding Model

↓

Memory

Never use one model for everything.

Database

I would keep three databases.

SQLite

↓

Metadata

----------------

Vector DB

↓

Embeddings

----------------

Screenshot Folder

↓

Images

Never store images inside SQLite.

Folder Structure
AIWorkMemory

app/

collectors/

window/

mouse/

keyboard/

browser/

git/

filesystem/

clipboard/

system/

ai/

vision/

ocr/

embeddings/

llm/

memory/

database/

ui/

plugins/

config/

logs/

cache/

screenshots/

reports/
Scheduler

Instead of

Every 5 minutes

Have a scheduler.

Screenshot

every 2 min

OCR

every 5 min

Summary

every 30 min

Cleanup

daily

Embedding

idle only

Backup

night
Event Flow
Open VS Code

↓

Window Event

↓

Collector

↓

SQLite

↓

Screenshot

↓

OCR

↓

Vision

↓

Task Detection

↓

Session Builder

↓

Memory

↓

Embeddings

↓

Search Index
AI Pipeline
Image

↓

Image Hash

↓

Changed?

↓

No

↓

Discard

↓

Yes

↓

OCR

↓

Vision

↓

Structured JSON

↓

Summary

↓

Embeddings

↓

Store

This saves huge amounts of CPU.

Future Plugin System

Everything should be a plugin.

Discord Plugin

Slack Plugin

Git Plugin

Jira Plugin

Chrome Plugin

Firefox Plugin

Outlook Plugin

Teams Plugin

No code changes needed.

If I were building Version 1 today

Since I know you're comfortable with React, Node.js, Express, and MongoDB, I'd choose a stack that fits those skills while still being robust:

Layer	Technology
Desktop UI	Electron + React + TypeScript
Background service	Separate Node.js process (or Windows Service later)
IPC	Electron IPC + EventEmitter
Local database	SQLite with better-sqlite3
Search	SQLite FTS5
AI runtime	Ollama
Vision	Qwen2.5-VL (or another Ollama-supported vision model)
OCR	Windows OCR (fallback to Tesseract)
Event queue	Lightweight in-memory queue (e.g., EventEmitter)
Scheduling	node-cron or a custom scheduler
Logging	Pino