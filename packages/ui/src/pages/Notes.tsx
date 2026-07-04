import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Search,
  Tag,
  Clock,
  MoreHorizontal,
  Pin,
  Trash2,
} from 'lucide-react';

declare global {
  interface Window {
    electronAPI: {
      getBookmarks: (options?: { limit?: number }) => Promise<any[]>;
      createBookmark: (data: { type: string; title: string; description?: string; tags?: string[] }) => Promise<number>;
      toggleBookmarkPin: (id: number) => Promise<boolean>;
      deleteBookmark: (id: number) => Promise<boolean>;
    };
  }
}

interface Note {
  id: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  updatedAt: string;
}

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const bookmarks = await window.electronAPI.getBookmarks({ limit: 100 });
      const notesData: Note[] = bookmarks.map((b: any) => ({
        id: b.id,
        title: b.title,
        content: b.description || '',
        tags: b.tags || [],
        pinned: b.pinned,
        updatedAt: b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
      }));
      setNotes(notesData);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
    setLoading(false);
  };

  const handleCreateNote = async () => {
    const title = prompt('Enter note title:');
    if (!title) return;
    const content = prompt('Enter note content:');
    await window.electronAPI.createBookmark({
      type: 'note',
      title,
      description: content || '',
      tags: [],
    });
    loadNotes();
  };

  const handleTogglePin = async (id: number) => {
    await window.electronAPI.toggleBookmarkPin(id);
    loadNotes();
  };

  const handleDelete = async (id: number) => {
    await window.electronAPI.deleteBookmark(id);
    if (selectedNote?.id === id) setSelectedNote(null);
    loadNotes();
  };

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter((n) => n.pinned);
  const otherNotes = filteredNotes.filter((n) => !n.pinned);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Note List */}
      <div style={{ width: 300, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>Notes</h2>
            <button className="btn btn-primary" style={{ fontSize: '11px', padding: '6px 12px' }} onClick={handleCreateNote}>
              <Plus style={{ width: 14, height: 14 }} /> New
            </button>
          </div>
          <div className="input-icon">
            <Search />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ fontSize: '12px', padding: '8px 10px 8px 36px' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 12px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Pin style={{ width: 10, height: 10 }} /> Pinned
                  </p>
                  {pinnedNotes.map((note) => (
                    <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onClick={() => setSelectedNote(note)} />
                  ))}
                </div>
              )}

              {otherNotes.length > 0 && (
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 12px', marginBottom: '4px' }}>Recent</p>
                  {otherNotes.map((note) => (
                    <NoteItem key={note.id} note={note} selected={selectedNote?.id === note.id} onClick={() => setSelectedNote(note)} />
                  ))}
                </div>
              )}

              {filteredNotes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <FileText style={{ width: 32, height: 32, color: 'var(--color-text-muted)', marginBottom: 12 }} />
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>No notes yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Note Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedNote ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedNote.tags.map((tag) => (
                  <span key={tag} className="tag" style={{ fontSize: '10px' }}>{tag}</span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => handleTogglePin(selectedNote.id)}>
                  <Pin style={{ width: 16, height: 16, color: selectedNote.pinned ? 'var(--color-purple)' : undefined }} />
                </button>
                <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => handleDelete(selectedNote.id)}>
                  <Trash2 style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px' }}>{selectedNote.title}</h2>
              <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedNote.content || 'No content'}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <FileText style={{ width: 48, height: 48, color: 'var(--color-text-muted)', marginBottom: 16 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Select a note</h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Choose a note from the list to view its contents</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteItem({ note, selected, onClick }: { note: Note; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="card"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px',
        marginBottom: '4px',
        cursor: 'pointer',
        borderColor: selected ? 'var(--color-purple)' : undefined,
        background: selected ? 'var(--color-purple-subtle)' : undefined,
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '4px' }}>{note.title}</div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.content || 'No content'}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Clock style={{ width: 10, height: 10, color: 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{note.updatedAt}</span>
      </div>
    </motion.button>
  );
}
