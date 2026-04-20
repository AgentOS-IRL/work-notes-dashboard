import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import TaskEditorModal from '~/components/tasks/TaskEditorModal.vue';

describe('TaskEditorModal', () => {
  it('validates input, saves changes, and closes', async () => {
    const wrapper = mount(
      defineComponent({
        components: { TaskEditorModal },
        setup() {
          const isOpen = ref(true);
          const name = ref('');
          const status = ref<'todo' | 'backlog' | 'in progress' | 'completed'>('todo');
          const submitted = ref(0);

          function closeModal() {
            isOpen.value = false;
          }

          return {
            isOpen,
            name,
            status,
            submitted,
            closeModal
          };
        },
        template: `
          <TaskEditorModal
            v-model="isOpen"
            v-model:name="name"
            v-model:status="status"
            :busy="false"
            :error-message="''"
            :is-editing="false"
            @save="submitted += 1"
            @cancel="closeModal"
          />
        `
      })
    );

    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('[role="alert"]').text()).toBe('A valid task name is required.');

    await wrapper.get('#task-name-input').setValue('Draft checklist');
    await wrapper.get('#task-status-select').setValue('backlog');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.findComponent(TaskEditorModal).emitted('save')).toHaveLength(1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    await wrapper.get('.close-button').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('shows complete and busy states in edit mode', async () => {
    const completeSpy = vi.fn();

    const busyWrapper = mount(TaskEditorModal, {
      props: {
        modelValue: true,
        name: 'Ship board',
        status: 'in progress',
        busy: true,
        errorMessage: '',
        isEditing: true,
        'onUpdate:modelValue': () => undefined,
        'onUpdate:name': () => undefined,
        'onUpdate:status': () => undefined,
        onComplete: completeSpy,
        onCancel: () => undefined
      }
    });

    expect(busyWrapper.get('h3').text()).toBe('Edit task');
    expect(busyWrapper.get('.primary-button').text()).toBe('Saving...');
    expect(busyWrapper.get('.primary-button').attributes('disabled')).toBeDefined();
    expect(busyWrapper.findAll('.secondary-button')[1].text()).toBe('Complete');

    const wrapper = mount(TaskEditorModal, {
      props: {
        modelValue: true,
        name: 'Ship board',
        status: 'in progress',
        busy: false,
        errorMessage: '',
        isEditing: true,
        'onUpdate:modelValue': () => undefined,
        'onUpdate:name': () => undefined,
        'onUpdate:status': () => undefined,
        onComplete: completeSpy,
        onCancel: () => undefined
      }
    });

    await wrapper.findAll('.secondary-button')[1].trigger('click');
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });
});
