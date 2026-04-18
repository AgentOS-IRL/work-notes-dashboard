import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MarkdownRenderer from '~/components/notes/MarkdownRenderer.vue';

describe('MarkdownRenderer', () => {
  it('renders headings, lists, links, and code fences', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: '# Title\n\n- first\n- second\n\n[Docs](https://example.com)\n\n```ts\nconst value = 1;\n```'
      }
    });

    expect(wrapper.find('h1').text()).toBe('Title');
    expect(wrapper.findAll('li')).toHaveLength(2);
    expect(wrapper.find('a').attributes('href')).toBe('https://example.com');
    expect(wrapper.find('pre code').text()).toContain('const value = 1;');
  });

  it('escapes raw html in plain text content', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: {
        content: 'Hello <script>alert(1)</script>'
      }
    });

    expect(wrapper.find('script').exists()).toBe(false);
    expect(wrapper.text()).toContain('Hello <script>alert(1)</script>');
  });
});
