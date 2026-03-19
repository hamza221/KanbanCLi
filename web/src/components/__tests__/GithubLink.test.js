import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GithubLink from '../GithubLink.vue';

describe('GithubLink', () => {
  it('renders an anchor element with the link', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://github.com/acme/repo/issues/42',
      },
    });
    const a = wrapper.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('https://github.com/acme/repo/issues/42');
    expect(a.attributes('target')).toBe('_blank');
  });

  it('shows GitHub icon for GitHub URLs', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://github.com/acme/repo/issues/42',
      },
    });
    expect(wrapper.find('i.pi-github').exists()).toBe(true);
  });

  it('shows external-link icon for non-GitHub URLs', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://example.com/task',
      },
    });
    expect(wrapper.find('i.pi-external-link').exists()).toBe(true);
  });

  it('formats display text from GitHub URL path', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://github.com/acme/repo/issues/42',
      },
    });
    expect(wrapper.text()).toContain('acme/repo#42');
  });

  it('uses meta data for display when available', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://github.com/acme/repo/issues/42',
        meta: {
          type: 'issue',
          repo: 'repo',
          number: 42,
        },
      },
    });
    expect(wrapper.text()).toContain('repo#42');
  });

  it('shows PR prefix for pull requests', () => {
    const wrapper = mount(GithubLink, {
      props: {
        link: 'https://github.com/acme/repo/pull/99',
        meta: {
          type: 'pull_request',
          repo: 'repo',
          number: 99,
        },
      },
    });
    expect(wrapper.text()).toContain('repoPR99');
  });
});
