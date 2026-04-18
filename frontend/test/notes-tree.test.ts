import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NotesTree from '~/components/notes/NotesTree.vue';

describe('NotesTree', () => {
  it('renders a selectable tree and emits note ids', async () => {
    const wrapper = mount(NotesTree, {
      props: {
        nodes: [
          { id: 'note-1', label: 'Sprint plan', noteId: 1, children: [] },
          {
            id: 'folder-1',
            label: 'Team',
            children: [{ id: 'note-2', label: 'Retro', noteId: 2, children: [] }]
          }
        ],
        selectedNoteId: 2
      }
    });

    expect(wrapper.text()).toContain('Sprint plan');
    expect(wrapper.text()).toContain('Retro');
    expect(wrapper.findAll('.tree-node.active')).toHaveLength(1);

    await wrapper.findAll('.tree-item')[0].trigger('click');

    expect(wrapper.emitted('select')).toEqual([[1]]);
  });
});
