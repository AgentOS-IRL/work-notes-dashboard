import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, reactive, ref, computed } from 'vue';
import { describe, expect, it } from 'vitest';
import TaskBoard from '~/components/tasks/TaskBoard.vue';
import { groupTasksByStatus } from '~/composables/useTasks';
import type { TaskStatus } from '~/types/task';

describe('TaskBoard', () => {
  it('opens tasks from cards and respects collapsed sections', async () => {
    const wrapper = mount(
      defineComponent({
        components: { TaskBoard },
        setup() {
          const tasks = ref([
            {
              id: 1,
              name: 'Ship board',
              status: 'in progress' as TaskStatus
            },
            {
              id: 2,
              name: 'Draft follow-up',
              status: 'todo' as TaskStatus
            },
            {
              id: 3,
              name: 'Old backlog item',
              status: 'backlog' as TaskStatus
            }
          ]);
          const collapseState = reactive({
            todo: true,
            backlog: true,
            'in progress': false,
            completed: true
          });
          const isEditorOpen = ref(false);
          const draftName = ref('');
          const draftStatus = ref<TaskStatus>('todo');
          const isEditing = ref(false);
          const groupedTasks = computed(() => groupTasksByStatus(tasks.value));

          function createTask() {
            isEditing.value = false;
            isEditorOpen.value = true;
            draftName.value = '';
            draftStatus.value = 'todo';
          }

          function selectTask(task: { id: number; name: string; status: TaskStatus }) {
            isEditing.value = true;
            isEditorOpen.value = true;
            draftName.value = task.name;
            draftStatus.value = task.status;
          }

          function toggle(status: TaskStatus) {
            collapseState[status] = !collapseState[status];
          }

          function close() {
            isEditorOpen.value = false;
          }

          return {
            tasks,
            groupedTasks,
            collapseState,
            isEditorOpen,
            draftName,
            draftStatus,
            isEditing,
            createTask,
            selectTask,
            toggle,
            close
          };
        },
        template: `
          <TaskBoard
            :tasks="tasks"
            :grouped-tasks="groupedTasks"
            :collapse-state="collapseState"
            :loading="false"
            :saving="false"
            error-message=""
            status-message=""
            v-model:isEditorOpen="isEditorOpen"
            v-model:draftName="draftName"
            v-model:draftStatus="draftStatus"
            :is-editing="isEditing"
            @create="createTask"
            @select="selectTask"
            @toggle="toggle"
            @save="close"
            @complete="close"
            @close="close"
          />
        `
      })
    );

    expect(wrapper.text()).toContain('Tasks');
    expect(wrapper.text()).toContain('Ship board');
    expect(wrapper.findAll('.status-collapsed-copy')).toHaveLength(3);

    await wrapper.get('button.create-button').trigger('click');
    await flushPromises();

    expect(wrapper.get('h3').text()).toBe('New task');
    expect((wrapper.get('#task-name-input').element as HTMLInputElement).value).toBe('');

    const taskCards = wrapper.findAll('.task-card');
    await taskCards[0].trigger('click');
    await flushPromises();

    expect(wrapper.get('h3').text()).toBe('Edit task');
    expect((wrapper.get('#task-name-input').element as HTMLInputElement).value).toBe('Ship board');
    expect((wrapper.get('#task-status-select').element as HTMLSelectElement).value).toBe(
      'in progress'
    );
    expect(wrapper.text()).toContain('Complete');

    await wrapper.get('.status-divider').trigger('click');
    await flushPromises();

    expect(wrapper.findAll('.status-collapsed-copy').length).toBeGreaterThanOrEqual(2);
  });
});
