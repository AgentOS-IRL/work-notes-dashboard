import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import IndexPage from '~/pages/index.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('index page', () => {
  it('renders the workspace shell, toggles note dump mode, deletes a note, and auto-enables it after note creation', async () => {
    let notesListCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/chat/sessions') && method === 'GET') {
        return jsonResponse({
          sessions: []
        });
      }

      if (url.endsWith('/api/notes') && method === 'GET') {
        notesListCount += 1;
        if (notesListCount === 1) {
          return jsonResponse({
            notes: [
              {
                id: 1,
                title: 'Sprint plan',
                content: '# Sprint plan\n\n- Outline milestones',
                metadata: { created: '', updated: [] }
              },
              {
                id: 2,
                title: 'Retro',
                content: '# Retro\n\nRemember the blocker.',
                metadata: { created: '', updated: [] }
              }
            ]
          });
        }

        if (notesListCount === 2) {
          return jsonResponse({
            notes: [
              {
                id: 1,
                title: 'Sprint plan',
                content: '# Sprint plan\n\n- Outline milestones',
                metadata: { created: '', updated: [] }
              }
            ]
          });
        }

        return jsonResponse({
          notes: [
            {
              id: 1,
              title: 'Sprint plan refined',
              content: '# Sprint plan\n\n- Outline milestones',
              metadata: { created: '', updated: [] }
            },
            {
              id: 3,
              title: 'Weekly update',
              content: '# Weekly update\n\n- Sent to the team',
              metadata: { created: 'session-123', updated: ['session-123'] }
            }
          ]
        });
      }

      if (url.includes('/api/notes/') && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      if (url.endsWith('/api/chat') && method === 'POST') {
        return jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I created a new weekly update note.'
          },
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              name: 'createNote',
              arguments: {
                title: 'Weekly update',
                content: 'Draft content'
              }
            }
          ],
          createdNoteIds: [3],
          updatedNoteIds: [3],
          changedNoteIds: [3],
          openedNoteIds: [],
          notesChanged: true
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));

    const wrapper = mount(IndexPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Work Notes');
    expect(wrapper.text()).toContain('Note dump mode');
    expect(wrapper.text()).toContain('Off');
    expect(wrapper.text()).toContain('Sprint plan');
    expect(wrapper.text()).toContain('Outline milestones');
    expect(wrapper.find('.delete-button').exists()).toBe(false);
    expect(wrapper.get('button.toggle-button').attributes('aria-pressed')).toBe('false');

    await wrapper.get('button.toggle-button').trigger('click');
    await flushPromises();

    expect(wrapper.get('button.toggle-button').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('.notes-tree').exists()).toBe(true);

    const noteButtons = wrapper.findAll('.tree-item');
    await noteButtons[1].trigger('click');
    await flushPromises();

    expect(wrapper.find('.note-meta h3').text()).toBe('Retro');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Retro');
    expect(wrapper.get('.delete-button').text()).toBe('Delete note');

    await wrapper.get('.delete-button').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.tree-item')).toHaveLength(1);
    expect(wrapper.find('.tree-item').text()).toContain('Sprint plan');
    expect(wrapper.find('.note-meta h3').text()).toBe('Sprint plan');

    await wrapper.get('button.toggle-button').trigger('click');
    await flushPromises();

    expect(wrapper.get('button.toggle-button').attributes('aria-pressed')).toBe('false');
    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('I created a new weekly update note.');
    expect(wrapper.text()).toContain('createNote');
    expect(wrapper.text()).toContain('Weekly update');
    expect(wrapper.get('button.toggle-button').attributes('aria-pressed')).toBe('true');

    expect(wrapper.findAll('.tree-item')[0].text()).toContain('Sprint plan refined');
    expect(wrapper.find('.note-meta h3').text()).toBe('Weekly update');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Weekly update');
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it('opens a note in the notes panel when chat requests it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/chat/sessions') && method === 'GET') {
        return jsonResponse({
          sessions: []
        });
      }

      if (url.endsWith('/api/notes') && method === 'GET') {
        return jsonResponse({
          notes: [
            {
              id: 1,
              title: 'Sprint plan',
              content: '# Sprint plan\n\n- Outline milestones',
              metadata: { created: '', updated: [] }
            },
            {
              id: 2,
              title: 'Retro',
              content: '# Retro\n\nRemember the blocker.',
              metadata: { created: '', updated: [] }
            }
          ]
        });
      }

      if (url.endsWith('/api/chat') && method === 'POST') {
        return jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I opened the retro note.'
          },
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [2],
          notesChanged: false
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(IndexPage);
    await flushPromises();

    expect(wrapper.get('button.toggle-button').attributes('aria-pressed')).toBe('false');
    await wrapper.get('#chat-draft').setValue('Open the retro note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('I opened the retro note.');
    expect(wrapper.find('.note-meta h3').text()).toBe('Retro');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Retro');
  });
});
