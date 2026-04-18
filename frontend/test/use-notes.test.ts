import { describe, expect, it, vi } from 'vitest';
import { useNotes } from '~/composables/useNotes';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('useNotes', () => {
  it('loads notes and keeps the selection in sync', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        notes: [
          { id: 1, title: 'Daily log', content: 'First entry' },
          { id: 2, title: 'Follow-up', content: 'Second entry' }
        ]
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const notes = useNotes();
    await notes.loadNotes();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({ method: 'GET' })
    );
    expect(notes.notes.value).toHaveLength(2);
    expect(notes.selectedNote.value?.id).toBe(1);
    expect(notes.title.value).toBe('Daily log');
    expect(notes.content.value).toBe('First entry');
    expect(notes.noteTree.value).toEqual([
      { id: 'note-1', label: 'Daily log', noteId: 1, children: [] },
      { id: 'note-2', label: 'Follow-up', noteId: 2, children: [] }
    ]);
  });

  it('selects a note by id for explorer navigation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        notes: [
          { id: 1, title: 'Daily log', content: 'First entry' },
          { id: 2, title: 'Follow-up', content: 'Second entry' }
        ]
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const notes = useNotes();
    await notes.loadNotes();

    notes.selectNoteById(2);

    expect(notes.selectedNoteId.value).toBe(2);
    expect(notes.selectedNote.value?.title).toBe('Follow-up');
  });

  it('preserves a dirty editor when refreshes come from chat updates', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [
            { id: 1, title: 'Sprint plan', content: 'Initial body' },
            { id: 2, title: 'Retro', content: 'Second entry' }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [
            { id: 1, title: 'Sprint plan updated', content: 'Initial body' },
            { id: 2, title: 'Retro', content: 'Second entry' }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const notes = useNotes();
    await notes.loadNotes();

    notes.title.value = 'Local draft';
    notes.content.value = 'Unsaved body';

    await notes.loadNotes({ preserveEditorFields: true });

    expect(notes.notes.value[0].title).toBe('Sprint plan updated');
    expect(notes.title.value).toBe('Local draft');
    expect(notes.content.value).toBe('Unsaved body');
    expect(notes.selectedNoteId.value).toBe(1);
    expect(notes.isEditorDirty.value).toBe(true);
  });

  it('creates, updates, and deletes notes through the same API contract', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          note: { id: 3, title: 'New note', content: 'Created body' }
        }, { status: 201 })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [{ id: 3, title: 'New note', content: 'Created body' }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          note: { id: 3, title: 'Updated note', content: 'Updated body' }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [{ id: 3, title: 'Updated note', content: 'Updated body' }]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse({ notes: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const notes = useNotes();

    notes.title.value = 'New note';
    notes.content.value = 'Created body';
    await notes.saveNote();

    expect(notes.statusMessage.value).toBe('Note created.');
    expect(notes.selectedNoteId.value).toBe(3);
    expect(notes.notes.value).toHaveLength(1);

    notes.title.value = 'Updated note';
    notes.content.value = 'Updated body';
    await notes.saveNote();

    expect(notes.statusMessage.value).toBe('Note updated.');
    expect(notes.selectedNoteId.value).toBe(3);
    expect(notes.notes.value[0].title).toBe('Updated note');

    await notes.deleteNote(3);

    expect(notes.statusMessage.value).toBe('Note deleted.');
    expect(notes.selectedNoteId.value).toBeNull();
    expect(notes.notes.value).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('selects the next available note after deleting the active one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [
            { id: 1, title: 'Daily log', content: 'First entry' },
            { id: 2, title: 'Follow-up', content: 'Second entry' },
            { id: 3, title: 'Retro', content: 'Third entry' }
          ]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [
            { id: 1, title: 'Daily log', content: 'First entry' },
            { id: 3, title: 'Retro', content: 'Third entry' }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const notes = useNotes();
    await notes.loadNotes();

    notes.selectNoteById(2);
    await notes.deleteNote(2);

    expect(notes.selectedNoteId.value).toBe(3);
    expect(notes.selectedNote.value?.title).toBe('Retro');
    expect(notes.notes.value).toHaveLength(2);
    expect(notes.statusMessage.value).toBe('Note deleted.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
