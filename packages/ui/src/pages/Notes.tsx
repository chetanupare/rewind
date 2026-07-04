import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Tag,
  Clock,
  MoreHorizontal,
  Pin,
  Archive,
  Trash2,
} from 'lucide-react';

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([
    {
      id: 1,
      title: 'Project Ideas',
      content: 'Build an AI-powered code review tool that analyzes PRs and provides suggestions...',
      tags: ['ideas', 'ai'],
      pinned: true,
      updatedAt: '2 hours ago',
    },
    {
      id: 2,
      title: 'Meeting Notes - Sprint Planning',
      content: 'Discussed Q3 priorities. Focus on user authentication, dashboard redesign...',
      tags: ['meeting', 'sprint'],
      pinned: true,
      updatedAt: 'Yesterday',
    },
    {
      id: 3,
      title: 'React Best Practices',
      content: 'Use custom hooks for reusable logic. Keep components small and focused...',
      tags: ['react', 'coding'],
      pinned: false,
      updatedAt: '3 days ago',
    },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter((n) => n.pinned);
  const otherNotes = filteredNotes.filter((n) => !n.pinned);

  return (
    <div className="flex h-full">
      {/* Note List */}
      <div className="w-80 border-r border-border flex flex-col">
        <header className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-text">Notes</h1>
            <button className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-area pl-10 pr-4 py-2 text-sm w-full"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {pinnedNotes.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2 flex items-center gap-1.5">
                <Pin className="w-3 h-3" />
                Pinned
              </p>
              {pinnedNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  selected={selectedNote?.id === note.id}
                  onClick={() => setSelectedNote(note)}
                />
              ))}
            </div>
          )}

          {otherNotes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 mb-2">
                Recent
              </p>
              {otherNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  selected={selectedNote?.id === note.id}
                  onClick={() => setSelectedNote(note)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Note Content */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <header className="px-8 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedNote.tags.map((tag) => (
                  <span key={tag} className="tag text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-icon w-8 h-8">
                  <Archive className="w-4 h-4" />
                </button>
                <button className="btn-icon w-8 h-8">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button className="btn-icon w-8 h-8">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <h2 className="text-2xl font-bold text-text mb-4">{selectedNote.title}</h2>
              <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {selectedNote.content}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">Select a note</h3>
              <p className="text-sm text-text-secondary">
                Choose a note from the list to view its contents
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteItem({
  note,
  selected,
  onClick,
}: {
  note: Note;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-all mb-1 ${
        selected
          ? 'bg-purple/10 border border-purple/20'
          : 'hover:bg-surface border border-transparent'
      }`}
    >
      <h4 className="text-sm font-semibold text-text truncate">{note.title}</h4>
      <p className="text-xs text-text-secondary truncate mt-1">{note.content}</p>
      <div className="flex items-center gap-2 mt-2">
        <Clock className="w-3 h-3 text-text-muted" />
        <span className="text-[10px] text-text-muted">{note.updatedAt}</span>
      </div>
    </motion.button>
  );
}
