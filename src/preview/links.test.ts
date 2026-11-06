// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { linkPath, pageLinks, pageResolver } from './links'

describe('linkPath', () => {
  it('drops the trailing slash and keeps the root', () => {
    expect(linkPath('/fr/about/')).toBe('/fr/about')
    expect(linkPath('/fr/')).toBe('/fr')
    expect(linkPath('/')).toBe('/')
    expect(linkPath('')).toBe('/')
  })
})

describe('pageLinks', () => {
  it('maps every address to its page and locale', () => {
    expect(
      pageLinks([
        { id: 1, paths: { en: '/', fr: '/fr/' } },
        { id: 6, paths: { en: '/work/', fr: '/fr/projets/' } },
      ]),
    ).toEqual({
      '/': [1, 'en'],
      '/fr': [1, 'fr'],
      '/work': [6, 'en'],
      '/fr/projets': [6, 'fr'],
    })
  })

  it('skips a locale the page has no address in', () => {
    expect(pageLinks([{ id: 3, paths: { en: '/contact/', fr: undefined } }])).toEqual({ '/contact': [3, 'en'] })
  })
})

describe('pageResolver', () => {
  const resolve = pageResolver({
    collection: 'pages',
    links: { '/': [1, 'en'], '/fr/à-propos': [2, 'fr'], '/plain': [3] },
    origins: ['https://www.example.com/'],
  })
  const link = document.createElement('a')
  const at = (href: string) => resolve(new URL(href, location.href), link)

  it('resolves links of the preview origin and of the site', () => {
    expect(at('/')).toEqual({ collection: 'pages', id: 1, locale: 'en' })
    expect(at('https://www.example.com/fr/%C3%A0-propos/?x=1#top')).toEqual({ collection: 'pages', id: 2, locale: 'fr' })
    expect(at('/plain/')).toEqual({ collection: 'pages', id: 3 })
  })

  it('resolves nothing elsewhere', () => {
    expect(at('https://other.example.com/')).toBeNull()
    expect(at('/unknown')).toBeNull()
    expect(at('/constructor')).toBeNull()
    expect(at('/%E0%A4%A')).toBeNull()
  })
})
