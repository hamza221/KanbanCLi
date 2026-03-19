import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DeadlineTag from '../DeadlineTag.vue';

describe('DeadlineTag', () => {
  it('shows "Due today" when deadline is today', () => {
    const today = new Date().toISOString().slice(0, 10);
    const wrapper = mount(DeadlineTag, {
      props: { deadline: today },
    });
    expect(wrapper.text()).toContain('Due today');
  });

  it('shows "Due tomorrow" when deadline is tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const wrapper = mount(DeadlineTag, {
      props: { deadline: tomorrow },
    });
    expect(wrapper.text()).toContain('Due tomorrow');
  });

  it('shows overdue text for past dates', () => {
    const past = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const wrapper = mount(DeadlineTag, {
      props: { deadline: past },
    });
    expect(wrapper.text()).toContain('overdue');
  });

  it('shows "d left" for future dates beyond tomorrow', () => {
    const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const wrapper = mount(DeadlineTag, {
      props: { deadline: future },
    });
    expect(wrapper.text()).toMatch(/\d+d left/);
  });

  it('renders a Tag component', () => {
    const wrapper = mount(DeadlineTag, {
      props: { deadline: '2026-12-31' },
    });
    // PrimeVue Tag renders with p-tag class
    expect(wrapper.find('.p-tag').exists()).toBe(true);
  });
});
