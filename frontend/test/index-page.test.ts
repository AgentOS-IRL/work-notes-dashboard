import { mount, flushPromises } from '@vue/test-utils';
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
  it('renders the split dashboard and keeps chat local-only', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        notes: [
          { id: 1, title: 'Sprint plan', content: 'Outline milestones' },
          { id: 2, title: 'Retro', content: 'Capture lessons learned' }
        ]
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mount(IndexPage);
    await flushPromises();

    expect(wrapper.text()).toContain('Talk things out locally.');
    expect(wrapper.text()).toContain('Capture the source of truth.');
    expect(wrapper.text()).toContain('Sprint plan');
    expect(wrapper.text()).toContain('Retro');

    const noteCards = wrapper.findAll('.note-card');
    await noteCards[1].trigger('click');
    await flushPromises();

    const titleInput = wrapper.find('.notes-panel input');
    expect((titleInput.element as HTMLInputElement).value).toBe('Retro');

    const chatInput = wrapper.get('#chat-draft');
    await chatInput.setValue('Draft a summary for the team.');
    await wrapper.get('form.composer').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('This chat stays local for now.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
