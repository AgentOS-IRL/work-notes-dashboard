import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import ChatPanel from '~/components/chat/ChatPanel.vue';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('ChatPanel', () => {
  it('renders the terminal-style chat shell and notifies the page when notes change', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
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
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [1],
                lockedNoteId: 1
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    expect(wrapper.find('header.panel-header').exists()).toBe(true);
    expect(wrapper.find('.status-token').text()).toBe('~/notes');
    expect(wrapper.find('.status-pill').text()).toBe('ready');
    expect(wrapper.get('.note-dump-indicator').text()).toBe('note dump mode off');
    expect(wrapper.get('button.clear-button').text()).toBe('Clear');
    expect(wrapper.get('select').exists()).toBe(true);
    expect(wrapper.findAll('option')).toHaveLength(3);
    expect(wrapper.findAll('option')[1].text()).toBe('Named session');
    expect(wrapper.findAll('option')[2].text()).toMatch(/:/);
    expect(wrapper.find('.prompt-row').exists()).toBe(false);
    expect(wrapper.findAll('.prompt-chip')).toHaveLength(0);
    expect(wrapper.find('form.composer').exists()).toBe(true);
    expect(wrapper.get('button.rename-button').text()).toBe('Rename');
    expect(wrapper.get('button.rename-button').attributes('disabled')).toBeDefined();
    await wrapper.get('select').setValue('session-1');
    await flushPromises();
    await flushPromises();
    await wrapper.vm.$nextTick();
    expect(wrapper.get('.note-dump-indicator').text()).toBe('note dump mode off');
  });

  it('opens the rename modal and updates the session label after saving', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            id: 'session-2',
            name: null,
            createdAt: 1_700_000_100_000,
            lastActivityAt: 1_700_000_100_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: null
            }
          },
          messages: []
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            id: 'session-2',
            name: 'Renamed session',
            createdAt: 1_700_000_100_000,
            lastActivityAt: 1_700_000_100_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: null
            }
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: 'Renamed session',
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    expect(wrapper.get('button.rename-button').attributes('disabled')).toBeDefined();

    await wrapper.get('select').setValue('session-2');
    await flushPromises();

    expect(wrapper.get('button.rename-button').attributes('disabled')).toBeUndefined();

    await wrapper.get('button.rename-button').trigger('click');
    expect(wrapper.get('.rename-modal').exists()).toBe(true);
    expect((wrapper.get('#session-rename-input').element as HTMLInputElement).value).toBe('');

    await wrapper.get('#session-rename-input').setValue('Renamed session');
    await wrapper.get('.rename-modal form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('select').element).toBeDefined();
    expect(wrapper.findAll('option')[2].text()).toBe('Renamed session');
    expect(wrapper.vm.sessionId).toBe('session-2');
    expect(wrapper.find('.rename-modal').exists()).toBe(false);
  });

  it('renders assistant tool calls beneath the message content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I drafted the weekly update note.'
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
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [3]
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I refined the sprint plan.'
          },
          toolCalls: [],
          createdNoteIds: [],
          updatedNoteIds: [3],
          changedNoteIds: [3],
          openedNoteIds: [],
          lockedNoteId: 3,
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 3
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    await wrapper.get('#chat-draft').setValue('Draft a weekly update note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    const toolCallList = wrapper.get('.tool-call-list');
    expect(toolCallList.text()).toContain('createNote');
    expect(toolCallList.text()).toContain('Weekly update');
    expect(toolCallList.text()).toContain('Draft content');
    expect(wrapper.find('.message.assistant').text()).toContain('I drafted the weekly update note.');
  });

  it('surfaces opened note ids to the page shell', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: []
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I opened the sprint plan note.'
          },
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [4],
          notesChanged: false
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: []
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    await wrapper.get('#chat-draft').setValue('Open the sprint plan note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('notes-activity')).toEqual([
      [
        {
          createdNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [4]
        }
      ]
    ]);
  });

  it('surfaces changed and opened note ids together as a single activity event', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: []
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated and opened the sprint plan note.'
          },
          createdNoteIds: [1],
          updatedNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [4],
          lockedNoteId: 1,
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 1
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    await wrapper.get('#chat-draft').setValue('Update and open the sprint plan note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.emitted('notes-activity')).toEqual([
      [
        {
          createdNoteIds: [1],
          changedNoteIds: [1],
          openedNoteIds: [4]
        }
      ]
    ]);
  });

  it('loads a persisted session and replaces the visible transcript', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 3
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            id: 'session-2',
            name: null,
            createdAt: 1_700_000_100_000,
            lastActivityAt: 1_700_000_100_000,
            metadata: {
              created: [],
              updated: [],
              lockedNoteId: 3
            }
          },
          messages: [
            {
              id: 1,
              role: 'user',
              content: 'Draft a weekly update.',
              toolCalls: []
            },
            {
              id: 2,
              role: 'assistant',
              content: 'Here is a draft.',
              toolCalls: [
                {
                  id: 'call-1',
                  type: 'function',
                  name: 'createNote',
                  arguments: {
                    title: 'Weekly update'
                  }
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          sessions: [
            {
              id: 'session-1',
              name: 'Named session',
              createdAt: 1_700_000_000_000,
              lastActivityAt: 1_700_000_000_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: null
              }
            },
            {
              id: 'session-2',
              name: null,
              createdAt: 1_700_000_100_000,
              lastActivityAt: 1_700_000_100_000,
              metadata: {
                created: [],
                updated: [],
                lockedNoteId: 3
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    await wrapper.get('select').setValue('session-2');
    await flushPromises();

    expect(wrapper.findAll('.message')).toHaveLength(2);
    expect(wrapper.find('.message.user').text()).toContain('Draft a weekly update.');
    expect(wrapper.find('.message.assistant').text()).toContain('Here is a draft.');
    expect(wrapper.get('.tool-call-list').text()).toContain('createNote');
    expect(wrapper.vm.sessionId).toBe('session-2');
    expect(wrapper.get('.note-dump-indicator').text()).toBe('note dump mode on');

    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/chat' && (init as RequestInit | undefined)?.method === 'POST'
    );
    const requestBody = JSON.parse(postCall?.[1]?.body as string) as {
      sessionId: string;
      messages: Array<{ role: string; content: string; toolCalls: unknown[] }>;
    };

    expect(requestBody.messages[2]).toMatchObject({
      role: 'user',
      content:
        'Please update, reformat, and organize the note with the new information.\n\nRefine the sprint plan.',
      toolCalls: []
    });
  });

  it('clears the transcript and rotates the session id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan note.'
          },
          createdNoteIds: [],
          updatedNoteIds: [],
          changedNoteIds: [],
          openedNoteIds: [],
          notesChanged: false
        })
      )
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();
    const initialSessionId = wrapper.vm.sessionId as string;

    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    await wrapper.get('button.clear-button').trigger('click');

    expect(wrapper.findAll('.message')).toHaveLength(0);
    expect(wrapper.find('.status-pill').text()).toBe('ready');
    expect(wrapper.vm.sessionId).not.toBe(initialSessionId);
  });

  it('keeps Shift+Enter available for new lines in the composer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sessions: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();

    await wrapper.get('#chat-draft').setValue('Line one');
    await wrapper.get('#chat-draft').trigger('keydown', { key: 'Enter', shiftKey: true });
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/sessions',
      expect.objectContaining({
        method: 'GET'
      })
    );
    expect((wrapper.get('#chat-draft').element as HTMLTextAreaElement).value).toBe('Line one');
  });

  it('collapses the composer in compact mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ sessions: [] })));

    const wrapper = mount(ChatPanel, {
      props: {
        compact: true
      }
    });
    await flushPromises();

    expect(wrapper.find('.collapsed-copy').text()).toBe('Chat collapsed for browsing.');
    expect(wrapper.find('form.composer').exists()).toBe(false);
    expect(wrapper.find('.prompt-row').exists()).toBe(false);
    expect(wrapper.findAll('.prompt-chip')).toHaveLength(0);
    expect(wrapper.classes()).toContain('compact');
  });

  it('shows a terminal-style error when the backend request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ sessions: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await flushPromises();
    await wrapper.get('#chat-draft').setValue('Draft a note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.terminal-alert').text()).toContain('Request failed with status 503');
  });
});
