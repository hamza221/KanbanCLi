import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import KanbanCard from '../KanbanCard.vue';

const baseCard = {
  id: 'test-1',
  title: 'Test Card',
  status: 'To Do',
  link: null,
  linkMeta: null,
  deadline: null,
  recurring: null,
  customFields: {},
  createdAt: '2026-03-19T00:00:00.000Z',
  updatedAt: '2026-03-19T00:00:00.000Z',
};

const config = {
  columns: ['To Do', 'Done'],
  customFields: [],
};

describe('KanbanCard', () => {
  it('renders the card title', () => {
    const wrapper = mount(KanbanCard, {
      props: { card: baseCard, config },
    });
    expect(wrapper.text()).toContain('Test Card');
  });

  it('renders a DeadlineTag when deadline is set', () => {
    const wrapper = mount(KanbanCard, {
      props: {
        card: { ...baseCard, deadline: '2026-12-31' },
        config,
      },
    });
    // DeadlineTag renders a p-tag element
    expect(wrapper.find('.p-tag').exists()).toBe(true);
  });

  it('does not render DeadlineTag when deadline is null', () => {
    const wrapper = mount(KanbanCard, {
      props: { card: baseCard, config },
    });
    expect(wrapper.find('.p-tag').exists()).toBe(false);
  });

  it('renders a Weekly tag when recurring is set', () => {
    const wrapper = mount(KanbanCard, {
      props: {
        card: {
          ...baseCard,
          recurring: { frequency: 'weekly', lastReset: '2026-03-19' },
        },
        config,
      },
    });
    expect(wrapper.text()).toContain('Weekly');
  });

  it('renders GithubLink when link is set', () => {
    const wrapper = mount(KanbanCard, {
      props: {
        card: { ...baseCard, link: 'https://github.com/a/b/issues/1' },
        config,
      },
    });
    expect(wrapper.find('a').exists()).toBe(true);
  });

  it('emits edit event when edit button is clicked', async () => {
    const wrapper = mount(KanbanCard, {
      props: { card: baseCard, config },
    });
    const editBtn = wrapper.findAll('button').find((b) => b.find('.pi-pencil').exists());
    expect(editBtn).toBeTruthy();
    await editBtn.trigger('click');
    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')[0][0]).toEqual(baseCard);
  });

  it('emits delete event when delete button is clicked', async () => {
    const wrapper = mount(KanbanCard, {
      props: { card: baseCard, config },
    });
    const deleteBtn = wrapper.findAll('button').find((b) => b.find('.pi-trash').exists());
    expect(deleteBtn).toBeTruthy();
    await deleteBtn.trigger('click');
    expect(wrapper.emitted('delete')).toBeTruthy();
    expect(wrapper.emitted('delete')[0][0]).toEqual(baseCard);
  });

  it('renders GitHub label chips when linkMeta has labels', () => {
    const wrapper = mount(KanbanCard, {
      props: {
        card: {
          ...baseCard,
          link: 'https://github.com/a/b/issues/1',
          linkMeta: {
            type: 'issue',
            owner: 'a',
            repo: 'b',
            number: 1,
            labels: [
              { name: 'bug', color: 'd73a4a' },
              { name: 'enhancement', color: 'a2eeef' },
            ],
          },
        },
        config,
      },
    });
    const labels = wrapper.findAll('.kanban-card-labels .p-tag');
    expect(labels.length).toBe(2);
    expect(wrapper.text()).toContain('bug');
    expect(wrapper.text()).toContain('enhancement');
  });

  it('renders GitHub metadata (author, comments)', () => {
    const wrapper = mount(KanbanCard, {
      props: {
        card: {
          ...baseCard,
          link: 'https://github.com/a/b/issues/1',
          linkMeta: {
            type: 'issue',
            owner: 'a',
            repo: 'b',
            number: 1,
            labels: [],
            author: 'octocat',
            assignees: ['monalisa'],
            commentsCount: 5,
          },
        },
        config,
      },
    });
    expect(wrapper.text()).toContain('octocat');
    expect(wrapper.text()).toContain('monalisa');
    expect(wrapper.text()).toContain('5');
  });
});
