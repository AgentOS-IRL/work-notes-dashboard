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
});
