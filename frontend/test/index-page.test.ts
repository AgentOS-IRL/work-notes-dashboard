import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceShell from '~/components/workspace/WorkspaceShell.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

async function mountWorkspaceShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', redirect: '/chat' },
      { path: '/chat', component: { template: '<div />' } },
      { path: '/explore', component: { template: '<div />' } },
      { path: '/tasks', component: { template: '<div />' } }
    ]
  });

  await router.push('/chat');
  await router.isReady();

  const wrapper = mount(WorkspaceShell, {
    global: {
      plugins: [router]
    }
  });

  return { router, wrapper };
}

describe('workspace shell', () => {
  it('navigates between chat, explore, and tasks routes while keeping workspace state alive', async () => {
    let notesListCount = 0;
    let sessionLocked = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/chat/sessions') && method === 'GET') {
        return jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Locked note session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: sessionLocked ? 1 : null
              }
            }
          ]
        });
      }

      if (url.endsWith('/api/chat/sessions/session-1') && method === 'GET') {
        return jsonResponse({
          session: {
            id: 'session-1',
            name: 'Locked note session',
            createdAt: 1_700_000_000_000,
            lastActivityAt: 1_700_000_000_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: null
            }
          },
          messages: []
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

      if (url.endsWith('/api/tasks') && method === 'GET') {
        return jsonResponse({
          tasks: [
            {
              id: 10,
              name: 'Ship board',
              status: 'in progress'
            },
            {
              id: 11,
              name: 'Draft follow-up',
              status: 'todo'
            },
            {
              id: 12,
              name: 'Old backlog item',
              status: 'backlog'
            }
          ]
        });
      }

      if (url.endsWith('/api/chat') && method === 'POST') {
        const requestBody = JSON.parse(init?.body as string) as {
          sessionId: string;
          messages: Array<{ role: string; content: string; toolCalls: unknown[] }>;
        };

        expect(requestBody.messages[0]).toMatchObject({
          role: 'user',
          content: 'Refine the sprint plan.',
          toolCalls: []
        });

        sessionLocked = true;
        return jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan note.'
          },
          toolCalls: [
            {
              id: 'call-1',
              type: 'function',
              name: 'updateNote',
              arguments: {
                id: 1,
                title: 'Sprint plan'
              }
            }
          ],
          createdNoteIds: [],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [],
          lockedNoteId: 1,
          notesChanged: true
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn(() => true));

    const { router, wrapper } = await mountWorkspaceShell();
    await flushPromises();

    expect(wrapper.text()).toContain('Work Notes');
    expect(wrapper.text()).toContain('Explore');
    expect(wrapper.text()).toContain('Tasks');
    expect(router.currentRoute.value.path).toBe('/chat');
    expect(wrapper.find('.notes-tree').exists()).toBe(false);
    expect(wrapper.text()).toContain('Sprint plan');
    expect(wrapper.text()).toContain('Outline milestones');
    expect(wrapper.find('.delete-button').exists()).toBe(false);

    await wrapper.get('a.nav-link[href="/explore"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/explore');
    expect(wrapper.text()).toContain('Chat');
    expect(wrapper.find('.notes-tree').exists()).toBe(true);

    await wrapper.get('select').setValue('session-1');
    await flushPromises();

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

    await wrapper.get('a.nav-link[href="/tasks"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/tasks');
    expect(wrapper.text()).toContain('Tasks');
    expect(wrapper.text()).toContain('Ship board');
    expect(wrapper.find('.status-collapsed-copy').exists()).toBe(true);
    expect(wrapper.text()).toContain('Section collapsed.');

    await wrapper.get('a.nav-link[href="/chat"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/chat');
    expect(wrapper.find('.notes-tree').exists()).toBe(false);

    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('I updated the sprint plan note.');
    expect(wrapper.text()).toContain('updateNote');
    expect(wrapper.text()).toContain('Sprint plan');

    await wrapper.get('a.nav-link[href="/explore"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/explore');
    expect(wrapper.findAll('.tree-item')[0].text()).toContain('Sprint plan refined');
    expect(wrapper.find('.note-meta h3').text()).toBe('Sprint plan refined');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Sprint plan');
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

    const { router, wrapper } = await mountWorkspaceShell();
    await flushPromises();

    await wrapper.get('a.nav-link[href="/explore"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/explore');

    await wrapper.get('a.nav-link[href="/chat"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/chat');

    await wrapper.get('#chat-draft').setValue('Open the retro note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('I opened the retro note.');

    await wrapper.get('a.nav-link[href="/explore"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/explore');
    expect(wrapper.find('.note-meta h3').text()).toBe('Retro');
    expect(wrapper.find('.markdown-body h1').text()).toBe('Retro');
  });
});
