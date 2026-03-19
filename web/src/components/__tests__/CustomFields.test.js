import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CustomFields from '../CustomFields.vue';

describe('CustomFields', () => {
  const schema = [
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'high'] },
    { key: 'points', label: 'Points', type: 'number' },
    { key: 'done', label: 'Done', type: 'boolean' },
  ];

  it('renders chips for fields with values', () => {
    const wrapper = mount(CustomFields, {
      props: {
        fields: { priority: 'high', points: 5 },
        schema,
      },
    });
    expect(wrapper.text()).toContain('Priority: high');
    expect(wrapper.text()).toContain('Points: 5');
  });

  it('does not render chips for null/undefined fields', () => {
    const wrapper = mount(CustomFields, {
      props: {
        fields: { priority: 'low' },
        schema,
      },
    });
    expect(wrapper.text()).toContain('Priority: low');
    expect(wrapper.text()).not.toContain('Points');
  });

  it('shows label for boolean true values', () => {
    const wrapper = mount(CustomFields, {
      props: {
        fields: { done: true },
        schema,
      },
    });
    expect(wrapper.text()).toContain('Done');
  });

  it('renders nothing when no fields have values', () => {
    const wrapper = mount(CustomFields, {
      props: {
        fields: {},
        schema,
      },
    });
    expect(wrapper.text()).toBe('');
  });
});
