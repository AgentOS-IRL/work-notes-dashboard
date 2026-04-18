import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NotesPanel from '~/components/notes/NotesPanel.vue';

describe('NotesPanel', () => {
  it('shows the delete action only when a note is selected', async () => {
    const emptyWrapper = mount(NotesPanel, {
      props: {
        note: null,
        loading: false,
        errorMessage: ''
      }
    });

    expect(emptyWrapper.find('.delete-button').exists()).toBe(false);
    expect(emptyWrapper.text()).toContain('No note');

    const wrapper = mount(NotesPanel, {
      props: {
        note: {
          id: 7,
          title: 'Weekly note',
          content: 'Body'
        },
        loading: false,
        errorMessage: '',
        mutating: false,
        canDelete: true
      },
      global: {
        stubs: {
          MarkdownRenderer: {
            props: ['content'],
            template: '<div class="markdown-body">{{ content }}</div>'
          }
        }
      }
    });

    const deleteButton = wrapper.get('.delete-button');

    expect(deleteButton.text()).toBe('Delete note');
    await deleteButton.trigger('click');
    expect(wrapper.emitted('delete')).toEqual([[]]);
  });

  it('disables the delete action while a mutation is in flight', () => {
    const wrapper = mount(NotesPanel, {
      props: {
        note: {
          id: 11,
          title: 'Delete me',
          content: 'Body'
        },
        loading: false,
        errorMessage: '',
        mutating: true,
        canDelete: true
      },
      global: {
        stubs: {
          MarkdownRenderer: {
            props: ['content'],
            template: '<div class="markdown-body">{{ content }}</div>'
          }
        }
      }
    });

    const deleteButton = wrapper.get('.delete-button');

    expect(deleteButton.attributes('disabled')).toBeDefined();
    expect(deleteButton.text()).toBe('Deleting...');
  });

  it('keeps the delete action hidden while loading', () => {
    const wrapper = mount(NotesPanel, {
      props: {
        note: {
          id: 12,
          title: 'Loading note',
          content: 'Body'
        },
        loading: true,
        errorMessage: '',
        mutating: false,
        canDelete: true
      }
    });

    expect(wrapper.find('.delete-button').exists()).toBe(false);
    expect(wrapper.text()).toContain('Loading...');
  });

  it('keeps the delete action hidden when deletion is not allowed', () => {
    const wrapper = mount(NotesPanel, {
      props: {
        note: {
          id: 13,
          title: 'Chat-first note',
          content: 'Body'
        },
        loading: false,
        errorMessage: '',
        mutating: false,
        canDelete: false
      },
      global: {
        stubs: {
          MarkdownRenderer: {
            props: ['content'],
            template: '<div class="markdown-body">{{ content }}</div>'
          }
        }
      }
    });

    expect(wrapper.find('.delete-button').exists()).toBe(false);
    expect(wrapper.text()).toContain('Chat-first note');
  });
});
