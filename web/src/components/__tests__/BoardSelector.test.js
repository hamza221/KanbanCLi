import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BoardSelector from '../BoardSelector.vue';

describe('BoardSelector', () => {
  it('renders the Select component', () => {
    const wrapper = mount(BoardSelector, {
      props: {
        boards: ['default', 'work'],
        activeBoard: 'default',
      },
    });
    expect(wrapper.find('.board-selector').exists()).toBe(true);
  });

  it('displays the active board', () => {
    const wrapper = mount(BoardSelector, {
      props: {
        boards: ['default', 'work'],
        activeBoard: 'default',
      },
    });
    // PrimeVue Select renders the selected value in the component
    expect(wrapper.text()).toContain('default');
  });

  it('updates when activeBoard prop changes', async () => {
    const wrapper = mount(BoardSelector, {
      props: {
        boards: ['default', 'work'],
        activeBoard: 'default',
      },
    });
    await wrapper.setProps({ activeBoard: 'work' });
    expect(wrapper.text()).toContain('work');
  });
});
