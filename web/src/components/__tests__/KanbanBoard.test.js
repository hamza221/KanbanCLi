import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KanbanBoard from '../KanbanBoard.vue';

const config = {
  columns: ['To Do', 'In Progress', 'Done'],
  customFields: [],
};

const cards = [
  {
    id: '1',
    title: 'Card A',
    status: 'To Do',
    link: null,
    linkMeta: null,
    deadline: null,
    recurring: null,
    customFields: {},
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  },
  {
    id: '2',
    title: 'Card B',
    status: 'Done',
    link: null,
    linkMeta: null,
    deadline: null,
    recurring: null,
    customFields: {},
    createdAt: '2026-03-19T00:00:00.000Z',
    updatedAt: '2026-03-19T00:00:00.000Z',
  },
];

describe('KanbanBoard', () => {
  it('renders a column for each column in config', () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    const columns = wrapper.findAll('.kanban-column');
    expect(columns).toHaveLength(3);
  });

  it('shows column names', () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    expect(wrapper.text()).toContain('To Do');
    expect(wrapper.text()).toContain('In Progress');
    expect(wrapper.text()).toContain('Done');
  });

  it('distributes cards to correct columns', () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    // Card A should be in first column (To Do)
    const firstCol = wrapper.findAll('.kanban-column')[0];
    expect(firstCol.text()).toContain('Card A');

    // Card B should be in last column (Done)
    const lastCol = wrapper.findAll('.kanban-column')[2];
    expect(lastCol.text()).toContain('Card B');
  });

  it('shows card count per column', () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    // To Do has 1 card, In Progress has 0, Done has 1
    const counts = wrapper.findAll('.kanban-column-count');
    expect(counts[0].text()).toBe('1');
    expect(counts[1].text()).toBe('0');
    expect(counts[2].text()).toBe('1');
  });

  it('forwards edit-card event from KanbanColumn', async () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    // Find the edit button in the first column's card and click it
    const firstCol = wrapper.findAll('.kanban-column')[0];
    const editBtn = firstCol.findAll('button').find((b) => b.find('.pi-pencil').exists());
    expect(editBtn).toBeTruthy();
    await editBtn.trigger('click');
    expect(wrapper.emitted('edit-card')).toBeTruthy();
    expect(wrapper.emitted('edit-card')[0][0]).toMatchObject({ id: '1', title: 'Card A' });
  });

  it('forwards delete-card event from KanbanColumn', async () => {
    const wrapper = mount(KanbanBoard, {
      props: { config, cards },
    });
    // Find the delete button in the first column's card and click it
    const firstCol = wrapper.findAll('.kanban-column')[0];
    const deleteBtn = firstCol.findAll('button').find((b) => b.find('.pi-trash').exists());
    expect(deleteBtn).toBeTruthy();
    await deleteBtn.trigger('click');
    expect(wrapper.emitted('delete-card')).toBeTruthy();
    expect(wrapper.emitted('delete-card')[0][0]).toMatchObject({ id: '1', title: 'Card A' });
  });
});
