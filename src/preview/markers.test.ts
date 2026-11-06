import { describe, expect, it } from 'vitest'

import { BLOCK_MARKER_PATTERN, BLOCKS_END, blockAttributes, blockMarker, editable, readBlockMarker } from './markers'

const text = (comment: string) => comment.replace(/^<!--|-->$/g, '')

describe('blockMarker', () => {
  it('carries the index and type of the block', () => {
    expect(blockMarker(3, 'closingCta')).toBe('<!--preview-block:3:closingCta-->')
    expect(BLOCK_MARKER_PATTERN.exec(text(blockMarker(3, 'closingCta')))?.slice(1)).toEqual(['3', 'closingCta'])
    expect(readBlockMarker(text(blockMarker(3, 'closingCta')))).toEqual({ index: 3, blockType: 'closingCta' })
  })

  it('cannot close the comment early', () => {
    expect(blockMarker(0, 'x-->')).toBe('<!--preview-block:0:x-->')
  })

  it('keeps the index a row', () => {
    expect(blockMarker(-1, 'hero')).toBe('<!--preview-block:0:hero-->')
    expect(blockMarker(2.7, 'hero')).toBe('<!--preview-block:2:hero-->')
  })

  it('end marker is not a block', () => {
    expect(readBlockMarker(text(BLOCKS_END))).toBeNull()
  })
})

describe('blockAttributes', () => {
  it('marks the root element of a block', () => {
    expect(blockAttributes(true, 2, 'media-text')).toEqual({
      'data-preview-block': '2',
      'data-preview-block-type': 'mediatext',
    })
  })

  it('adds nothing outside the preview', () => {
    expect(blockAttributes(false, 2, 'hero')).toEqual({})
    expect(blockAttributes({ preview: false }, 2, 'hero')).toEqual({})
  })
})

describe('editable', () => {
  it('ties an element to a field of its block in the preview', () => {
    const edit = editable({ preview: true })
    expect(edit('title')).toEqual({ 'data-preview-field': 'title' })
    expect(edit(`items.${2}.title`)).toEqual({ 'data-preview-field': 'items.2.title' })
    expect(editable(true)('title')).toEqual({ 'data-preview-field': 'title' })
  })

  it('prefixes paths of a nested component', () => {
    expect(editable({ preview: true }, 'items.2')('title')).toEqual({ 'data-preview-field': 'items.2.title' })
    expect(editable({ preview: true }, 'items')(2)).toEqual({ 'data-preview-field': 'items.2' })
  })

  it('adds nothing outside the preview', () => {
    expect(editable({})('title')).toEqual({})
    expect(editable({ preview: false }, 'items')(0)).toEqual({})
    expect(editable(undefined)('title')).toEqual({})
    expect(editable(null)('title')).toEqual({})
  })
})
