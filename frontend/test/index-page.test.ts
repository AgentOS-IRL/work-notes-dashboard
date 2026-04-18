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
  it('renders the workspace shell, explores notes, deletes a note, and loads a new chat-created note', async () => {
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
          changedNoteIds: [3],
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
    expect(wrapper.text()).toContain('Explore');
    expect(wrapper.text()).toContain('Sprint plan');
    expect(wrapper.text()).toContain('Outline milestones');
    expect(wrapper.find('.delete-button').exists()).toBe(false);

    await wrapper.get('button.toggle-button').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Chat');
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

    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('I created a new weekly update note.');

    await wrapper.get('button.toggle-button').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.tree-item')[0].text()).toContain('Sprint plan refined');
    expect(wrapper.find('.note-meta h3').text()).toBe('Weekly update');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Weekly update');
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });
});
