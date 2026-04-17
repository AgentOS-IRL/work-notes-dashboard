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
  it('renders the assistant reply and notifies the page when notes change', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        assistantMessage: {
          id: 3,
          role: 'assistant',
          content: 'I updated the sprint plan note.'
        },
        changedNoteIds: [1],
        notesChanged: true
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(ChatPanel);
    await wrapper.get('#chat-draft').setValue('Refine the sprint plan.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('I updated the sprint plan note.');
    expect(wrapper.emitted('notes-changed')).toEqual([[[1]]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows an error when the backend request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })));

    const wrapper = mount(ChatPanel);
    await wrapper.get('#chat-draft').setValue('Draft a note.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Request failed with status 503');
  });
});

