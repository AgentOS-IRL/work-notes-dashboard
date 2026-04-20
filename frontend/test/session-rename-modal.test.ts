import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import SessionRenameModal from '~/components/chat/SessionRenameModal.vue';

describe('SessionRenameModal', () => {
  it('prefills the current name, submits a trimmed value, and emits cancel', async () => {
    const wrapper = mount(SessionRenameModal, {
      props: {
        modelValue: true,
        sessionName: 'Weekly update'
      }
    });

    await flushPromises();

    expect((wrapper.get('#session-rename-input').element as HTMLInputElement).value).toBe(
      'Weekly update'
    );

    await wrapper.get('#session-rename-input').setValue('  Renamed session  ');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.emitted('submit')).toEqual([['Renamed session']]);

    await wrapper.get('.secondary-button').trigger('click');

    expect(wrapper.emitted('update:modelValue')).toContainEqual([false]);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('blocks empty submissions and disables actions while busy', async () => {
    const wrapper = mount(SessionRenameModal, {
      props: {
        modelValue: true,
        sessionName: '',
        busy: true,
        errorMessage: 'Rename failed.'
      }
    });

    await flushPromises();

    expect(wrapper.get('.rename-error').text()).toBe('Rename failed.');
    expect(wrapper.get('.primary-button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.secondary-button').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.close-button').attributes('disabled')).toBeDefined();
  });
});
