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
  it('renders the workspace shell, explores notes, deletes a note, and refreshes after chat updates', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [
            { id: 1, title: 'Sprint plan', content: '# Sprint plan\n\n- Outline milestones' },
            { id: 2, title: 'Retro', content: '# Retro\n\nRemember the blocker.' }
          ]
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [{ id: 1, title: 'Sprint plan', content: '# Sprint plan\n\n- Outline milestones' }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          assistantMessage: {
            role: 'assistant',
            content: 'I updated the sprint plan note.'
          },
          changedNoteIds: [1],
          notesChanged: true
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          notes: [{ id: 1, title: 'Sprint plan refined', content: '# Sprint plan\n\n- Outline milestones' }]
        })
      );

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

    expect(wrapper.text()).toContain('I updated the sprint plan note.');

    await wrapper.get('button.toggle-button').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.tree-item')[0].text()).toContain('Sprint plan refined');
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
