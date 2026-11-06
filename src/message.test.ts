import { describe, expect, it } from 'vitest'

import {
  PREVIEW_CLICK,
  PREVIEW_NAVIGATE,
  isDocumentId,
  isFieldPath,
  previewClickMessage,
  previewNavigateMessage,
  previewOrigin,
  readPreviewClick,
  readPreviewNavigate,
} from './message'

const origin = 'http://localhost:4321'
const click = (data: unknown, from = origin) => readPreviewClick({ data, origin: from }, { origin, path: 'layout' })

describe('previewOrigin', () => {
  it('keeps the origin of the preview link', () => {
    expect(previewOrigin('http://localhost:4321/_preview/?id=3&token=x')).toBe(origin)
  })

  it('has none without a valid link', () => {
    expect(previewOrigin(undefined)).toBeNull()
    expect(previewOrigin(null)).toBeNull()
    expect(previewOrigin('')).toBeNull()
    expect(previewOrigin('not a url')).toBeNull()
  })
})

describe('readPreviewClick', () => {
  it('reads the block a click from the preview points to', () => {
    expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 3 })).toEqual({ index: 3 })
    expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 0 })).toEqual({ index: 0 })
  })

  it('reads the field inside the block', () => {
    expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 3, field: 'items.2.question' })).toEqual({
      index: 3,
      field: 'items.2.question',
    })
    expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 3, field: 'items.2' })).toEqual({
      index: 3,
      field: 'items.2',
    })
  })

  it('ignores field paths that are not field names and row indexes', () => {
    for (const field of ['', '2', 'items..2', 'items.2.', 'a"] , b', 'title -->', 'x'.repeat(201), 3]) {
      expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 3, field })).toBeNull()
    }
  })

  it('ignores messages from any other origin', () => {
    expect(click({ type: PREVIEW_CLICK, path: 'layout', index: 3 }, 'https://evil.example')).toBeNull()
    expect(
      readPreviewClick(
        { data: { type: PREVIEW_CLICK, path: 'layout', index: 3 }, origin },
        { origin: null, path: 'layout' },
      ),
    ).toBeNull()
  })

  it('ignores other messages and other fields', () => {
    expect(click({ type: 'payload-live-preview', ready: true })).toBeNull()
    expect(click({ type: PREVIEW_CLICK, path: 'sections', index: 3 })).toBeNull()
    expect(click('payload-preview-click')).toBeNull()
    expect(click(null)).toBeNull()
  })

  it('ignores indexes that cannot be a row', () => {
    for (const index of [-1, 1.5, '3', Number.NaN, undefined]) {
      expect(click({ type: PREVIEW_CLICK, path: 'layout', index })).toBeNull()
    }
  })
})

describe('readPreviewNavigate', () => {
  const expected = { collection: 'pages', locales: ['en', 'fr'], origin }
  const navigate = (data: unknown, from = origin) => readPreviewNavigate({ data, origin: from }, expected)

  it('reads the page a preview link points to', () => {
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id: 4 })).toEqual({ id: 4 })
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id: 4, locale: 'fr' })).toEqual({
      id: 4,
      locale: 'fr',
    })
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id: '65f1c0ffee' })).toEqual({ id: '65f1c0ffee' })
  })

  it('ignores messages from any other origin', () => {
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id: 4 }, 'https://evil.example')).toBeNull()
    expect(
      readPreviewNavigate(
        { data: { type: PREVIEW_NAVIGATE, collection: 'pages', id: 4 }, origin },
        { ...expected, origin: null },
      ),
    ).toBeNull()
  })

  it('only opens pages of the collection being edited', () => {
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'posts', id: 4 })).toBeNull()
    expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'users', id: 1 })).toBeNull()
    expect(navigate({ type: PREVIEW_CLICK, collection: 'pages', id: 4 })).toBeNull()
  })

  it('ignores ids and locales that are not valid', () => {
    for (const id of [0, -1, 1.5, Number.NaN, '', '../users/1', '4?depth=9', 'x'.repeat(65), null, undefined]) {
      expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id })).toBeNull()
    }
    for (const locale of ['de', '', 'en&x=1', 2, null]) {
      expect(navigate({ type: PREVIEW_NAVIGATE, collection: 'pages', id: 4, locale })).toBeNull()
    }
  })
})

describe('message builders', () => {
  it('build messages the admin reads back', () => {
    const clicked = previewClickMessage('layout', { index: 2, field: 'items.0.title' })
    expect(clicked).toEqual({ type: PREVIEW_CLICK, path: 'layout', index: 2, field: 'items.0.title' })
    expect(click(clicked)).toEqual({ index: 2, field: 'items.0.title' })
    expect(previewClickMessage('layout', { index: 2 })).not.toHaveProperty('field')

    const navigated = previewNavigateMessage('pages', { id: 7, locale: 'fr' })
    expect(navigated).toEqual({ type: PREVIEW_NAVIGATE, collection: 'pages', id: 7, locale: 'fr' })
    expect(readPreviewNavigate({ data: navigated, origin }, { collection: 'pages', locales: ['fr'], origin })).toEqual({
      id: 7,
      locale: 'fr',
    })
    expect(previewNavigateMessage('pages', { id: 7 })).not.toHaveProperty('locale')
  })
})

describe('validators', () => {
  it('accept field paths and document ids', () => {
    expect(isFieldPath('items.2.title')).toBe(true)
    expect(isFieldPath('2.title')).toBe(false)
    expect(isDocumentId(3)).toBe(true)
    expect(isDocumentId('a1b2-c3')).toBe(true)
    expect(isDocumentId('a/b')).toBe(false)
  })
})
