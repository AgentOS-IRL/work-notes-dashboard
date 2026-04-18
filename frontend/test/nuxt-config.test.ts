import { describe, expect, it } from 'vitest';
import nuxtConfig from '../nuxt.config';

describe('nuxt config', () => {
  it('declares the favicon link for the frontend head', () => {
    const faviconLink = nuxtConfig.app?.head?.link?.find((link) => link.rel === 'icon');

    expect(faviconLink).toEqual({
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg'
    });
  });

  it('keeps the favicon asset path aligned with the public asset contract', () => {
    const faviconLink = nuxtConfig.app?.head?.link?.find((link) => link.rel === 'icon');

    expect(faviconLink?.href).toBe('/favicon.svg');
  });
});
